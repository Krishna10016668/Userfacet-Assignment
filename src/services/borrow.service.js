const { getDb } = require('../database/connection');
const config = require('../config');
const { generateUUID, calculateDueDate, calculatePagination, calculateOverdueDays, calculateFine } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const { BORROW_STATUS, RESERVATION_STATUS, FINE_STATUS, NOTIFICATION_TYPE, AUDIT_ACTION, ENTITY_TYPE, ROLES } = require('../utils/constants');
const auditService = require('./audit.service');

/**
 * Borrow Service
 * Handles book borrowing, returns, renewals, and related fines/reservations
 */
class BorrowService {
  
  /**
   * Process borrowing a book
   * @param {string} userId - User borrowing the book
   * @param {string} bookId - Book being borrowed
   * @returns {Object} Borrow record
   */
  borrowBook(userId, bookId) {
    const db = getDb();
    
    // Validate user
    const user = db.prepare('SELECT id, is_active, max_books_allowed FROM users WHERE id = ?').get(userId);
    if (!user || !user.is_active) throw new AppError('User not active or not found', 400);
    
    // Check pending fines
    const hasUnpaidFines = db.prepare('SELECT id FROM fines WHERE user_id = ? AND status = ?').get(userId, FINE_STATUS.PENDING);
    if (hasUnpaidFines) throw new AppError('Cannot borrow books with unpaid fines', 400);
    
    // Check max allowed
    const activeCount = db.prepare('SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND status = ?').get(userId, BORROW_STATUS.ACTIVE).count;
    if (activeCount >= user.max_books_allowed) throw new AppError(`Maximum limit of ${user.max_books_allowed} books reached`, 400);
    
    // Validate book
    const book = db.prepare('SELECT id, available_copies, is_deleted FROM books WHERE id = ?').get(bookId);
    if (!book || book.is_deleted) throw new AppError('Book not found', 404);
    if (book.available_copies <= 0) throw new AppError('No copies available currently', 400);
    
    // Check if user already borrowed this book
    const alreadyBorrowed = db.prepare('SELECT id FROM borrow_records WHERE user_id = ? AND book_id = ? AND status = ?').get(userId, bookId, BORROW_STATUS.ACTIVE);
    if (alreadyBorrowed) throw new AppError('You have already borrowed this book', 400);
    
    // Transact borrowing
    const borrowId = generateUUID();
    const now = new Date().toISOString();
    const maxDays = config.MAX_BORROW_DAYS || 14;
    const dueDate = calculateDueDate(now, maxDays);
    
    const tx = db.transaction(() => {
      // 1. Create record
      db.prepare(`
        INSERT INTO borrow_records (id, user_id, book_id, borrow_date, due_date, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(borrowId, userId, bookId, now, dueDate, BORROW_STATUS.ACTIVE);
      
      // 2. Decrement copies
      db.prepare('UPDATE books SET available_copies = available_copies - 1, updated_at = ? WHERE id = ?').run(now, bookId);
    });
    
    tx();
    
    // Log audit trail
    auditService.logAction({
      actor_id: userId,
      actor_role: ROLES.MEMBER,
      action: AUDIT_ACTION.BORROW,
      entity_type: ENTITY_TYPE.BORROW,
      entity_id: borrowId,
      details: { book_id: bookId, due_date: dueDate }
    });

    return this.getBorrowRecord(borrowId);
  }

  /**
   * Process book return and assess fines
   * @param {string} borrowId - Borrow record ID
   * @param {string} reqUserId - User requesting return (for validation)
   * @param {string} userRole - Role of requester
   * @returns {Object} Updated borrow record and fine info
   */
  returnBook(borrowId, reqUserId, userRole) {
    const db = getDb();
    
    const record = db.prepare('SELECT * FROM borrow_records WHERE id = ?').get(borrowId);
    if (!record) throw new AppError('Borrow record not found', 404);
    
    // Auth validation
    if (record.user_id !== reqUserId && userRole === 'MEMBER') {
      throw new AppError('Unauthorized to return this book', 403);
    }
    
    if (record.status === BORROW_STATUS.RETURNED) {
      throw new AppError('Book already returned', 400);
    }
    
    const now = new Date().toISOString();
    const overdueDays = calculateOverdueDays(record.due_date, now);
    let fineAmount = 0;
    
    const tx = db.transaction(() => {
      // 1. Mark returned
      db.prepare(`
        UPDATE borrow_records SET status = ?, return_date = ? WHERE id = ?
      `).run(BORROW_STATUS.RETURNED, now, borrowId);
      
      // 2. Increment book copies
      db.prepare('UPDATE books SET available_copies = available_copies + 1, updated_at = ? WHERE id = ?').run(now, record.book_id);
      
      // 3. Process fine if overdue
      if (overdueDays > 0) {
        fineAmount = calculateFine(overdueDays, config.FINE_RATE_PER_DAY || 2);
        const fineId = generateUUID();
        db.prepare(`
          INSERT INTO fines (id, user_id, borrow_record_id, amount, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(fineId, record.user_id, borrowId, fineAmount, FINE_STATUS.PENDING, now);
      }
      
      // 4. Handle reservations (fulfill first pending one)
      const reservation = db.prepare(`
        SELECT id, user_id FROM reservations 
        WHERE book_id = ? AND status = ? 
        ORDER BY created_at ASC LIMIT 1
      `).get(record.book_id, RESERVATION_STATUS.PENDING);
      
      if (reservation) {
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + (config.RESERVATION_EXPIRY_HOURS || 48));
        
        db.prepare('UPDATE reservations SET status = ?, expires_at = ? WHERE id = ?')
          .run(RESERVATION_STATUS.FULFILLED, expiry.toISOString(), reservation.id);
          
        // Create notification
        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, type, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(generateUUID(), reservation.user_id, 'Reservation Ready', 'A book you reserved is now available!', NOTIFICATION_TYPE.RESERVATION_READY, now);
      }
    });
    
    tx();
    
    // Log audit trail
    auditService.logAction({
      actor_id: reqUserId,
      actor_role: userRole || ROLES.MEMBER,
      action: AUDIT_ACTION.RETURN,
      entity_type: ENTITY_TYPE.BORROW,
      entity_id: borrowId,
      details: { overdue_days: overdueDays, fine_assessed: fineAmount }
    });

    const updated = this.getBorrowRecord(borrowId);
    return { ...updated, fine_assessed: fineAmount > 0, fine_amount: fineAmount };
  }

  /**
   * Renew a book borrow duration
   * @param {string} borrowId - Borrow record ID
   * @param {string} userId - Requesting user ID
   * @returns {Object} Updated borrow record
   */
  renewBorrow(borrowId, userId) {
    const db = getDb();
    
    const record = db.prepare('SELECT * FROM borrow_records WHERE id = ?').get(borrowId);
    if (!record) throw new AppError('Record not found', 404);
    if (record.user_id !== userId) throw new AppError('Unauthorized access', 403);
    
    if (record.status !== BORROW_STATUS.ACTIVE) {
      throw new AppError('Only active borrows can be renewed', 400);
    }
    
    // Check if overdue
    if (new Date(record.due_date) < new Date()) {
      throw new AppError('Cannot renew overdue books', 400);
    }
    
    const maxRenewals = config.MAX_RENEWALS || 2;
    if (record.renewal_count >= maxRenewals) {
      throw new AppError(`Maximum renewal limit (${maxRenewals}) reached`, 400);
    }
    
    // Check pending reservations
    const reservations = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = ?').get(record.book_id, RESERVATION_STATUS.PENDING).count;
    if (reservations > 0) {
      throw new AppError('Cannot renew book because it has pending reservations', 400);
    }
    
    const maxDays = config.MAX_BORROW_DAYS || 14;
    const newDueDate = calculateDueDate(record.due_date, maxDays);
    
    db.prepare(`
      UPDATE borrow_records SET due_date = ?, renewal_count = renewal_count + 1 WHERE id = ?
    `).run(newDueDate, borrowId);
    
    // Log audit trail
    auditService.logAction({
      actor_id: userId,
      actor_role: ROLES.MEMBER,
      action: AUDIT_ACTION.RENEW,
      entity_type: ENTITY_TYPE.BORROW,
      entity_id: borrowId,
      details: { new_due_date: newDueDate, renewal_count: record.renewal_count + 1 }
    });

    return this.getBorrowRecord(borrowId);
  }

  /**
   * Get list of borrows based on filters
   * @param {Object} query - Filter options
   * @returns {Object} List of borrows and pagination
   */
  getAllBorrows({ userId, bookId, status, page = 1, limit = 10 }) {
    const db = getDb();
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    let where = 'WHERE 1=1';
    const params = [];
    
    if (userId) { where += ' AND br.user_id = ?'; params.push(userId); }
    if (bookId) { where += ' AND br.book_id = ?'; params.push(bookId); }
    if (status) { where += ' AND br.status = ?'; params.push(status); }
    
    const count = db.prepare(`SELECT COUNT(*) as total FROM borrow_records br ${where}`).get(...params).total;
    
    const records = db.prepare(`
      SELECT br.*, b.title as book_title, u.username, u.email
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      JOIN users u ON br.user_id = u.id
      ${where}
      ORDER BY br.borrow_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, sqlLimit, offset);
    
    return {
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / sqlLimit)
      }
    };
  }

  /**
   * Fetch a single enriched borrow record
   * @param {string} id - Borrow ID
   * @returns {Object} Borrow record
   */
  getBorrowRecord(id) {
    const db = getDb();
    return db.prepare(`
      SELECT br.*, b.title as book_title
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      WHERE br.id = ?
    `).get(id);
  }

  /**
   * Identify active borrows that are past due date and mark them overdue
   * @returns {Array} List of marked overdue records
   */
  getOverdueBorrows() {
    const db = getDb();
    const now = new Date().toISOString();
    
    const overdue = db.prepare(`
      SELECT * FROM borrow_records 
      WHERE status = 'ACTIVE' AND due_date < ?
    `).all(now);
    
    if (overdue.length > 0) {
      const ids = overdue.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE borrow_records SET status = 'OVERDUE' WHERE id IN (${placeholders})`).run(...ids);
    }
    
    return db.prepare(`
      SELECT br.*, u.email, u.full_name, b.title as book_title
      FROM borrow_records br
      JOIN users u ON br.user_id = u.id
      JOIN books b ON br.book_id = b.id
      WHERE br.status = 'OVERDUE'
    `).all();
  }
}

module.exports = new BorrowService();
