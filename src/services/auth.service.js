const bcrypt = require('bcryptjs');
const config = require('../config');
const { getDb } = require('../database/connection');
const { ROLES } = require('../utils/constants');
const { generateUUID } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const jwt = require('jsonwebtoken');

/**
 * Authentication Service
 * Handles user registration, login, token refresh, and profile management.
 */
class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.username - Username
   * @param {string} userData.password - User password
   * @param {string} userData.full_name - User full name
   * @returns {Object} Created user object without password hash
   */
  async register({ email, username, password, full_name }) {
    const db = getDb();
    
    // Check if email or username already exists
    const existingUser = db.prepare(
      'SELECT id FROM users WHERE email = ? OR username = ?'
    ).get(email, username);
    
    if (existingUser) {
      throw new AppError('Email or username already exists', 409);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = generateUUID();
    
    // Insert new user
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, username, passwordHash, full_name, ROLES.MEMBER);
    
    // Return created user without password
    const user = db.prepare('SELECT id, email, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(userId);
    return user;
  }

  /**
   * Authenticate a user and generate tokens
   * @param {Object} credentials - User credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Object} Object containing user details, access token, and refresh token
   */
  async login({ email, password }) {
    const db = getDb();
    
    // Find user by email
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user || !user.is_active) {
      throw new AppError('Invalid credentials or inactive account', 401);
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }
    
    // Generate tokens
    const payload = { id: user.id, email: user.email, username: user.username, role: user.role };
    const accessToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY });
    const refreshToken = jwt.sign({ id: user.id }, config.JWT_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRY });
    
    // Remove password hash from response
    delete user.password_hash;
    
    return { user, accessToken, refreshToken };
  }

  /**
   * Generate a new access token using a refresh token
   * @param {string} token - Refresh token
   * @returns {Object} New access token
   */
  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const db = getDb();
      
      const user = db.prepare('SELECT id, email, username, role, is_active FROM users WHERE id = ?').get(decoded.id);
      if (!user || !user.is_active) {
        throw new AppError('User not found or inactive', 401);
      }
      
      const payload = { id: user.id, email: user.email, username: user.username, role: user.role };
      const accessToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY });
      
      return { accessToken };
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  /**
   * Change user password
   * @param {string} userId - ID of the user
   * @param {Object} passwordData - Password update data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Object} Success message
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    const db = getDb();
    
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) throw new AppError('User not found', 404);
    
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new AppError('Incorrect current password', 401);
    
    const newHash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
    
    return { message: 'Password changed successfully' };
  }

  /**
   * Get complete user profile with borrow statistics
   * @param {string} userId - User ID
   * @returns {Object} User profile with stats
   */
  async getUserProfile(userId) {
    const db = getDb();
    
    const user = db.prepare('SELECT id, email, username, full_name, role, max_books_allowed, is_active, created_at FROM users WHERE id = ?').get(userId);
    if (!user) throw new AppError('User not found', 404);
    
    // Get borrow stats
    const stats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_borrows,
        COUNT(*) as total_borrows
      FROM borrow_records 
      WHERE user_id = ?
    `).get(userId);
    
    // Get unpaid fines
    const fines = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as unpaid_fines
      FROM fines
      WHERE user_id = ? AND status = 'PENDING'
    `).get(userId);
    
    return {
      ...user,
      stats: {
        active_borrows: stats.active_borrows || 0,
        total_borrows: stats.total_borrows || 0,
        unpaid_fines: fines.unpaid_fines || 0
      }
    };
  }
}

module.exports = new AuthService();
