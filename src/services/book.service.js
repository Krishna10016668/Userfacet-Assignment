const { getDb } = require('../database/connection');
const config = require('../config');
const { generateUUID, calculatePagination, validateISBN } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const aiService = require('./ai.service');

/**
 * Book Service
 * Handles book inventory, searching, recommendations and summaries.
 */
class BookService {
  /**
   * Get all books with filtering and pagination
   * @param {Object} query - Query parameters
   * @returns {Object} Books array and pagination metadata
   */
  getAllBooks({ page = 1, limit = 10, sort_by = 'created_at', sort_order = 'DESC', category_id, author_id, language, available }) {
    const db = getDb();
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    let whereClause = 'WHERE b.is_deleted = 0';
    const params = [];
    
    if (category_id) {
      whereClause += ' AND b.category_id = ?';
      params.push(category_id);
    }
    if (author_id) {
      whereClause += ' AND b.author_id = ?';
      params.push(author_id);
    }
    if (language) {
      whereClause += ' AND b.language = ?';
      params.push(language);
    }
    if (available === 'true') {
      whereClause += ' AND b.available_copies > 0';
    }
    
    // Validate sort fields to prevent SQL injection
    const validSortFields = ['title', 'published_year', 'created_at', 'available_copies'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const order = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    const countQuery = `SELECT COUNT(*) as total FROM books b ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;
    
    const dataQuery = `
      SELECT b.*, a.name as author_name, c.name as category_name
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.${sortField} ${order}
      LIMIT ? OFFSET ?
    `;
    
    const books = db.prepare(dataQuery).all(...params, sqlLimit, offset);
    
    return {
      books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / sqlLimit)
      }
    };
  }

  /**
   * Get a single book by ID
   * @param {string} id - Book ID
   * @returns {Object} Book details
   */
  getBookById(id) {
    const db = getDb();
    const book = db.prepare(`
      SELECT b.*, a.name as author_name, c.name as category_name
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ? AND b.is_deleted = 0
    `).get(id);
    
    if (!book) {
      throw new AppError('Book not found', 404);
    }
    
    // Add extra stats like reviews count
    const stats = db.prepare('SELECT COUNT(*) as review_count, AVG(rating) as avg_rating FROM reviews WHERE book_id = ?').get(id);
    book.review_count = stats.review_count || 0;
    book.avg_rating = stats.avg_rating ? parseFloat(stats.avg_rating.toFixed(2)) : null;
    
    return book;
  }

  /**
   * Search books with full-text search capability
   * @param {Object} params - Search parameters
   * @returns {Object} Search results and pagination
   */
  searchBooks({ q = '', category_id, author_id, language, year_from, year_to, available, page = 1, limit = 10 }) {
    const db = getDb();
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    let whereClause = 'WHERE b.is_deleted = 0';
    const params = [];
    
    if (q) {
      whereClause += ' AND (b.title LIKE ? OR b.description LIKE ? OR a.name LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (category_id) { whereClause += ' AND b.category_id = ?'; params.push(category_id); }
    if (author_id) { whereClause += ' AND b.author_id = ?'; params.push(author_id); }
    if (language) { whereClause += ' AND b.language = ?'; params.push(language); }
    if (year_from) { whereClause += ' AND b.published_year >= ?'; params.push(year_from); }
    if (year_to) { whereClause += ' AND b.published_year <= ?'; params.push(year_to); }
    if (available === 'true') { whereClause += ' AND b.available_copies > 0'; }
    
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM books b 
      LEFT JOIN authors a ON b.author_id = a.id 
      ${whereClause}
    `;
    const total = db.prepare(countQuery).get(...params).total;
    
    const dataQuery = `
      SELECT b.*, a.name as author_name, c.name as category_name
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const books = db.prepare(dataQuery).all(...params, sqlLimit, offset);
    
    return {
      books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / sqlLimit)
      }
    };
  }

  /**
   * Create a new book
   * @param {Object} bookData - Book details
   * @returns {Object} Created book
   */
  createBook(bookData) {
    const db = getDb();
    
    // Validate author and category exist
    const author = db.prepare('SELECT id FROM authors WHERE id = ?').get(bookData.author_id);
    if (!author) throw new AppError('Author not found', 404);
    
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(bookData.category_id);
    if (!category) throw new AppError('Category not found', 404);
    
    // Validate ISBN
    if (bookData.isbn && !validateISBN(bookData.isbn)) {
      throw new AppError('Invalid ISBN format', 400);
    }
    
    // Check duplicate ISBN
    if (bookData.isbn) {
      const existing = db.prepare('SELECT id FROM books WHERE isbn = ? AND is_deleted = 0').get(bookData.isbn);
      if (existing) throw new AppError('Book with this ISBN already exists', 409);
    }
    
    const id = generateUUID();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO books (
        id, title, author_id, category_id, isbn, publisher, 
        published_year, language, total_copies, available_copies, 
        description, cover_image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, bookData.title, bookData.author_id, bookData.category_id, 
      bookData.isbn || null, bookData.publisher || null, 
      bookData.published_year || null, bookData.language || 'English', 
      bookData.total_copies, bookData.total_copies, 
      bookData.description || null, bookData.cover_image_url || null,
      now, now
    );
    
    return this.getBookById(id);
  }

  /**
   * Update an existing book
   * @param {string} id - Book ID
   * @param {Object} bookData - Fields to update
   * @returns {Object} Updated book
   */
  updateBook(id, bookData) {
    const db = getDb();
    
    const existing = db.prepare('SELECT id FROM books WHERE id = ? AND is_deleted = 0').get(id);
    if (!existing) throw new AppError('Book not found', 404);
    
    const updates = [];
    const params = [];
    
    // Filter allowed fields
    const allowedFields = ['title', 'author_id', 'category_id', 'isbn', 'publisher', 'published_year', 'language', 'total_copies', 'available_copies', 'description', 'cover_image_url'];
    
    for (const key of Object.keys(bookData)) {
      if (allowedFields.includes(key) && bookData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(bookData[key]);
      }
    }
    
    if (updates.length === 0) return this.getBookById(id);
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    db.prepare(`UPDATE books SET ${updates.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...params);
    
    return this.getBookById(id);
  }

  /**
   * Soft delete a book
   * @param {string} id - Book ID
   * @returns {Object} Success message
   */
  deleteBook(id) {
    const db = getDb();
    
    const book = db.prepare('SELECT id FROM books WHERE id = ? AND is_deleted = 0').get(id);
    if (!book) throw new AppError('Book not found', 404);
    
    // Check for active borrows
    const activeBorrows = db.prepare(`
      SELECT COUNT(*) as count FROM borrow_records 
      WHERE book_id = ? AND status = 'ACTIVE'
    `).get(id);
    
    if (activeBorrows.count > 0) {
      throw new AppError('Cannot delete book with active borrows', 400);
    }
    
    db.prepare('UPDATE books SET is_deleted = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    
    return { message: 'Book deleted successfully' };
  }

  /**
   * Get popular books based on borrow frequency
   * @param {number} limit - Number of books to return
   * @returns {Array} List of popular books
   */
  getPopularBooks(limit = 10) {
    const db = getDb();
    
    // Order by borrow count first, then rating
    return db.prepare(`
      SELECT b.*, a.name as author_name, c.name as category_name,
        (SELECT COUNT(*) FROM borrow_records WHERE book_id = b.id) as borrow_count,
        (SELECT AVG(rating) FROM reviews WHERE book_id = b.id) as avg_rating
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.is_deleted = 0
      ORDER BY borrow_count DESC, avg_rating DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Generate or retrieve an AI summary for a book
   * @param {string} bookId - Book ID
   * @param {string} summaryType - Type of summary (brief, detailed, chapter_wise)
   * @returns {Object} Book summary
   */
  async getBookSummary(bookId, summaryType = 'brief') {
    const db = getDb();
    const book = this.getBookById(bookId);
    
    // Check cache
    const now = new Date().toISOString();
    const cached = db.prepare(`
      SELECT summary_text 
      FROM ai_summaries 
      WHERE book_id = ? AND summary_type = ? AND expires_at > ?
    `).get(bookId, summaryType, now);
    
    if (cached) {
      return { summary: cached.summary_text, source: 'cache' };
    }
    
    // Not in cache, call AI service
    const aiData = await aiService.generateSummary({
      book_id: book.id,
      title: book.title,
      description: book.description,
      author: book.author_name,
      category: book.category_name,
      summary_type: summaryType
    });
    
    // Save to cache (30 days expiry)
    if (aiData && aiData.summary_text && aiData.token_count > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (config.SUMMARY_CACHE_DAYS || 30));
      
      db.prepare(`
        INSERT OR IGNORE INTO ai_summaries (id, book_id, summary_type, summary_text, token_count, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateUUID(), bookId, summaryType, aiData.summary_text, 
        aiData.token_count || 0, now, expiresAt.toISOString()
      );
    }
    
    return { summary: aiData.summary_text, source: 'ai' };
  }

  /**
   * Generate AI recommendations based on a book
   * @param {string} bookId - Book ID
   * @returns {Array} Recommended books list
   */
  async getBookRecommendations(bookId) {
    const book = this.getBookById(bookId);
    
    return aiService.generateRecommendations({
      book_id: book.id,
      title: book.title,
      description: book.description,
      author: book.author_name,
      category: book.category_name
    });
  }

  /**
   * Collaborative Filtering: Discover books frequently borrowed together by readers
   * @param {string} bookId - Source book ID
   * @param {number} [limit=5] - Number of recommendations
   * @returns {Array} List of co-borrowed books with co-borrow frequency metrics
   */
  getAlsoBorrowed(bookId, limit = 5) {
    const db = getDb();
    const book = this.getBookById(bookId);

    // SQL Collaborative Filtering Algorithm:
    // 1. Find all users who borrowed this book
    // 2. Find other books checked out by those same users
    // 3. Rank books by co-occurrence count
    const coBorrowedBooks = db.prepare(`
      SELECT 
        b.id, b.title, b.isbn, b.cover_image_url, b.avg_rating, b.available_copies,
        a.name as author_name, c.name as category_name,
        COUNT(DISTINCT br_other.user_id) as co_borrow_count
      FROM borrow_records br_target
      JOIN borrow_records br_other ON br_target.user_id = br_other.user_id AND br_other.book_id != ?
      JOIN books b ON br_other.book_id = b.id
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE br_target.book_id = ? AND b.is_deleted = 0
      GROUP BY b.id
      ORDER BY co_borrow_count DESC, b.avg_rating DESC
      LIMIT ?
    `).all(bookId, bookId, parseInt(limit, 10));

    // If insufficient co-borrow data (cold start), fallback to high-rated books in same category
    if (coBorrowedBooks.length === 0) {
      return db.prepare(`
        SELECT 
          b.id, b.title, b.isbn, b.cover_image_url, b.avg_rating, b.available_copies,
          a.name as author_name, c.name as category_name,
          0 as co_borrow_count,
          'Similar category recommendation' as match_reason
        FROM books b
        LEFT JOIN authors a ON b.author_id = a.id
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE b.category_id = ? AND b.id != ? AND b.is_deleted = 0
        ORDER BY b.avg_rating DESC, b.created_at DESC
        LIMIT ?
      `).all(book.category_id, bookId, parseInt(limit, 10)).map(b => ({
        ...b,
        match_reason: `Popular choice in ${b.category_name || 'this category'}`
      }));
    }

    return coBorrowedBooks.map(b => ({
      ...b,
      match_reason: `${b.co_borrow_count} reader(s) who checked out "${book.title}" also borrowed this book`
    }));
  }
  /**
   * Ask AI a question about a book
   * @param {string} bookId - Book ID
   * @param {string} question - User question
   * @returns {Promise<Object>} AI response
   */
  async askBookQuestion(bookId, question) {
    const book = this.getBookById(bookId);
    return aiService.askBook({ 
      book_id: book.id, 
      title: book.title, 
      description: book.description, 
      author: book.author_name, 
      category: book.category_name, 
      question 
    });
  }

  /**
   * Generate AI quiz for a book
   * @param {string} bookId - Book ID
   * @param {number} numQuestions - Number of questions
   * @returns {Promise<Object>} Quiz data
   */
  async getBookQuiz(bookId, numQuestions = 5) {
    const book = this.getBookById(bookId);
    return aiService.generateQuiz({ 
      book_id: book.id, 
      title: book.title, 
      description: book.description, 
      author: book.author_name, 
      category: book.category_name, 
      num_questions: numQuestions 
    });
  }

  /**
   * Generate AI review digest
   * @param {string} bookId - Book ID
   * @returns {Promise<Object>} Review digest data
   */
  async getReviewDigest(bookId) {
    const book = this.getBookById(bookId);
    const db = getDb();
    const reviews = db.prepare('SELECT r.rating, r.review_text, u.username FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.book_id = ?').all(bookId);
    
    if (!reviews || reviews.length === 0) {
      throw new AppError('No reviews found for this book', 404);
    }
    
    return aiService.generateReviewDigest({ 
      book_id: book.id, 
      title: book.title, 
      author: book.author_name, 
      reviews 
    });
  }
}

module.exports = new BookService();
