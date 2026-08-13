const express = require('express');
const { getDb } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { buildResponse, calculatePagination } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route GET /api/users
 * @desc Get all users with pagination and filters
 * @access Private (Admin)
 */
router.get('/', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, role, is_active, search } = req.query;
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (role) { whereClause += ' AND role = ?'; params.push(role); }
    if (is_active !== undefined) { whereClause += ' AND is_active = ?'; params.push(is_active === 'true' ? 1 : 0); }
    if (search) { 
      whereClause += ' AND (full_name LIKE ? OR email LIKE ? OR username LIKE ?)'; 
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;
    
    const dataQuery = `
      SELECT id, email, username, full_name, role, max_books_allowed, is_active, created_at 
      FROM users 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const users = db.prepare(dataQuery).all(...params, sqlLimit, offset);
    
    res.status(200).json(buildResponse(true, users, 'Users retrieved successfully', {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / sqlLimit)
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * Helper to check authorization for self or admin/librarian
 */
const checkSelfOrRole = (req, targetId, allowedRoles = [ROLES.ADMIN]) => {
  if (req.user.id !== targetId && !allowedRoles.includes(req.user.role)) {
    throw new AppError('Forbidden: Access denied', 403);
  }
};

/**
 * @route GET /api/users/:id
 * @desc Get user profile with stats
 * @access Private (Self or Admin)
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    checkSelfOrRole(req, req.params.id, [ROLES.ADMIN]);
    
    const db = getDb();
    const user = db.prepare(`
      SELECT id, email, username, full_name, role, max_books_allowed, is_active, created_at 
      FROM users WHERE id = ?
    `).get(req.params.id);
    
    if (!user) throw new AppError('User not found', 404);
    
    const stats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_borrows,
        COUNT(*) as total_borrows
      FROM borrow_records WHERE user_id = ?
    `).get(user.id);
    
    const fines = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as unpaid_fines
      FROM fines WHERE user_id = ? AND status = 'PENDING'
    `).get(user.id);
    
    user.stats = {
      active_borrows: stats.active_borrows || 0,
      total_borrows: stats.total_borrows || 0,
      unpaid_fines: fines.unpaid_fines || 0
    };
    
    res.status(200).json(buildResponse(true, user, 'User profile retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/users/:id
 * @desc Update user profile
 * @access Private (Self or Admin)
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    checkSelfOrRole(req, req.params.id, [ROLES.ADMIN]);
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) throw new AppError('User not found', 404);
    
    const { full_name, max_books_allowed } = req.body;
    const updates = [];
    const params = [];
    
    if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
    if (max_books_allowed && req.user.role === ROLES.ADMIN) { 
      updates.push('max_books_allowed = ?'); params.push(max_books_allowed); 
    }
    
    if (updates.length > 0) {
      params.push(new Date().toISOString(), req.params.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...params);
    }
    
    const updated = db.prepare('SELECT id, email, username, full_name, role, max_books_allowed, is_active FROM users WHERE id = ?').get(req.params.id);
    res.status(200).json(buildResponse(true, updated, 'User updated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /api/users/:id
 * @desc Deactivate user
 * @access Private (Admin)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);
    res.status(200).json(buildResponse(true, null, 'User deactivated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/users/:id/history
 * @desc Get user's borrow history
 * @access Private (Self, Admin, Librarian)
 */
router.get('/:id/history', authenticate, async (req, res, next) => {
  try {
    checkSelfOrRole(req, req.params.id, [ROLES.ADMIN, ROLES.LIBRARIAN]);
    
    const db = getDb();
    const { page = 1, limit = 10 } = req.query;
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    const count = db.prepare('SELECT COUNT(*) as total FROM borrow_records WHERE user_id = ?').get(req.params.id).total;
    
    const records = db.prepare(`
      SELECT br.*, b.title as book_title, b.cover_image_url
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      WHERE br.user_id = ?
      ORDER BY br.borrow_date DESC
      LIMIT ? OFFSET ?
    `).all(req.params.id, sqlLimit, offset);
    
    res.status(200).json(buildResponse(true, records, 'History retrieved successfully', {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / sqlLimit)
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/users/:id/fines
 * @desc Get user's fines
 * @access Private (Self or Admin)
 */
router.get('/:id/fines', authenticate, async (req, res, next) => {
  try {
    checkSelfOrRole(req, req.params.id, [ROLES.ADMIN]);
    
    const db = getDb();
    const fines = db.prepare(`
      SELECT f.*, br.book_id, b.title as book_title
      FROM fines f
      JOIN borrow_records br ON f.borrow_record_id = br.id
      JOIN books b ON br.book_id = b.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(req.params.id);
    
    res.status(200).json(buildResponse(true, fines, 'Fines retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/users/:id/reading-lists
 * @desc Get user's reading lists
 * @access Private (Self or public lists only)
 */
router.get('/:id/reading-lists', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    let query = 'SELECT * FROM reading_lists WHERE user_id = ?';
    
    if (req.user.id !== req.params.id) {
      query += ' AND is_public = 1';
    }
    query += ' ORDER BY created_at DESC';
    
    const lists = db.prepare(query).all(req.params.id);
    res.status(200).json(buildResponse(true, lists, 'Reading lists retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
