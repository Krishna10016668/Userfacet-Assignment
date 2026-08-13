import json
import requests
import config
from utils.prompt_templates import ASK_BOOK_SYSTEM_PROMPT, get_ask_book_prompt

class AskBookService:
    def __init__(self):
        self.api_url = config.AI_API_BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {config.AI_API_TOKEN}',
            'Content-Type': 'application/json'
        })

    def _call_ai_api(self, messages, max_tokens=500):
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

    def ask_question(self, book_data, question):
        try:
            prompt = get_ask_book_prompt(
                book_data.get('title', ''),
                book_data.get('author', ''),
                book_data.get('description', ''),
                book_data.get('category', ''),
                question
            )
            
            messages = [
                {"role": "system", "content": ASK_BOOK_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
            
            ai_response = self._call_ai_api(messages, max_tokens=500)
            if not ai_response or 'choices' not in ai_response:
                raise Exception("Invalid AI response")
                
            answer_text = ai_response['choices'][0]['message']['content'].strip()
            return {"answer": answer_text}
            
        except Exception as e:
            print(f'AskBookService Error: {e}')
            return {"answer": f"Information about '{book_data.get('title', 'this book')}' is currently unavailable. Please try again later."}
