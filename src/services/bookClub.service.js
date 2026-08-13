const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp, calculatePagination } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Book Club Service
 * Coordinates reading circles, group book assignments, and collaborative reading progress.
 */
class BookClubService {
  /**
   * Creates a new book club and designates creator as the organizer.
   * 
   * @param {string} organizerId - User ID of the club creator
   * @param {Object} clubData - Club creation payload
   * @param {string} clubData.name - Name of the club
   * @param {string} [clubData.description] - Description or reading mission
   * @param {string} [clubData.current_book_id] - Optional initial book of the month
   * @param {boolean} [clubData.is_private] - Whether club is private
   * @returns {Object} Created club record
   */
  createClub(organizerId, { name, description, current_book_id, is_private = false }) {
    const db = getDb();
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Club name is required', HTTP_STATUS.BAD_REQUEST);
    }

    if (current_book_id) {
      const book = db.prepare('SELECT id FROM books WHERE id = ? AND is_deleted = 0').get(current_book_id);
      if (!book) throw new AppError('Specified initial book not found', HTTP_STATUS.NOT_FOUND);
    }

    const clubId = generateUUID();
    const memberId = generateUUID();
    const now = getCurrentTimestamp();

    const tx = db.transaction(() => {
      // 1. Create Book Club
      db.prepare(`
        INSERT INTO book_clubs (id, name, description, organizer_id, current_book_id, is_private, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(clubId, name.trim(), description || null, organizerId, current_book_id || null, is_private ? 1 : 0, now, now);

      // 2. Add Organizer as first member
      db.prepare(`
        INSERT INTO club_members (id, club_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'ORGANIZER', ?)
      `).run(memberId, clubId, organizerId, now);
    });

    tx();
    return this.getClubById(clubId);
  }

  /**
   * Retrieves a single club by ID with member roster and current book details.
   * 
   * @param {string} clubId - Unique identifier of the club
   * @returns {Object} Detailed club object
   */
  getClubById(clubId) {
    const db = getDb();
    const club = db.prepare(`
      SELECT 
        c.*, 
        u.full_name as organizer_name, u.username as organizer_username,
        b.title as current_book_title, b.cover_image_url as current_book_cover,
        b.avg_rating as current_book_rating
      FROM book_clubs c
      JOIN users u ON c.organizer_id = u.id
      LEFT JOIN books b ON c.current_book_id = b.id
      WHERE c.id = ?
    `).get(clubId);

    if (!club) {
      throw new AppError('Book club not found', HTTP_STATUS.NOT_FOUND);
    }

    // Fetch members
    const members = db.prepare(`
      SELECT cm.id, cm.role, cm.joined_at, u.id as user_id, u.full_name, u.username
      FROM club_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.club_id = ?
      ORDER BY cm.role DESC, cm.joined_at ASC
    `).all(clubId);

    club.member_count = members.length;
    club.members = members;

    return club;
  }

  /**
   * Lists book clubs with search and pagination.
   * 
   * @param {Object} query - Pagination and search query options
   * @returns {Object} Paginated club list
   */
  listClubs({ page = 1, limit = 10, search = '' }) {
    const db = getDb();
    const { offset, limit: sqlLimit } = calculatePagination(page, limit);

    let whereClause = 'WHERE c.is_private = 0';
    const params = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const count = db.prepare(`SELECT COUNT(*) as total FROM book_clubs c ${whereClause}`).get(...params).total;

    const clubs = db.prepare(`
      SELECT 
        c.*, 
        u.full_name as organizer_name,
        b.title as current_book_title,
        (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
      FROM book_clubs c
      JOIN users u ON c.organizer_id = u.id
      LEFT JOIN books b ON c.current_book_id = b.id
      ${whereClause}
      ORDER BY member_count DESC, c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, sqlLimit, offset);

    return {
      clubs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / sqlLimit)
      }
    };
  }

  /**
   * Joins a user to an existing book club.
   * 
   * @param {string} clubId - Target club ID
   * @param {string} userId - Joining user ID
   * @returns {Object} Membership confirmation
   */
  joinClub(clubId, userId) {
    const db = getDb();
    const club = db.prepare('SELECT id, name, is_private FROM book_clubs WHERE id = ?').get(clubId);
    if (!club) throw new AppError('Book club not found', HTTP_STATUS.NOT_FOUND);

    const existingMember = db.prepare('SELECT id FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
    if (existingMember) {
      throw new AppError('You are already a member of this book club', HTTP_STATUS.BAD_REQUEST);
    }

    const id = generateUUID();
    const now = getCurrentTimestamp();

    db.prepare(`
      INSERT INTO club_members (id, club_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'MEMBER', ?)
    `).run(id, clubId, userId, now);

    return { message: `Successfully joined "${club.name}"` };
  }

  /**
   * Removes a user from a book club.
   * 
   * @param {string} clubId - Target club ID
   * @param {string} userId - Leaving user ID
   * @returns {Object} Confirmation message
   */
  leaveClub(clubId, userId) {
    const db = getDb();
    const member = db.prepare('SELECT role FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
    if (!member) {
      throw new AppError('You are not a member of this book club', HTTP_STATUS.BAD_REQUEST);
    }

    if (member.role === 'ORGANIZER') {
      throw new AppError('Club organizer cannot leave the club. Transfer ownership or delete the club.', HTTP_STATUS.FORBIDDEN);
    }

    db.prepare('DELETE FROM club_members WHERE club_id = ? AND user_id = ?').run(clubId, userId);
    return { message: 'Successfully left the book club' };
  }

  /**
   * Assigns the active Book of the Month for a club.
   * 
   * @param {string} clubId - Club ID
   * @param {string} userId - Requester user ID (must be Organizer)
   * @param {string} bookId - Target Book ID
   * @returns {Object} Updated club record
   */
  setClubBook(clubId, userId, bookId) {
    const db = getDb();
    const club = db.prepare('SELECT organizer_id FROM book_clubs WHERE id = ?').get(clubId);
    if (!club) throw new AppError('Book club not found', HTTP_STATUS.NOT_FOUND);

    if (club.organizer_id !== userId) {
      throw new AppError('Only the club organizer can change the current reading pick', HTTP_STATUS.FORBIDDEN);
    }

    const book = db.prepare('SELECT id, title FROM books WHERE id = ? AND is_deleted = 0').get(bookId);
    if (!book) throw new AppError('Book not found', HTTP_STATUS.NOT_FOUND);

    const now = getCurrentTimestamp();
    db.prepare('UPDATE book_clubs SET current_book_id = ?, updated_at = ? WHERE id = ?').run(bookId, now, clubId);

    return this.getClubById(clubId);
  }

  /**
   * Aggregates collective reading progress for all members on the club's current book.
   * 
   * @param {string} clubId - Club ID
   * @returns {Object} Club reading progress summary and leaderboard
   */
  getClubReadingProgress(clubId) {
    const db = getDb();
    const club = this.getClubById(clubId);

    if (!club.current_book_id) {
      return {
        club_id: club.id,
        club_name: club.name,
        current_book: null,
        message: 'No active Book of the Month currently set for this club.',
        aggregate: { total_members: club.member_count, active_readers: 0, average_completion_pct: 0 },
        member_progress: []
      };
    }

    // Query reading progress of club members for the club's current book
    const memberProgress = db.prepare(`
      SELECT 
        u.id as user_id, u.full_name, u.username, cm.role,
        COALESCE(rp.current_page, 0) as current_page,
        COALESCE(rp.total_pages, b.page_count, 0) as total_pages,
        COALESCE(rp.percentage, 0.0) as completion_percentage,
        COALESCE(rp.reading_speed_pph, 0.0) as reading_speed_pph,
        COALESCE(rp.estimated_hours_remaining, 0.0) as hours_remaining,
        rp.notes as latest_note,
        rp.updated_at as last_read_at
      FROM club_members cm
      JOIN users u ON cm.user_id = u.id
      CROSS JOIN books b ON b.id = ?
      LEFT JOIN reading_progress rp ON rp.user_id = u.id AND rp.book_id = b.id
      WHERE cm.club_id = ?
      ORDER BY completion_percentage DESC, u.full_name ASC
    `).all(club.current_book_id, clubId);

    const activeReaders = memberProgress.filter(m => m.completion_percentage > 0).length;
    const avgPct = memberProgress.length > 0 
      ? memberProgress.reduce((sum, m) => sum + m.completion_percentage, 0) / memberProgress.length 
      : 0;

    return {
      club_id: club.id,
      club_name: club.name,
      current_book: {
        id: club.current_book_id,
        title: club.current_book_title,
        cover_image_url: club.current_book_cover
      },
      aggregate: {
        total_members: club.member_count,
        active_readers: activeReaders,
        average_completion_pct: parseFloat(avgPct.toFixed(2))
      },
      member_progress: memberProgress
    };
  }
}

module.exports = new BookClubService();
