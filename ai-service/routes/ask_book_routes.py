from flask import Blueprint, request, jsonify
from services.ask_book_service import AskBookService

ask_book_blueprint = Blueprint('ask_book', __name__)
service = AskBookService()

@ask_book_blueprint.route('/ask-book', methods=['POST'])
def handle_ask_book():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Bad Request', 'message': 'Missing JSON body'}), 400
        
    required_fields = ['book_id', 'title', 'author', 'category', 'description', 'question']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': 'Bad Request', 'message': f'Missing required field: {field}'}), 400
            
    result = service.ask_question(data, data['question'])
    return jsonify({'status': 'success', 'data': result}), 200
