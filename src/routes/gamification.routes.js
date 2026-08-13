const express = require('express');
const gamificationService = require('../services/gamification.service');
const { authenticate } = require('../middleware/auth');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/users/my-badges
 * @desc Get all unlocked and available milestone badges for the authenticated user
 * @access Private (Member, Librarian, Admin)
 */
router.get('/my-badges', authenticate, (req, res, next) => {
  try {
    const data = gamificationService.getUserBadges(req.user.id);
    res.status(200).json(buildResponse(true, data, 'User milestone badges retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/users/reading-streak
 * @desc Get current daily reading streak, longest streak, and consistency metrics
 * @access Private (Member, Librarian, Admin)
 */
router.get('/reading-streak', authenticate, (req, res, next) => {
  try {
    const data = gamificationService.getUserStreak(req.user.id);
    res.status(200).json(buildResponse(true, data, 'Reading streak metrics retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
