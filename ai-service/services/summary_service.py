"""
Service for generating AI summaries.
"""
import sqlite3
import datetime
import requests
import uuid
import config
from utils.prompt_templates import (
    BOOK_SUMMARY_SYSTEM_PROMPT,
    get_brief_summary_prompt,
    get_detailed_summary_prompt,
    get_chapter_wise_summary_prompt
)

class SummaryService:
    """
    Service class to handle book summary generation and caching.
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

    def get_cached_summary(self, book_id: str, summary_type: str):
        """
        Query ai_summaries table, return if valid (not expired).
        
        Args:
            book_id (str): The ID of the book.
            summary_type (str): The type of summary (brief, detailed, chapter_wise).
            
        Returns:
            dict: The cached summary data or None if not found/expired.
        """
        try:
            with self._get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT summary_text, created_at FROM ai_summaries WHERE book_id = ? AND summary_type = ? AND expires_at > datetime('now')",
                    (book_id, summary_type)
                )
                row = cursor.fetchone()
                if row:
                    return {
                        'summary_text': row['summary_text'],
                        'summary_type': summary_type,
                        'token_count': 0, # Not relevant for cache hit
                        'generated_at': row['created_at'],
                        'cached': True
                    }
        except Exception as e:
            print(f"Error checking cache: {e}")
        return None

    def _call_ai_api(self, messages: list, max_tokens: int) -> dict:
        """
        Make the actual API call with proper error handling.
        
        Args:
            messages (list): List of message dictionaries (role, content).
            max_tokens (int): Maximum tokens for the response.
            
        Returns:
            dict: The parsed API response or error dict.
        """
        url = f"{self.api_url}/v1/chat/completions"
        payload = {
            'model': 'gpt-4o-mini',
            'messages': messages,
            'max_tokens': max_tokens,
            'temperature': config.TEMPERATURE
        }
        
        try:
            print(f"Calling AI API: {url} with {len(messages)} messages, max_tokens: {max_tokens}")
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 401:
                print("API Error 401: Invalid token")
                return {'error': True, 'message': 'Invalid API token'}
            elif response.status_code == 429:
                print("API Error 429: Rate limit or quota exceeded")
                return {'error': True, 'message': 'API rate limit or quota exceeded'}
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.Timeout:
            print("API Error: Request timed out")
            return {'error': True, 'message': 'Request timed out'}
        except requests.exceptions.RequestException as e:
            print(f"API Error: Network or request error - {e}")
            return {'error': True, 'message': str(e)}
        except Exception as e:
            print(f"API Error: Unexpected error - {e}")
            return {'error': True, 'message': 'An unexpected error occurred'}

    def generate_summary(self, book_data: dict, summary_type: str = 'brief') -> dict:
        """
        Generate a summary for a book, using cache if available.
        
        Args:
            book_data (dict): Dictionary containing title, author, description, category, and book_id.
            summary_type (str): Type of summary ('brief', 'detailed', 'chapter_wise').
            
        Returns:
            dict: Dictionary with summary details.
        """
        book_id = book_data.get('book_id')
        
        # 1. First check cache
        cached_result = self.get_cached_summary(book_id, summary_type)
        if cached_result:
            print(f"Cache hit for book {book_id}, type {summary_type}")
            return cached_result
            
        # 3. Select prompt template
        title = book_data.get('title', 'Unknown Title')
        author = book_data.get('author', 'Unknown Author')
        description = book_data.get('description', '')
        category = book_data.get('category', 'General')
        
        if summary_type == 'detailed':
            user_prompt = get_detailed_summary_prompt(title, author, description, category)
            max_tokens = config.MAX_TOKENS_DETAILED
        elif summary_type == 'chapter_wise':
            user_prompt = get_chapter_wise_summary_prompt(title, author, description, category)
            max_tokens = config.MAX_TOKENS_CHAPTER_WISE
        else: # default brief
            user_prompt = get_brief_summary_prompt(title, author, description, category)
            max_tokens = config.MAX_TOKENS_BRIEF
            summary_type = 'brief'
            
        messages = [
            {'role': 'system', 'content': BOOK_SUMMARY_SYSTEM_PROMPT},
            {'role': 'user', 'content': user_prompt}
        ]
        
        # 4. Call API
        api_response = self._call_ai_api(messages, max_tokens)
        
        # 8. Error handling
        if api_response.get('error'):
            return {
                'summary_text': 'Unable to generate AI summary at this time. Please try again later.',
                'error': True,
                'details': api_response.get('message')
            }
            
        # 5. Extract response text
        try:
            summary_text = api_response['choices'][0]['message']['content'].strip()
            token_count = api_response.get('usage', {}).get('total_tokens', 0)
        except (KeyError, IndexError) as e:
            print(f"Error parsing API response: {e}")
            return {
                'summary_text': 'Unable to parse AI summary response.',
                'error': True
            }
            
        # 6. Cache the result
        generated_at = datetime.datetime.utcnow().isoformat()
        expires_at = (datetime.datetime.utcnow() + datetime.timedelta(days=config.CACHE_TTL_DAYS)).isoformat()
        
        try:
            with self._get_db_connection() as conn:
                cursor = conn.cursor()
                # Create table if it doesn't exist just in case
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS ai_summaries (
                        id TEXT PRIMARY KEY,
                        book_id TEXT NOT NULL,
                        summary_type TEXT NOT NULL,
                        summary_text TEXT NOT NULL,
                        token_count INTEGER,
                        created_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL,
                        UNIQUE(book_id, summary_type)
                    )
                ''')
                summary_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO ai_summaries (id, book_id, summary_type, summary_text, token_count, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (summary_id, book_id, summary_type, summary_text, token_count, generated_at, expires_at)
                )
                conn.commit()
        except Exception as e:
            print(f"Failed to cache summary: {e}")
            
        # 7. Return summary
        return {
            'summary_text': summary_text,
            'summary_type': summary_type,
            'token_count': token_count,
            'generated_at': generated_at,
            'cached': False
        }

    def check_api_health(self) -> dict:
        """
        Check health of the AI API.
        
        Returns:
            dict: API health status.
        """
        url = f"{self.api_url}/health"
        try:
            response = self.session.get(url, timeout=10)
            if response.status_code == 200:
                return response.json() if response.text else {'status': 'ok'}
            return {'status': 'error', 'code': response.status_code}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    def check_api_usage(self) -> dict:
        """
        Check API usage and quota.
        
        Returns:
            dict: API usage information.
        """
        url = f"{self.api_url}/v1/usage"
        try:
            response = self.session.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
            return {'status': 'error', 'code': response.status_code}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
