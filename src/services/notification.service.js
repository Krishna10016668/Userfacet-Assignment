const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Service for managing user notifications.
 */
class NotificationService {
  /**
   * Creates a notification for a user.
   * @param {string} userId - The user ID.
   * @param {Object} data - Notification details {title, message, type}.
   * @returns {Object} The created notification.
   */
  static createNotification(userId, { title, message, type }) {
    const db = getDb();
    const id = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, userId, title, message, type, now);

    return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  }

  /**
   * Gets user notifications.
   * @param {string} userId - The user ID.
   * @param {Object} options - Filter and pagination options.
   * @returns {Object} Paginated notifications.
   */
  static getUserNotifications(userId, { page = 1, limit = 10, unread_only = false }) {
    const db = getDb();
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (unread_only === 'true' || unread_only === true) {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const items = db.prepare(query).all(...params);

    // Count
    let countQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?';
    const countParams = [userId];
    if (unread_only === 'true' || unread_only === true) {
      countQuery += ' AND is_read = 0';
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
   * Marks a notification as read.
   * @param {string} notificationId - The notification ID.
   * @param {string} userId - The user ID.
   * @returns {Object} The updated notification.
   */
  static markAsRead(notificationId, userId) {
    const db = getDb();
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId);

    if (!notification) {
      throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
    }

    if (notification.user_id !== userId) {
      throw new AppError('Unauthorized', HTTP_STATUS.FORBIDDEN);
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId);
    
    return db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId);
  }

  /**
   * Marks all unread notifications for a user as read.
   * @param {string} userId - The user ID.
   * @returns {number} Number of notifications updated.
   */
  static markAllAsRead(userId) {
    const db = getDb();
    const info = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
    return info.changes;
  }

  /**
   * Gets unread notification count for a user.
   * @param {string} userId - The user ID.
   * @returns {number} The count.
   */
  static getUnreadCount(userId) {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId);
    return result.count;
  }
}

module.exports = NotificationService;
