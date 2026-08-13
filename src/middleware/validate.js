const Joi = require('joi');

/**
 * Middleware factory to validate request data against a Joi schema
 * @param {Joi.ObjectSchema} schema - The Joi schema to validate against
 * @param {string} [source='body'] - The request property to validate (e.g., 'body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // Return all errors
      stripUnknown: true // Remove unknown keys
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        error: {
          message: errorMessage,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    // Replace the original req object property with the validated value (applies defaults)
    req[source] = value;
    next();
  };
}

/**
 * Reusable Joi validation schemas for the application
 */
const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(128).required(),
    full_name: Joi.string().min(1).max(100).required()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  createBook: Joi.object({
    isbn: Joi.string().required(),
    title: Joi.string().required(),
    description: Joi.string().allow('', null),
    author_id: Joi.string().guid().required(),
    category_id: Joi.string().guid().required(),
    publication_year: Joi.number().integer().min(1000).max(new Date().getFullYear()),
    publisher: Joi.string().allow('', null),
    language: Joi.string().default('English'),
    page_count: Joi.number().integer().min(1),
    total_copies: Joi.number().integer().min(1).default(1),
    cover_image_url: Joi.string().uri().allow('', null)
  }),

  updateBook: Joi.object({
    isbn: Joi.string(),
    title: Joi.string(),
    description: Joi.string().allow('', null),
    author_id: Joi.string().guid(),
    category_id: Joi.string().guid(),
    publication_year: Joi.number().integer().min(1000).max(new Date().getFullYear()),
    publisher: Joi.string().allow('', null),
    language: Joi.string(),
    page_count: Joi.number().integer().min(1),
    total_copies: Joi.number().integer().min(1),
    cover_image_url: Joi.string().uri().allow('', null)
  }).min(1), // At least one key must be provided
  
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort_by: Joi.string().default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  createReview: Joi.object({
    book_id: Joi.string().guid().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    review_text: Joi.string().allow('', null)
  }),

  createAuthor: Joi.object({
    name: Joi.string().required(),
    biography: Joi.string().allow('', null),
    nationality: Joi.string().allow('', null),
    birth_date: Joi.string().isoDate().allow('', null)
  }),

  createCategory: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    parent_category_id: Joi.string().guid().allow(null)
  }),

  borrowBook: Joi.object({
    book_id: Joi.string().guid().required()
  }),

  createReadingList: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    is_public: Joi.boolean().default(false)
  }),

  searchBooks: Joi.object({
    q: Joi.string().allow('', null),
    category_id: Joi.string().guid().allow(null),
    author_id: Joi.string().guid().allow(null),
    language: Joi.string().allow('', null),
    year_from: Joi.number().integer().min(1000).max(new Date().getFullYear()).allow(null),
    year_to: Joi.number().integer().min(1000).max(new Date().getFullYear()).allow(null),
    available: Joi.boolean().allow(null)
  })
};

module.exports = {
  validate,
  schemas
};
