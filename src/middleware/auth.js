const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../database/connection');

/**
 * Middleware to authenticate requests using JWT
 * Checks for Bearer token, verifies it, and attaches the user payload to the request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    const db = getDb();
    const user = db.prepare('SELECT id, email, username, role, is_active FROM users WHERE id = ?').get(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or inactive user.',
          code: 'UNAUTHORIZED'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { message: 'Token expired.', code: 'TOKEN_EXPIRED' }
      });
    }
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid token.', code: 'INVALID_TOKEN' }
    });
  }
}

/**
 * Factory middleware to authorize users based on roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware for authorization
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions.',
          code: 'FORBIDDEN'
        }
      });
    }
    next();
  };
}

/**
 * Middleware for optional authentication. Does not fail if token is missing/invalid,
 * just sets req.user to null.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, email, username, role, is_active FROM users WHERE id = ?').get(decoded.id);

    if (user && user.is_active) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }
  next();
}

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
