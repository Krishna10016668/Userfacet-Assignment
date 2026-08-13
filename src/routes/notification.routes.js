const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notification.service');
const { authenticate } = require('../middleware/auth');
const { buildResponse } = require('../utils/helpers');

/**
 * @route GET /api/notifications
 * @desc Get user notifications
 * @access Private
 */
router.get('/', authenticate, (req, res, next) => {
  try {
    const { page = 1, limit = 10, unread_only } = req.query;
    const result = NotificationService.getUserNotifications(req.user.id, { page, limit, unread_only });
    
    res.json({
      success: true,
      data: result.items,
      message: 'Notifications fetched successfully',
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
router.get('/unread-count', authenticate, (req, res, next) => {
  try {
    const count = NotificationService.getUnreadCount(req.user.id);
    res.json(buildResponse(true, { count }, 'Unread count fetched'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
router.put('/:id/read', authenticate, (req, res, next) => {
  try {
    const notification = NotificationService.markAsRead(req.params.id, req.user.id);
    res.json(buildResponse(true, notification, 'Notification marked as read'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.put('/read-all', authenticate, (req, res, next) => {
  try {
    const count = NotificationService.markAllAsRead(req.user.id);
    res.json(buildResponse(true, { updatedCount: count }, 'All notifications marked as read'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
