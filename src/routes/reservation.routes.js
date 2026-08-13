const express = require('express');
const router = express.Router();
const ReservationService = require('../services/reservation.service');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const Joi = require('joi');
const { buildResponse } = require('../utils/helpers');

// Validation schemas
const createReservationSchema = Joi.object({
  book_id: Joi.string().uuid().required()
});

/**
 * @route POST /api/reservations
 * @desc Create a reservation for a book
 * @access Private
 */
router.post('/', authenticate, validate(createReservationSchema), (req, res, next) => {
  try {
    const reservation = ReservationService.createReservation(req.user.id, req.body.book_id);
    res.status(201).json(buildResponse(true, reservation, 'Reservation created successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/reservations/:id
 * @desc Cancel a reservation
 * @access Private
 */
router.delete('/:id', authenticate, (req, res, next) => {
  try {
    const reservation = ReservationService.cancelReservation(req.params.id, req.user.id, req.user.role);
    res.json(buildResponse(true, reservation, 'Reservation cancelled successfully'));
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/reservations
 * @desc Get user's reservations
 * @access Private
 */
router.get('/', authenticate, (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = ReservationService.getUserReservations(req.user.id, { page, limit });
    res.json({
      success: true,
      data: result.items,
      message: 'User reservations fetched successfully',
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/reservations/book/:bookId
 * @desc Get all pending reservations for a book
 * @access Public/Private
 */
router.get('/book/:bookId', (req, res, next) => {
  try {
    const reservations = ReservationService.getBookReservations(req.params.bookId);
    res.json(buildResponse(true, reservations, 'Book reservations fetched successfully'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
