const express = require('express');
const router = express.Router();
const ExportService = require('../services/export.service');
const bulkImportService = require('../services/bulkImport.service');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { buildResponse } = require('../utils/helpers');

/**
 * @route GET /api/exports/books/csv
 * @desc Export books to CSV
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get(['/books', '/books/csv'], authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const csvString = ExportService.exportBooksCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=books_export.csv');
    res.send(csvString);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/exports/borrows or /api/exports/borrows/csv
 * @desc Export borrows to CSV
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get(['/borrows', '/borrows/csv'], authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const { status, from_date, to_date } = req.query;
    const csvString = ExportService.exportBorrowsCSV({ status, from_date, to_date });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=borrows_export.csv');
    res.send(csvString);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/exports/fines or /api/exports/fines/csv
 * @desc Export fines to CSV
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get(['/fines', '/fines/csv'], authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    const { status } = req.query;
    const csvString = ExportService.exportFinesCSV({ status });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fines_export.csv');
    res.send(csvString);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/exports/analytics/report
 * @desc Export analytics report as JSON
 * @access Private (ADMIN)
 */
router.get('/analytics/report', authenticate, authorize(ROLES.ADMIN), (req, res, next) => {
  try {
    const reportJson = ExportService.exportAnalyticsReport();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics_report.json');
    res.send(reportJson);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/exports/import/template or /api/exports/imports/template
 * @desc Download a sample CSV template for bulk book imports
 * @access Private (LIBRARIAN, ADMIN)
 */
router.get(['/import/template', '/imports/template'], authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res) => {
  const template = bulkImportService.getCSVTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=book_import_template.csv');
  res.send(template);
});

/**
 * @route POST /api/exports/import/books or /api/exports/imports/books
 * @desc Bulk import books from CSV content
 * @access Private (LIBRARIAN, ADMIN)
 */
router.post(['/import/books', '/imports/books'], authenticate, authorize(ROLES.LIBRARIAN, ROLES.ADMIN), (req, res, next) => {
  try {
    let csvContent = '';
    
    if (typeof req.body === 'string') {
      csvContent = req.body;
    } else if (req.body && req.body.csv) {
      csvContent = req.body.csv;
    } else {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing CSV content in request body (send raw CSV or { "csv": "..." })', code: 'MISSING_CSV' }
      });
    }

    const report = bulkImportService.importBooksFromCSV(csvContent, req.user);
    res.status(200).json(buildResponse(true, report, `Bulk import finished: ${report.imported_count} book(s) imported, ${report.error_count} error(s), ${report.skipped_count} skipped`));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
