const express = require('express');
const arrivalService = require('../services/arrivalService-v2');
const { handleAsync } = require('../middleware/responseFormatter');

const router = express.Router();

// Отримати всі приходи з фільтрацією
router.get('/', async (req, res) => {
    try {
        const { start_date, end_date, created_by } = req.query;
        
        const filters = {};
        if (start_date) filters.start_date = start_date;
        if (end_date) filters.end_date = end_date;
        if (created_by) filters.created_by = created_by;
        
        const result = await arrivalService.getAllArrivals(filters);
        res.json(result);
    } catch (error) {
        console.error('Error in GET /arrivals:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка завантаження приходів',
            details: error.message 
        });
    }
});

// Отримати прихід за ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await arrivalService.getArrivalById(id);
        res.json(result);
    } catch (error) {
        console.error('Error in GET /arrivals/:id:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка завантаження приходу',
            details: error.message 
        });
    }
});

// Створити документ приходу
router.post('/', async (req, res) => {
    try {
        const { arrival_date, reason, created_by, items } = req.body;
        
        // Валідація
        if (!arrival_date || !reason || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Некоректні дані для оприходування',
                details: 'Обов\'язкові поля: arrival_date, reason, items (масив)'
            });
        }

        const arrivalData = { arrival_date, reason, created_by };
        const context = {
            user: created_by || 'system',
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            log_operation: true
        };
        
        const result = await arrivalService.createArrival(arrivalData, items, context);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error in POST /arrivals:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка створення приходу',
            details: error.message 
        });
    }
});

// Видалити прихід
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const context = {
            user: req.body.user || 'system',
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            log_operation: true
        };
        
        const result = await arrivalService.deleteArrival(id, context);
        res.json(result);
    } catch (error) {
        console.error('Error in DELETE /arrivals/:id:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка видалення приходу',
            details: error.message 
        });
    }
});

// Отримати статистику приходів
router.get('/statistics/summary', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const result = await arrivalService.getArrivalStatistics(start_date, end_date);
        res.json(result);
    } catch (error) {
        console.error('Error in GET /arrivals/statistics:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка отримання статистики',
            details: error.message 
        });
    }
});

// Отримати звіт приходів
router.get('/reports/detailed', async (req, res) => {
    try {
        const { start_date, end_date, group_by = 'date' } = req.query;
        const result = await arrivalService.getArrivalsReport(start_date, end_date, group_by);
        res.json(result);
    } catch (error) {
        console.error('Error in GET /arrivals/reports:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка створення звіту',
            details: error.message 
        });
    }
});

// Валідувати дані приходу
router.post('/validate', async (req, res) => {
    try {
        const { arrival_date, reason, created_by, items } = req.body;
        const arrivalData = { arrival_date, reason, created_by };
        
        const validation = await arrivalService.validateArrivalData(arrivalData, items);
        res.json({
            success: true,
            validation: validation
        });
    } catch (error) {
        console.error('Error in POST /arrivals/validate:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Помилка валідації',
            details: error.message 
        });
    }
});

module.exports = router; 