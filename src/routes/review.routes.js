const express = require('express');
const router = express.Router();
const ReviewService = require('../services/review.service');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { buildResponse } = require('../utils/helpers');

/**
 * @route POST /api/reviews
 * @desc Create a review for a book
 * @access Private
 */
router.post('/', authenticate, validate(schemas.createReview), (req, res, next) => {
  try {
    const review = ReviewService.createReview(req.user.id, req.body);
    res.status(201).json(buildResponse(true, review, 'Review created successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/reviews/:id
 * @desc Update a review
 * @access Private
 */
router.put('/:id', authenticate, (req, res, next) => {
  try {
    const review = ReviewService.updateReview(req.params.id, req.user.id, req.body);
    res.json(buildResponse(true, review, 'Review updated successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/reviews/:id
 * @desc Delete a review
 * @access Private
 */
router.delete('/:id', authenticate, (req, res, next) => {
  try {
    ReviewService.deleteReview(req.params.id, req.user.id, req.user.role);
    res.json(buildResponse(true, null, 'Review deleted successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/reviews/book/:bookId
 * @desc Get all reviews for a book (paginated)
 * @access Public
 */
router.get('/book/:bookId', (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = ReviewService.getBookReviews(req.params.bookId, { page, limit });
    res.json({
      success: true,
      data: result.items,
      message: 'Book reviews fetched successfully',
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
