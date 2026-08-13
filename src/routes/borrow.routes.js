const express = require('express');
const borrowService = require('../services/borrow.service');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route POST /api/borrow
 * @desc Borrow a book
 * @access Private
 */
router.post('/', authenticate, validate(schemas.borrowBook), async (req, res, next) => {
  try {
    const record = borrowService.borrowBook(req.user.id, req.body.book_id);
    res.status(201).json(buildResponse(true, record, 'Book borrowed successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/borrow/:id/return
 * @desc Return a borrowed book
 * @access Private
 */
router.post('/:id/return', authenticate, async (req, res, next) => {
  try {
    const result = borrowService.returnBook(req.params.id, req.user.id, req.user.role);
    res.status(200).json(buildResponse(true, result, 'Book returned successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/borrow/:id/renew
 * @desc Renew a borrowed book
 * @access Private
 */
router.post('/:id/renew', authenticate, async (req, res, next) => {
  try {
    const record = borrowService.renewBorrow(req.params.id, req.user.id);
    res.status(200).json(buildResponse(true, record, 'Book renewed successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/borrow
 * @desc Get borrow records based on role
 * @access Private
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const query = { ...req.query };
    
    // If regular member, force userId to their own
    if (req.user.role === ROLES.MEMBER) {
      query.userId = req.user.id;
    }
    
    const result = borrowService.getAllBorrows(query);
    res.status(200).json(buildResponse(true, result.records, 'Borrow records retrieved', result.pagination));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/borrow/overdue
 * @desc Process and list all overdue books
 * @access Private (Librarian/Admin)
 */
router.get('/overdue', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), async (req, res, next) => {
  try {
    const records = borrowService.getOverdueBorrows();
    res.status(200).json(buildResponse(true, records, 'Overdue records retrieved'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
