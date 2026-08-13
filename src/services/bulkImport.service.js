const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp, validateISBN } = require('../utils/helpers');
const auditService = require('./audit.service');
const { AUDIT_ACTION, ENTITY_TYPE, ROLES } = require('../utils/constants');

/**
 * Bulk Import Service
 * Handles bulk CSV book imports with reference auto-creation and atomic transactions.
 */
class BulkImportService {
  /**
   * Parses raw CSV string into an array of objects
   * @param {string} csvText - Raw CSV content
   * @returns {Array<Object>} Parsed rows
   */
  parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];
    
    // Normalize newlines and split
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Helper to parse a CSV line supporting quoted fields
    const parseLine = (line) => {
      const values = [];
      let current = '';
      let insideQuote = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (insideQuote && line[i + 1] === char) {
            current += char;
            i++;
          } else {
            insideQuote = !insideQuote;
          }
        } else if (char === ',' && !insideQuote) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, '_'));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const rowObj = {};
      headers.forEach((header, idx) => {
        rowObj[header] = values[idx] !== undefined ? values[idx] : '';
      });
      rows.push({ rowIndex: i + 1, data: rowObj });
    }

    return rows;
  }

  /**
   * Imports books from a CSV string inside an atomic transaction
   * @param {string} csvContent - CSV string
   * @param {Object} actor - User performing the import { id, role }
   * @returns {Object} Detailed import summary report
   */
  importBooksFromCSV(csvContent, actor = { id: 'SYSTEM', role: ROLES.ADMIN }) {
    const db = getDb();
    const parsedRows = this.parseCSV(csvContent);

    if (parsedRows.length === 0) {
      return {
        total_rows: 0,
        imported_count: 0,
        skipped_count: 0,
        error_count: 0,
        imported_books: [],
        errors: [{ row: 0, reason: 'CSV is empty or missing valid headers' }]
      };
    }

    const report = {
      total_rows: parsedRows.length,
      imported_count: 0,
      skipped_count: 0,
      error_count: 0,
      imported_books: [],
      errors: []
    };

    const now = getCurrentTimestamp();

    // Run import inside SQLite Transaction for ACID safety
    const importTx = db.transaction(() => {
      for (const item of parsedRows) {
        const { rowIndex, data } = item;
        const title = data.title;
        const authorName = data.author || data.author_name;
        const categoryName = data.category || data.category_name;
        const isbn = data.isbn ? data.isbn.replace(/[-\s]/g, '') : null;
        const description = data.description || '';
        const publisher = data.publisher || '';
        const language = data.language || 'English';
        const publicationYear = parseInt(data.publication_year || data.published_year, 10) || null;
        const pageCount = parseInt(data.page_count || data.pages, 10) || 250;
        const totalCopies = Math.max(1, parseInt(data.total_copies || data.copies, 10) || 1);
        const coverImageUrl = data.cover_image_url || null;

        // Validation
        if (!title) {
          report.errors.push({ row: rowIndex, reason: 'Missing required field "title"' });
          report.error_count++;
          continue;
        }
        if (!authorName) {
          report.errors.push({ row: rowIndex, reason: `Missing required field "author" for "${title}"` });
          report.error_count++;
          continue;
        }
        if (!categoryName) {
          report.errors.push({ row: rowIndex, reason: `Missing required field "category" for "${title}"` });
          report.error_count++;
          continue;
        }

        // ISBN validation & duplicate check
        if (isbn) {
          if (!validateISBN(isbn)) {
            report.errors.push({ row: rowIndex, reason: `Invalid ISBN format: ${isbn}` });
            report.error_count++;
            continue;
          }
          const existingBook = db.prepare('SELECT id, title FROM books WHERE isbn = ? AND is_deleted = 0').get(isbn);
          if (existingBook) {
            report.skipped_count++;
            report.errors.push({ row: rowIndex, reason: `Skipped: ISBN "${isbn}" already exists ("${existingBook.title}")` });
            continue;
          }
        }

        // 1. Resolve or Create Author
        let author = db.prepare('SELECT id FROM authors WHERE LOWER(name) = LOWER(?)').get(authorName);
        let authorId;
        if (author) {
          authorId = author.id;
        } else {
          authorId = generateUUID();
          db.prepare(`
            INSERT INTO authors (id, name, biography, created_at)
            VALUES (?, ?, ?, ?)
          `).run(authorId, authorName, `Author of ${title}`, now);
        }

        // 2. Resolve or Create Category
        let category = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(categoryName);
        let categoryId;
        if (category) {
          categoryId = category.id;
        } else {
          categoryId = generateUUID();
          db.prepare(`
            INSERT INTO categories (id, name, description, created_at)
            VALUES (?, ?, ?, ?)
          `).run(categoryId, categoryName, `${categoryName} literature`, now);
        }

        // 3. Insert Book
        const bookId = generateUUID();
        db.prepare(`
          INSERT INTO books (
            id, isbn, title, description, author_id, category_id,
            publication_year, publisher, language, page_count,
            total_copies, available_copies, avg_rating, cover_image_url,
            is_deleted, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, 0, ?, ?)
        `).run(
          bookId, isbn || `GEN-${generateUUID().substring(0, 10)}`, title, description,
          authorId, categoryId, publicationYear, publisher, language, pageCount,
          totalCopies, totalCopies, coverImageUrl, now, now
        );

        report.imported_count++;
        report.imported_books.push({ id: bookId, title, author: authorName, category: categoryName, isbn });
      }
    });

    importTx();

    // Log administrative audit entry
    if (report.imported_count > 0 && actor && actor.id) {
      auditService.logAction({
        actor_id: actor.id,
        actor_role: actor.role || ROLES.ADMIN,
        action: AUDIT_ACTION.BULK_IMPORT,
        entity_type: ENTITY_TYPE.BOOK,
        details: {
          total_rows: report.total_rows,
          imported_count: report.imported_count,
          skipped_count: report.skipped_count,
          error_count: report.error_count
        }
      });
    }

    return report;
  }

  /**
   * Generates a sample CSV template for bulk book imports
   * @returns {string} CSV template string
   */
  getCSVTemplate() {
    return [
      'isbn,title,author,category,description,publisher,publication_year,language,page_count,total_copies',
      '9780141439518,Pride and Prejudice,Jane Austen,Classic Literature,A classic romantic novel of manners.,T. Egerton,1813,English,432,3',
      '9780061120084,To Kill a Mockingbird,Harper Lee,Historical Fiction,The unforgettable novel of a childhood in a sleepy Southern town.,J. B. Lippincott & Co.,1960,English,281,4',
      '9780345391803,The Hitchhiker\'s Guide to the Galaxy,Douglas Adams,Science Fiction,Seconds before Earth is demolished for a galactic freeway...,Pan Books,1979,English,224,2'
    ].join('\n');
  }
}

module.exports = new BulkImportService();
