const axios = require('axios');
const config = require('../config');

/**
 * AI Service
 * Communicates with the external Python AI Microservice for summaries and recommendations.
 */
class AIService {
  constructor() {
    // Determine the base URL for the AI microservice
    this.baseUrl = config.AI_SERVICE_URL || 'http://localhost:5000';
    this.axiosClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Helper to perform request with 1 retry
   * @param {Function} requestFn - Function returning a promise
   * @returns {Promise<any>}
   */
  async _withRetry(requestFn) {
    try {
      return await requestFn();
    } catch (error) {
      // Retry once
      try {
        return await requestFn();
      } catch (retryError) {
        throw retryError;
      }
    }
  }

  /**
   * Generate an AI summary for a book
   * @param {Object} bookData - Book details
   * @param {string} bookData.book_id - Book ID
   * @param {string} bookData.title - Book title
   * @param {string} bookData.description - Book description
   * @param {string} bookData.author - Author name
   * @param {string} bookData.category - Category name
   * @param {string} bookData.summary_type - brief, detailed, chapter_wise
   * @returns {Promise<Object>} Object containing summary_text and token_count
   */
  async generateSummary(bookData) {
    try {
      const response = await this._withRetry(() => 
        this.axiosClient.post('/ai/summary', bookData)
      );
      return response.data;
    } catch (error) {
      console.error('AI Summary Generation Error:', error.message);
      // Graceful fallback
      return {
        summary_text: 'AI summary is currently unavailable. Please try again later.',
        token_count: 0
      };
    }
  }

  /**
   * Generate book recommendations based on a given book
   * @param {Object} bookData - Book details
   * @returns {Promise<Array>} Array of recommended books/strings
   */
  async generateRecommendations(bookData) {
    try {
      const response = await this._withRetry(() => 
        this.axiosClient.post('/ai/recommendations', bookData)
      );
      return response.data.recommendations || [];
    } catch (error) {
      console.error('AI Recommendations Generation Error:', error.message);
      // Graceful fallback
      return [];
    }
  }

  /**
   * Check health of the AI microservice
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await this.axiosClient.get('/ai/health');
      return response.data;
    } catch (error) {
      return { status: 'down', error: error.message };
    }
  }

  /**
   * Check usage metrics of the AI microservice
   * @returns {Promise<Object>} Usage metrics
   */
  async checkUsage() {
    try {
      const response = await this.axiosClient.get('/ai/usage');
      return response.data;
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}

module.exports = new AIService();
