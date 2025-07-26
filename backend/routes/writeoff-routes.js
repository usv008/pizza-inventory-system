const express = require('express');
const writeoffService = require('../services/writeoffService-v2');
const { 
    validateCreateWriteoff, 
    validateIdParam, 
    validateQueryParams,
    normalizeWriteoffData 
} = require('../validators/writeoffValidator');
const { handleAsync } = require('../middleware/responseFormatter');

const router = express.Router();

/**
 * WRITEOFFS ROUTES
 * 
 * REST API для управління списаннями товарів:
 * - GET /api/writeoffs - список всіх списань з фільтрацією
 * - POST /api/writeoffs - створення нового списання
 * - GET /api/writeoffs/product/:id - списання за продуктом
 * - GET /api/writeoffs/statistics - статистика списань
 * 
 * Всі routes використовують стандартизований response format
 */

/**
 * GET /api/writeoffs
 * Отримати всі списання з опціональною фільтрацією
 * 
 * Query params:
 * - date_from: фільтр по даті від (YYYY-MM-DD)
 * - date_to: фільтр по даті до (YYYY-MM-DD)  
 * - product_id: фільтр по ID продукту
 * - reason: фільтр по причині (часткове співпадіння)
 * - responsible: фільтр по відповідальному (часткове співпадіння)
 */
router.get('/', handleAsync(async (req, res) => {
    const filters = {
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        product_id: req.query.product_id,
        reason: req.query.reason,
        responsible: req.query.responsible
    };

    // Видаляємо порожні фільтри
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });

    const result = await writeoffService.getAllWriteoffs(filters);

    res.json({
        success: true,
        data: result.writeoffs,
        meta: {
            ...result.meta,
            message: result.writeoffs.length > 0 ? 
                `Знайдено ${result.writeoffs.length} записів списання` : 
                'Списання не знайдено',
            endpoint: 'GET /api/writeoffs',
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * POST /api/writeoffs
 * Створити новий запис списання
 * 
 * Body:
 * - product_id: ID продукту (обов'язково)
 * - writeoff_date: дата списання YYYY-MM-DD (обов'язково)
 * - total_quantity: кількість штук (обов'язково)
 * - reason: причина списання (обов'язково)
 * - responsible: відповідальна особа (обов'язково)
 * - notes: додаткові примітки (опціонально)
 */
router.post('/', 
    normalizeWriteoffData,
    validateCreateWriteoff,
    handleAsync(async (req, res) => {
        const writeoffData = {
            product_id: req.body.product_id,
            writeoff_date: req.body.writeoff_date,
            total_quantity: req.body.total_quantity,
            reason: req.body.reason,
            responsible: req.body.responsible,
            notes: req.body.notes || ''
        };

        const requestInfo = {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        };

        const result = await writeoffService.createWriteoff(writeoffData, requestInfo);

        res.status(201).json({
            success: true,
            data: result,
            meta: {
                message: `Списання створено успішно. ID: ${result.id}`,
                operation: 'CREATE_WRITEOFF',
                endpoint: 'POST /api/writeoffs',
                timestamp: new Date().toISOString()
            }
        });
    })
);

/**
 * GET /api/writeoffs/product/:id
 * Отримати всі списання для конкретного продукту
 * 
 * Params:
 * - id: ID продукту
 */
router.get('/product/:id', 
    validateIdParam,
    handleAsync(async (req, res) => {
        const productId = parseInt(req.params.id);
        
        const result = await writeoffService.getWriteoffsByProductId(productId);

        res.json({
            success: true,
            data: result.writeoffs,
            meta: {
                ...result.meta,
                product: result.product,
                message: result.writeoffs.length > 0 ? 
                    `Знайдено ${result.writeoffs.length} записів списання для продукту "${result.product.name}"` :
                    `Записи списання для продукту "${result.product.name}" не знайдено`,
                endpoint: `GET /api/writeoffs/product/${productId}`,
                timestamp: new Date().toISOString()
            }
        });
    })
);

/**
 * GET /api/writeoffs/statistics
 * Отримати статистику списань за період
 * 
 * Query params:
 * - period: week|month|quarter|year (default: month)
 */
router.get('/statistics', handleAsync(async (req, res) => {
    const period = req.query.period || 'month';
    
    // Валідація періоду
    const allowedPeriods = ['week', 'month', 'quarter', 'year'];
    if (!allowedPeriods.includes(period)) {
        return res.status(400).json({
            success: false,
            error: {
                type: 'ValidationError',
                message: `Невірний період. Дозволені: ${allowedPeriods.join(', ')}`,
                details: [{
                    field: 'period',
                    message: `period повинен бути одним з: ${allowedPeriods.join(', ')}`,
                    value: period
                }]
            },
            meta: {
                endpoint: 'GET /api/writeoffs/statistics',
                timestamp: new Date().toISOString()
            }
        });
    }

    const result = await writeoffService.getWriteoffStatisticsByPeriod(period);

    res.json({
        success: true,
        data: result,
        meta: {
            message: `Статистика списань за ${period}`,
            period: result.period,
            endpoint: 'GET /api/writeoffs/statistics',
            timestamp: new Date().toISOString()
        }
    });
}));

module.exports = router; 