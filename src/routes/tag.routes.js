const express = require('express');
const tagService = require('../services/tag.service');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/tags
 * @desc Get all tags with associated book counts
 * @access Public
 */
router.get('/', (req, res, next) => {
  try {
    const tags = tagService.getAllTags();
    res.status(200).json(buildResponse(true, tags, 'Tags retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/tags
 * @desc Create a new tag
 * @access Private (Librarian, Admin)
 */
router.post('/', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const tag = tagService.createTag(req.body);
    res.status(201).json(buildResponse(true, tag, 'Tag created successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/tags/book/:bookId
 * @desc Get all tags attached to a book
 * @access Public
 */
router.get('/book/:bookId', (req, res, next) => {
  try {
    const tags = tagService.getBookTags(req.params.bookId);
    res.status(200).json(buildResponse(true, tags, 'Book tags retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/tags/book/:bookId
 * @desc Attach a tag to a book
 * @access Private (Librarian, Admin)
 */
router.post('/book/:bookId', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const result = tagService.addTagToBook(req.params.bookId, req.body.tag_id);
    res.status(200).json(buildResponse(true, result, result.message));
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /api/tags/book/:bookId/:tagId
 * @desc Detach a tag from a book
 * @access Private (Librarian, Admin)
 */
router.delete('/book/:bookId/:tagId', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const result = tagService.removeTagFromBook(req.params.bookId, req.params.tagId);
    res.status(200).json(buildResponse(true, null, result.message));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
