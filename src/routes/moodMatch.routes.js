const express = require('express');
const moodMatchService = require('../services/moodMatch.service');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

router.post('/', authenticate, aiLimiter, async (req, res, next) => {
  try {
    if (!req.body.mood_query) {
      return res.status(400).json(buildResponse(false, null, 'mood_query is required'));
    }
    const result = await moodMatchService.matchMood(req.body.mood_query);
    res.status(200).json(buildResponse(true, result, 'Mood matched successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
