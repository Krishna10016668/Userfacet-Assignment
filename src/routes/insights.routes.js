const express = require('express');
const insightsService = require('../services/insights.service');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/insights/my-profile
 * @desc Get AI-powered personalized reader profile and next-read recommendations
 * @access Private (Member)
 */
router.get('/my-profile', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const data = await insightsService.getUserReadingInsights(req.user.id);
    res.status(200).json(buildResponse(true, data, 'AI reader insights generated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/insights/user/:userId
 * @desc Get AI reader insights for any user (Admin/Librarian inspection)
 * @access Private (Admin, Librarian)
 */
router.get('/user/:userId', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'MEMBER' && req.user.id !== req.params.userId) {
      return res.status(403).json(buildResponse(false, null, 'Unauthorized access to reader profile'));
    }
    const data = await insightsService.getUserReadingInsights(req.params.userId);
    res.status(200).json(buildResponse(true, data, 'User reading profile generated successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
