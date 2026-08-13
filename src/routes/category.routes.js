const express = require('express');
const { getDb } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { ROLES } = require('../utils/constants');
const { buildResponse, generateUUID, calculatePagination } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route GET /api/categories
 * @desc Get all categories with subcategory structure and book counts
 * @access Public
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    
    // Get all categories and count books directly in SQL
    const categories = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM books WHERE category_id = c.id AND is_deleted = 0) as book_count
      FROM categories c
    `).all();
    
    // Build tree structure
    const categoryMap = {};
    const roots = [];
    
    categories.forEach(c => {
      c.subcategories = [];
      categoryMap[c.id] = c;
    });
    
    categories.forEach(c => {
      if (c.parent_id && categoryMap[c.parent_id]) {
        categoryMap[c.parent_id].subcategories.push(c);
      } else {
        roots.push(c);
      }
    });
    
    res.status(200).json(buildResponse(true, roots, 'Categories retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/categories/:id
 * @desc Get category with paginated books and subcategories
 * @access Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);
    
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) throw new AppError('Category not found', 404);
    
    category.subcategories = db.prepare('SELECT * FROM categories WHERE parent_id = ?').all(id);
    
    const count = db.prepare('SELECT COUNT(*) as total FROM books WHERE category_id = ? AND is_deleted = 0').get(id).total;
    const books = db.prepare(`
      SELECT id, title, cover_image_url, author_id, published_year, avg_rating 
      FROM books 
      WHERE category_id = ? AND is_deleted = 0
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(id, sqlLimit, offset);
    
    category.books = {
      data: books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / sqlLimit)
      }
    };
    
    res.status(200).json(buildResponse(true, category, 'Category retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/categories
 * @desc Create a new category
 * @access Private (Admin)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), validate(schemas.createCategory), async (req, res, next) => {
  try {
    const db = getDb();
    const { name, description, parent_id } = req.body;
    
    const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
    if (existing) throw new AppError('Category name already exists', 409);
    
    if (parent_id) {
      const parent = db.prepare('SELECT id FROM categories WHERE id = ?').get(parent_id);
      if (!parent) throw new AppError('Parent category not found', 404);
    }
    
    const id = generateUUID();
    db.prepare(`
      INSERT INTO categories (id, name, description, parent_id)
      VALUES (?, ?, ?, ?)
    `).run(id, name, description || null, parent_id || null);
    
    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.status(201).json(buildResponse(true, created, 'Category created successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/categories/:id
 * @desc Update a category
 * @access Private (Admin)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const db = getDb();
    const { name, description, parent_id } = req.body;
    const id = req.params.id;
    
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) throw new AppError('Category not found', 404);
    
    if (name && name !== category.name) {
      const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
      if (existing) throw new AppError('Category name already exists', 409);
    }
    
    const updates = [];
    const params = [];
    
    if (name) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (parent_id !== undefined) { updates.push('parent_id = ?'); params.push(parent_id); }
    
    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.status(200).json(buildResponse(true, updated, 'Category updated successfully'));
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /api/categories/:id
 * @desc Delete a category
 * @access Private (Admin)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const db = getDb();
    const id = req.params.id;
    
    const bookCount = db.prepare('SELECT COUNT(*) as count FROM books WHERE category_id = ? AND is_deleted = 0').get(id).count;
    if (bookCount > 0) throw new AppError('Cannot delete category containing active books', 400);
    
    const subcats = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(id).count;
    if (subcats > 0) throw new AppError('Cannot delete category with subcategories', 400);
    
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.status(200).json(buildResponse(true, null, 'Category deleted successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
