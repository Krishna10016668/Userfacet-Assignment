const express = require('express');
const auditService = require('../services/audit.service');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { buildResponse } = require('../utils/helpers');

const router = express.Router();

/**
 * @route GET /api/audit-log
 * @desc Get system-wide audit logs with filters & pagination
 * @access Private (Admin only)
 */
router.get('/', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const result = auditService.getAuditLogs(req.query);
    res.status(200).json(buildResponse(true, result.logs, 'Audit logs retrieved successfully', result.pagination));
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/audit-log/:entityType/:entityId
 * @desc Get complete audit timeline for a specific entity
 * @access Private (Admin only)
 */
router.get('/:entityType/:entityId', authenticate, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const history = auditService.getEntityHistory(req.params.entityType.toUpperCase(), req.params.entityId);
    res.status(200).json(buildResponse(true, history, 'Entity audit history retrieved successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
