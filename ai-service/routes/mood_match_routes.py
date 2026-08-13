from flask import Blueprint, request, jsonify
from services.mood_match_service import MoodMatchService

mood_match_blueprint = Blueprint('mood_match', __name__)
service = MoodMatchService()

@mood_match_blueprint.route('/mood-match', methods=['POST'])
def handle_mood_match():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Bad Request', 'message': 'Missing JSON body'}), 400
        
    if 'mood_query' not in data or 'catalog' not in data:
        return jsonify({'error': 'Bad Request', 'message': 'Missing required fields: mood_query, catalog'}), 400
        
    result = service.match_mood(data['mood_query'], data['catalog'])
    return jsonify({'status': 'success', 'data': result}), 200
