/**
 * Writeoff Document Controller
 * HTTP layer for writeoff document operations
 * 
 * Endpoints:
 * GET /api/writeoff-documents - Get all documents (hybrid)
 * GET /api/writeoff-documents/:id - Get document by ID
 * POST /api/writeoff-documents - Create new document
 * GET /api/writeoff-documents/preview-number - Preview document number
 * GET /api/writeoff-documents/statistics - Get statistics
 */

const writeoffDocumentService = require('../services/writeoffDocumentService');

class WriteoffDocumentController {
    constructor() {
        this.name = 'WriteoffDocumentController';
    }

    /**
     * GET /api/writeoff-documents
     * Get all writeoff documents (hybrid: new + legacy)
     */
    async getAllDocuments(req, res) {
        try {
            console.log(`[${this.name}] GET /api/writeoff-documents`);
            
            const result = await writeoffDocumentService.getAllDocuments();
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: result.data,
                    message: `Знайдено ${result.data.length} документів списання`
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error(`[${this.name}] Error in getAllDocuments:`, error);
            res.status(500).json({
                success: false,
                error: 'Помилка отримання документів списання'
            });
        }
    }

    /**
     * GET /api/writeoff-documents/:id
     * Get writeoff document by ID
     */
    async getDocumentById(req, res) {
        try {
            const { id } = req.params;
            console.log(`[${this.name}] GET /api/writeoff-documents/${id}`);
            
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Некоректний ID документу'
                });
            }
            
            const result = await writeoffDocumentService.getDocumentById(parseInt(id));
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error(`[${this.name}] Error in getDocumentById:`, error);
            res.status(500).json({
                success: false,
                error: 'Помилка отримання документу'
            });
        }
    }

    /**
     * POST /api/writeoff-documents
     * Create new writeoff document
     */
    async createDocument(req, res) {
        try {
            console.log(`[${this.name}] POST /api/writeoff-documents`);
            console.log('Request body:', JSON.stringify(req.body, null, 2));
            
            const { documentData, items } = req.body;
            
            // Validate request structure
            if (!documentData || !items) {
                return res.status(400).json({
                    success: false,
                    error: 'Некоректна структура запиту',
                    details: 'Очікуються поля documentData та items'
                });
            }

            // Add created_by from authenticated user if available
            if (req.user && req.user.username) {
                documentData.created_by = req.user.username;
            }

            const result = await writeoffDocumentService.createDocument(documentData, items);
            
            if (result.success) {
                res.status(201).json({
                    success: true,
                    data: result.data,
                    message: result.message
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    details: result.details
                });
            }
        } catch (error) {
            console.error(`[${this.name}] Error in createDocument:`, error);
            res.status(500).json({
                success: false,
                error: 'Помилка створення документу списання'
            });
        }
    }

    /**
     * GET /api/writeoff-documents/preview-number
     * Preview document number for given date
     */
    async previewDocumentNumber(req, res) {
        try {
            const { date } = req.query;
            console.log(`[${this.name}] GET /api/writeoff-documents/preview-number?date=${date}`);
            
            if (!date) {
                return res.status(400).json({
                    success: false,
                    error: 'Параметр date обов\'язковий'
                });
            }

            // Validate date format
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Некоректний формат дати'
                });
            }
            
            const result = await writeoffDocumentService.previewDocumentNumber(date);
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: {
                        document_number: result.data,
                        date: date
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error(`[${this.name}] Error in previewDocumentNumber:`, error);
            res.status(500).json({
                success: false,
                error: 'Помилка генерації номеру документу'
            });
        }
    }

    /**
     * GET /api/writeoff-documents/statistics
     * Get writeoff statistics
     */
    async getStatistics(req, res) {
        try {
            const { start_date, end_date } = req.query;
            console.log(`[${this.name}] GET /api/writeoff-documents/statistics?start_date=${start_date}&end_date=${end_date}`);
            
            const result = await writeoffDocumentService.getStatistics(start_date, end_date);
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: result.data,
                    filters: {
                        start_date,
                        end_date
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error(`[${this.name}] Error in getStatistics:`, error);
            res.status(500).json({
                success: false,
                error: 'Помилка отримання статистики'
            });
        }
    }

    /**
     * Validation middleware for document creation
     */
    validateCreateRequest(req, res, next) {
        const { documentData, items } = req.body;
        
        if (!documentData) {
            return res.status(400).json({
                success: false,
                error: 'documentData обов\'язкове поле'
            });
        }
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'items повинно бути непустим масивом'
            });
        }

        // Validate required fields in documentData
        const requiredFields = ['writeoff_date', 'reason', 'responsible'];
        for (const field of requiredFields) {
            if (!documentData[field]) {
                return res.status(400).json({
                    success: false,
                    error: `Поле ${field} обов'язкове в documentData`
                });
            }
        }

        // Validate required fields in items
        for (const [index, item] of items.entries()) {
            if (!item.product_id || !item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Позиція ${index + 1}: product_id та quantity обов'язкові`
                });
            }
        }

        next();
    }

    /**
     * Error handling middleware
     */
    handleError(error, req, res, next) {
        console.error(`[${this.name}] Unhandled error:`, error);
        
        res.status(500).json({
            success: false,
            error: 'Внутрішня помилка сервера',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
}

module.exports = new WriteoffDocumentController(); 