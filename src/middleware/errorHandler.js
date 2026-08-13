/**
 * Custom error class for application specific errors
 * @extends Error
 */
class AppError extends Error {
  /**
   * Creates an AppError instance
   * @param {string} message - Error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [code='INTERNAL_ERROR'] - Error code identifier
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
  // Log the error for server-side debugging
  console.error(`[${new Date().toISOString()}] Error:`, err);

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  } else if (err.isJoi) {
    // Joi validation errors
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.details.map(detail => detail.message).join(', ');
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired.';
  } else {
    // Other unknown errors - hide details in production
    message = process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error';
  }

  const errorResponse = {
    success: false,
    error: {
      message,
      code
    }
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND'
    }
  });
}

module.exports = {
  AppError,
  errorHandler,
  notFound
};
