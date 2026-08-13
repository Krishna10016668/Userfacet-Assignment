const express = require('express');
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', authLimiter, validate(schemas.register), async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(buildResponse(true, user, 'User registered successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login user and get tokens
 * @access Public
 */
router.post('/login', authLimiter, validate(schemas.login), async (req, res, next) => {
  try {
    const data = await authService.login(req.body);
    res.status(200).json(buildResponse(true, data, 'Login successful'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json(buildResponse(false, null, 'Refresh token is required'));
    }
    const data = await authService.refreshToken(refreshToken);
    res.status(200).json(buildResponse(true, data, 'Token refreshed successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getUserProfile(req.user.id);
    res.status(200).json(buildResponse(true, user, 'Profile retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json(buildResponse(false, null, 'Current and new passwords are required'));
    }
    const result = await authService.changePassword(req.user.id, { currentPassword, newPassword });
    res.status(200).json(buildResponse(true, null, result.message));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
