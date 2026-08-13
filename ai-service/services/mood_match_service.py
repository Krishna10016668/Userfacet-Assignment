import json
import requests
import config
from utils.prompt_templates import MOOD_MATCH_SYSTEM_PROMPT, get_mood_match_prompt

class MoodMatchService:
    def __init__(self):
        self.api_url = config.AI_API_BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {config.AI_API_TOKEN}',
            'Content-Type': 'application/json'
        })

    def _call_ai_api(self, messages, max_tokens=800):
        url = f"{self.api_url}/v1/chat/completions"
        payload = {
            'model': 'gpt-4o-mini',
            'messages': messages,
            'max_tokens': max_tokens,
            'temperature': 0.7
        }
        try:
            response = self.session.post(url, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'AI API Error: {e}')
            return None

    def match_mood(self, mood_query, catalog):
        try:
            prompt = get_mood_match_prompt(mood_query, catalog)
            
            messages = [
                {"role": "system", "content": MOOD_MATCH_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
            
            ai_response = self._call_ai_api(messages, max_tokens=800)
            if not ai_response or 'choices' not in ai_response:
                raise Exception("Invalid AI response")
                
            content = ai_response['choices'][0]['message']['content'].strip()
            # Strip markdown code blocks if present
            if content.startswith('```json'):
                content = content[7:]
            if content.startswith('```'):
                content = content[3:]
            if content.endswith('```'):
                content = content[:-3]
                
            return json.loads(content.strip())
            
        except Exception as e:
            print(f'MoodMatchService Error: {e}')
            # Fallback
            fallback_results = []
            for book in catalog[:3]:
                fallback_results.append({
                    "book_id": book.get("id"),
                    "title": book.get("title"),
                    "match_reason": "Based on our general catalog, this might be a good match for your mood."
                })
            return fallback_results
