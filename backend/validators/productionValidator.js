const { body, param, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errors/AppError');

class ProductionValidator {
    /**
     * Валідація даних для створення виробництва
     */
    static validateCreateProduction() {
        return [
            body('product_id')
                .notEmpty()
                .withMessage('ID товару є обов\'язковим')
                .isInt({ min: 1 })
                .withMessage('ID товару має бути додатним числом'),
            
            body('production_date')
                .notEmpty()
                .withMessage('Дата виробництва є обов\'язковою')
                .matches(/^\d{4}-\d{2}-\d{2}$/)
                .withMessage('Дата виробництва має бути у форматі YYYY-MM-DD')
                .custom((value) => {
                    const date = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    if (date > today) {
                        throw new Error('Дата виробництва не може бути в майбутньому');
                    }
                    
                    // Не дозволяємо дати старше 1 року
                    const oneYearAgo = new Date();
                    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                    
                    if (date < oneYearAgo) {
                        throw new Error('Дата виробництва не може бути старше 1 року');
                    }
                    
                    return true;
                }),
            
            body('total_quantity')
                .notEmpty()
                .withMessage('Загальна кількість є обов\'язковою')
                .isInt({ min: 1 })
                .withMessage('Загальна кількість має бути додатним числом')
                .custom((value) => {
                    if (value > 100000) {
                        throw new Error('Загальна кількість не може перевищувати 100,000 штук');
                    }
                    return true;
                }),
            
            body('expiry_date')
                .optional()
                .matches(/^\d{4}-\d{2}-\d{2}$/)
                .withMessage('Дата закінчення терміну придатності має бути у форматі YYYY-MM-DD')
                .custom((value, { req }) => {
                    if (value) {
                        const expiryDate = new Date(value);
                        const productionDate = new Date(req.body.production_date);
                        
                        if (expiryDate <= productionDate) {
                            throw new Error('Дата закінчення терміну придатності має бути пізніше дати виробництва');
                        }
                        
                        // Максимальний термін придатності - 5 років
                        const maxExpiryDate = new Date(productionDate);
                        maxExpiryDate.setFullYear(maxExpiryDate.getFullYear() + 5);
                        
                        if (expiryDate > maxExpiryDate) {
                            throw new Error('Термін придатності не може перевищувати 5 років');
                        }
                    }
                    return true;
                }),
            
            body('responsible')
                .optional()
                .isLength({ min: 2, max: 100 })
                .withMessage('Відповідальна особа має бути від 2 до 100 символів')
                .trim()
                .escape(),
            
            body('notes')
                .optional()
                .isLength({ max: 500 })
                .withMessage('Примітки не можуть перевищувати 500 символів')
                .trim()
                .escape(),
            
            body('production_time')
                .optional()
                .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
                .withMessage('Час виробництва має бути у форматі HH:MM або HH:MM:SS')
        ];
    }

    /**
     * Валідація ID товару для отримання виробництва
     */
    static validateProductId() {
        return [
            param('id')
                .notEmpty()
                .withMessage('ID товару є обов\'язковим')
                .isInt({ min: 1 })
                .withMessage('ID товару має бути додатним числом')
        ];
    }

    /**
     * Валідація параметрів для отримання списку виробництва
     */
    static validateGetProduction() {
        return [
            // Можемо додати query параметри для фільтрації
            // наприклад ?start_date=2024-01-01&end_date=2024-12-31
        ];
    }

    /**
     * Middleware для обробки результатів валідації
     */
    static handleValidationErrors(req, res, next) {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => ({
                field: error.path || error.param,
                message: error.msg,
                value: error.value
            }));
            
            return next(new AppError(
                'Помилки валідації даних виробництва',
                400,
                'VALIDATION_ERROR',
                { errors: errorMessages }
            ));
        }
        
        next();
    }

    /**
     * Нормалізація даних виробництва
     */
    static normalizeProductionData(req, res, next) {
        if (req.body) {
            // Конвертуємо числові поля
            if (req.body.product_id) {
                req.body.product_id = parseInt(req.body.product_id);
            }
            
            if (req.body.total_quantity) {
                req.body.total_quantity = parseInt(req.body.total_quantity);
            }
            
            // Тримаємо текстові поля
            if (req.body.responsible) {
                req.body.responsible = req.body.responsible.trim();
            }
            
            if (req.body.notes) {
                req.body.notes = req.body.notes.trim();
            }
            
            // Додаємо поточну дату/час якщо не вказано
            if (!req.body.production_time) {
                const now = new Date();
                req.body.production_time = now.toLocaleTimeString('uk-UA', { 
                    hour12: false, 
                    timeZone: 'Europe/Kyiv' 
                });
            }
        }
        
        next();
    }
}

module.exports = ProductionValidator; 