const express = require('express');
const router = express.Router();

// Імпорти
const productionService = require('../services/productionService');
const ProductionValidator = require('../validators/productionValidator');
const { handleAsync } = require('../middleware/responseFormatter');

/**
 * @route GET /api/production
 * @desc Отримати всі записи виробництва з можливістю фільтрації
 * @access Public
 * @query {string} start_date - Початкова дата фільтрації (YYYY-MM-DD)
 * @query {string} end_date - Кінцева дата фільтрації (YYYY-MM-DD)  
 * @query {number} product_id - ID товару для фільтрації
 */
router.get('/', 
    ProductionValidator.validateGetProduction(),
    ProductionValidator.handleValidationErrors,
    handleAsync(async (req, res) => {
        const { start_date, end_date, product_id } = req.query;
        
        const filters = {};
        if (start_date) filters.start_date = start_date;
        if (end_date) filters.end_date = end_date;
        if (product_id) filters.product_id = product_id;
        
        const result = await productionService.getAllProduction(filters);
        
        // Return clean array for frontend compatibility (no wrapper)
        res.json(result.production || result);
    })
);

/**
 * @route POST /api/production
 * @desc Створити новий запис виробництва
 * @access Public
 * @body {number} product_id - ID товару (обов'язково)
 * @body {string} production_date - Дата виробництва YYYY-MM-DD (обов'язково)
 * @body {number} total_quantity - Загальна кількість штук (обов'язково)
 * @body {string} expiry_date - Дата закінчення терміну придатності YYYY-MM-DD (опційно)
 * @body {string} responsible - Відповідальна особа (опційно)
 * @body {string} notes - Примітки (опційно)
 * @body {string} production_time - Час виробництва HH:MM:SS (опційно)
 */
router.post('/',
    ProductionValidator.validateCreateProduction(),
    ProductionValidator.handleValidationErrors,
    ProductionValidator.normalizeProductionData,
    handleAsync(async (req, res) => {
        const productionData = req.body;
        
        const result = await productionService.createProduction(productionData, req);
        
        res.status(201).json({
            success: true,
            data: result.production,
            message: result.message
        });
    })
);

/**
 * @route GET /api/production/product/:id
 * @desc Отримати всі записи виробництва для конкретного товару
 * @access Public
 * @param {number} id - ID товару
 */
router.get('/product/:id',
    ProductionValidator.validateProductId(),
    ProductionValidator.handleValidationErrors,
    handleAsync(async (req, res) => {
        const productId = parseInt(req.params.id);
        
        const result = await productionService.getProductionByProductId(productId);
        
        res.json({
            success: true,
            data: result.production,
            meta: {
                count: result.count,
                stats: result.stats,
                product_id: result.product_id
            }
        });
    })
);

/**
 * @route GET /api/production/statistics
 * @desc Отримати статистики виробництва за період
 * @access Public
 * @query {string} start_date - Початкова дата (YYYY-MM-DD)
 * @query {string} end_date - Кінцева дата (YYYY-MM-DD)
 */
router.get('/statistics',
    handleAsync(async (req, res) => {
        const { start_date, end_date } = req.query;
        
        const result = await productionService.getProductionStatistics(start_date, end_date);
        
        res.json({
            success: true,
            data: result
        });
    })
);

// TODO: Додаткові endpoints для production planning
/**
 * Планові endpoints для майбутньої імплементації:
 * 
 * GET /api/production-analysis - аналіз виробництва
 * GET /api/production-plans/:date - план виробництва на дату
 * POST /api/production-plans - створити план виробництва
 * GET /api/production-settings - налаштування виробництва
 * GET /api/production-demand - попит на виробництво
 * 
 * Ці endpoints будуть додані в наступних ітераціях після базової функціональності
 */

module.exports = router; 