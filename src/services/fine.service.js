const { getDb } = require('../database/connection');
const { FINE_STATUS, HTTP_STATUS } = require('../utils/constants');
const { getCurrentTimestamp } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

/**
 * Service to handle fine related operations.
 */
class FineService {
  /**
   * Retrieves user's fines.
   * @param {string} userId - The ID of the user.
   * @param {Object} options - Status filter and pagination options.
   * @returns {Object} Paginated fines.
   */
  static getUserFines(userId, { status, page = 1, limit = 10 }) {
    const db = getDb();
    const offset = (page - 1) * limit;

    let query = `
      SELECT f.*, b.title as book_title, br.borrow_date, br.due_date 
      FROM fines f
      JOIN borrow_records br ON f.borrow_record_id = br.id
      JOIN books b ON br.book_id = b.id
      WHERE f.user_id = ?
    `;
    const params = [userId];

    if (status) {
      query += ` AND f.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY f.created_at DESC LIMIT ? OFFSET ?`;
    const allParams = [...params, limit, offset];
    
    const items = db.prepare(query).all(...allParams);

    // Count query
    let countQuery = `SELECT COUNT(*) as count FROM fines WHERE user_id = ?`;
    const countParams = [userId];
    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }
    const total = db.prepare(countQuery).get(...countParams).count;

    return {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Retrieves all fines (Admin only).
   * @param {Object} options - Filters and pagination options.
   * @returns {Object} Paginated fines.
   */
  static getAllFines({ user_id, status, page = 1, limit = 10 }) {
    const db = getDb();
    const offset = (page - 1) * limit;

    let query = `
      SELECT f.*, u.username, u.full_name, b.title as book_title
      FROM fines f
      JOIN users u ON f.user_id = u.id
      JOIN borrow_records br ON f.borrow_record_id = br.id
      JOIN books b ON br.book_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ` AND f.user_id = ?`;
      params.push(user_id);
    }
    if (status) {
      query += ` AND f.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY f.created_at DESC LIMIT ? OFFSET ?`;
    const allParams = [...params, limit, offset];
    
    const items = db.prepare(query).all(...allParams);

    // Count query
    let countQuery = `SELECT COUNT(*) as count FROM fines WHERE 1=1`;
    const countParams = [];
    if (user_id) {
      countQuery += ` AND user_id = ?`;
      countParams.push(user_id);
    }
    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }
    const total = db.prepare(countQuery).get(...countParams).count;

    return {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Pays a fine.
   * @param {string} fineId - The ID of the fine.
   * @param {string} userId - The user ID making the payment (or Admin).
   * @param {string} userRole - The role of the user.
   * @returns {Object} The updated fine.
   */
  static payFine(fineId, userId, userRole) {
    const db = getDb();
    const fine = db.prepare('SELECT * FROM fines WHERE id = ?').get(fineId);

    if (!fine) {
      throw new AppError('Fine not found', HTTP_STATUS.NOT_FOUND);
    }

    if (fine.user_id !== userId && userRole !== 'ADMIN') {
      throw new AppError('Unauthorized to pay this fine', HTTP_STATUS.FORBIDDEN);
    }

    if (fine.status !== FINE_STATUS.PENDING) {
      throw new AppError(`Fine is already ${fine.status}`, HTTP_STATUS.BAD_REQUEST);
    }

    const now = getCurrentTimestamp();
    db.prepare(`
      UPDATE fines SET status = ?, paid_at = ? WHERE id = ?
    `).run(FINE_STATUS.PAID, now, fineId);

    return db.prepare('SELECT * FROM fines WHERE id = ?').get(fineId);
  }

  /**
   * Waives a fine (Admin only).
   * @param {string} fineId - The ID of the fine.
   * @returns {Object} The updated fine.
   */
  static waiveFine(fineId) {
    const db = getDb();
    const fine = db.prepare('SELECT * FROM fines WHERE id = ?').get(fineId);

    if (!fine) {
      throw new AppError('Fine not found', HTTP_STATUS.NOT_FOUND);
    }

    if (fine.status !== FINE_STATUS.PENDING) {
      throw new AppError(`Cannot waive fine with status ${fine.status}`, HTTP_STATUS.BAD_REQUEST);
    }

    db.prepare(`
      UPDATE fines SET status = ? WHERE id = ?
    `).run(FINE_STATUS.WAIVED, fineId);

    return db.prepare('SELECT * FROM fines WHERE id = ?').get(fineId);
  }

  /**
   * Gets total unpaid fines for a user.
   * @param {string} userId - The user ID.
   * @returns {number} Total unpaid amount.
   */
  static getTotalUnpaidFines(userId) {
    const db = getDb();
    const result = db.prepare(`
      SELECT SUM(amount) as total FROM fines 
      WHERE user_id = ? AND status = ?
    `).get(userId, FINE_STATUS.PENDING);

    return result.total || 0;
  }
}

module.exports = FineService;
