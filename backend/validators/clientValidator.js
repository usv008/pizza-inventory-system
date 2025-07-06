const { ValidationError } = require('../middleware/errors/AppError');

/**
 * Валідація даних клієнта
 */
function validateClient(req, res, next) {
    const { name, contact_person, phone, email, address, notes } = req.body;
    const errors = [];

    // Перевірка обов'язкових полів
    if (!name || typeof name !== 'string' || name.trim() === '') {
        errors.push('Назва клієнта обов\'язкова і повинна бути не порожньою');
    }

    // Перевірка довжини полів
    if (name && name.length > 255) {
        errors.push('Назва клієнта не може перевищувати 255 символів');
    }

    if (contact_person && contact_person.length > 255) {
        errors.push('Ім\'я контактної особи не може перевищувати 255 символів');
    }

    if (phone && phone.length > 50) {
        errors.push('Номер телефону не може перевищувати 50 символів');
    }

    if (email && email.length > 255) {
        errors.push('Email не може перевищувати 255 символів');
    }

    if (address && address.length > 500) {
        errors.push('Адреса не може перевищувати 500 символів');
    }

    if (notes && notes.length > 1000) {
        errors.push('Примітки не можуть перевищувати 1000 символів');
    }

    // Перевірка формату email (якщо вказаний)
    if (email && email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errors.push('Невірний формат email');
        }
    }

    // Перевірка формату телефону (базова - тільки цифри, пробіли, дефіси, плюс)
    if (phone && phone.trim() !== '') {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(phone)) {
            errors.push('Телефон може містити тільки цифри, пробіли, дефіси та дужки');
        }
    }

    if (errors.length > 0) {
        return next(new ValidationError(`Помилки валідації: ${errors.join('; ')}`));
    }

    // Очищуємо та нормалізуємо дані
    req.body = {
        name: name.trim(),
        contact_person: (contact_person || '').trim(),
        phone: (phone || '').trim(),
        email: (email || '').trim().toLowerCase(),
        address: (address || '').trim(),
        notes: (notes || '').trim()
    };

    next();
}

/**
 * Валідація ID клієнта
 */
function validateClientId(req, res, next) {
    const { id } = req.params;
    
    if (!id) {
        return next(new ValidationError('ID клієнта обов\'язковий'));
    }

    const clientId = parseInt(id);
    if (isNaN(clientId) || clientId <= 0) {
        return next(new ValidationError('ID клієнта повинен бути позитивним числом'));
    }

    // Зберігаємо parsed ID в params
    req.params.id = clientId;
    next();
}

/**
 * Валідація пошукових параметрів клієнтів
 */
function validateClientSearch(req, res, next) {
    const { name, phone, email, active, limit, offset } = req.query;
    const errors = [];

    // Валідація параметра active
    if (active !== undefined && active !== 'true' && active !== 'false' && active !== '1' && active !== '0') {
        errors.push('Параметр active повинен бути true, false, 1 або 0');
    }

    // Валідація limit
    if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
            errors.push('Limit повинен бути числом від 1 до 1000');
        }
    }

    // Валідація offset
    if (offset !== undefined) {
        const offsetNum = parseInt(offset);
        if (isNaN(offsetNum) || offsetNum < 0) {
            errors.push('Offset повинен бути невід\'ємним числом');
        }
    }

    // Валідація довжини пошукових строк
    if (name && name.length > 255) {
        errors.push('Пошукова назва не може перевищувати 255 символів');
    }

    if (phone && phone.length > 50) {
        errors.push('Пошуковий телефон не може перевищувати 50 символів');
    }

    if (email && email.length > 255) {
        errors.push('Пошуковий email не може перевищувати 255 символів');
    }

    if (errors.length > 0) {
        return next(new ValidationError(`Помилки валідації пошуку: ${errors.join('; ')}`));
    }

    next();
}

module.exports = {
    validateClient,
    validateClientId,
    validateClientSearch
}; 