const express = require('express');
const { getDb } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const { buildResponse, generateUUID, calculatePagination } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route GET /api/authors
 * @desc Get all authors with book count
 * @access Public
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const { page = 1, limit = 10, search } = req.query;
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause = 'WHERE name LIKE ?';
      params.push(`%${search}%`);
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM authors ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;
    
    const query = `
      SELECT a.*, 
        (SELECT COUNT(*) FROM books WHERE author_id = a.id AND is_deleted = 0) as book_count
      FROM authors a
      ${whereClause}
      ORDER BY a.name ASC
      LIMIT ? OFFSET ?
    `;
    
    const authors = db.prepare(query).all(...params, sqlLimit, offset);
    
    res.status(200).json(buildResponse(true, authors, 'Authors retrieved successfully', {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / sqlLimit)
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/authors/:id
 * @desc Get author and their books
 * @access Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(id);
    if (!author) throw new AppError('Author not found', 404);
    
    const count = db.prepare('SELECT COUNT(*) as total FROM books WHERE author_id = ? AND is_deleted = 0').get(id).total;
    
    const books = db.prepare(`
      SELECT id, title, cover_image_url, category_id, published_year 
      FROM books 
      WHERE author_id = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(id, sqlLimit, offset);
    
    author.books = {
      data: books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / sqlLimit)
      }
    };
    
    res.status(200).json(buildResponse(true, author, 'Author retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/authors
 * @desc Create a new author
 * @access Private (Librarian/Admin)
 */
router.post('/', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), validate(schemas.createAuthor), async (req, res, next) => {
  try {
    const db = getDb();
    const { name, biography, bio, birth_date, nationality } = req.body;
    
    const id = generateUUID();
    db.prepare(`
      INSERT INTO authors (id, name, biography, nationality, birth_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, biography || bio || null, nationality || null, birth_date || null);
    
    const created = db.prepare('SELECT * FROM authors WHERE id = ?').get(id);
    res.status(201).json(buildResponse(true, created, 'Author created successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/authors/:id
 * @desc Update an author
 * @access Private (Librarian/Admin)
 */
router.put('/:id', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), async (req, res, next) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const author = db.prepare('SELECT id FROM authors WHERE id = ?').get(id);
    if (!author) throw new AppError('Author not found', 404);
    
    const updates = [];
    const params = [];
    const allowed = ['name', 'biography', 'nationality', 'birth_date'];
    
    // Map bio to biography if provided
    if (req.body.bio && !req.body.biography) {
      req.body.biography = req.body.bio;
    }

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
    
    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE authors SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    const updated = db.prepare('SELECT * FROM authors WHERE id = ?').get(id);
    res.status(200).json(buildResponse(true, updated, 'Author updated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /api/authors/:id
 * @desc Delete an author
 * @access Private (Admin)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const db = getDb();
    const id = req.params.id;
    
    const bookCount = db.prepare('SELECT COUNT(*) as count FROM books WHERE author_id = ? AND is_deleted = 0').get(id).count;
    if (bookCount > 0) throw new AppError('Cannot delete author with associated active books', 400);
    
    db.prepare('DELETE FROM authors WHERE id = ?').run(id);
    res.status(200).json(buildResponse(true, null, 'Author deleted successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
