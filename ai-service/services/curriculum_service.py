import json
import requests
import config
from utils.prompt_templates import CURRICULUM_SYSTEM_PROMPT, get_curriculum_prompt

class CurriculumService:
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

    def generate_curriculum(self, goal, catalog, num_books=5):
        try:
            prompt = get_curriculum_prompt(goal, catalog, num_books)
            
            messages = [
                {"role": "system", "content": CURRICULUM_SYSTEM_PROMPT},
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
            print(f'CurriculumService Error: {e}')
            # Fallback
            learning_path = []
            for i, book in enumerate(catalog[:num_books]):
                learning_path.append({
                    "order": i + 1,
                    "book_id": book.get("id"),
                    "title": book.get("title"),
                    "learning_objective": "General topic overview",
                    "key_takeaway": "Key insights from the text"
                })
                
            return {
                "curriculum_title": "Custom Learning Path",
                "description": f"A learning path curated for: {goal}",
                "learning_path": learning_path,
                "expected_outcome": "Improved understanding of the subject matter."
            }
