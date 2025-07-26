const express = require('express');
const operationsLogService = require('../services/operationsLogService-v2');
const { handleAsync } = require('../middleware/responseFormatter');

const router = express.Router();

/**
 * Отримати логи з фільтрацією
 * GET /operations-log?operation_type=CREATE_ORDER&entity_type=order&limit=100
 */
router.get('/', async (req, res) => {
    try {
        const {
            operation_type,
            entity_type,
            entity_id,
            user_name,
            date_from,
            date_to,
            limit = 200,
            offset = 0
        } = req.query;

        const filters = {
            operation_type,
            entity_type,
            entity_id,
            user_name,
            date_from,
            date_to,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const result = await operationsLogService.getLogs(filters);
        res.json(result);
    } catch (error) {
        console.error('Error in GET /operations-log:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка завантаження логів',
            details: error.message 
        });
    }
});

/**
 * Отримати статистику операцій
 * GET /operations-log/statistics?period=30
 */
router.get('/statistics', async (req, res) => {
    try {
        const { period = 30 } = req.query;
        const result = await operationsLogService.getOperationsStats(parseInt(period));
        res.json(result);
    } catch (error) {
        console.error('Error in GET /operations-log/statistics:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка отримання статистики',
            details: error.message 
        });
    }
});

/**
 * Отримати операції по конкретній сутності
 * GET /operations-log/entity/order/123
 */
router.get('/entity/:entity_type/:entity_id', async (req, res) => {
    try {
        const { entity_type, entity_id } = req.params;
        const { limit = 50 } = req.query;

        const result = await operationsLogService.getEntityOperations(
            entity_type, 
            entity_id, 
            parseInt(limit)
        );
        res.json(result);
    } catch (error) {
        console.error('Error in GET /operations-log/entity:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка отримання операцій сутності',
            details: error.message 
        });
    }
});

/**
 * Ручне логування операції (для тестування або адміністративного використання)
 * POST /operations-log
 */
router.post('/', async (req, res) => {
    try {
        const {
            operation_type,
            operation_id,
            entity_type,
            entity_id,
            old_data,
            new_data,
            description,
            user_name
        } = req.body;

        // Валідація обов'язкових полів
        if (!operation_type || !entity_type || !description || !user_name) {
            return res.status(400).json({
                success: false,
                error: 'Некоректні дані для логування',
                details: 'Обов\'язкові поля: operation_type, entity_type, description, user_name'
            });
        }

        const context = {
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
        };

        const logId = await operationsLogService.logOperation({
            operation_type,
            operation_id,
            entity_type,
            entity_id,
            old_data,
            new_data,
            description,
            user_name,
            ...context
        });

        res.status(201).json({
            success: true,
            message: 'Операція успішно залогована',
            log_id: logId
        });
    } catch (error) {
        console.error('Error in POST /operations-log:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка логування операції',
            details: error.message 
        });
    }
});

/**
 * Отримати типи операцій (довідкова інформація)
 * GET /operations-log/operation-types
 */
router.get('/operation-types', (req, res) => {
    res.json({
        success: true,
        operation_types: operationsLogService.constructor.OPERATION_TYPES,
        count: Object.keys(operationsLogService.constructor.OPERATION_TYPES).length
    });
});

module.exports = router;