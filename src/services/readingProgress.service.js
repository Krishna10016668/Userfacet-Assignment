const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const { BORROW_STATUS } = require('../utils/constants');

/**
 * Reading Progress Service
 * Tracks pages read, calculates reading velocity, and forecasts book completion.
 */
class ReadingProgressService {
  /**
   * Updates or creates reading progress for an active borrow
   * @param {string} userId - User ID
   * @param {string} borrowId - Borrow record ID
   * @param {Object} data - Update data
   * @param {number} data.current_page - Page number reached
   * @param {number} [data.total_pages] - Total page count override
   * @param {string} [data.notes] - Reader's personal reading notes
   * @returns {Object} Progress record with velocity and ETA
   */
  updateProgress(userId, borrowId, { current_page, total_pages, notes }) {
    const db = getDb();
    
    // Validate borrow record
    const borrow = db.prepare(`
      SELECT br.*, b.title as book_title, b.page_count as book_page_count
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      WHERE br.id = ?
    `).get(borrowId);

    if (!borrow) {
      throw new AppError('Borrow record not found', 404);
    }
    if (borrow.user_id !== userId) {
      throw new AppError('Unauthorized: borrow record does not belong to you', 403);
    }
    if (borrow.status !== BORROW_STATUS.ACTIVE) {
      throw new AppError('Can only log progress for actively borrowed books', 400);
    }

    const totalPages = total_pages || borrow.book_page_count || 300;
    const currentPage = Math.min(Math.max(0, parseInt(current_page, 10)), totalPages);
    const percentage = parseFloat(((currentPage / totalPages) * 100).toFixed(2));
    const now = getCurrentTimestamp();

    // Check existing progress
    const existing = db.prepare('SELECT * FROM reading_progress WHERE borrow_id = ?').get(borrowId);

    // Calculate reading velocity (pages per hour)
    let readingSpeedPph = 25.0; // Standard average default
    let estimatedHoursRemaining = 0.0;

    const borrowStart = new Date(borrow.borrow_date);
    const hoursElapsed = Math.max(0.5, (new Date(now) - borrowStart) / (1000 * 60 * 60));
    
    if (currentPage > 0) {
      readingSpeedPph = parseFloat((currentPage / hoursElapsed).toFixed(2));
      // Clamp reading speed to realistic human bounds (5 to 120 pages/hour)
      readingSpeedPph = Math.max(5.0, Math.min(120.0, readingSpeedPph));
    }

    const pagesRemaining = totalPages - currentPage;
    estimatedHoursRemaining = parseFloat((pagesRemaining / readingSpeedPph).toFixed(1));

    let progressId;
    if (existing) {
      progressId = existing.id;
      db.prepare(`
        UPDATE reading_progress
        SET current_page = ?, total_pages = ?, percentage = ?, reading_speed_pph = ?, 
            estimated_hours_remaining = ?, notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?
      `).run(currentPage, totalPages, percentage, readingSpeedPph, estimatedHoursRemaining, notes || null, now, progressId);
    } else {
      progressId = generateUUID();
      db.prepare(`
        INSERT INTO reading_progress (
          id, borrow_id, user_id, book_id, current_page, total_pages, percentage, 
          reading_speed_pph, estimated_hours_remaining, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        progressId, borrowId, userId, borrow.book_id, currentPage, totalPages, percentage,
        readingSpeedPph, estimatedHoursRemaining, notes || null, now, now
      );
    }

    return this.getProgressByBorrowId(borrowId);
  }

  /**
   * Retrieves reading progress for a given borrow record
   * @param {string} borrowId - Borrow record ID
   * @returns {Object} Reading progress with book metadata
   */
  getProgressByBorrowId(borrowId) {
    const db = getDb();
    return db.prepare(`
      SELECT rp.*, b.title as book_title, b.cover_image_url, br.due_date, br.status as borrow_status
      FROM reading_progress rp
      JOIN books b ON rp.book_id = b.id
      JOIN borrow_records br ON rp.borrow_id = br.id
      WHERE rp.borrow_id = ?
    `).get(borrowId);
  }

  /**
   * Retrieves comprehensive reading analytics for a user
   * @param {string} userId - User ID
   * @returns {Object} Aggregated reading statistics
   */
  getUserReadingStats(userId) {
    const db = getDb();

    // Active progress list
    const activeReads = db.prepare(`
      SELECT rp.*, b.title as book_title, b.cover_image_url, br.due_date
      FROM reading_progress rp
      JOIN books b ON rp.book_id = b.id
      JOIN borrow_records br ON rp.borrow_id = br.id
      WHERE rp.user_id = ? AND br.status = 'ACTIVE'
      ORDER BY rp.updated_at DESC
    `).all(userId);

    // Aggregates
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_tracked_books,
        COALESCE(SUM(current_page), 0) as total_pages_read,
        COALESCE(AVG(percentage), 0) as average_completion_pct,
        COALESCE(AVG(reading_speed_pph), 25) as avg_reading_speed_pph
      FROM reading_progress
      WHERE user_id = ?
    `).get(userId);

    return {
      overview: {
        total_tracked_books: stats.total_tracked_books,
        total_pages_read: stats.total_pages_read,
        average_completion_pct: parseFloat(stats.average_completion_pct.toFixed(1)),
        avg_reading_speed_pph: parseFloat(stats.avg_reading_speed_pph.toFixed(1))
      },
      currently_reading: activeReads
    };
  }
}

module.exports = new ReadingProgressService();
