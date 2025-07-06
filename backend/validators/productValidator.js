const { ValidationError } = require('../middleware/errors/AppError');

/**
 * Валідація даних товару
 * Витягнуто з app.js function validateProductData
 */
function validateProductData(data) {
    const errors = [];
    const validatedData = {};
    
    // Перевірка обов'язкових полів
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push({ field: 'name', message: 'Поле "name" обов\'язкове' });
    } else {
        validatedData.name = data.name.trim();
    }
    
    if (!data.code || typeof data.code !== 'string' || data.code.trim() === '') {
        errors.push({ field: 'code', message: 'Поле "code" обов\'язкове' });
    } else {
        validatedData.code = data.code.trim();
    }
    
    if (!data.weight || isNaN(Number(data.weight))) {
        errors.push({ field: 'weight', message: 'Поле "weight" обов\'язкове і має бути числом' });
    } else {
        validatedData.weight = Number(data.weight);
    }
    
    // Необов'язкові поля
    validatedData.barcode = data.barcode ? String(data.barcode).trim() : null;
    validatedData.pieces_per_box = data.pieces_per_box ? Number(data.pieces_per_box) : 1;
    
    // Початкові запаси завжди 0 - створюються тільки через виробництво з партіями
    validatedData.stock_pieces = 0;
    validatedData.stock_boxes = 0;
    
    validatedData.min_stock_pieces = data.min_stock_pieces ? Number(data.min_stock_pieces) : 0;
    
    return {
        isValid: errors.length === 0,
        errors,
        validatedData
    };
}

/**
 * Middleware валідатор що викидає ValidationError для Express error handler
 */
function validateProduct(req, res, next) {
    const validation = validateProductData(req.body);
    
    if (!validation.isValid) {
        return next(new ValidationError(validation.errors));
    }
    
    // Зберігаємо валідовані дані в req для подальшого використання
    req.validatedData = validation.validatedData;
    next();
}

/**
 * Валідація ID параметра
 */
function validateProductId(req, res, next) {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
        return next(new ValidationError([{ field: 'id', message: 'ID має бути додатним числом' }]));
    }
    
    req.productId = id;
    next();
}

module.exports = {
    validateProductData,
    validateProduct,
    validateProductId
}; 