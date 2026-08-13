"""
Configuration module for the AI Microservice.
"""
import os

# AI API configuration
AI_API_BASE_URL = 'https://ai-api.userfacet.com'
AI_API_TOKEN = os.getenv('AI_API_TOKEN', 'sk-3a603b6cf3f44519aba4503735e35477')

# Database configuration
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'library.db')

# Caching configuration
CACHE_TTL_DAYS = 30

# Application configuration
PORT = 5000
DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

# AI Model token limits
MAX_TOKENS_BRIEF = 500
MAX_TOKENS_DETAILED = 1500
MAX_TOKENS_CHAPTER_WISE = 2500
MAX_TOKENS_RECOMMENDATION = 1000

# Generation settings
TEMPERATURE = 0.7
