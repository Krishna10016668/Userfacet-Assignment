"""
Prompt templates for interacting with the AI API.
"""

BOOK_SUMMARY_SYSTEM_PROMPT = """You are an expert literary analyst and book reviewer. You provide insightful, engaging, and well-structured book summaries that capture the essence of a book without spoiling key plot points. Your summaries are informative, balanced, and suitable for library patrons deciding whether to read a book."""

def get_brief_summary_prompt(title: str, author: str, description: str, category: str) -> str:
    """
    Generate a prompt for a brief summary.
    
    Args:
        title (str): Title of the book.
        author (str): Author of the book.
        description (str): Description of the book.
        category (str): Category of the book.
        
    Returns:
        str: The prompt for a brief summary.
    """
    return f"""Please provide a concise 100-150 word summary for the book "{title}" by {author}.
Category: {category}
Context Description: {description}

The summary should cover:
- Core premise
- Target audience
- Why it's notable

Format: A single paragraph."""

def get_detailed_summary_prompt(title: str, author: str, description: str, category: str) -> str:
    """
    Generate a prompt for a detailed summary.
    
    Args:
        title (str): Title of the book.
        author (str): Author of the book.
        description (str): Description of the book.
        category (str): Category of the book.
        
    Returns:
        str: The prompt for a detailed summary.
    """
    return f"""Please provide a detailed 250-400 word summary for the book "{title}" by {author}.
Category: {category}
Context Description: {description}

Include the following sections:
- Overview
- Key Themes
- Writing Style
- Who Should Read This

Format: Markdown with appropriate headers."""

def get_chapter_wise_summary_prompt(title: str, author: str, description: str, category: str) -> str:
    """
    Generate a prompt for a chapter-wise summary.
    
    Args:
        title (str): Title of the book.
        author (str): Author of the book.
        description (str): Description of the book.
        category (str): Category of the book.
        
    Returns:
        str: The prompt for a chapter-wise summary.
    """
    return f"""Please provide a chapter-by-chapter or section-by-section analysis for the book "{title}" by {author}.
Category: {category}
Context Description: {description}

Length: 300-500 words.
Include major plot points or arguments for each section without full spoilers."""

RECOMMENDATION_SYSTEM_PROMPT = """You are a knowledgeable librarian AI assistant who excels at recommending books. Given a book that a reader enjoyed, you suggest similar books based on theme, writing style, genre, and reader experience. You explain why each recommendation is relevant."""

def get_recommendation_prompt(title: str, author: str, description: str, category: str, available_books: list) -> str:
    """
    Generate a prompt for book recommendations.
    
    Args:
        title (str): Title of the source book.
        author (str): Author of the source book.
        description (str): Description of the source book.
        category (str): Category of the source book.
        available_books (list): List of dictionaries containing available book details.
        
    Returns:
        str: The prompt for recommendations.
    """
    books_context = "\n".join([f"- ID: {b.get('id')}, Title: {b.get('title')}, Author: {b.get('author')}, Category: {b.get('category')}" for b in available_books])
    
    return f"""A reader recently enjoyed the following book:
Title: "{title}"
Author: {author}
Category: {category}
Description: {description}

Based on this, please select and rank 5 books from the following available library catalog that would appeal to this reader:

{books_context}

For each recommendation, provide a brief explanation of why it is relevant (e.g., similar theme, writing style, or genre).
Output MUST be a valid JSON array of objects with the exact keys:
[{{"book_id": "...", "reason": "..."}}]
Do not include any extra text outside the JSON array."""

READING_INSIGHTS_SYSTEM_PROMPT = """You are a master literary psychologist and AI library curator. Given a reader's lifetime borrowing history, you analyze their intellectual interests, thematic preferences, and reading personality to craft a personalized reader profile and curate exceptional next reads from the library collection."""

def get_reading_insights_prompt(user_name: str, history: list, catalog: list) -> str:
    """
    Generate prompt for comprehensive AI reader profiling and next-read recommendations.
    """
    history_str = "\n".join([f"- \"{b.get('title')}\" by {b.get('author')} (Category: {b.get('category')}, Status: {b.get('status')})" for b in history])
    catalog_str = "\n".join([f"- ID: {b.get('id')}, Title: \"{b.get('title')}\", Author: {b.get('author')}, Category: {b.get('category')}" for b in catalog])

    return f"""Reader: {user_name}

Borrowing History:
{history_str if history_str else "No prior history - new reader."}

Available Unread Catalog Books:
{catalog_str}

Analyze this reader's profile and generate:
1. "reader_persona": A creative 2-4 word persona title (e.g. "Dystopian Thinker & Philosopher", "Curious Polymath", "Classic Realist")
2. "primary_genres": Top 2-3 favorite genres/categories
3. "reading_habits_analysis": 2-3 sentences analyzing their taste, intellectual curiosity, and thematic patterns
4. "recommended_next_reads": A list of up to 3 books chosen from the available catalog that best expand their reading journey, with a tailored 1-sentence reason for each
5. "ai_curator_message": A warm, encouraging 1-sentence librarian recommendation message to the reader

Output MUST be a valid JSON object with the exact keys:
{{
  "reader_persona": "...",
  "primary_genres": ["...", "..."],
  "reading_habits_analysis": "...",
  "recommended_next_reads": [
    {{"book_id": "...", "title": "...", "reason": "..."}}
  ],
  "ai_curator_message": "..."
}}
Do not include any text outside the JSON object."""
