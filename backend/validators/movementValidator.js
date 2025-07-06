const { body, param, query } = require('express-validator');

/**
 * Movement Validator
 * Валідація для рухів товарів (stock_movements)
 */

const MovementValidator = {
    // Валідація створення нового руху
    validateCreate: [
        body('product_id')
            .isInt({ min: 1 })
            .withMessage('ID товару повинен бути позитивним числом'),
        
        body('movement_type')
            .isIn(['IN', 'OUT', 'TRANSFER', 'CORRECTION', 'WRITEOFF', 'PRODUCTION'])
            .withMessage('Тип руху повинен бути одним з: IN, OUT, TRANSFER, CORRECTION, WRITEOFF, PRODUCTION'),
        
        body('pieces')
            .isInt({ min: 1, max: 100000 })
            .withMessage('Кількість штук повинна бути від 1 до 100,000'),
        
        body('boxes')
            .isInt({ min: 0, max: 10000 })
            .withMessage('Кількість коробок повинна бути від 0 до 10,000'),
        
        body('reason')
            .isLength({ min: 3, max: 500 })
            .withMessage('Причина повинна містити від 3 до 500 символів')
            .customSanitizer(value => {
                // Автоматична капіталізація першої літери
                return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
            }),
        
        body('user')
            .optional()
            .isLength({ min: 2, max: 100 })
            .withMessage('Ім\'я користувача повинно містити від 2 до 100 символів')
            .customSanitizer(value => {
                if (!value) return 'system';
                return value.trim();
            }),
        
        body('batch_id')
            .optional()
            .isInt({ min: 1 })
            .withMessage('ID партії повинен бути позитивним числом'),
        
        body('batch_date')
            .optional()
            .isISO8601()
            .withMessage('Дата партії повинна бути у форматі YYYY-MM-DD')
            .custom(value => {
                if (!value) return true;
                const date = new Date(value);
                const now = new Date();
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(now.getFullYear() - 1);
                
                if (date > now) {
                    throw new Error('Дата партії не може бути в майбутньому');
                }
                
                if (date < oneYearAgo) {
                    throw new Error('Дата партії не може бути старше року');
                }
                
                return true;
            }),

        // Кастомна валідація узгодженості даних
        body().custom((body) => {
            const { movement_type, pieces, boxes } = body;
            
            // Перевірка, що для OUT рухів кількість не перевищує наявні залишки
            if (movement_type === 'OUT' && pieces <= 0) {
                throw new Error('Для вихідних рухів кількість повинна бути більше 0');
            }
            
            // Перевірка узгодженості pieces та boxes
            if (boxes > 0 && pieces < boxes) {
                throw new Error('Кількість штук не може бути меншою за кількість коробок');
            }
            
            return true;
        })
    ],

    // Валідація оновлення руху
    validateUpdate: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('ID руху повинен бути позитивним числом'),
        
        body('reason')
            .optional()
            .isLength({ min: 3, max: 500 })
            .withMessage('Причина повинна містити від 3 до 500 символів'),
        
        body('user')
            .optional()
            .isLength({ min: 2, max: 100 })
            .withMessage('Ім\'я користувача повинно містити від 2 до 100 символів')
    ],

    // Валідація параметрів фільтрації
    validateFilters: [
        query('product_id')
            .optional()
            .isInt({ min: 1 })
            .withMessage('ID товару повинен бути позитивним числом'),
        
        query('movement_type')
            .optional()
            .isIn(['IN', 'OUT', 'TRANSFER', 'CORRECTION', 'WRITEOFF', 'PRODUCTION', 'ALL'])
            .withMessage('Тип руху повинен бути одним з: IN, OUT, TRANSFER, CORRECTION, WRITEOFF, PRODUCTION, ALL'),
        
        query('date_from')
            .optional()
            .isISO8601()
            .withMessage('Дата початку повинна бути у форматі YYYY-MM-DD'),
        
        query('date_to')
            .optional()
            .isISO8601()
            .withMessage('Дата закінчення повинна бути у форматі YYYY-MM-DD'),
        
        query('user')
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage('Користувач повинен містити від 1 до 100 символів'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .withMessage('Ліміт повинен бути від 1 до 1000'),
        
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Зсув повинен бути не менше 0'),

        // Валідація узгодженості дат
        query().custom((query) => {
            const { date_from, date_to } = query;
            
            if (date_from && date_to) {
                const from = new Date(date_from);
                const to = new Date(date_to);
                
                if (from > to) {
                    throw new Error('Дата початку не може бути пізніше дати закінчення');
                }
                
                // Максимальний період - 1 рік
                const diffTime = Math.abs(to - from);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 365) {
                    throw new Error('Період фільтрації не може перевищувати 1 рік');
                }
            }
            
            return true;
        })
    ],

    // Валідація параметрів статистики
    validateStatistics: [
        query('period')
            .optional()
            .isIn(['day', 'week', 'month', 'quarter', 'year'])
            .withMessage('Період повинен бути одним з: day, week, month, quarter, year'),
        
        query('group_by')
            .optional()
            .isIn(['type', 'user', 'product', 'reason', 'date'])
            .withMessage('Групування повинно бути одним з: type, user, product, reason, date'),
        
        query('product_id')
            .optional()
            .isInt({ min: 1 })
            .withMessage('ID товару повинен бути позитивним числом'),
        
        query('start_date')
            .optional()
            .isISO8601()
            .withMessage('Початкова дата повинна бути у форматі YYYY-MM-DD'),
        
        query('end_date')
            .optional()
            .isISO8601()
            .withMessage('Кінцева дата повинна бути у форматі YYYY-MM-DD')
    ],

    // Валідація ID параметра
    validateId: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('ID повинен бути позитивним числом')
    ]
};

module.exports = MovementValidator; 