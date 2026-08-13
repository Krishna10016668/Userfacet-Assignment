"""
Service for generating AI-powered reader personality insights and next-read discovery.
"""
import json
import sqlite3
import requests
import config
from utils.prompt_templates import READING_INSIGHTS_SYSTEM_PROMPT, get_reading_insights_prompt

class ReadingInsightsService:
    """
    Analyzes reader borrowing journeys and crafts personalized insights.
    """
    def __init__(self):
        self.api_url = config.AI_API_BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {config.AI_API_TOKEN}',
            'Content-Type': 'application/json'
        })
        self.db_path = config.DB_PATH

    def _get_db_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _generate_fallback_insights(self, user_name: str, history: list, catalog: list) -> dict:
        """
        Rule-based fallback if AI API is offline.
        """
        top_categories = {}
        for b in history:
            cat = b.get('category', 'General')
            top_categories[cat] = top_categories.get(cat, 0) + 1
        
        sorted_cats = sorted(top_categories.items(), key=lambda x: x[1], reverse=True)
        primary_genres = [c[0] for c in sorted_cats[:3]] if sorted_cats else ["General Literature"]

        next_reads = []
        for b in catalog[:3]:
            next_reads.append({
                "book_id": b.get("id"),
                "title": b.get("title"),
                "reason": f"Popular recommendation in {b.get('category', 'the library')} to expand your reading."
            })

        return {
            "reader_persona": "Curious Explorer",
            "primary_genres": primary_genres,
            "reading_habits_analysis": f"{user_name} has explored {len(history)} title(s) across our library catalog, demonstrating focused reading interests.",
            "recommended_next_reads": next_reads,
            "ai_curator_message": "Keep up your great reading journey! Here are handpicked books for your next session."
        }

    def generate_insights(self, user_name: str, history: list, catalog: list = None) -> dict:
        """
        Generate AI-powered reading insights for a user.
        """
        # If catalog is not passed, fetch unread books from SQLite
        if catalog is None:
            borrowed_book_ids = [b.get('book_id') or b.get('id') for b in history if b.get('book_id') or b.get('id')]
            try:
                with self._get_db_connection() as conn:
                    cursor = conn.cursor()
                    if borrowed_book_ids:
                        placeholders = ','.join(['?'] * len(borrowed_book_ids))
                        cursor.execute(f"""
                            SELECT b.id, b.title, a.name as author, c.name as category 
                            FROM books b
                            LEFT JOIN authors a ON b.author_id = a.id
                            LEFT JOIN categories c ON b.category_id = c.id
                            WHERE b.id NOT IN ({placeholders}) AND b.is_deleted = 0
                            LIMIT 15
                        """, borrowed_book_ids)
                    else:
                        cursor.execute("""
                            SELECT b.id, b.title, a.name as author, c.name as category 
                            FROM books b
                            LEFT JOIN authors a ON b.author_id = a.id
                            LEFT JOIN categories c ON b.category_id = c.id
                            WHERE b.is_deleted = 0
                            LIMIT 15
                        """)
                    catalog = [dict(row) for row in cursor.fetchall()]
            except Exception as e:
                print(f"[AI Insights] Database catalog fetch error: {e}")
                catalog = []

        # Prepare AI prompt
        prompt = get_reading_insights_prompt(user_name, history, catalog)
        messages = [
            {'role': 'system', 'content': READING_INSIGHTS_SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt}
        ]

        url = f"{self.api_url}/v1/chat/completions"
        payload = {
            'model': 'gpt-4o-mini',
            'messages': messages,
            'max_tokens': 600,
            'temperature': 0.7
        }

        try:
            print(f"[AI Insights] Generating insights for reader: {user_name}")
            response = self.session.post(url, json=payload, timeout=30)
            response.raise_for_status()
            api_data = response.json()
            response_text = api_data['choices'][0]['message']['content'].strip()

            # Clean markdown codeblocks
            if response_text.startswith("```json"):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith("```"):
                response_text = response_text[3:-3].strip()

            insights = json.loads(response_text)
            print(f"[AI Insights] Persona generated: {insights.get('reader_persona')}")
            return insights

        except Exception as e:
            print(f"[AI Insights] Error generating insights via AI API: {e}")
            return self._generate_fallback_insights(user_name, history, catalog)
