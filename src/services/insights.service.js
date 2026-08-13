const axios = require('axios');
const { getDb } = require('../database/connection');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

/**
 * Insights Service
 * Aggregates reader history and coordinates with Python AI service to generate personalized reading profiles.
 */
class InsightsService {
  /**
   * Generates AI reading persona and tailored recommendations for a user
   * @param {string} userId - User ID
   * @returns {Object} AI persona, reading pattern analysis, and recommended next reads
   */
  async getUserReadingInsights(userId) {
    const db = getDb();

    // 1. Fetch user info
    const user = db.prepare('SELECT id, full_name, username, created_at FROM users WHERE id = ?').get(userId);
    if (!user) throw new AppError('User not found', 404);

    // 2. Fetch user's borrowing history with book/author/category metadata
    const history = db.prepare(`
      SELECT 
        b.id as book_id, b.title, a.name as author, c.name as category,
        br.borrow_date, br.status
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE br.user_id = ?
      ORDER BY br.borrow_date DESC
    `).all(userId);

    // 3. Fetch candidate books from catalog that user hasn't borrowed yet
    const borrowedBookIds = history.map(h => h.book_id);
    let catalog = [];
    if (borrowedBookIds.length > 0) {
      const placeholders = borrowedBookIds.map(() => '?').join(',');
      catalog = db.prepare(`
        SELECT b.id, b.title, a.name as author, c.name as category, b.avg_rating
        FROM books b
        LEFT JOIN authors a ON b.author_id = a.id
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE b.id NOT IN (${placeholders}) AND b.is_deleted = 0
        ORDER BY b.avg_rating DESC, b.created_at DESC
        LIMIT 10
      `).all(...borrowedBookIds);
    } else {
      catalog = db.prepare(`
        SELECT b.id, b.title, a.name as author, c.name as category, b.avg_rating
        FROM books b
        LEFT JOIN authors a ON b.author_id = a.id
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE b.is_deleted = 0
        ORDER BY b.avg_rating DESC, b.created_at DESC
        LIMIT 10
      `).all();
    }

    // 4. Request AI profiling from Python microservice
    try {
      const response = await axios.post(`${config.AI_SERVICE_URL}/ai/reading-insights`, {
        user_name: user.full_name || user.username,
        history,
        catalog
      }, { timeout: 35000 });

      if (response.data && response.data.data) {
        return {
          user: { id: user.id, name: user.full_name, username: user.username },
          total_books_read: history.length,
          insights: response.data.data,
          generated_via: 'ai_microservice'
        };
      }
    } catch (err) {
      console.error('[Insights Service] Python AI service unavailable, using local intelligence engine:', err.message);
    }

    // 5. High-fidelity Rule-Based Fallback Engine
    const topCategories = {};
    history.forEach(b => {
      const cat = b.category || 'General';
      topCategories[cat] = (topCategories[cat] || 0) + 1;
    });

    const sortedCats = Object.entries(topCategories).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const primaryGenres = sortedCats.length > 0 ? sortedCats.slice(0, 3) : ['Dystopian Fiction', 'Classic Literature'];

    const persona = history.length >= 3 ? 'Dedicated Scholar & Explorer' : (history.length > 0 ? 'Avid Inquisitive Reader' : 'Emerging Bibliophile');

    return {
      user: { id: user.id, name: user.full_name, username: user.username },
      total_books_read: history.length,
      insights: {
        reader_persona: persona,
        primary_genres: primaryGenres,
        reading_habits_analysis: `${user.full_name} has borrowed ${history.length} book(s), showing a strong inclination towards ${primaryGenres.join(' and ')}.`,
        recommended_next_reads: catalog.slice(0, 3).map(b => ({
          book_id: b.id,
          title: b.title,
          reason: `Highly rated title in ${b.category || 'the collection'} to broaden your reading repertoire.`
        })),
        ai_curator_message: `Welcome ${user.full_name}! Your curated reading journey continues with these handpicked selections.`
      },
      generated_via: 'local_curator_fallback'
    };
  }
}

module.exports = new InsightsService();
