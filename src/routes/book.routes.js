const express = require('express');
const bookService = require('../services/book.service');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/rateLimiter');
const { ROLES } = require('../utils/constants');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/books
 * @desc Get all books with pagination and filters
 * @access Public (Optional Auth)
 */
router.get('/', optionalAuth, validate(schemas.pagination, 'query'), async (req, res, next) => {
  try {
    const result = bookService.getAllBooks(req.query);
    res.status(200).json(buildResponse(true, result.books, 'Books retrieved successfully', result.pagination));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/search
 * @desc Search for books
 * @access Public
 */
router.get('/search', validate(schemas.searchBooks, 'query'), async (req, res, next) => {
  try {
    const result = bookService.searchBooks(req.query);
    res.status(200).json(buildResponse(true, result.books, 'Search results retrieved successfully', result.pagination));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/popular
 * @desc Get popular books
 * @access Public
 */
router.get('/popular', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const books = bookService.getPopularBooks(limit);
    res.status(200).json(buildResponse(true, books, 'Popular books retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/:id
 * @desc Get a book by ID
 * @access Public (Optional Auth)
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const book = bookService.getBookById(req.params.id);
    res.status(200).json(buildResponse(true, book, 'Book retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/:id/summary
 * @desc Get AI generated summary of a book
 * @access Private
 */
router.get('/:id/summary', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const summaryType = req.query.type || 'brief';
    const result = await bookService.getBookSummary(req.params.id, summaryType);
    res.status(200).json(buildResponse(true, result, 'Summary retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/:id/recommendations
 * @desc Get AI recommendations based on a book
 * @access Private
 */
router.get('/:id/recommendations', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const recommendations = await bookService.getBookRecommendations(req.params.id);
    res.status(200).json(buildResponse(true, recommendations, 'Recommendations retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/:id/also-borrowed
 * @desc Get collaborative filtering recommendations ('Readers Also Borrowed')
 * @access Public (Optional Auth)
 */
router.get('/:id/also-borrowed', optionalAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
    const recommendations = bookService.getAlsoBorrowed(req.params.id, limit);
    res.status(200).json(buildResponse(true, recommendations, 'Collaborative filtering recommendations retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/books/:id/ask
 * @desc Ask a question about a book
 * @access Private
 */
router.post('/:id/ask', authenticate, aiLimiter, async (req, res, next) => {
  try {
    if (!req.body.question) {
      return res.status(400).json(buildResponse(false, null, 'Question is required'));
    }
    const result = await bookService.askBookQuestion(req.params.id, req.body.question);
    res.status(200).json(buildResponse(true, result, 'Answer retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/:id/ai-quiz
 * @desc Get an AI generated quiz for a book
 * @access Private
 */
router.get('/:id/ai-quiz', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const numQuestions = req.query.questions ? parseInt(req.query.questions, 10) : 5;
    const result = await bookService.getBookQuiz(req.params.id, numQuestions);
    res.status(200).json(buildResponse(true, result, 'Quiz retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/books/:id/ai-reviews-digest
 * @desc Get an AI generated digest of book reviews
 * @access Public (Optional Auth)
 */
router.get('/:id/ai-reviews-digest', optionalAuth, async (req, res, next) => {
  try {
    const result = await bookService.getReviewDigest(req.params.id);
    res.status(200).json(buildResponse(true, result, 'Review digest retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/books
 * @desc Create a new book
 * @access Private (Librarian/Admin)
 */
router.post('/', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), validate(schemas.createBook), async (req, res, next) => {
  try {
    const book = bookService.createBook(req.body);
    res.status(201).json(buildResponse(true, book, 'Book created successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/books/:id
 * @desc Update a book
 * @access Private (Librarian/Admin)
 */
router.put('/:id', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), validate(schemas.updateBook), async (req, res, next) => {
  try {
    const book = bookService.updateBook(req.params.id, req.body);
    res.status(200).json(buildResponse(true, book, 'Book updated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /api/books/:id
 * @desc Soft delete a book
 * @access Private (Admin)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const result = bookService.deleteBook(req.params.id);
    res.status(200).json(buildResponse(true, null, result.message));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
