const { getDb } = require('../database/connection');
const { BORROW_STATUS, FINE_STATUS } = require('../utils/constants');

/**
 * Service for analytics and reporting.
 */
class AnalyticsService {
  /**
   * Retrieves overall dashboard statistics.
   * @returns {Object} Dashboard stats.
   */
  static getDashboardStats() {
    const db = getDb();
    const stats = {};

    stats.total_books = db.prepare('SELECT COUNT(*) as count FROM books WHERE is_deleted = 0').get().count;
    stats.total_users = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    stats.active_borrows = db.prepare('SELECT COUNT(*) as count FROM borrow_records WHERE status = ?').get(BORROW_STATUS.ACTIVE).count;
    stats.overdue_borrows = db.prepare('SELECT COUNT(*) as count FROM borrow_records WHERE status = ?').get(BORROW_STATUS.OVERDUE).count;
    
    stats.total_fines_collected = db.prepare('SELECT SUM(amount) as total FROM fines WHERE status = ?').get(FINE_STATUS.PAID).total || 0;
    stats.pending_fines = db.prepare('SELECT SUM(amount) as total FROM fines WHERE status = ?').get(FINE_STATUS.PENDING).total || 0;

    // This month stats
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    
    stats.new_books_this_month = db.prepare('SELECT COUNT(*) as count FROM books WHERE created_at >= ? AND is_deleted = 0').get(firstDayOfMonth).count;
    stats.new_users_this_month = db.prepare('SELECT COUNT(*) as count FROM users WHERE created_at >= ? AND is_active = 1').get(firstDayOfMonth).count;
    stats.borrows_this_month = db.prepare('SELECT COUNT(*) as count FROM borrow_records WHERE created_at >= ?').get(firstDayOfMonth).count;

    return stats;
  }

  /**
   * Retrieves popular books based on borrow count.
   * @param {number} limit - Number of books to return.
   * @returns {Array} List of popular books.
   */
  static getPopularBooks(limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT b.id, b.title, b.author_id, b.cover_image_url, b.avg_rating, COUNT(br.id) as borrow_count
      FROM books b
      LEFT JOIN borrow_records br ON b.id = br.book_id
      WHERE b.is_deleted = 0
      GROUP BY b.id
      ORDER BY borrow_count DESC
      LIMIT ?
    `).all(parseInt(limit));
  }

  /**
   * Retrieves most active users.
   * @param {number} limit - Number of users to return.
   * @returns {Array} List of active users.
   */
  static getActiveUsers(limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT u.id, u.username, u.full_name, 
             COUNT(br.id) as borrow_count,
             SUM(CASE WHEN br.status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count
      FROM users u
      LEFT JOIN borrow_records br ON u.id = br.user_id
      WHERE u.is_active = 1
      GROUP BY u.id
      ORDER BY borrow_count DESC
      LIMIT ?
    `).all(parseInt(limit));
  }

  /**
   * Retrieves category distribution.
   * @returns {Array} Category distribution.
   */
  static getCategoryDistribution() {
    const db = getDb();
    return db.prepare(`
      SELECT c.name as category_name, 
             COUNT(DISTINCT b.id) as book_count,
             COUNT(br.id) as borrow_count
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id AND b.is_deleted = 0
      LEFT JOIN borrow_records br ON b.id = br.book_id
      GROUP BY c.id, c.name
      ORDER BY book_count DESC
    `).all();
  }

  /**
   * Retrieves borrow trends for the last N days.
   * @param {number} days - Number of days to include.
   * @returns {Array} Borrow trends.
   */
  static getBorrowTrends(days = 30) {
    const db = getDb();
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // SQLite strftime allows extracting dates
    return db.prepare(`
      SELECT date(created_at) as date,
             COUNT(*) as borrow_count,
             SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) as return_count
      FROM borrow_records
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all(fromDate);
  }

  /**
   * Retrieves a report of overdue borrows.
   * @returns {Array} Overdue report.
   */
  static getOverdueReport() {
    const db = getDb();
    return db.prepare(`
      SELECT br.id, br.borrow_date, br.due_date,
             u.username, u.email, u.full_name,
             b.title as book_title,
             CAST(julianday('now') - julianday(br.due_date) AS INTEGER) as days_overdue
      FROM borrow_records br
      JOIN users u ON br.user_id = u.id
      JOIN books b ON br.book_id = b.id
      WHERE br.status = ?
      ORDER BY days_overdue DESC
    `).all(BORROW_STATUS.OVERDUE).map(item => ({
      ...item,
      estimated_fine: item.days_overdue > 0 ? item.days_overdue * 2 : 0 // Assume fine rate is 2
    }));
  }
}

module.exports = AnalyticsService;
