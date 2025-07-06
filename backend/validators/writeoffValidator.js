const { body, param, validationResult } = require('express-validator');
const { AppError, ValidationError } = require('../middleware/errors/AppError');

/**
 * WRITEOFFS VALIDATOR
 * 
 * Валідація даних для writeoffs операцій згідно з business rules:
 * - Обов'язкові поля: product_id, writeoff_date, total_quantity, reason, responsible
 * - Валідація дат (не в майбутньому, максимум 1 рік назад)
 * - Валідація кількості (1-100000 штук)
 * - Нормалізація тексту
 */

// Middleware для обробки помилок валідації
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const validationErrors = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));
        
        throw new ValidationError('Помилки валідації writeoff даних', validationErrors);
    }
    next();
};

// Валідація для створення writeoff
const validateCreateWriteoff = [
    // Product ID валідація
    body('product_id')
        .notEmpty()
        .withMessage('product_id є обов\'язковим')
        .isInt({ min: 1 })
        .withMessage('product_id повинен бути додатним числом')
        .toInt(),

    // Writeoff date валідація
    body('writeoff_date')
        .notEmpty()
        .withMessage('writeoff_date є обов\'язковим')
        .isISO8601({ strict: true })
        .withMessage('writeoff_date повинен бути в форматі YYYY-MM-DD')
        .custom((date) => {
            const writeoffDate = new Date(date);
            const now = new Date();
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(now.getFullYear() - 1);

            // Не можна списувати в майбутньому
            if (writeoffDate > now) {
                throw new Error('Дата списання не може бути в майбутньому');
            }

            // Не можна списувати дуже старі товари (більше року)
            if (writeoffDate < oneYearAgo) {
                throw new Error('Дата списання не може бути давніше ніж 1 рік');
            }

            return true;
        }),

    // Quantity валідація
    body('total_quantity')
        .notEmpty()
        .withMessage('total_quantity є обов\'язковим')
        .isInt({ min: 1, max: 100000 })
        .withMessage('total_quantity повинен бути від 1 до 100,000 штук')
        .toInt(),

    // Reason валідація
    body('reason')
        .notEmpty()
        .withMessage('reason є обов\'язковим')
        .isLength({ min: 3, max: 200 })
        .withMessage('reason повинен містити від 3 до 200 символів')
        .trim()
        .escape()
        .custom((reason) => {
            // Список допустимих причин списання
            const allowedReasons = [
                'Прострочка',
                'Псування',
                'Брак виробництва',
                'Механічні пошкодження',
                'Списання залишків',
                'Інвентаризація',
                'Втрата',
                'Крадіжка',
                'Повернення від клієнта',
                'Технічне списання',
                'Перерахунок',
                'Інше'
            ];
            
            const found = allowedReasons.some(allowed => 
                reason.toLowerCase().includes(allowed.toLowerCase()) || 
                allowed.toLowerCase().includes(reason.toLowerCase())
            );
            
            if (!found && !reason.toLowerCase().includes('інше')) {
                throw new Error(`Невідома причина списання. Дозволені: ${allowedReasons.join(', ')}`);
            }
            
            return true;
        }),

    // Responsible валідація
    body('responsible')
        .notEmpty()
        .withMessage('responsible є обов\'язковим')
        .isLength({ min: 2, max: 100 })
        .withMessage('responsible повинен містити від 2 до 100 символів')
        .trim()
        .escape()
        .matches(/^[a-zA-Zа-яА-ЯїЇєЄіІ\s\.-]+$/)
        .withMessage('responsible повинен містити лише букви, пробіли, точки та дефіси'),

    // Notes валідація (опціональне)
    body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('notes не повинні перевищувати 500 символів')
        .trim()
        .escape(),

    handleValidationErrors
];

// Валідація параметрів ID
const validateIdParam = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID повинен бути додатним числом')
        .toInt(),
    
    handleValidationErrors
];

// Валідація query параметрів для фільтрації
const validateQueryParams = [
    // Date range валідація
    body('date_from')
        .optional()
        .isISO8601({ strict: true })
        .withMessage('date_from повинен бути в форматі YYYY-MM-DD'),
    
    body('date_to')  
        .optional()
        .isISO8601({ strict: true })
        .withMessage('date_to повинен бути в форматі YYYY-MM-DD')
        .custom((dateTo, { req }) => {
            if (req.body.date_from && dateTo) {
                const from = new Date(req.body.date_from);
                const to = new Date(dateTo);
                
                if (to < from) {
                    throw new Error('date_to не може бути раніше ніж date_from');
                }
            }
            return true;
        }),

    // Product ID фільтр
    body('product_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('product_id повинен бути додатним числом')
        .toInt(),

    handleValidationErrors
];

// Допоміжна функція для нормалізації writeoff даних
const normalizeWriteoffData = (req, res, next) => {
    if (req.body) {
        // Нормалізація текстових полів
        if (req.body.reason) {
            req.body.reason = req.body.reason.trim();
            // Капіталізація першої літери
            req.body.reason = req.body.reason.charAt(0).toUpperCase() + req.body.reason.slice(1);
        }
        
        if (req.body.responsible) {
            req.body.responsible = req.body.responsible.trim();
            // Капіталізація кожного слова
            req.body.responsible = req.body.responsible
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

        if (req.body.notes) {
            req.body.notes = req.body.notes.trim();
        }

        // Нормалізація дати
        if (req.body.writeoff_date) {
            req.body.writeoff_date = req.body.writeoff_date.split('T')[0]; // Тільки дата без часу
        }
    }
    
    next();
};

module.exports = {
    validateCreateWriteoff,
    validateIdParam,
    validateQueryParams,
    normalizeWriteoffData,
    handleValidationErrors
}; 