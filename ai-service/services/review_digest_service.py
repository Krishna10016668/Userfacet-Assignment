import json
import requests
import config
from utils.prompt_templates import REVIEW_DIGEST_SYSTEM_PROMPT, get_review_digest_prompt

class ReviewDigestService:
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

    def generate_digest(self, book_data, reviews):
        try:
            prompt = get_review_digest_prompt(
                book_data.get('title', ''),
                book_data.get('author', ''),
                reviews
            )
            
            messages = [
                {"role": "system", "content": REVIEW_DIGEST_SYSTEM_PROMPT},
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
            print(f'ReviewDigestService Error: {e}')
            # Fallback
            if not reviews:
                return {
                    "overall_sentiment": "Neutral",
                    "sentiment_score": 50,
                    "key_praise_points": [],
                    "common_critiques": [],
                    "executive_summary": "Not enough reviews to analyze.",
                    "recommendation_level": "Unknown"
                }
            avg_rating = sum(float(r.get('rating', 0)) for r in reviews) / len(reviews)
            sentiment_score = int(avg_rating * 20)
            return {
                "overall_sentiment": "Positive" if avg_rating >= 3.5 else "Mixed",
                "sentiment_score": sentiment_score,
                "key_praise_points": ["Based on general reader ratings."],
                "common_critiques": [],
                "executive_summary": f"Based on {len(reviews)} reviews, the average rating is {avg_rating:.1f}/5.",
                "recommendation_level": "Recommended" if avg_rating >= 4.0 else "Consider"
            }
