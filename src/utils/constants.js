/**
 * User roles
 */
const ROLES = {
  MEMBER: 'MEMBER',
  LIBRARIAN: 'LIBRARIAN',
  ADMIN: 'ADMIN'
};

/**
 * Status of a borrowed book
 */
const BORROW_STATUS = {
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  OVERDUE: 'OVERDUE'
};

/**
 * Status of a reservation
 */
const RESERVATION_STATUS = {
  PENDING: 'PENDING',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

/**
 * Status of a fine
 */
const FINE_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  WAIVED: 'WAIVED'
};

/**
 * Types of notifications
 */
const NOTIFICATION_TYPE = {
  DUE_REMINDER: 'DUE_REMINDER',
  OVERDUE: 'OVERDUE',
  RESERVATION_READY: 'RESERVATION_READY',
  FINE: 'FINE',
  SYSTEM: 'SYSTEM'
};

/**
 * Types of AI book summaries
 */
const SUMMARY_TYPE = {
  BRIEF: 'brief',
  DETAILED: 'detailed',
  CHAPTER_WISE: 'chapter_wise'
};

/**
 * Standard HTTP Status Codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500
};

/**
 * Types of Audit Actions
 */
const AUDIT_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BORROW: 'BORROW',
  RETURN: 'RETURN',
  RENEW: 'RENEW',
  FINE_PAY: 'FINE_PAY',
  FINE_WAIVE: 'FINE_WAIVE',
  BULK_IMPORT: 'BULK_IMPORT',
  LOGIN: 'LOGIN',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE'
};

/**
 * Entity Types for Audit Log
 */
const ENTITY_TYPE = {
  BOOK: 'BOOK',
  USER: 'USER',
  BORROW: 'BORROW',
  FINE: 'FINE',
  RESERVATION: 'RESERVATION',
  REVIEW: 'REVIEW',
  READING_LIST: 'READING_LIST',
  CATEGORY: 'CATEGORY',
  AUTHOR: 'AUTHOR'
};

/**
 * Real-World Fine Policy Constants
 */
const FINE_POLICY = {
  GRACE_PERIOD_DAYS: 3,        // 3-day grace period where fine is ₹0
  TIER_1_DAILY_RATE: 2.0,       // ₹2.00/day for days 4 to 10
  TIER_2_DAILY_RATE: 5.0,       // ₹5.00/day for days 11 and beyond
  DEFAULT_BOOK_VALUE_CAP: 250.0 // Default maximum fine ceiling if book price is unstated
};

/**
 * Gamification Milestone Badge Definitions
 */
const BADGE_DEFINITIONS = {
  NIGHT_OWL: {
    key: 'NIGHT_OWL',
    name: 'Night Owl Reader',
    description: 'Logged reading activity or borrowed a book between 11 PM and 4 AM.',
    icon: '🦉'
  },
  SPEED_DEMON: {
    key: 'SPEED_DEMON',
    name: 'Speed Demon',
    description: 'Achieved a reading velocity of 80+ pages per hour.',
    icon: '⚡'
  },
  GENRE_EXPLORER: {
    key: 'GENRE_EXPLORER',
    name: 'Genre Explorer',
    description: 'Borrowed books across 3 or more distinct literary genres.',
    icon: '🌍'
  },
  AVID_READER: {
    key: 'AVID_READER',
    name: 'Avid Reader',
    description: 'Successfully completed and returned 3 or more books on time.',
    icon: '📚'
  },
  STREAK_CHAMPION: {
    key: 'STREAK_CHAMPION',
    name: 'Streak Champion',
    description: 'Maintained an active consecutive reading streak of 3+ days.',
    icon: '🔥'
  }
};

module.exports = {
  ROLES,
  BORROW_STATUS,
  RESERVATION_STATUS,
  FINE_STATUS,
  NOTIFICATION_TYPE,
  SUMMARY_TYPE,
  HTTP_STATUS,
  AUDIT_ACTION,
  ENTITY_TYPE,
  FINE_POLICY,
  BADGE_DEFINITIONS
};
