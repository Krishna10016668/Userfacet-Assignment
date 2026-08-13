const { getDb } = require('./connection');

/**
 * Initializes the database schema with all required tables and indexes
 */
function initializeDatabase() {
  const db = getDb();

  // Begin transaction for schema initialization
  const initializeSchema = db.transaction(() => {
    // 1. Create Users table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('MEMBER', 'LIBRARIAN', 'ADMIN')),
        is_active INTEGER NOT NULL DEFAULT 1,
        max_books_allowed INTEGER NOT NULL DEFAULT 5,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 2. Create Authors table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS authors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        biography TEXT,
        nationality TEXT,
        birth_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 3. Create Categories table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        parent_category_id TEXT REFERENCES categories(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 4. Create Books table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        isbn TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        author_id TEXT NOT NULL REFERENCES authors(id),
        category_id TEXT NOT NULL REFERENCES categories(id),
        publication_year INTEGER,
        publisher TEXT,
        language TEXT NOT NULL DEFAULT 'English',
        page_count INTEGER,
        total_copies INTEGER NOT NULL DEFAULT 1,
        available_copies INTEGER NOT NULL DEFAULT 1,
        avg_rating REAL NOT NULL DEFAULT 0,
        cover_image_url TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 5. Create Borrow Records table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS borrow_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        book_id TEXT NOT NULL REFERENCES books(id),
        borrow_date TEXT NOT NULL DEFAULT (datetime('now')),
        due_date TEXT NOT NULL,
        return_date TEXT,
        renewal_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'RETURNED', 'OVERDUE')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 6. Create Reservations table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        book_id TEXT NOT NULL REFERENCES books(id),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
        queue_position INTEGER NOT NULL,
        reserved_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 7. Create Reviews table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        book_id TEXT NOT NULL REFERENCES books(id),
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        review_text TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, book_id)
      )
    `).run();

    // 8. Create AI Summaries table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ai_summaries (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id),
        summary_text TEXT NOT NULL,
        summary_type TEXT NOT NULL DEFAULT 'brief' CHECK(summary_type IN ('brief', 'detailed', 'chapter_wise')),
        token_count INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        UNIQUE(book_id, summary_type)
      )
    `).run();

    // 9. Create Fines table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS fines (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        borrow_record_id TEXT NOT NULL REFERENCES borrow_records(id),
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'WAIVED')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        paid_at TEXT
      )
    `).run();

    // 10. Create Reading Lists table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reading_lists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        description TEXT,
        is_public INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 11. Create Reading List Items table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reading_list_items (
        id TEXT PRIMARY KEY,
        reading_list_id TEXT NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
        book_id TEXT NOT NULL REFERENCES books(id),
        position INTEGER NOT NULL DEFAULT 0,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(reading_list_id, book_id)
      )
    `).run();

    // 12. Create Notifications table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('DUE_REMINDER', 'OVERDUE', 'RESERVATION_READY', 'FINE', 'SYSTEM')),
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 13. Create Reading Progress table (Feature: Reading Progress Tracker)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        id TEXT PRIMARY KEY,
        borrow_id TEXT NOT NULL REFERENCES borrow_records(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id),
        book_id TEXT NOT NULL REFERENCES books(id),
        current_page INTEGER NOT NULL DEFAULT 0,
        total_pages INTEGER NOT NULL DEFAULT 0,
        percentage REAL NOT NULL DEFAULT 0.0,
        reading_speed_pph REAL DEFAULT 0.0,
        estimated_hours_remaining REAL DEFAULT 0.0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(borrow_id)
      )
    `).run();

    // 14. Create Audit Log table (Feature: Enterprise Audit Trail)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL REFERENCES users(id),
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 15. Create Tags table (Feature: Multi-Dimensional Book Taxonomies)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 16. Create Book Tags junction table (Many-to-Many Book-Tag Relationship)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS book_tags (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(book_id, tag_id)
      )
    `).run();

    // 17. Create User Badges table (Feature: Reading Gamification & Milestones)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_key TEXT NOT NULL,
        badge_name TEXT NOT NULL,
        badge_description TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '🏆',
        unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, badge_key)
      )
    `).run();

    // 18. Create Reading Streaks table (Feature: Daily Consecutive Reading Streaks)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS reading_streaks (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        current_streak_days INTEGER NOT NULL DEFAULT 0,
        longest_streak_days INTEGER NOT NULL DEFAULT 0,
        last_activity_date TEXT,
        total_active_days INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 19. Create Book Clubs table (Feature: Collaborative Book Clubs & Reading Circles)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS book_clubs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        organizer_id TEXT NOT NULL REFERENCES users(id),
        current_book_id TEXT REFERENCES books(id),
        is_private INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // 20. Create Club Members junction table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS club_members (
        id TEXT PRIMARY KEY,
        club_id TEXT NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('ORGANIZER', 'MEMBER')),
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(club_id, user_id)
      )
    `).run();

    // Create Indexes
    db.prepare('CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_borrow_user ON borrow_records(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_borrow_book ON borrow_records(book_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_borrow_status ON borrow_records(status)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reservations_book ON reservations(book_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reviews_book ON reviews(book_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_fines_user ON fines(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ai_summaries_book ON ai_summaries(book_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reading_progress_borrow ON reading_progress(borrow_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_book_tags_book ON book_tags(book_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_book_tags_tag ON book_tags(tag_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_reading_streaks_user ON reading_streaks(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_book_clubs_organizer ON book_clubs(organizer_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id)').run();
  });

  initializeSchema();
  console.log('Database schema and indexes initialized successfully.');
}

module.exports = { initializeDatabase };
