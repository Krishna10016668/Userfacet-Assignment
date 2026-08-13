const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp, calculatePagination } = require('../utils/helpers');

/**
 * Audit Service
 * Enterprise-grade audit trail logger and query engine.
 */
class AuditService {
  /**
   * Records a security/administrative audit log entry
   * @param {Object} entry - Audit log entry details
   * @param {string} entry.actor_id - ID of user performing the action
   * @param {string} entry.actor_role - Role of the actor
   * @param {string} entry.action - Action performed (e.g. CREATE, DELETE, BORROW)
   * @param {string} entry.entity_type - Type of entity affected (BOOK, USER, BORROW, etc.)
   * @param {string} [entry.entity_id] - Optional ID of the affected entity
   * @param {Object|string} [entry.details] - Optional payload/metadata of changes
   * @param {string} [entry.ip_address] - Optional IP address
   * @returns {Object} Created audit record
   */
  logAction({ actor_id, actor_role, action, entity_type, entity_id = null, details = null, ip_address = null }) {
    try {
      const db = getDb();
      const id = generateUUID();
      const now = getCurrentTimestamp();
      const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null;

      db.prepare(`
        INSERT INTO audit_log (id, actor_id, actor_role, action, entity_type, entity_id, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, actor_id, actor_role, action, entity_type, entity_id, detailsStr, ip_address, now);

      return { id, actor_id, actor_role, action, entity_type, entity_id, created_at: now };
    } catch (err) {
      // Non-blocking: audit log failure should never crash the main transaction
      console.error('Failed to write audit log:', err.message);
      return null;
    }
  }

  /**
   * Query audit logs with rich filters and pagination (Admin only)
   * @param {Object} query - Filter parameters
   * @returns {Object} Paginated audit records
   */
  getAuditLogs({ actor_id, action, entity_type, entity_id, from_date, to_date, page = 1, limit = 20 }) {
    const db = getDb();
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);

    let where = 'WHERE 1=1';
    const params = [];

    if (actor_id) {
      where += ' AND a.actor_id = ?';
      params.push(actor_id);
    }
    if (action) {
      where += ' AND a.action = ?';
      params.push(action);
    }
    if (entity_type) {
      where += ' AND a.entity_type = ?';
      params.push(entity_type);
    }
    if (entity_id) {
      where += ' AND a.entity_id = ?';
      params.push(entity_id);
    }
    if (from_date) {
      where += ' AND a.created_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      where += ' AND a.created_at <= ?';
      params.push(to_date);
    }

    const countQuery = `SELECT COUNT(*) as total FROM audit_log a ${where}`;
    const total = db.prepare(countQuery).get(...params).total;

    const dataQuery = `
      SELECT a.*, u.username as actor_username, u.email as actor_email
      FROM audit_log a
      LEFT JOIN users u ON a.actor_id = u.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const logs = db.prepare(dataQuery).all(...params, sqlLimit, offset).map(log => {
      let parsedDetails = log.details;
      try {
        if (log.details) parsedDetails = JSON.parse(log.details);
      } catch (e) {
        // Keep string if not valid JSON
      }
      return {
        ...log,
        details: parsedDetails
      };
    });

    return {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / sqlLimit)
      }
    };
  }

  /**
   * Get audit history for a specific entity
   * @param {string} entityType - Entity type (e.g. BOOK)
   * @param {string} entityId - Entity ID
   * @returns {Array} Timeline of actions on this entity
   */
  getEntityHistory(entityType, entityId) {
    const db = getDb();
    return db.prepare(`
      SELECT a.*, u.username as actor_username
      FROM audit_log a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE a.entity_type = ? AND a.entity_id = ?
      ORDER BY a.created_at DESC
    `).all(entityType, entityId).map(log => {
      let parsedDetails = log.details;
      try {
        if (log.details) parsedDetails = JSON.parse(log.details);
      } catch (e) {}
      return { ...log, details: parsedDetails };
    });
  }
}

module.exports = new AuditService();
