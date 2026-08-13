from flask import Blueprint, request, jsonify
from services.review_digest_service import ReviewDigestService

review_digest_blueprint = Blueprint('review_digest', __name__)
service = ReviewDigestService()

@review_digest_blueprint.route('/review-digest', methods=['POST'])
def handle_review_digest():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Bad Request', 'message': 'Missing JSON body'}), 400
        
    required_fields = ['book_id', 'title', 'author', 'reviews']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': 'Bad Request', 'message': f'Missing required field: {field}'}), 400
            
    result = service.generate_digest(data, data['reviews'])
    return jsonify({'status': 'success', 'data': result}), 200
