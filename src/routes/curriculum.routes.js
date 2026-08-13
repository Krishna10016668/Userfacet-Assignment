const express = require('express');
const curriculumService = require('../services/curriculum.service');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

router.post('/ai-curate', authenticate, aiLimiter, async (req, res, next) => {
  try {
    if (!req.body.goal) {
      return res.status(400).json(buildResponse(false, null, 'goal is required'));
    }
    const numBooks = req.body.num_books ? parseInt(req.body.num_books, 10) : 5;
    const result = await curriculumService.generateCurriculum(req.user.id, req.body.goal, numBooks);
    res.status(200).json(buildResponse(true, result, 'Curriculum generated successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
