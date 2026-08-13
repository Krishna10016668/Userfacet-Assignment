const crypto = require('crypto');

/**
 * Generates a unique UUID
 * @returns {string} UUID string
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Formats a date to ISO string format
 * @param {Date|string|number} date - The date to format
 * @returns {string} ISO date string
 */
function formatDate(date) {
  return new Date(date).toISOString();
}

/**
 * Gets the current timestamp in ISO format
 * @returns {string} Current timestamp
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Calculates pagination values
 * @param {number} [page=1] - Current page number
 * @param {number} [limit=10] - Items per page
 * @returns {Object} Pagination options containing offset and limit
 */
function calculatePagination(page = 1, limit = 10) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(Math.max(1, parseInt(limit, 10) || 10), 100);
  return {
    offset: (p - 1) * l,
    limit: l
  };
}

/**
 * Calculates a due date based on borrow date and max days
 * @param {Date|string} borrowDate - The date the book was borrowed
 * @param {number} [days=14] - Number of days allowed to borrow
 * @returns {string} Due date in ISO string format
 */
function calculateDueDate(borrowDate, days = 14) {
  const date = new Date(borrowDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Calculates the number of overdue days
 * @param {Date|string} dueDate - The date the book is due
 * @param {Date|string|null} [returnDate=null] - The date returned, or null if not yet returned
 * @returns {number} Number of days overdue (0 if not overdue)
 */
function calculateOverdueDays(dueDate, returnDate = null) {
  const end = returnDate ? new Date(returnDate) : new Date();
  const due = new Date(dueDate);
  
  const diffTime = end - due;
  if (diffTime <= 0) return 0;
  
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculates fine amount based on overdue days
 * @param {number} overdueDays - Number of days overdue
 * @param {number} [ratePerDay=2] - Fine rate per day
 * @returns {number} Total fine amount
 */
function calculateFine(overdueDays, ratePerDay = 2) {
  if (overdueDays <= 0) return 0;
  return overdueDays * ratePerDay;
}

/**
 * Validates whether a string is a valid ISBN-10 or ISBN-13
 * @param {string} isbn - The ISBN string to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateISBN(isbn) {
  // Remove hyphens and spaces
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  
  if (cleanIsbn.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      if (cleanIsbn[i] < '0' || cleanIsbn[i] > '9') return false;
      sum += (10 - i) * parseInt(cleanIsbn[i], 10);
    }
    let last = cleanIsbn[9];
    if (last === 'X' || last === 'x') {
      sum += 10;
    } else if (last >= '0' && last <= '9') {
      sum += parseInt(last, 10);
    } else {
      return false;
    }
    return sum % 11 === 0;
  } else if (cleanIsbn.length === 13) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      if (cleanIsbn[i] < '0' || cleanIsbn[i] > '9') return false;
      const digit = parseInt(cleanIsbn[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    return sum % 10 === 0;
  }
  
  return false;
}

/**
 * Sanitizes a string by trimming and removing excess whitespace
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Builds a standardized API response object
 * @param {boolean} success - Whether the operation was successful
 * @param {any} [data=null] - Payload data to include
 * @param {string} [message=''] - Optional message
 * @param {Object|null} [pagination=null] - Optional pagination metadata
 * @returns {Object} Standardized response structure
 */
function buildResponse(success, data = null, message = '', pagination = null) {
  const response = {
    success,
    message
  };
  if (data !== null) response.data = data;
  if (pagination) response.pagination = pagination;
  return response;
}

module.exports = {
  generateUUID,
  formatDate,
  getCurrentTimestamp,
  calculatePagination,
  calculateDueDate,
  calculateOverdueDays,
  calculateFine,
  validateISBN,
  sanitizeString,
  buildResponse
};
