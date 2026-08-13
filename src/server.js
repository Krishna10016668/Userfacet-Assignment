const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const { initializeDatabase } = require('./database/schema');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const { startCronJobs } = require('./cron/jobs');

// Import routes
const authRoutes = require('./routes/auth.routes');
const bookRoutes = require('./routes/book.routes');
const userRoutes = require('./routes/user.routes');
const borrowRoutes = require('./routes/borrow.routes');
const reservationRoutes = require('./routes/reservation.routes');
const reviewRoutes = require('./routes/review.routes');
const categoryRoutes = require('./routes/category.routes');
const authorRoutes = require('./routes/author.routes');
const fineRoutes = require('./routes/fine.routes');
const readingListRoutes = require('./routes/readingList.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const exportRoutes = require('./routes/export.routes');
const readingProgressRoutes = require('./routes/readingProgress.routes');
const auditRoutes = require('./routes/audit.routes');
const insightsRoutes = require('./routes/insights.routes');
const moodMatchRoutes = require('./routes/moodMatch.routes');
const curriculumRoutes = require('./routes/curriculum.routes');
const tagRoutes = require('./routes/tag.routes');
const gamificationRoutes = require('./routes/gamification.routes');
const bookClubRoutes = require('./routes/bookClub.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Initialize Database
try {
  initializeDatabase();
  console.log('Database initialized successfully.');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.1.0'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books/ai-match-mood', moodMatchRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/users', gamificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/reading-lists', readingListRoutes);
app.use('/api/reading-lists', curriculumRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/clubs', bookClubRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/reading-progress', readingProgressRoutes);
app.use('/api/audit-log', auditRoutes);
app.use('/api/insights', insightsRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Start Server
const PORT = config.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Available routes:');
  console.log('  /api/auth');
  console.log('  /api/books/ai-match-mood');
  console.log('  /api/books');
  console.log('  /api/users');
  console.log('  /api/users/my-badges');
  console.log('  /api/users/reading-streak');
  console.log('  /api/borrows');
  console.log('  /api/reservations');
  console.log('  /api/reviews');
  console.log('  /api/categories');
  console.log('  /api/authors');
  console.log('  /api/tags');
  console.log('  /api/clubs');
  console.log('  /api/fines');
  console.log('  /api/reading-lists');
  console.log('  /api/notifications');
  console.log('  /api/analytics');
  console.log('  /api/exports');
  console.log('  /api/reading-progress');
  console.log('  /api/audit-log');
  console.log('  /api/insights');
  
  // Start CRON jobs
  startCronJobs();
});

module.exports = app;
