const { getDb } = require('../database/connection');
const AnalyticsService = require('./analytics.service');

/**
 * Service for handling data exports.
 */
class ExportService {
  /**
   * Helper to convert an array of objects to CSV string.
   * @param {Array} headers - Column headers.
   * @param {Array} rows - Array of data objects.
   * @returns {string} CSV formatted string.
   */
  static arrayToCSV(headers, rows) {
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of rows) {
      const values = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        // Escape quotes and wrap in quotes if contains comma
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Exports all books to CSV.
   * @returns {string} CSV string.
   */
  static exportBooksCSV() {
    const db = getDb();
    const books = db.prepare(`
      SELECT b.id, b.isbn, b.title, a.name as author_name, c.name as category_name,
             b.publication_year, b.publisher, b.total_copies, b.available_copies
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.is_deleted = 0
    `).all();

    if (books.length === 0) return '';

    const headers = ['id', 'isbn', 'title', 'author_name', 'category_name', 'publication_year', 'publisher', 'total_copies', 'available_copies'];
    return this.arrayToCSV(headers, books);
  }

  /**
   * Exports borrow records to CSV.
   * @param {Object} filters - Filtering options.
   * @returns {string} CSV string.
   */
  static exportBorrowsCSV({ status, from_date, to_date }) {
    const db = getDb();
    
    let query = `
      SELECT br.id, u.username as user, b.title as book, br.borrow_date, 
             br.due_date, br.return_date, br.status
      FROM borrow_records br
      JOIN users u ON br.user_id = u.id
      JOIN books b ON br.book_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND br.status = ?`;
      params.push(status);
    }
    if (from_date) {
      query += ` AND br.borrow_date >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      query += ` AND br.borrow_date <= ?`;
      params.push(to_date);
    }

    const records = db.prepare(query).all(...params);

    if (records.length === 0) return '';

    const headers = ['id', 'user', 'book', 'borrow_date', 'due_date', 'return_date', 'status'];
    return this.arrayToCSV(headers, records);
  }

  /**
   * Exports fine records to CSV.
   * @param {Object} filters - Filtering options (status).
   * @returns {string} CSV string.
   */
  static exportFinesCSV({ status } = {}) {
    const db = getDb();
    let query = `
      SELECT f.id, u.username as user, b.title as book, f.amount, f.status, f.created_at, f.paid_at
      FROM fines f
      JOIN users u ON f.user_id = u.id
      JOIN borrow_records br ON f.borrow_record_id = br.id
      JOIN books b ON br.book_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      query += ` AND f.status = ?`;
      params.push(status);
    }
    const records = db.prepare(query).all(...params);
    if (records.length === 0) return '';
    const headers = ['id', 'user', 'book', 'amount', 'status', 'created_at', 'paid_at'];
    return this.arrayToCSV(headers, records);
  }

  /**
   * Exports an analytics report.
   * @returns {string} JSON formatted string report.
   */
  static exportAnalyticsReport() {
    const stats = AnalyticsService.getDashboardStats();
    const popularBooks = AnalyticsService.getPopularBooks(10);
    const categoryDistribution = AnalyticsService.getCategoryDistribution();

    const report = {
      generated_at: new Date().toISOString(),
      dashboard_stats: stats,
      popular_books: popularBooks,
      category_distribution: categoryDistribution
    };

    return JSON.stringify(report, null, 2);
  }
}

module.exports = ExportService;
