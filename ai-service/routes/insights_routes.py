"""
Routes for AI Reading Insights
"""
from flask import Blueprint, request, jsonify
from services.insights_service import ReadingInsightsService

insights_blueprint = Blueprint('insights', __name__)
insights_service = ReadingInsightsService()

@insights_blueprint.route('/reading-insights', methods=['POST'])
def get_reading_insights():
    """
    POST /ai/reading-insights
    Expects JSON body: { "user_name": "...", "history": [...], "catalog": [...] }
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Bad Request', 'message': 'Missing JSON body'}), 400

    user_name = data.get('user_name', 'Valued Reader')
    history = data.get('history', [])
    catalog = data.get('catalog', None)

    insights = insights_service.generate_insights(user_name, history, catalog)
    return jsonify({
        'status': 'success',
        'data': insights
    }), 200
