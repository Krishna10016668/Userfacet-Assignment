const express = require('express');
const router = express.Router();
const { getDb } = require('../database/connection');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { buildResponse, generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const { HTTP_STATUS } = require('../utils/constants');
const Joi = require('joi');

const createListSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('', null),
  is_public: Joi.boolean().default(false)
});

const updateListSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow('', null),
  is_public: Joi.boolean()
});

/**
 * @route POST /api/reading-lists
 * @desc Create a reading list
 * @access Private
 */
router.post('/', authenticate, validate(createListSchema), (req, res, next) => {
  try {
    const db = getDb();
    const { name, description, is_public } = req.body;
    const id = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT INTO reading_lists (id, user_id, name, description, is_public, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, name, description, is_public ? 1 : 0, now);

    const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(id);
    res.status(201).json(buildResponse(true, list, 'Reading list created successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/reading-lists
 * @desc Get user's reading lists with book count
 * @access Private
 */
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const lists = db.prepare(`
      SELECT rl.*, COUNT(rli.id) as book_count
      FROM reading_lists rl
      LEFT JOIN reading_list_items rli ON rl.id = rli.reading_list_id
      WHERE rl.user_id = ?
      GROUP BY rl.id
      ORDER BY rl.created_at DESC
    `).all(req.user.id);

    res.json(buildResponse(true, lists, 'Reading lists fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/reading-lists/public
 * @desc Get public reading lists with user info and book count
 * @access Public
 */
router.get('/public', (req, res, next) => {
  try {
    const db = getDb();
    const lists = db.prepare(`
      SELECT rl.*, u.username, COUNT(rli.id) as book_count
      FROM reading_lists rl
      JOIN users u ON rl.user_id = u.id
      LEFT JOIN reading_list_items rli ON rl.id = rli.reading_list_id
      WHERE rl.is_public = 1
      GROUP BY rl.id
      ORDER BY rl.created_at DESC
    `).all();

    res.json(buildResponse(true, lists, 'Public reading lists fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/reading-lists/:id
 * @desc Get reading list with its books
 * @access Public (if list is public) or Private (if owner)
 */
router.get('/:id', optionalAuth, (req, res, next) => {
  try {
    const db = getDb();
    const listId = req.params.id;

    const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
    
    if (!list) {
      throw new AppError('Reading list not found', HTTP_STATUS.NOT_FOUND);
    }

    if (list.is_public === 0 && (!req.user || req.user.id !== list.user_id)) {
      throw new AppError('Unauthorized access to this reading list', HTTP_STATUS.FORBIDDEN);
    }

    const books = db.prepare(`
      SELECT b.*, rli.position
      FROM books b
      JOIN reading_list_items rli ON b.id = rli.book_id
      WHERE rli.reading_list_id = ?
      ORDER BY rli.position ASC
    `).all(listId);

    list.books = books;

    res.json(buildResponse(true, list, 'Reading list fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/reading-lists/:id
 * @desc Update reading list
 * @access Private (Owner only)
 */
router.put('/:id', authenticate, validate(updateListSchema), (req, res, next) => {
  try {
    const db = getDb();
    const listId = req.params.id;
    const { name, description, is_public } = req.body;

    const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
    if (!list) {
      throw new AppError('Reading list not found', HTTP_STATUS.NOT_FOUND);
    }
    if (list.user_id !== req.user.id) {
      throw new AppError('Unauthorized', HTTP_STATUS.FORBIDDEN);
    }

    const newName = name !== undefined ? name : list.name;
    const newDesc = description !== undefined ? description : list.description;
    const newIsPublic = is_public !== undefined ? (is_public ? 1 : 0) : list.is_public;

    db.prepare(`
      UPDATE reading_lists 
      SET name = ?, description = ?, is_public = ? 
      WHERE id = ?
    `).run(newName, newDesc, newIsPublic, listId);

    const updatedList = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
    res.json(buildResponse(true, updatedList, 'Reading list updated successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/reading-lists/:id
 * @desc Delete reading list
 * @access Private (Owner only)
 */
router.delete('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const listId = req.params.id;

    const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
    if (!list) {
      throw new AppError('Reading list not found', HTTP_STATUS.NOT_FOUND);
    }
    if (list.user_id !== req.user.id) {
      throw new AppError('Unauthorized', HTTP_STATUS.FORBIDDEN);
    }

    // Cascade delete items is handled by foreign key if set up, or manual delete
    db.prepare('DELETE FROM reading_list_items WHERE reading_list_id = ?').run(listId);
    db.prepare('DELETE FROM reading_lists WHERE id = ?').run(listId);

    res.json(buildResponse(true, null, 'Reading list deleted successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/reading-lists/:id/books
 * @desc Add book to list
 * @access Private (Owner only)
 */
router.post('/:id/books', authenticate, validate(Joi.object({ book_id: Joi.string().uuid().required() })), (req, res, next) => {
  try {
    const db = getDb();
    const listId = req.params.id;
    const { book_id } = req.body;

    const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
    if (!list) {
      throw new AppError('Reading list not found', HTTP_STATUS.NOT_FOUND);
    }
    if (list.user_id !== req.user.id) {
      throw new AppError('Unauthorized', HTTP_STATUS.FORBIDDEN);
    }

    const book = db.prepare('SELECT id FROM books WHERE id = ?').get(book_id);
    if (!book) {
      throw new AppError('Book not found', HTTP_STATUS.NOT_FOUND);
    }

    // Check if already in list
    const existing = db.prepare('SELECT id FROM reading_list_items WHERE reading_list_id = ? AND book_id = ?').get(listId, book_id);
    if (existing) {
      throw new AppError('Book already in reading list', HTTP_STATUS.BAD_REQUEST);
    }

    const posRow = db.prepare('SELECT MAX(position) as maxPos FROM reading_list_items WHERE reading_list_id = ?').get(listId);
    const position = (posRow.maxPos || 0) + 1;
    const itemId = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT INTO reading_list_items (id, reading_list_id, book_id, position, added_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(itemId, listId, book_id, position, now);

    res.status(201).json(buildResponse(true, { id: itemId, position }, 'Book added to reading list'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/reading-lists/:id/books/:bookId
 * @desc Remove book from list
 * @access Private (Owner only)
 */
router.delete('/:id/books/:bookId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const listId = req.params.id;
    const bookId = req.params.bookId;

    const list = db.prepare('SELECT * FROM reading_lists WHERE id = ?').get(listId);
    if (!list) {
      throw new AppError('Reading list not found', HTTP_STATUS.NOT_FOUND);
    }
    if (list.user_id !== req.user.id) {
      throw new AppError('Unauthorized', HTTP_STATUS.FORBIDDEN);
    }

    db.prepare('DELETE FROM reading_list_items WHERE reading_list_id = ? AND book_id = ?').run(listId, bookId);

    res.json(buildResponse(true, null, 'Book removed from reading list'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
