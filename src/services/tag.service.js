const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Tag Service
 * Manages multi-dimensional taxonomies and many-to-many book tagging.
 */
class TagService {
  /**
   * Retrieves all available tags along with associated book counts.
   * 
   * @returns {Array<Object>} List of tags with usage metrics
   */
  getAllTags() {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, COUNT(bt.book_id) as book_count
      FROM tags t
      LEFT JOIN book_tags bt ON t.id = bt.tag_id
      GROUP BY t.id
      ORDER BY book_count DESC, t.name ASC
    `).all();
  }

  /**
   * Creates a new tag with auto-generated slug.
   * 
   * @param {Object} tagData - Tag creation payload
   * @param {string} tagData.name - Human-readable tag name (e.g. 'Award Winner')
   * @param {string} [tagData.description] - Description of the tag
   * @returns {Object} Created tag record
   */
  createTag({ name, description }) {
    const db = getDb();
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Tag name is required', HTTP_STATUS.BAD_REQUEST);
    }

    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existingTag = db.prepare('SELECT id FROM tags WHERE slug = ? OR name = ?').get(slug, trimmedName);
    if (existingTag) {
      return db.prepare('SELECT * FROM tags WHERE id = ?').get(existingTag.id);
    }

    const id = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT INTO tags (id, name, slug, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, trimmedName, slug, description || null, now);

    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  }

  /**
   * Attaches a tag to a book.
   * 
   * @param {string} bookId - Target book ID
   * @param {string} tagId - Target tag ID
   * @returns {Object} Success confirmation with book and tag details
   */
  addTagToBook(bookId, tagId) {
    const db = getDb();

    const book = db.prepare('SELECT id, title FROM books WHERE id = ? AND is_deleted = 0').get(bookId);
    if (!book) throw new AppError('Book not found', HTTP_STATUS.NOT_FOUND);

    const tag = db.prepare('SELECT id, name FROM tags WHERE id = ?').get(tagId);
    if (!tag) throw new AppError('Tag not found', HTTP_STATUS.NOT_FOUND);

    const id = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT OR IGNORE INTO book_tags (id, book_id, tag_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, bookId, tagId, now);

    return { message: `Tag "${tag.name}" successfully attached to "${book.title}"` };
  }

  /**
   * Removes a tag from a book.
   * 
   * @param {string} bookId - Target book ID
   * @param {string} tagId - Target tag ID
   * @returns {Object} Success confirmation
   */
  removeTagFromBook(bookId, tagId) {
    const db = getDb();
    db.prepare('DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?').run(bookId, tagId);
    return { message: 'Tag removed from book successfully' };
  }

  /**
   * Retrieves all tags attached to a specific book.
   * 
   * @param {string} bookId - Book ID
   * @returns {Array<Object>} List of attached tags
   */
  getBookTags(bookId) {
    const db = getDb();
    return db.prepare(`
      SELECT t.id, t.name, t.slug, t.description, bt.created_at as tagged_at
      FROM tags t
      JOIN book_tags bt ON t.id = bt.tag_id
      WHERE bt.book_id = ?
      ORDER BY t.name ASC
    `).all(bookId);
  }
}

module.exports = new TagService();
