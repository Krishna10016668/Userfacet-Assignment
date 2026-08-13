"""
Service for generating AI book recommendations.
"""
import sqlite3
import json
import requests
import config
from utils.prompt_templates import RECOMMENDATION_SYSTEM_PROMPT, get_recommendation_prompt

class RecommendationService:
    """
    Service class to handle book recommendations based on AI analysis.
    """
    def __init__(self):
        """Initialize with config values, setup requests session with auth header."""
        self.api_url = config.AI_API_BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {config.AI_API_TOKEN}',
            'Content-Type': 'application/json'
        })
        self.db_path = config.DB_PATH

    def _get_db_connection(self):
        """Create and return a database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
        
    def _get_category_based_recommendations(self, book_data: dict, limit: int = 5) -> list:
        """
        Fallback method to get category-based recommendations.
        
        Args:
            book_data (dict): Details of the source book.
            limit (int): Maximum number of recommendations to return.
            
        Returns:
            list: A list of recommendation objects.
        """
        try:
            with self._get_db_connection() as conn:
                cursor = conn.cursor()
                source_id = book_data.get('book_id')
                category = book_data.get('category', '')
                
                # Fetch books in same category by joining authors and categories
                cursor.execute("""
                    SELECT b.id, b.title, a.name as author, b.description, c.name as category 
                    FROM books b
                    LEFT JOIN authors a ON b.author_id = a.id
                    LEFT JOIN categories c ON b.category_id = c.id
                    WHERE c.name = ? AND b.id != ? AND b.is_deleted = 0
                    LIMIT ?
                """, (category, source_id, limit))
                
                books = cursor.fetchall()
                recommendations = []
                for b in books:
                    recommendations.append({
                        'book': dict(b),
                        'reason': f"Similar book in the {category} category."
                    })
                return recommendations
        except Exception as e:
            print(f"Error in category fallback: {e}")
            return []

    def get_recommendations(self, book_data: dict) -> list:
        """
        Get book recommendations using the AI API.
        
        Args:
            book_data (dict): Dictionary containing title, author, description, category, and book_id.
            
        Returns:
            list: List of dictionaries with 'book' and 'reason' keys.
        """
        source_id = book_data.get('book_id')
        title = book_data.get('title', '')
        author = book_data.get('author', '')
        description = book_data.get('description', '')
        category = book_data.get('category', '')
        
        # 2. Query available books by joining authors and categories
        available_books = []
        try:
            with self._get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT b.id, b.title, a.name as author, b.description, c.name as category 
                    FROM books b
                    LEFT JOIN authors a ON b.author_id = a.id
                    LEFT JOIN categories c ON b.category_id = c.id
                    WHERE b.id != ? AND b.is_deleted = 0
                """, (source_id,))
                rows = cursor.fetchall()
                available_books = [dict(row) for row in rows]
        except Exception as e:
            print(f"Error fetching available books: {e}")
            return self._get_category_based_recommendations(book_data)
            
        # 3. If few books, return all basic
        if len(available_books) < 5:
            return self._get_category_based_recommendations(book_data, limit=len(available_books))
            
        # 4. Build prompt
        user_prompt = get_recommendation_prompt(title, author, description, category, available_books)
        messages = [
            {'role': 'system', 'content': RECOMMENDATION_SYSTEM_PROMPT},
            {'role': 'user', 'content': user_prompt}
        ]
        
        # 5. Call AI
        url = f"{self.api_url}/v1/chat/completions"
        payload = {
            'model': 'gpt-4o-mini',
            'messages': messages,
            'max_tokens': config.MAX_TOKENS_RECOMMENDATION,
            'temperature': config.TEMPERATURE
        }
        
        try:
            print(f"[AI Service] Fetching recommendations for: {title}")
            print(f"[AI Service] Available books in catalog: {len(available_books)}")
            response = self.session.post(url, json=payload, timeout=30)
            response.raise_for_status()
            api_data = response.json()
            response_text = api_data['choices'][0]['message']['content'].strip()
            
            print(f"[AI Service] AI Response raw text: {response_text}")
            
            # Clean up markdown formatting if the model returns it
            if response_text.startswith("```json"):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith("```"):
                response_text = response_text[3:-3].strip()
                
            # 6. Parse JSON response
            recommended_items = json.loads(response_text)
            print(f"[AI Service] Parsed recommended items: {recommended_items}")
            
            # 7. Fetch full book details
            recommendations = []
            for item in recommended_items:
                book_id_rec = item.get('book_id')
                reason = item.get('reason')
                
                # Find book in available_books
                book_obj = next((b for b in available_books if str(b['id']) == str(book_id_rec)), None)
                if book_obj:
                    recommendations.append({
                        'book': book_obj,
                        'reason': reason
                    })
                else:
                    print(f"[AI Service] Warning: Book ID {book_id_rec} not found in available catalog.")
                    
            print(f"[AI Service] Returning {len(recommendations)} recommendations.")
            return recommendations[:5]
            
        except Exception as e:
            print(f"Error generating AI recommendations: {e}")
            # 9. Fallback
            return self._get_category_based_recommendations(book_data)
