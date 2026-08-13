"""
Main application entry point for the AI Microservice.
"""
from flask import Flask, jsonify
from flask_cors import CORS
import config
from routes.summary_routes import ai_blueprint
from routes.insights_routes import insights_blueprint
from routes.ask_book_routes import ask_book_blueprint
from routes.mood_match_routes import mood_match_blueprint
from routes.quiz_routes import quiz_blueprint
from routes.review_digest_routes import review_digest_blueprint
from routes.curriculum_routes import curriculum_blueprint

app = Flask(__name__)
# Enable CORS for the application
CORS(app)

# Register the blueprints
app.register_blueprint(ai_blueprint, url_prefix='/ai')
app.register_blueprint(insights_blueprint, url_prefix='/ai')
app.register_blueprint(ask_book_blueprint, url_prefix='/ai')
app.register_blueprint(mood_match_blueprint, url_prefix='/ai')
app.register_blueprint(quiz_blueprint, url_prefix='/ai')
app.register_blueprint(review_digest_blueprint, url_prefix='/ai')
app.register_blueprint(curriculum_blueprint, url_prefix='/ai')

# Global error handlers
@app.errorhandler(400)
def bad_request(e):
    return jsonify({'error': 'Bad Request', 'message': str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not Found', 'message': 'The requested URL was not found on the server.'}), 404

@app.errorhandler(500)
def internal_server_error(e):
    return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected error has occurred.'}), 500

@app.route('/', methods=['GET'])
def root():
    """
    Root route providing basic service information.
    """
    return jsonify({
        'service': 'AI Microservice',
        'status': 'running',
        'port': config.PORT,
        'description': 'Handles AI-powered book summaries and recommendations'
    })

if __name__ == '__main__':
    print('\n[AI Service] AI Summary Microservice starting...')
    print(f'[AI Service] AI API: {config.AI_API_BASE_URL}')
    print(f'[AI Service] Database: {config.DB_PATH}')
    print(f'[AI Service] Running on port {config.PORT}\n')
    app.run(host='0.0.0.0', port=config.PORT, debug=config.DEBUG)
