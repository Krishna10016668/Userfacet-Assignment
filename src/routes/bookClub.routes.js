const express = require('express');
const bookClubService = require('../services/bookClub.service');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/clubs
 * @desc List public book clubs with search and pagination
 * @access Public
 */
router.get('/', optionalAuth, (req, res, next) => {
  try {
    const result = bookClubService.listClubs(req.query);
    res.status(200).json(buildResponse(true, result.clubs, 'Book clubs retrieved successfully', result.pagination));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/clubs
 * @desc Create a new book club (creator becomes Organizer)
 * @access Private (Member, Librarian, Admin)
 */
router.post('/', authenticate, (req, res, next) => {
  try {
    const club = bookClubService.createClub(req.user.id, req.body);
    res.status(201).json(buildResponse(true, club, 'Book club created successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/clubs/:id
 * @desc Get detailed information about a book club
 * @access Public (Optional Auth)
 */
router.get('/:id', optionalAuth, (req, res, next) => {
  try {
    const club = bookClubService.getClubById(req.params.id);
    res.status(200).json(buildResponse(true, club, 'Book club details retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/clubs/:id/join
 * @desc Join a book club
 * @access Private
 */
router.post('/:id/join', authenticate, (req, res, next) => {
  try {
    const result = bookClubService.joinClub(req.params.id, req.user.id);
    res.status(200).json(buildResponse(true, result, result.message));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/clubs/:id/leave
 * @desc Leave a book club
 * @access Private
 */
router.post('/:id/leave', authenticate, (req, res, next) => {
  try {
    const result = bookClubService.leaveClub(req.params.id, req.user.id);
    res.status(200).json(buildResponse(true, null, result.message));
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/clubs/:id/current-book
 * @desc Set the active Book of the Month for a club
 * @access Private (Organizer only)
 */
router.put('/:id/current-book', authenticate, (req, res, next) => {
  try {
    const { book_id } = req.body;
    const club = bookClubService.setClubBook(req.params.id, req.user.id, book_id);
    res.status(200).json(buildResponse(true, club, 'Book of the Month updated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/clubs/:id/progress
 * @desc Get collective reading progress for club members on current book
 * @access Private
 */
router.get('/:id/progress', authenticate, (req, res, next) => {
  try {
    const progress = bookClubService.getClubReadingProgress(req.params.id);
    res.status(200).json(buildResponse(true, progress, 'Club reading progress retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
