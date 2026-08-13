from flask import Blueprint, request, jsonify
from services.curriculum_service import CurriculumService

curriculum_blueprint = Blueprint('curriculum', __name__)
service = CurriculumService()

@curriculum_blueprint.route('/reading-curriculum', methods=['POST'])
def handle_reading_curriculum():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Bad Request', 'message': 'Missing JSON body'}), 400
        
    required_fields = ['goal', 'catalog', 'num_books']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': 'Bad Request', 'message': f'Missing required field: {field}'}), 400
            
    result = service.generate_curriculum(data['goal'], data['catalog'], data['num_books'])
    return jsonify({'status': 'success', 'data': result}), 200
