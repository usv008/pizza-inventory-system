const { ValidationError } = require('../middleware/errors/AppError');

/**
 * Допустимі статуси замовлень
 */
const ORDER_STATUSES = ['NEW', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

/**
 * Валідація нового замовлення
 */
function validateOrder(req, res, next) {
    const { client_name, order_date, items, client_id, client_contact, delivery_date, notes, created_by } = req.body;
    const errors = [];

    // Перевірка обов'язкових полів
    if (!client_name || typeof client_name !== 'string' || client_name.trim() === '') {
        errors.push('Назва клієнта обов\'язкова');
    }

    if (!order_date || typeof order_date !== 'string') {
        errors.push('Дата замовлення обов\'язкова');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        errors.push('Замовлення повинно містити хоча б один товар');
    }

    // Валідація дат
    if (order_date) {
        const orderDateObj = new Date(order_date);
        if (isNaN(orderDateObj.getTime())) {
            errors.push('Невірний формат дати замовлення');
        }
    }

    if (delivery_date) {
        const deliveryDateObj = new Date(delivery_date);
        if (isNaN(deliveryDateObj.getTime())) {
            errors.push('Невірний формат дати відвантаження');
        }

        // Дата відвантаження не може бути раніше дати замовлення
        if (order_date) {
            const orderDateObj = new Date(order_date);
            if (deliveryDateObj < orderDateObj) {
                errors.push('Дата відвантаження не може бути раніше дати замовлення');
            }
        }
    }

    // Валідація client_id (якщо вказаний)
    if (client_id !== undefined && client_id !== null) {
        const clientIdNum = parseInt(client_id);
        if (isNaN(clientIdNum) || clientIdNum <= 0) {
            errors.push('Client ID повинен бути позитивним числом');
        }
    }

    // Валідація довжини полів
    if (client_name && client_name.length > 255) {
        errors.push('Назва клієнта не може перевищувати 255 символів');
    }

    if (client_contact && client_contact.length > 1000) {
        errors.push('Контактна інформація не може перевищувати 1000 символів');
    }

    if (notes && notes.length > 1000) {
        errors.push('Примітки не можуть перевищувати 1000 символів');
    }

    if (created_by && created_by.length > 100) {
        errors.push('Ім\'я створювача не може перевищувати 100 символів');
    }

    // Валідація позицій замовлення
    if (items && Array.isArray(items)) {
        const itemErrors = validateOrderItems(items);
        errors.push(...itemErrors);
    }

    if (errors.length > 0) {
        return next(new ValidationError(`Помилки валідації замовлення: ${errors.join('; ')}`));
    }

    // Нормалізуємо дані
    req.body = {
        client_id: client_id ? parseInt(client_id) : null,
        client_name: client_name.trim(),
        client_contact: (client_contact || '').trim(),
        order_date: order_date,
        delivery_date: delivery_date || null,
        notes: (notes || '').trim(),
        created_by: (created_by || 'system').trim(),
        items: items.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseInt(item.quantity),
            notes: (item.notes || '').trim()
        }))
    };

    next();
}

/**
 * Валідація оновлення замовлення
 */
function validateOrderUpdate(req, res, next) {
    const { client_name, client_contact, delivery_date, notes, status, items } = req.body;
    const errors = [];

    // Перевірка обов'язкових полів для оновлення
    if (!client_name || typeof client_name !== 'string' || client_name.trim() === '') {
        errors.push('Назва клієнта обов\'язкова');
    }

    // Валідація статусу (якщо вказаний)
    if (status && !ORDER_STATUSES.includes(status)) {
        errors.push(`Невірний статус. Допустимі значення: ${ORDER_STATUSES.join(', ')}`);
    }

    // Валідація дати відвантаження
    if (delivery_date) {
        const deliveryDateObj = new Date(delivery_date);
        if (isNaN(deliveryDateObj.getTime())) {
            errors.push('Невірний формат дати відвантаження');
        }
    }

    // Валідація довжини полів
    if (client_name && client_name.length > 255) {
        errors.push('Назва клієнта не може перевищувати 255 символів');
    }

    if (client_contact && client_contact.length > 1000) {
        errors.push('Контактна інформація не може перевищувати 1000 символів');
    }

    if (notes && notes.length > 1000) {
        errors.push('Примітки не можуть перевищувати 1000 символів');
    }

    // Валідація позицій замовлення (якщо вказані)
    if (items) {
        if (!Array.isArray(items) || items.length === 0) {
            errors.push('Замовлення повинно містити хоча б один товар');
        } else {
            const itemErrors = validateOrderItems(items);
            errors.push(...itemErrors);
        }
    }

    if (errors.length > 0) {
        return next(new ValidationError(`Помилки валідації оновлення: ${errors.join('; ')}`));
    }

    // Нормалізуємо дані
    const normalizedData = {
        client_name: client_name.trim(),
        client_contact: (client_contact || '').trim(),
        delivery_date: delivery_date || null,
        notes: (notes || '').trim(),
        status: status || undefined
    };

    if (items) {
        normalizedData.items = items.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseInt(item.quantity),
            notes: (item.notes || '').trim()
        }));
    }

    req.body = normalizedData;
    next();
}

/**
 * Валідація статусу замовлення
 */
function validateOrderStatus(req, res, next) {
    const { status, updated_by } = req.body;
    const errors = [];

    // Перевірка обов'язкових полів
    if (!status || typeof status !== 'string') {
        errors.push('Статус обов\'язковий');
    }

    // Перевірка допустимих значень статусу
    if (status && !ORDER_STATUSES.includes(status)) {
        errors.push(`Невірний статус. Допустимі значення: ${ORDER_STATUSES.join(', ')}`);
    }

    // Валідація користувача
    if (updated_by && updated_by.length > 100) {
        errors.push('Ім\'я користувача не може перевищувати 100 символів');
    }

    if (errors.length > 0) {
        return next(new ValidationError(`Помилки валідації статусу: ${errors.join('; ')}`));
    }

    // Нормалізуємо дані
    req.body = {
        status: status.trim(),
        updated_by: (updated_by || 'system').trim()
    };

    next();
}

/**
 * Валідація ID замовлення
 */
function validateOrderId(req, res, next) {
    const { id } = req.params;
    
    if (!id) {
        return next(new ValidationError('ID замовлення обов\'язковий'));
    }

    const orderId = parseInt(id);
    if (isNaN(orderId) || orderId <= 0) {
        return next(new ValidationError('ID замовлення повинен бути позитивним числом'));
    }

    // Зберігаємо parsed ID в params
    req.params.id = orderId;
    next();
}

/**
 * Валідація позицій замовлення
 */
function validateOrderItems(items) {
    const errors = [];
    const productIds = new Set();

    if (!Array.isArray(items)) {
        return ['Позиції замовлення повинні бути масивом'];
    }

    if (items.length > 50) {
        errors.push('Замовлення не може містити більше 50 позицій');
    }

    items.forEach((item, index) => {
        const itemPrefix = `Позиція ${index + 1}`;

        // Перевірка product_id
        if (!item.product_id) {
            errors.push(`${itemPrefix}: ID товару обов'язковий`);
        } else {
            const productId = parseInt(item.product_id);
            if (isNaN(productId) || productId <= 0) {
                errors.push(`${itemPrefix}: ID товару повинен бути позитивним числом`);
            } else {
                // Перевірка на дублікати товарів в замовленні
                if (productIds.has(productId)) {
                    errors.push(`${itemPrefix}: Товар з ID ${productId} вже додано до замовлення`);
                }
                productIds.add(productId);
            }
        }

        // Перевірка quantity
        if (!item.quantity) {
            errors.push(`${itemPrefix}: Кількість обов'язкова`);
        } else {
            const quantity = parseInt(item.quantity);
            if (isNaN(quantity) || quantity <= 0) {
                errors.push(`${itemPrefix}: Кількість повинна бути позитивним числом`);
            } else if (quantity > 1000000) {
                errors.push(`${itemPrefix}: Кількість не може перевищувати 1,000,000`);
            }
        }

        // Перевірка notes
        if (item.notes && item.notes.length > 500) {
            errors.push(`${itemPrefix}: Примітки не можуть перевищувати 500 символів`);
        }
    });

    return errors;
}

/**
 * Валідація пошукових параметрів замовлень
 */
function validateOrderSearch(req, res, next) {
    const { status, client_id, date_from, date_to, limit, offset } = req.query;
    const errors = [];

    // Валідація статусу
    if (status && !ORDER_STATUSES.includes(status)) {
        errors.push(`Невірний статус для пошуку. Допустимі значення: ${ORDER_STATUSES.join(', ')}`);
    }

    // Валідація client_id
    if (client_id !== undefined) {
        const clientIdNum = parseInt(client_id);
        if (isNaN(clientIdNum) || clientIdNum <= 0) {
            errors.push('Client ID повинен бути позитивним числом');
        }
    }

    // Валідація дат
    if (date_from) {
        const dateFromObj = new Date(date_from);
        if (isNaN(dateFromObj.getTime())) {
            errors.push('Невірний формат дати початку пошуку');
        }
    }

    if (date_to) {
        const dateToObj = new Date(date_to);
        if (isNaN(dateToObj.getTime())) {
            errors.push('Невірний формат дати кінця пошуку');
        }
    }

    if (date_from && date_to) {
        const dateFromObj = new Date(date_from);
        const dateToObj = new Date(date_to);
        if (dateFromObj > dateToObj) {
            errors.push('Дата початку не може бути пізніше дати кінця');
        }
    }

    // Валідація limit та offset
    if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
            errors.push('Limit повинен бути числом від 1 до 1000');
        }
    }

    if (offset !== undefined) {
        const offsetNum = parseInt(offset);
        if (isNaN(offsetNum) || offsetNum < 0) {
            errors.push('Offset повинен бути невід\'ємним числом');
        }
    }

    if (errors.length > 0) {
        return next(new ValidationError(`Помилки валідації пошуку: ${errors.join('; ')}`));
    }

    next();
}

module.exports = {
    validateOrder,
    validateOrderUpdate,
    validateOrderStatus,
    validateOrderId,
    validateOrderItems,
    validateOrderSearch,
    ORDER_STATUSES
}; 