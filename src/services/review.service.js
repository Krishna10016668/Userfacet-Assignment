const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Service to handle review related operations.
 */
class ReviewService {
  /**
   * Recalculates and updates the average rating for a book.
   * @param {string} bookId - The ID of the book.
   * @private
   */
  static _recalculateAvgRating(bookId) {
    const db = getDb();
    const result = db.prepare('SELECT AVG(rating) as avgRating FROM reviews WHERE book_id = ?').get(bookId);
    const avgRating = result.avgRating || 0;
    
    db.prepare('UPDATE books SET avg_rating = ? WHERE id = ?').run(avgRating, bookId);
  }

  /**
   * Creates a review for a book.
   * @param {string} userId - The ID of the user.
   * @param {Object} reviewData - The review data.
   * @returns {Object} The created review.
   */
  static createReview(userId, { book_id, rating, review_text }) {
    const db = getDb();
    
    // Check if book exists
    const book = db.prepare('SELECT id FROM books WHERE id = ? AND is_deleted = 0').get(book_id);
    if (!book) {
      throw new AppError('Book not found', HTTP_STATUS.NOT_FOUND);
    }

    // Check if user has borrowed the book at least once
    const borrowRecord = db.prepare('SELECT id FROM borrow_records WHERE user_id = ? AND book_id = ? LIMIT 1').get(userId, book_id);
    if (!borrowRecord) {
      throw new AppError('You must borrow this book before reviewing it', HTTP_STATUS.FORBIDDEN);
    }

    // Check for existing review (also handled by DB unique constraint)
    const existingReview = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND book_id = ?').get(userId, book_id);
    if (existingReview) {
      throw new AppError('You have already reviewed this book', HTTP_STATUS.BAD_REQUEST);
    }

    const reviewId = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT INTO reviews (id, user_id, book_id, rating, review_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reviewId, userId, book_id, rating, review_text, now, now);

    this._recalculateAvgRating(book_id);

    return db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  }

  /**
   * Updates an existing review.
   * @param {string} reviewId - The ID of the review.
   * @param {string} userId - The ID of the user.
   * @param {Object} updateData - The data to update.
   * @returns {Object} The updated review.
   */
  static updateReview(reviewId, userId, { rating, review_text }) {
    const db = getDb();
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);

    if (!review) {
      throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    }

    if (review.user_id !== userId) {
      throw new AppError('Unauthorized to update this review', HTTP_STATUS.FORBIDDEN);
    }

    const now = getCurrentTimestamp();
    db.prepare(`
      UPDATE reviews SET rating = ?, review_text = ?, updated_at = ? WHERE id = ?
    `).run(rating, review_text, now, reviewId);

    this._recalculateAvgRating(review.book_id);

    return db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  }

  /**
   * Deletes a review.
   * @param {string} reviewId - The ID of the review.
   * @param {string} userId - The ID of the user requesting deletion.
   * @param {string} userRole - The role of the user.
   */
  static deleteReview(reviewId, userId, userRole) {
    const db = getDb();
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);

    if (!review) {
      throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    }

    if (review.user_id !== userId && userRole !== 'ADMIN') {
      throw new AppError('Unauthorized to delete this review', HTTP_STATUS.FORBIDDEN);
    }

    db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);
    this._recalculateAvgRating(review.book_id);
  }

  /**
   * Retrieves paginated reviews for a book.
   * @param {string} bookId - The ID of the book.
   * @param {Object} options - Pagination options.
   * @returns {Object} Paginated reviews.
   */
  static getBookReviews(bookId, { page = 1, limit = 10 }) {
    const db = getDb();
    const offset = (page - 1) * limit;

    const items = db.prepare(`
      SELECT r.*, u.username, u.full_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.book_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(bookId, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM reviews WHERE book_id = ?').get(bookId).count;

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
}

module.exports = ReviewService;
