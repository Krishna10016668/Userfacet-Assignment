const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * General rate limiter for standard endpoints
 */
const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.GENERAL.windowMs,
  max: config.RATE_LIMIT.GENERAL.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

/**
 * Stricter rate limiter for authentication endpoints (login, register)
 */
const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.AUTH.windowMs,
  max: config.RATE_LIMIT.AUTH.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

/**
 * Rate limiter for AI summary endpoints to manage resource usage
 */
const aiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.AI.windowMs,
  max: config.RATE_LIMIT.AI.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many AI requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  aiLimiter
};
