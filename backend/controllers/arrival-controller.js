const ArrivalService = require('../services/arrivalService');

// Отримати всі документи приходу
exports.getAllArrivals = async (req, res, next) => {
    try {
        const filters = {
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            created_by: req.query.created_by,
            limit: req.query.limit
        };

        const result = await ArrivalService.getAllArrivals(filters);
        
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

// Отримати документ приходу за ID
exports.getArrivalById = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        
        if (!id || isNaN(id)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Некоректний ID документа' 
            });
        }

        const result = await ArrivalService.getArrivalById(id);
        
        res.json({
            success: result.success,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        if (error.message.includes('не знайдено')) {
            return res.status(404).json({ 
                success: false, 
                error: error.message 
            });
        }
        next(error);
    }
};

// Створити документ приходу
exports.createArrival = async (req, res, next) => {
    try {
        const { arrival_date, reason, items } = req.body;
        
        // Отримуємо user з сесії, якщо доступна
        const created_by = req.userContext?.username || req.body.created_by || 'system';
        
        // Збираємо інформацію про запит для логування
        const requestInfo = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            user: created_by
        };

        const arrivalData = {
            arrival_date,
            reason,
            created_by,
            items
        };

        const result = await ArrivalService.createArrival(arrivalData, requestInfo);
        
        // Логуємо операцію створення приходу
        if (req.logOperation && result.success) {
            await req.logOperation(
                'ARRIVAL_CREATE',
                {
                    arrival_number: result.data.arrival_number,
                    arrival_date: arrival_date,
                    reason: reason,
                    items_count: items?.length || 0,
                    total_items: items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
                },
                'ARRIVAL',
                result.data.id
            );
        }
        
        res.status(201).json({
            success: result.success,
            message: result.message,
            arrival_number: result.data.arrival_number,
            data: result.data
        });
    } catch (error) {
        if (error.message.includes('Некоректні дані') || 
            error.message.includes('Некоректна позиція') ||
            error.message.includes('не знайдено')) {
            return res.status(400).json({ 
                success: false, 
                error: error.message 
            });
        }
        next(error);
    }
};