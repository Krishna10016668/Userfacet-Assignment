"""
Flask blueprint for AI routes.
"""
from flask import Blueprint, request, jsonify
import datetime
from services.summary_service import SummaryService
from services.recommendation_service import RecommendationService

ai_blueprint = Blueprint('ai', __name__)
summary_service = SummaryService()
recommendation_service = RecommendationService()

@ai_blueprint.route('/summary', methods=['POST'])
def generate_summary():
    """
    Generate or retrieve an AI summary for a book.
    Expected JSON body: { book_id, title, description, author, category, summary_type }
    """
    data = request.get_json()
    if not data or not data.get('book_id'):
        return jsonify({'error': 'book_id is required'}), 400
        
    summary_type = data.get('summary_type', 'brief')
    if summary_type not in ['brief', 'detailed', 'chapter_wise']:
        return jsonify({'error': 'Invalid summary_type. Choose from brief, detailed, chapter_wise'}), 400
        
    try:
        result = summary_service.generate_summary(data, summary_type)
        if result.get('error'):
            return jsonify(result), 503
        return jsonify(result), 200
    except Exception as e:
        print(f"Summary route error: {e}")
        return jsonify({'error': 'Internal server error processing summary'}), 500

@ai_blueprint.route('/recommendations', methods=['POST'])
def get_recommendations():
    """
    Get AI-driven book recommendations based on a source book.
    Expected JSON body: { book_id, title, description, author, category }
    """
    data = request.get_json()
    if not data or not data.get('book_id'):
        return jsonify({'error': 'book_id is required'}), 400
        
    try:
        recommendations = recommendation_service.get_recommendations(data)
        return jsonify({'recommendations': recommendations}), 200
    except Exception as e:
        print(f"Recommendations route error: {e}")
        return jsonify({'error': 'Internal server error processing recommendations'}), 500

@ai_blueprint.route('/health', methods=['GET'])
def ai_health():
    """
    Check the health of the AI API and internal service.
    """
    try:
        api_health = summary_service.check_api_health()
        return jsonify({
            'status': 'healthy',
            'ai_api': api_health,
            'timestamp': datetime.datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@ai_blueprint.route('/usage', methods=['GET'])
def ai_usage():
    """
    Check the usage limits of the AI API.
    """
    try:
        usage_info = summary_service.check_api_usage()
        return jsonify(usage_info), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
