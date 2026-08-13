const express = require('express');
const readingProgressService = require('../services/readingProgress.service');
const { authenticate } = require('../middleware/auth');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route PUT /api/reading-progress/:borrowId
 * @desc Update reading progress for an active borrow
 * @access Private (Member)
 */
router.put('/:borrowId', authenticate, async (req, res, next) => {
  try {
    const { current_page, total_pages, notes } = req.body;
    const progress = readingProgressService.updateProgress(req.user.id, req.params.borrowId, {
      current_page,
      total_pages,
      notes
    });
    res.status(200).json(buildResponse(true, progress, 'Reading progress updated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/reading-progress/my-stats
 * @desc Get aggregated reading analytics and current reads
 * @access Private (Member)
 */
router.get('/my-stats', authenticate, async (req, res, next) => {
  try {
    const stats = readingProgressService.getUserReadingStats(req.user.id);
    res.status(200).json(buildResponse(true, stats, 'Personal reading statistics fetched successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/reading-progress/:borrowId
 * @desc Get reading progress for a specific borrow
 * @access Private (Member)
 */
router.get('/:borrowId', authenticate, async (req, res, next) => {
  try {
    const progress = readingProgressService.getProgressByBorrowId(req.params.borrowId);
    if (!progress) {
      return res.status(404).json(buildResponse(false, null, 'No reading progress found for this borrow'));
    }
    if (progress.user_id !== req.user.id && req.user.role === 'MEMBER') {
      return res.status(403).json(buildResponse(false, null, 'Unauthorized access to progress record'));
    }
    res.status(200).json(buildResponse(true, progress, 'Reading progress fetched successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
