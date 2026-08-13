const express = require('express');
const router = express.Router();
const FineService = require('../services/fine.service');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { buildResponse } = require('../utils/helpers');

/**
 * @route GET /api/fines
 * @desc Get all fines (MEMBER sees own, ADMIN sees all)
 * @access Private
 */
router.get('/', authenticate, (req, res, next) => {
  try {
    const { status, user_id, page = 1, limit = 10 } = req.query;
    let result;
    
    if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.LIBRARIAN) {
      result = FineService.getAllFines({ user_id, status, page, limit });
    } else {
      result = FineService.getUserFines(req.user.id, { status, page, limit });
    }

    res.json({
      success: true,
      data: result.items,
      message: 'Fines fetched successfully',
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/fines/my
 * @desc Get user's own fines
 * @access Private
 */
router.get('/my', authenticate, (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const result = FineService.getUserFines(req.user.id, { status, page, limit });
    
    res.json({
      success: true,
      data: result.items,
      message: 'My fines fetched successfully',
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/fines/:id/pay
 * @desc Pay a fine
 * @access Private
 */
router.post('/:id/pay', authenticate, (req, res, next) => {
  try {
    const fine = FineService.payFine(req.params.id, req.user.id, req.user.role);
    res.json(buildResponse(true, fine, 'Fine paid successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/fines/:id/waive
 * @desc Waive a fine
 * @access Private (ADMIN only)
 */
router.post('/:id/waive', authenticate, authorize(ROLES.ADMIN), (req, res, next) => {
  try {
    const fine = FineService.waiveFine(req.params.id);
    res.json(buildResponse(true, fine, 'Fine waived successfully'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
