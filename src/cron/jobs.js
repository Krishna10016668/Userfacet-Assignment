const cron = require('node-cron');
const { getDb } = require('../database/connection');
const { BORROW_STATUS, RESERVATION_STATUS, NOTIFICATION_TYPE, FINE_STATUS } = require('../utils/constants');
const { getCurrentTimestamp, generateUUID } = require('../utils/helpers');
const config = require('../config');

/**
 * Starts all scheduled cron jobs for the system.
 */
function startCronJobs() {
  console.log('Starting background cron jobs...');

  // 1. Check for overdue books (Runs every hour)
  cron.schedule('0 * * * *', () => {
    try {
      const db = getDb();
      const now = getCurrentTimestamp();
      
      const activeBorrows = db.prepare(`
        SELECT * FROM borrow_records 
        WHERE status = ? AND due_date < ?
      `).all(BORROW_STATUS.ACTIVE, now);

      let count = 0;
      for (const record of activeBorrows) {
        // Update status to OVERDUE
        db.prepare('UPDATE borrow_records SET status = ? WHERE id = ?').run(BORROW_STATUS.OVERDUE, record.id);
        
        // Calculate fine (e.g., rate per day)
        // For simplicity, just create an initial fine record if one doesn't exist
        const existingFine = db.prepare('SELECT id FROM fines WHERE borrow_record_id = ?').get(record.id);
        if (!existingFine) {
          const fineId = generateUUID();
          db.prepare(`
            INSERT INTO fines (id, user_id, borrow_record_id, amount, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(fineId, record.user_id, record.id, config.FINE_RATE_PER_DAY || 2, FINE_STATUS.PENDING, now);
        }
        
        // Create Notification
        const notifId = generateUUID();
        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `).run(notifId, record.user_id, 'Book Overdue', `Your borrowed book is overdue. Please return it to avoid further fines.`, NOTIFICATION_TYPE.OVERDUE, now);
        
        count++;
      }
      
      console.log(`Overdue check: ${count} borrows marked overdue`);
    } catch (error) {
      console.error('Error running overdue check job:', error);
    }
  });

  // 2. Send Due Reminders (Runs daily at 9 AM)
  cron.schedule('0 9 * * *', () => {
    try {
      const db = getDb();
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const nowStr = now.toISOString();

      const upcomingBorrows = db.prepare(`
        SELECT * FROM borrow_records 
        WHERE status = ? AND due_date > ? AND due_date <= ?
      `).all(BORROW_STATUS.ACTIVE, nowStr, tomorrow);

      let count = 0;
      for (const record of upcomingBorrows) {
        const notifId = generateUUID();
        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `).run(notifId, record.user_id, 'Due Date Reminder', `Your borrowed book is due tomorrow.`, NOTIFICATION_TYPE.DUE_REMINDER, nowStr);
        
        count++;
      }
      
      console.log(`Due reminders: ${count} reminders sent`);
    } catch (error) {
      console.error('Error running due reminders job:', error);
    }
  });

  // 3. Expire Reservations (Runs every 6 hours)
  cron.schedule('0 */6 * * *', () => {
    try {
      const db = getDb();
      const nowStr = getCurrentTimestamp();

      const expiredReservations = db.prepare(`
        SELECT * FROM reservations 
        WHERE status = ? AND expires_at < ?
      `).all(RESERVATION_STATUS.FULFILLED, nowStr);

      let count = 0;
      for (const res of expiredReservations) {
        db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(RESERVATION_STATUS.EXPIRED, res.id);
        
        // Increment book available_copies since it was freed up
        db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(res.book_id);
        
        // Try to fulfill the next reservation if any
        // Note: For simplicity, we just log this. In a real system we'd call ReservationService.fulfillNextReservation
        // but requiring the service here might cause circular dependencies, so we do it manually or via event
        const nextReservation = db.prepare(`
          SELECT * FROM reservations 
          WHERE book_id = ? AND status = ? 
          ORDER BY queue_position ASC LIMIT 1
        `).get(res.book_id, RESERVATION_STATUS.PENDING);
        
        if (nextReservation) {
          const expiryDate = new Date(Date.now() + (config.RESERVATION_EXPIRY_HOURS || 48) * 60 * 60 * 1000).toISOString();
          db.prepare(`
            UPDATE reservations 
            SET status = ?, expires_at = ?, queue_position = NULL
            WHERE id = ?
          `).run(RESERVATION_STATUS.FULFILLED, expiryDate, nextReservation.id);
          
          db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(res.book_id);
          
          const notifId = generateUUID();
          db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
          `).run(notifId, nextReservation.user_id, 'Reservation Fulfilled', 'Your reserved book is now available.', NOTIFICATION_TYPE.RESERVATION_READY, nowStr);
        }

        count++;
      }
      
      console.log(`Reservation cleanup: ${count} expired`);
    } catch (error) {
      console.error('Error running reservation cleanup job:', error);
    }
  });
}

module.exports = { startCronJobs };
