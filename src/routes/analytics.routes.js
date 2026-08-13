const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analytics.service');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { buildResponse } = require('../utils/helpers');

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard statistics
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get('/dashboard', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const stats = AnalyticsService.getDashboardStats();
    res.json(buildResponse(true, stats, 'Dashboard stats fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/popular-books
 * @desc Get popular books
 * @access Public
 */
router.get('/popular-books', (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const books = AnalyticsService.getPopularBooks(limit);
    res.json(buildResponse(true, books, 'Popular books fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/active-users
 * @desc Get active users
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get('/active-users', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const users = AnalyticsService.getActiveUsers(limit);
    res.json(buildResponse(true, users, 'Active users fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/category-distribution
 * @desc Get category distribution
 * @access Public
 */
router.get('/category-distribution', (req, res, next) => {
  try {
    const data = AnalyticsService.getCategoryDistribution();
    res.json(buildResponse(true, data, 'Category distribution fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/borrow-trends
 * @desc Get borrow trends
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get('/borrow-trends', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const trends = AnalyticsService.getBorrowTrends(days);
    res.json(buildResponse(true, trends, 'Borrow trends fetched successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/analytics/overdue-report
 * @desc Get overdue report
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get('/overdue-report', authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const report = AnalyticsService.getOverdueReport();
    res.json(buildResponse(true, report, 'Overdue report fetched successfully'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
