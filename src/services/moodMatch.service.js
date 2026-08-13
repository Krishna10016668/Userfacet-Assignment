const axios = require('axios');
const { getDb } = require('../database/connection');
const config = require('../config');

class MoodMatchService {
  async matchMood(moodQuery) {
    const db = getDb();
    // Fetch available catalog
    const catalog = db.prepare(`
      SELECT b.id, b.title, a.name as author, c.name as category, b.avg_rating
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.is_deleted = 0 AND b.available_copies > 0
      ORDER BY b.avg_rating DESC
      LIMIT 20
    `).all();

    try {
      const response = await axios.post(`${config.AI_SERVICE_URL}/ai/mood-match`, {
        mood_query: moodQuery,
        catalog
      }, { timeout: 35000 });

      if (response.data && response.data.data) {
        return { matches: response.data.data.matches || response.data.data, query: moodQuery, generated_via: 'ai_microservice' };
      }
    } catch (err) {
      console.error('[MoodMatch] AI service error:', err.message);
    }

    // Fallback
    return {
      matches: catalog.slice(0, 3).map(b => ({ book_id: b.id, title: b.title, match_reason: `Top-rated ${b.category || 'book'} in the library` })),
      query: moodQuery,
      generated_via: 'fallback'
    };
  }
}
module.exports = new MoodMatchService();
