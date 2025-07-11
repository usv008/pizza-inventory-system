const express = require('express');
const { validationResult } = require('express-validator');
const router = express.Router();

const MovementValidator = require('../validators/movementValidator');
const MovementService = require('../services/movementService');
const { formatSuccess: formatResponse, formatError } = require('../middleware/responseFormatter');

/**
 * Movement Routes
 * REST API для рухів товарів (stock_movements)
 */

// Middleware для обробки помилок валідації
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json(formatError('Помилка валідації', errors.array()));
    }
    next();
};

// Middleware для захоплення інформації про запит
const captureRequestInfo = (req, res, next) => {
    req.requestInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        user: req.body.user || req.query.user || 'system'
    };
    next();
};

/**
 * GET /api/movements
 * Отримання списку всіх рухів з фільтрацією
 * Query params: product_id, movement_type, date_from, date_to, user, limit, offset
 */
router.get('/', 
    MovementValidator.validateFilters,
    handleValidationErrors,
    async (req, res, next) => {
        try {
            const filters = {
                product_id: req.query.product_id,
                movement_type: req.query.movement_type,
                date_from: req.query.date_from,
                date_to: req.query.date_to,
                user: req.query.user,
                limit: req.query.limit,
                offset: req.query.offset
            };

            const result = await MovementService.getAllMovements(filters);
            
            res.json(formatResponse(result.data, 'Рухи товарів отримано успішно', {
                pagination: result.pagination,
                filters: result.filters
            }));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/movements
 * Створення нового руху товару
 * Body: { product_id, movement_type, pieces, boxes, reason, user?, batch_id?, batch_date? }
 */
router.post('/',
    MovementValidator.validateCreate,
    handleValidationErrors,
    captureRequestInfo,
    async (req, res, next) => {
        try {
            const movementData = {
                product_id: req.body.product_id,
                movement_type: req.body.movement_type,
                pieces: req.body.pieces,
                boxes: req.body.boxes || 0,
                reason: req.body.reason,
                user: req.body.user || 'system',
                batch_id: req.body.batch_id || null,
                batch_date: req.body.batch_date || null
            };

            const result = await MovementService.createMovement(movementData, req.requestInfo);
            
            res.status(201).json(formatResponse(result.data, result.message));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/movements/:id
 * Оновлення руху товару (обмежене - тільки reason та user)
 * Body: { reason?, user? }
 */
router.put('/:id',
    MovementValidator.validateUpdate,
    handleValidationErrors,
    captureRequestInfo,
    async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            const updateData = {
                reason: req.body.reason,
                user: req.body.user
            };

            const result = await MovementService.updateMovement(id, updateData, req.requestInfo);
            
            res.json(formatResponse(result.data, result.message));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/movements/product/:id
 * Отримання рухів для конкретного товару
 * Query params: movement_type, date_from, date_to, limit, offset
 */
router.get('/product/:id',
    MovementValidator.validateId,
    MovementValidator.validateFilters,
    handleValidationErrors,
    async (req, res, next) => {
        try {
            const productId = parseInt(req.params.id);
            const filters = {
                movement_type: req.query.movement_type,
                date_from: req.query.date_from,
                date_to: req.query.date_to,
                user: req.query.user,
                limit: req.query.limit,
                offset: req.query.offset
            };

            const result = await MovementService.getMovementsByProduct(productId, filters);
            
            res.json(formatResponse(result.data, `Рухи товару отримано успішно`, {
                product_id: productId,
                pagination: result.pagination,
                filters: result.filters
            }));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/movements/statistics
 * Отримання статистики рухів товарів
 * Query params: period, group_by, product_id, start_date, end_date
 */
router.get('/statistics',
    MovementValidator.validateStatistics,
    handleValidationErrors,
    async (req, res, next) => {
        try {
            const options = {
                period: req.query.period || 'month',
                group_by: req.query.group_by || 'type',
                product_id: req.query.product_id,
                start_date: req.query.start_date,
                end_date: req.query.end_date
            };

            const result = await MovementService.getMovementStatistics(options);
            
            res.json(formatResponse(result.data, 'Статистика рухів отримана успішно', {
                options: result.options
            }));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/movements/:id
 * Видалення руху товару (ОБЕРЕЖНО - змінює залишки!)
 * Тільки для адміністраторів або у виняткових випадках
 */
router.delete('/:id',
    MovementValidator.validateId,
    handleValidationErrors,
    captureRequestInfo,
    async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            
            // Додаткова перевірка - чи дозволено видалення
            const confirmDelete = req.query.confirm === 'true';
            if (!confirmDelete) {
                return res.status(400).json(formatError(
                    'Видалення руху вимагає підтвердження. Додайте параметр ?confirm=true',
                    null,
                    { 
                        warning: 'Видалення руху змінить залишки товару!',
                        required_param: 'confirm=true'
                    }
                ));
            }

            const result = await MovementService.deleteMovement(id, req.requestInfo);
            
            res.json(formatResponse(null, result.message, {
                warning: 'Залишки товару були перераховані'
            }));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/movements/:id
 * Отримання конкретного руху за ID
 */
router.get('/:id',
    MovementValidator.validateId,
    handleValidationErrors,
    async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            
            // Використовуємо приватний метод через створення тимчасового екземпляра
            const { db } = require('../supabase-database');
            
            const movement = await new Promise((resolve, reject) => {
                const sql = `
                    SELECT 
                        sm.id,
                        sm.product_id,
                        sm.movement_type,
                        sm.pieces,
                        sm.boxes,
                        sm.reason,
                        sm.user,
                        sm.batch_id,
                        sm.batch_date,
                        sm.created_at,
                        p.name as product_name,
                        p.code as product_code
                    FROM stock_movements sm
                    JOIN products p ON sm.product_id = p.id
                    WHERE sm.id = ?
                `;
                
                db.get(sql, [id], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (!movement) {
                return res.status(404).json(formatError(`Рух з ID ${id} не знайдено`));
            }

            res.json(formatResponse(movement, 'Рух товару отримано успішно'));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/movements/types
 * Отримання списку доступних типів рухів
 */
router.get('/types', (req, res) => {
    const types = [
        { value: 'IN', label: 'Прихід', description: 'Надходження товару на склад' },
        { value: 'OUT', label: 'Видача', description: 'Видача товару зі складу' },
        { value: 'TRANSFER', label: 'Переміщення', description: 'Переміщення між складами' },
        { value: 'CORRECTION', label: 'Корекція', description: 'Корекція залишків' },
        { value: 'WRITEOFF', label: 'Списання', description: 'Списання товару' },
        { value: 'PRODUCTION', label: 'Виробництво', description: 'Надходження з виробництва' }
    ];

    res.json(formatResponse(types, 'Типи рухів отримано успішно'));
});

/**
 * GET /api/movements/summary
 * Короткий звіт по рухах за поточний день/тиждень/місяць
 */
router.get('/summary', async (req, res, next) => {
    try {
        const { db } = require('../supabase-database');
        
        const summary = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    movement_type,
                    COUNT(*) as count,
                    SUM(pieces) as total_pieces,
                    DATE(created_at) as movement_date
                FROM stock_movements 
                WHERE DATE(created_at) >= DATE('now', '-7 days')
                GROUP BY movement_type
                ORDER BY movement_type
            `;
            
            db.all(sql, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        res.json(formatResponse(summary, 'Звіт по рухах отримано успішно', {
            period: 'last_7_days',
            generated_at: new Date().toISOString()
        }));
    } catch (error) {
        next(error);
    }
});

module.exports = router; 