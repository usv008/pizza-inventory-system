/**
 * Writeoff Document Routes
 * Express routes for group writeoff functionality
 * 
 * Routes:
 * GET /api/writeoff-documents - Get all documents (hybrid)
 * GET /api/writeoff-documents/preview-number - Preview document number
 * GET /api/writeoff-documents/statistics - Get statistics  
 * GET /api/writeoff-documents/:id - Get document by ID
 * POST /api/writeoff-documents - Create new document
 */

const express = require('express');
const router = express.Router();
const writeoffDocumentController = require('../controllers/writeoffDocumentController');

// Middleware for authentication (if needed)
// const { requireAuth } = require('../middleware/auth');

console.log('[ROUTES] Initializing writeoff document routes...');

// GET /api/writeoff-documents - Get all documents (hybrid)
router.get('/', async (req, res) => {
    await writeoffDocumentController.getAllDocuments(req, res);
});

// GET /api/writeoff-documents/preview-number - Preview document number
// This route must be BEFORE /:id to avoid conflicts
router.get('/preview-number', async (req, res) => {
    await writeoffDocumentController.previewDocumentNumber(req, res);
});

// GET /api/writeoff-documents/statistics - Get statistics
// This route must be BEFORE /:id to avoid conflicts
router.get('/statistics', async (req, res) => {
    await writeoffDocumentController.getStatistics(req, res);
});

// GET /api/writeoff-documents/:id - Get document by ID
router.get('/:id', async (req, res) => {
    await writeoffDocumentController.getDocumentById(req, res);
});

// POST /api/writeoff-documents - Create new document
router.post('/', 
    writeoffDocumentController.validateCreateRequest.bind(writeoffDocumentController),
    async (req, res) => {
        await writeoffDocumentController.createDocument(req, res);
    }
);

// Error handling middleware
router.use((error, req, res, next) => {
    writeoffDocumentController.handleError(error, req, res, next);
});

console.log('[ROUTES] ✅ Writeoff document routes initialized');

module.exports = router; 