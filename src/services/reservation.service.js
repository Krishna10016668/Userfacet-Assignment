const { getDb } = require('../database/connection');
const { RESERVATION_STATUS, NOTIFICATION_TYPE, HTTP_STATUS } = require('../utils/constants');
const { generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

/**
 * Service to handle reservation related operations.
 */
class ReservationService {
  /**
   * Creates a reservation for a book.
   * @param {string} userId - The ID of the user.
   * @param {string} bookId - The ID of the book.
   * @returns {Object} The created reservation.
   */
  static createReservation(userId, bookId) {
    const db = getDb();
    
    // Check if book exists
    const book = db.prepare('SELECT id, available_copies FROM books WHERE id = ? AND is_deleted = 0').get(bookId);
    if (!book) {
      throw new AppError('Book not found', HTTP_STATUS.NOT_FOUND);
    }

    // Check if user already has a pending reservation
    const existingReservation = db.prepare(
      'SELECT id FROM reservations WHERE user_id = ? AND book_id = ? AND status = ?'
    ).get(userId, bookId, RESERVATION_STATUS.PENDING);
    
    if (existingReservation) {
      throw new AppError('You already have a pending reservation for this book', HTTP_STATUS.BAD_REQUEST);
    }

    // Check if user has an active borrow for this book
    const activeBorrow = db.prepare(
      'SELECT id FROM borrow_records WHERE user_id = ? AND book_id = ? AND status IN ("ACTIVE", "OVERDUE")'
    ).get(userId, bookId);

    if (activeBorrow) {
      throw new AppError('You currently have this book borrowed', HTTP_STATUS.BAD_REQUEST);
    }

    // Calculate queue_position
    const queueData = db.prepare(
      'SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = ?'
    ).get(bookId, RESERVATION_STATUS.PENDING);
    const queuePosition = queueData.count + 1;

    // Create reservation
    const reservationId = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT INTO reservations (id, user_id, book_id, status, queue_position, reserved_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reservationId, userId, bookId, RESERVATION_STATUS.PENDING, queuePosition, now, now);

    return db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
  }

  /**
   * Cancels a reservation.
   * @param {string} reservationId - The ID of the reservation.
   * @param {string} userId - The ID of the user cancelling (owner or admin).
   * @param {string} userRole - The role of the user.
   * @returns {Object} The cancelled reservation.
   */
  static cancelReservation(reservationId, userId, userRole) {
    const db = getDb();
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);

    if (!reservation) {
      throw new AppError('Reservation not found', HTTP_STATUS.NOT_FOUND);
    }

    if (reservation.user_id !== userId && userRole !== 'ADMIN') {
      throw new AppError('Unauthorized to cancel this reservation', HTTP_STATUS.FORBIDDEN);
    }

    if (reservation.status !== RESERVATION_STATUS.PENDING) {
      throw new AppError(`Cannot cancel reservation with status ${reservation.status}`, HTTP_STATUS.BAD_REQUEST);
    }

    // Set status = CANCELLED
    db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(RESERVATION_STATUS.CANCELLED, reservationId);

    // Reorder queue positions for remaining pending reservations
    db.prepare(`
      UPDATE reservations 
      SET queue_position = queue_position - 1 
      WHERE book_id = ? AND status = ? AND queue_position > ?
    `).run(reservation.book_id, RESERVATION_STATUS.PENDING, reservation.queue_position);

    return db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
  }

  /**
   * Fulfills the next reservation in the queue for a book.
   * @param {string} bookId - The ID of the book.
   * @returns {Object|null} The fulfilled reservation or null if none.
   */
  static fulfillNextReservation(bookId) {
    const db = getDb();
    const nextReservation = db.prepare(`
      SELECT * FROM reservations 
      WHERE book_id = ? AND status = ? 
      ORDER BY queue_position ASC LIMIT 1
    `).get(bookId, RESERVATION_STATUS.PENDING);

    if (!nextReservation) return null;

    const now = getCurrentTimestamp();
    const expiryDate = new Date(Date.now() + (config.RESERVATION_EXPIRY_HOURS || 48) * 60 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE reservations 
      SET status = ?, expires_at = ?, queue_position = NULL
      WHERE id = ?
    `).run(RESERVATION_STATUS.FULFILLED, expiryDate, nextReservation.id);

    // Update remaining queue
    db.prepare(`
      UPDATE reservations 
      SET queue_position = queue_position - 1 
      WHERE book_id = ? AND status = ?
    `).run(bookId, RESERVATION_STATUS.PENDING);

    // Create notification
    const notificationId = generateUUID();
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(
      notificationId, 
      nextReservation.user_id, 
      'Reservation Fulfilled', 
      'Your reserved book is now available for borrowing.', 
      NOTIFICATION_TYPE.RESERVATION_READY,
      now
    );

    return db.prepare('SELECT * FROM reservations WHERE id = ?').get(nextReservation.id);
  }

  /**
   * Retrieves a user's reservations.
   * @param {string} userId - The ID of the user.
   * @param {Object} options - Pagination options.
   * @returns {Object} Paginated reservations.
   */
  static getUserReservations(userId, { page = 1, limit = 10 }) {
    const db = getDb();
    const offset = (page - 1) * limit;

    const items = db.prepare(`
      SELECT r.*, b.title, b.cover_image_url 
      FROM reservations r
      JOIN books b ON r.book_id = b.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE user_id = ?').get(userId).count;

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
   * Retrieves all pending reservations for a book.
   * @param {string} bookId - The ID of the book.
   * @returns {Array} Array of pending reservations.
   */
  static getBookReservations(bookId) {
    const db = getDb();
    return db.prepare(`
      SELECT r.*, u.username, u.full_name
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      WHERE r.book_id = ? AND r.status = ?
      ORDER BY r.queue_position ASC
    `).all(bookId, RESERVATION_STATUS.PENDING);
  }

  /**
   * Expires stale fulfilled reservations.
   * @returns {number} The count of expired reservations.
   */
  static expireStaleReservations() {
    const db = getDb();
    const now = getCurrentTimestamp();
    
    const info = db.prepare(`
      UPDATE reservations 
      SET status = ? 
      WHERE status = ? AND expires_at < ?
    `).run(RESERVATION_STATUS.EXPIRED, RESERVATION_STATUS.FULFILLED, now);
    
    return info.changes;
  }
}

module.exports = ReservationService;
