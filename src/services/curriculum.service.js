const axios = require('axios');
const { getDb } = require('../database/connection');
const config = require('../config');

class CurriculumService {
  async generateCurriculum(userId, goal, numBooks = 5) {
    const db = getDb();
    const user = db.prepare('SELECT id, full_name, username FROM users WHERE id = ?').get(userId);
    
    // Fetch available catalog
    const catalog = db.prepare(`
      SELECT b.id, b.title, a.name as author, c.name as category, b.description, b.avg_rating
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.is_deleted = 0
      ORDER BY b.avg_rating DESC
      LIMIT 20
    `).all();

    try {
      const response = await axios.post(`${config.AI_SERVICE_URL}/ai/reading-curriculum`, {
        goal,
        catalog,
        num_books: numBooks
      }, { timeout: 35000 });

      if (response.data && response.data.data) {
        return { curriculum: response.data.data, user: { id: user.id, name: user.full_name }, generated_via: 'ai_microservice' };
      }
    } catch (err) {
      console.error('[Curriculum] AI service error:', err.message);
    }

    // Fallback
    return {
      curriculum: {
        curriculum_title: `Reading Path: ${goal}`,
        description: `A curated reading path based on your goal: "${goal}"`,
        learning_path: catalog.slice(0, numBooks).map((b, i) => ({
          order: i + 1, book_id: b.id, title: b.title,
          learning_objective: `Explore ${b.category || 'diverse themes'} through ${b.title}`,
          key_takeaway: `Gain insights from ${b.author || 'acclaimed authors'}`
        })),
        expected_outcome: `A deeper understanding of ${goal}`
      },
      user: { id: user.id, name: user.full_name },
      generated_via: 'fallback'
    };
  }
}
module.exports = new CurriculumService();
