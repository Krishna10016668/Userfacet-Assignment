const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

/**
 * Centralized configuration object
 * @type {Object}
 */
const config = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  DB_PATH: path.resolve(process.cwd(), process.env.DB_PATH || './data/library.db'),
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:5000',
  AI_API_TOKEN: process.env.AI_API_TOKEN,
  AI_API_BASE_URL: process.env.AI_API_BASE_URL || 'https://ai-api.userfacet.com',
  FINE_RATE_PER_DAY: 2,
  MAX_BORROW_DAYS: 14,
  MAX_RENEWALS: 2,
  RESERVATION_EXPIRY_HOURS: 48,
  SUMMARY_CACHE_DAYS: 30,
  RATE_LIMIT: {
    GENERAL: { windowMs: 15 * 60 * 1000, max: 100 },
    AUTH: { windowMs: 15 * 60 * 1000, max: 20 },
    AI: { windowMs: 15 * 60 * 1000, max: 10 }
  }
};

module.exports = config;
