from flask import Blueprint, request, jsonify
from services.quiz_service import QuizService

quiz_blueprint = Blueprint('quiz', __name__)
service = QuizService()

@quiz_blueprint.route('/book-quiz', methods=['POST'])
def handle_book_quiz():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Bad Request', 'message': 'Missing JSON body'}), 400
        
    required_fields = ['book_id', 'title', 'author', 'category', 'description', 'num_questions']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': 'Bad Request', 'message': f'Missing required field: {field}'}), 400
            
    result = service.generate_quiz(data, data['num_questions'])
    return jsonify({'status': 'success', 'data': result}), 200
