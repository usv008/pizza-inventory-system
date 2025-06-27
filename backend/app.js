const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const orderDocxRouter = require('./routes/order-docx');
const { router: orderPdfRouter, initPdfRoutes } = require('./routes/order-pdf');
const batchRoutes = require('./routes/batch-routes');
const BatchController = require('./controllers/batch-controller');
const arrivalRoutes = require('./routes/arrival-routes');
const operationsLogRoutes = require('./routes/operations-log-routes');
const orderUpdateRoutes = require('./routes/order-update-routes');
const originalArrivalController = require('./controllers/arrival-controller');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Додати після app.use(express.json()); в app.js:
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        console.error('JSON Parse Error:', error.message);
        return res.status(400).json({ 
            error: 'Некоректний формат JSON в запиті' 
        });
    }
    next();
});
app.use(express.static('frontend'));
app.use(orderDocxRouter);
app.use('/api', orderPdfRouter);
app.use('/api', batchRoutes);
app.use('/api/arrivals', arrivalRoutes);
app.use('/api/operations', operationsLogRoutes);
//app.use('/api', orderUpdateRoutes);

// Пробуємо підключити базу даних
let productQueries, productionQueries, writeoffQueries, clientQueries, orderQueries, movementsQueries, initDatabase;

try {
    console.log('[DB LOG] Спроба завантажити ./database.js');
    const database = require('./database');
    console.log('[DB LOG] Модуль database.js завантажено успішно.');

    productQueries = database.productQueries;
    productionQueries = database.productionQueries || null;
    writeoffQueries = database.writeoffQueries || null;
    clientQueries = database.clientQueries || null;
    orderQueries = database.orderQueries || null;
    movementsQueries = database.movementsQueries || null;
    initDatabase = database.initDatabase;
    
    if (typeof initDatabase !== 'function') {
        console.error('[DB LOG] FATAL: initDatabase не є функцією!');
        throw new Error('Помилка ініціалізації БД: функція не знайдена.');
    }

    // Ініціалізуємо базу даних
    initDatabase().then(() => {
        console.log('🚀 База даних готова до роботи');
        initPdfRoutes({
            orderQueries,
            productQueries
        });
    }).catch(err => {
        console.error('❌ Помилка ініціалізації БД:', err);
        // Ініціалізуємо PDF роути з залежностями
   
    });
} catch (error) {
    console.error('--- FATAL ERROR ON DATABASE LOAD ---');
    console.error(error);
    // Фоллбек до старих даних
    productQueries = null;
    productionQueries = null;
    movementsQueries = null;
}

// ================================
// API РОУТИ ДЛЯ ТОВАРІВ
// ================================

// Головна сторінка API
app.get('/', (req, res) => {
    res.json({ 
        message: 'Pizza Inventory System API',
        version: '2.0.0',
        endpoints: {
            products: '/api/products',
            create: 'POST /api/products',
            update: 'PUT /api/products/:id',
            delete: 'DELETE /api/products/:id',
            updateStock: 'POST /api/products/:id/stock',
            production: '/api/production',
            addProduction: 'POST /api/production',
            writeoffs: '/api/writeoffs',
            addWriteoff: 'POST /api/writeoffs',
            movements: '/api/movements',
            clients: '/api/clients',
            createClient: 'POST /api/clients',
            orders: '/api/orders',
            createOrder: 'POST /api/orders',
            orderById: '/api/orders/:id'
        },
        timestamp: new Date().toISOString()
    });
});

// Отримати всі товари (для сумісності зі старим frontend)
app.get('/api/pizzas', async (req, res) => {
    try {
        if (!productQueries) {
            // Fallback дані
            const pizzas = [
                { id: 1, name: 'Маргарита', stock: 15 },
                { id: 2, name: 'Пепероні', stock: 8 },
                { id: 3, name: 'Гавайська', stock: 12 }
            ];
            return res.json(pizzas);
        }
        
        const products = await productQueries.getAll();
        // Перетворюємо в старий формат для сумісності
        const pizzas = products.map(p => ({
            id: p.id,
            name: p.name,
            stock: p.stock_pieces
        }));
        res.json(pizzas);
    } catch (error) {
        console.error('Помилка отримання товарів:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Отримати всі товари (новий формат)
app.get('/api/products', async (req, res) => {
    try {
        if (!productQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const products = await productQueries.getAll();
        res.json(products);
    } catch (error) {
        console.error('Помилка отримання товарів:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Отримати товар за ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await productQueries.getById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Товар не знайдено' });
        }
        res.json(product);
    } catch (error) {
        console.error('Помилка отримання товару:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Створити новий товар
app.post('/api/products', async (req, res) => {
    try {
        const validation = validateProductData(req.body);
        
        if (!validation.isValid) {
            return res.status(400).json({ 
                error: 'Помилки валідації', 
                details: validation.errors 
            });
        }

        const result = await productQueries.create(validation.validatedData);
        
        // Логуємо створення товару
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            const newProduct = await productQueries.getById(result.id);
            
            await OperationsLogController.logProductOperation(
                OperationsLogController.OPERATION_TYPES.CREATE_PRODUCT,
                newProduct,
                'Адміністратор системи',
                null,
                req
            );
        } catch (logError) {
            console.error('Помилка логування створення товару:', logError);
        }
        
        res.status(201).json({ 
            message: 'Товар створено успішно', 
            id: result.id 
        });
    } catch (error) {
        console.error('Product creation error:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Оновити товар
app.put('/api/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
            return res.status(400).json({ error: 'Некоректний ID товару' });
        }
        
        const validation = validateProductData(req.body);
        
        if (!validation.isValid) {
            return res.status(400).json({ 
                error: 'Помилки валідації', 
                details: validation.errors 
            });
        }

        // Отримуємо старий товар для логування
        const oldProduct = await productQueries.getById(productId);
        if (!oldProduct) {
            return res.status(404).json({ error: 'Товар не знайдено' });
        }

        const result = await productQueries.update(productId, validation.validatedData);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Товар не знайдено' });
        }
        
        // Логуємо оновлення товару
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            const newProduct = await productQueries.getById(productId);
            
            await OperationsLogController.logProductOperation(
                OperationsLogController.OPERATION_TYPES.UPDATE_PRODUCT,
                newProduct,
                'Адміністратор системи',
                oldProduct,
                req
            );
        } catch (logError) {
            console.error('Помилка логування оновлення товару:', logError);
        }
        
        res.json({ message: 'Товар оновлено успішно' });
    } catch (error) {
        console.error('Product update error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({ error: 'Товар з таким кодом або штрихкодом вже існує' });
        } else {
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
});

// Видалити товар
app.delete('/api/products/:id', async (req, res) => {
    try {
        // Спочатку отримуємо інформацію про товар для логування
        const productToDelete = await productQueries.getById(req.params.id);
        if (!productToDelete) {
            return res.status(404).json({ error: 'Товар не знайдено' });
        }
        
        const result = await productQueries.delete(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Товар не знайдено' });
        }
        
        // Логуємо видалення товару
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            
            await OperationsLogController.logProductOperation(
                OperationsLogController.OPERATION_TYPES.DELETE_PRODUCT,
                productToDelete, // Передаємо старі дані як нові для збереження інформації
                'Адміністратор системи',
                productToDelete, // Старі дані
                req
            );
        } catch (logError) {
            console.error('Помилка логування видалення товару:', logError);
        }
        
        res.json({ message: 'Товар видалено успішно' });
    } catch (error) {
        console.error('Помилка видалення товару:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Оновити залишки товару
app.post('/api/products/:id/stock', async (req, res) => {
    try {
        const { pieces, boxes, reason, movement_type } = req.body;
        
        if (pieces === undefined || boxes === undefined) {
            return res.status(400).json({ 
                error: 'Обов\'язкові поля: pieces, boxes' 
            });
        }

        await productQueries.updateStock(
            req.params.id, 
            parseInt(pieces), 
            parseInt(boxes), 
            reason || 'Корегування залишків',
            movement_type || 'ADJUSTMENT'
        );
        
        res.json({ message: 'Залишки оновлено успішно' });
    } catch (error) {
        console.error('Помилка оновлення залишків:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ================================
// API РОУТИ ДЛЯ ВИРОБНИЦТВА
// ================================

// Отримати всі записи виробництва
app.get('/api/production', async (req, res) => {
    try {
        if (!productionQueries) {
            return res.json([]); // Порожній масив якщо база недоступна
        }
        
        const production = await productionQueries.getAll();
        res.json(production);
    } catch (error) {
        console.error('Помилка отримання виробництва:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Додати запис виробництва
app.post('/api/production', async (req, res) => {
    try {
        if (!productionQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const { product_id, production_date, total_quantity, responsible, notes } = req.body;
        
        // Валідація (залишається без змін)
        if (!product_id || !production_date || !total_quantity) {
            return res.status(400).json({ 
                error: 'Обов\'язкові поля: product_id, production_date, total_quantity' 
            });
        }

        const productIdNum = parseInt(product_id);
        if (isNaN(productIdNum) || productIdNum <= 0) {
            return res.status(400).json({ 
                error: 'product_id має бути додатним числом' 
            });
        }

        const totalQuantityNum = parseInt(total_quantity);
        if (isNaN(totalQuantityNum) || totalQuantityNum <= 0) {
            return res.status(400).json({ 
                error: 'total_quantity має бути додатним числом' 
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(production_date)) {
            return res.status(400).json({ 
                error: 'Некоректний формат дати (YYYY-MM-DD)' 
            });
        }

        const productionData = {
            product_id: productIdNum,
            production_date,
            total_quantity: totalQuantityNum,
            responsible: responsible || 'system',
            notes: notes || ''
        };

        // НОВИЙ КОД З СТВОРЕННЯМ ПАРТІЙ:
        const result = await productionQueries.create(productionData);
        
        // Логуємо виробництво
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            const product = await productQueries.getById(productIdNum);
            
            await OperationsLogController.logOperation({
                operation_type: OperationsLogController.OPERATION_TYPES.PRODUCTION,
                operation_id: result.id,
                entity_type: 'production',
                entity_id: result.id,
                new_data: {
                    product_name: product.name,
                    product_code: product.code,
                    quantity: totalQuantityNum,
                    batch_date: production_date,
                    responsible: responsible || 'system'
                },
                description: `Виробництво: ${product.name} - ${totalQuantityNum} шт (партія ${production_date})`,
                user_name: responsible || 'system',
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
        } catch (logError) {
            console.error('Помилка логування виробництва:', logError);
        }
        
        res.status(201).json({ 
            message: 'Запис виробництва створено успішно з партією', 
            id: result.id,
            boxes_quantity: result.boxes_quantity,
            pieces_quantity: result.pieces_quantity,
            batch_date: result.batch_date
        });
        
    } catch (error) {
        console.error('Production creation error:', error);
        res.status(500).json({ 
            error: 'Помилка сервера при створенні виробництва',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Отримати виробництво за продуктом
app.get('/api/production/product/:id', async (req, res) => {
    try {
        const production = await productionQueries.getByProductId(req.params.id);
        res.json(production);
    } catch (error) {
        console.error('Помилка отримання виробництва:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ================================
// API РОУТИ ДЛЯ СПИСАННЯ
// ================================

// Отримати всі записи списання
app.get('/api/writeoffs', async (req, res) => {
    try {
        if (!writeoffQueries) {
            return res.json([]); // Порожній масив якщо база недоступна
        }
        
        const writeoffs = await writeoffQueries.getAll();
        res.json(writeoffs);
    } catch (error) {
        console.error('Помилка отримання списання:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Додати запис списання
app.post('/api/writeoffs', async (req, res) => {
    try {
        if (!writeoffQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const { product_id, writeoff_date, total_quantity, reason, responsible, notes } = req.body;
        
        // Валідація (залишається без змін)
        if (!product_id || !writeoff_date || !total_quantity || !reason || !responsible) {
            return res.status(400).json({ 
                error: 'Обов\'язкові поля: product_id, writeoff_date, total_quantity, reason, responsible' 
            });
        }

        const writeoffData = {
            product_id: parseInt(product_id),
            writeoff_date,
            total_quantity: parseInt(total_quantity),
            reason,
            responsible,
            notes: notes || ''
        };

        const result = await writeoffQueries.create(writeoffData);
        
        // Логуємо списання
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            const product = await productQueries.getById(parseInt(product_id));
            
            await OperationsLogController.logOperation({
                operation_type: OperationsLogController.OPERATION_TYPES.WRITEOFF,
                operation_id: result.id,
                entity_type: 'writeoff',
                entity_id: result.id,
                new_data: {
                    product_name: product.name,
                    product_code: product.code,
                    quantity: parseInt(total_quantity),
                    reason: reason,
                    responsible: responsible
                },
                description: `Списання: ${product.name} - ${total_quantity} шт (${reason})`,
                user_name: responsible,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
        } catch (logError) {
            console.error('Помилка логування списання:', logError);
        }
        
        res.status(201).json({ 
            message: 'Запис списання створено успішно', 
            id: result.id 
        });
    } catch (error) {
        console.error('Помилка створення запису списання:', error);
        res.status(400).json({ error: error.message });
    }
});

// Отримати списання за продуктом
app.get('/api/writeoffs/product/:id', async (req, res) => {
    try {
        if (!writeoffQueries) {
            return res.json([]);
        }
        
        const writeoffs = await writeoffQueries.getByProductId(req.params.id);
        res.json(writeoffs);
    } catch (error) {
        console.error('Помилка отримання списання:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ================================
// API РОУТИ ДЛЯ ІСТОРІЇ РУХІВ
// ================================

// Отримати історію рухів товарів
app.get('/api/movements', async (req, res) => {
    console.log('--- Запит до /api/movements отримано ---');
    try {
        if (!movementsQueries) {
            console.error('FATAL: movementsQueries не ініціалізовано!');
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        // Збираємо фільтри з query params
        const filters = {
            product_id: req.query.product_id,
            movement_type: req.query.movement_type,
            date_from: req.query.date_from,
            date_to: req.query.date_to
        };
        // Видаляємо порожні фільтри
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });
        console.log('Виклик movementsQueries.getAll() з фільтрами:', filters);
        const movements = await movementsQueries.getAll(filters);
        console.log('Дані про рух успішно отримано.');
        res.json(movements);
    } catch (error) {
        console.error('--- ПОМИЛКА в /api/movements ---');
        console.error(error); // Виводимо повний об'єкт помилки
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ================================
// API РОУТИ ДЛЯ КЛІЄНТІВ
// ================================

// Отримати всіх клієнтів
app.get('/api/clients', async (req, res) => {
    try {
        if (!clientQueries) {
            return res.json([]);
        }
        
        const clients = await clientQueries.getAll();
        res.json(clients);
    } catch (error) {
        console.error('Помилка отримання клієнтів:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Отримати клієнта за ID
app.get('/api/clients/:id', async (req, res) => {
    try {
        if (!clientQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const client = await clientQueries.getById(req.params.id);
        if (!client) {
            return res.status(404).json({ error: 'Клієнта не знайдено' });
        }
        
        res.json(client);
    } catch (error) {
        console.error('Помилка отримання клієнта:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Створити клієнта
app.post('/api/clients', async (req, res) => {
    try {
        if (!clientQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const { name, contact_person, phone, email, address, notes } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Назва клієнта обов\'язкова' });
        }

        const clientData = {
            name,
            contact_person: contact_person || '',
            phone: phone || '',
            email: email || '',
            address: address || '',
            notes: notes || ''
        };

        const result = await clientQueries.create(clientData);
        
        // Логуємо створення клієнта
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            
            await OperationsLogController.logOperation({
                operation_type: OperationsLogController.OPERATION_TYPES.CREATE_CLIENT,
                operation_id: result.id,
                entity_type: 'client',
                entity_id: result.id,
                new_data: clientData,
                description: `Створено клієнта "${name}"`,
                user_name: 'Комерційний директор',
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });
        } catch (logError) {
            console.error('Помилка логування створення клієнта:', logError);
        }
        
        res.status(201).json({ 
            message: 'Клієнта створено успішно', 
            id: result.id 
        });
    } catch (error) {
        console.error('Помилка створення клієнта:', error);
        res.status(400).json({ error: error.message });
    }
});

// Оновити клієнта
app.put('/api/clients/:id', async (req, res) => {
    try {
        if (!clientQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const { name, contact_person, phone, email, address, notes } = req.body;
        
        const clientData = {
            name,
            contact_person: contact_person || '',
            phone: phone || '',
            email: email || '',
            address: address || '',
            notes: notes || ''
        };

        const result = await clientQueries.update(req.params.id, clientData);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Клієнта не знайдено' });
        }
        
        res.json({ message: 'Клієнта оновлено успішно' });
    } catch (error) {
        console.error('Помилка оновлення клієнта:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Деактивувати клієнта
app.delete('/api/clients/:id', async (req, res) => {
    try {
        if (!clientQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const result = await clientQueries.deactivate(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Клієнта не знайдено' });
        }
        
        res.json({ message: 'Клієнта деактивовано успішно' });
    } catch (error) {
        console.error('Помилка деактивації клієнта:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ================================
// API РОУТИ ДЛЯ ЗАМОВЛЕНЬ
// ================================


// ПОВНІСТЮ замінити PUT роут в app.js - СПРОЩЕНА ВЕРСІЯ
app.put('/api/orders/:id', (req, res) => {
    console.log('🚀🚀🚀 ПРОСТИЙ PUT РОУТ ВИКЛИКАНО 🚀🚀🚀');
    console.log('Order ID:', req.params.id, typeof req.params.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { client_name, client_contact, delivery_date, notes, status, items } = req.body;
    const orderId = parseInt(req.params.id);
    
    // Валідація
    if (!client_name) {
        return res.status(400).json({ error: 'client_name обов\'язкове' });
    }
    
    const { db } = require('./database');
    
    // Спочатку перевіримо поточні дані
    db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, beforeUpdate) => {
        if (err) {
            console.error('Error checking current order:', err);
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        
        console.log('Current order in DB BEFORE update:', beforeUpdate);
        
        if (!beforeUpdate) {
            console.log('Order not found in database');
            return res.status(404).json({ error: 'Замовлення не знайдено в базі' });
        }
        
        // Оновлюємо основну інформацію
        const sql = `UPDATE orders 
                   SET client_name = ?, 
                       client_contact = ?, 
                       delivery_date = ?, 
                       notes = ?, 
                       status = ?, 
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
        
        const params = [
            client_name, 
            client_contact || '', 
            delivery_date || null, 
            notes || '', 
            status || beforeUpdate.status, 
            orderId
        ];
        
        console.log('SQL query:', sql);
        console.log('SQL params:', params);
        
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Database update error:', err);
                return res.status(500).json({ error: 'Помилка оновлення основної інформації: ' + err.message });
            }
            
            console.log('Main info UPDATE result - changes:', this.changes, 'lastID:', this.lastID);
            
            // Якщо є позиції для оновлення
            if (items && Array.isArray(items) && items.length > 0) {
                console.log('Updating items:', items.length);
                
                // Спочатку видаляємо старі позиції
                db.run('DELETE FROM order_items WHERE order_id = ?', [orderId], function(deleteErr) {
                    if (deleteErr) {
                        console.error('Error deleting old items:', deleteErr);
                        return res.status(500).json({ error: 'Помилка видалення старих позицій: ' + deleteErr.message });
                    }
                    
                    console.log('Deleted old items, changes:', this.changes);
                    
                    // Тепер додаємо нові позиції
                    let itemsProcessed = 0;
                    let itemsToAdd = 0;
                    let hasErrors = false;
                    let totalQuantity = 0;
                    let totalBoxes = 0;
                    
                    // Підраховуємо скільки позицій потрібно додати
                    items.forEach(item => {
                        if (item.product_id && item.quantity && item.quantity > 0) {
                            itemsToAdd++;
                        }
                    });
                    
                    if (itemsToAdd === 0) {
                        return res.json({ 
                            message: 'Замовлення оновлено успішно (тільки основна інформація)',
                            orderId: orderId,
                            itemsUpdated: 0
                        });
                    }
                    
                    // Додаємо кожну позицію
                    items.forEach((item, index) => {
                        const { product_id, quantity, notes: itemNotes } = item;
                        
                        if (!product_id || !quantity || quantity <= 0) {
                            console.log(`Skipping item ${index} - invalid data:`, item);
                            return;
                        }
                        
                        // Спочатку отримуємо інформацію про товар
                        db.get('SELECT pieces_per_box FROM products WHERE id = ?', [product_id], (productErr, product) => {
                            if (productErr) {
                                console.error(`Error getting product ${product_id}:`, productErr);
                                hasErrors = true;
                                return;
                            }
                            
                            if (!product) {
                                console.error(`Product not found: ${product_id}`);
                                hasErrors = true;
                                return;
                            }
                            
                            const quantityNum = parseInt(quantity);
                            const boxes = Math.floor(quantityNum / product.pieces_per_box);
                            const pieces = quantityNum % product.pieces_per_box;
                            
                            totalQuantity += quantityNum;
                            totalBoxes += boxes;
                            
                            // Додаємо позицію
                            const insertSql = `INSERT INTO order_items 
                                             (order_id, product_id, quantity, boxes, pieces, notes, created_at) 
                                             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
                            
                            db.run(insertSql, [orderId, product_id, quantityNum, boxes, pieces, itemNotes || ''], function(insertErr) {
                                if (insertErr) {
                                    console.error(`Error inserting item ${index}:`, insertErr);
                                    hasErrors = true;
                                    return;
                                }
                                
                                console.log(`Item ${index} inserted with ID:`, this.lastID);
                                itemsProcessed++;
                                
                                // Коли всі позиції оброблені
                                if (itemsProcessed === itemsToAdd) {
                                    if (hasErrors) {
                                        return res.status(500).json({ error: 'Деякі позиції не вдалося додати' });
                                    }
                                    
                                    // Оновлюємо загальні кількості
                                    db.run('UPDATE orders SET total_quantity = ?, total_boxes = ? WHERE id = ?', 
                                          [totalQuantity, totalBoxes, orderId], function(updateTotalErr) {
                                        if (updateTotalErr) {
                                            console.error('Error updating totals:', updateTotalErr);
                                            // Не блокуємо відповідь через це
                                        }
                                        
                                        console.log('✅ Order updated successfully');
                                        res.json({ 
                                            message: 'Замовлення оновлено успішно',
                                            orderId: orderId,
                                            itemsUpdated: itemsProcessed,
                                            totalQuantity: totalQuantity,
                                            totalBoxes: totalBoxes
                                        });
                                    });
                                }
                            });
                        });
                    });
                });
            } else {
                // Тільки основна інформація оновлена
                console.log('✅ Order main info updated successfully');
                res.json({ 
                    message: 'Замовлення оновлено успішно',
                    orderId: orderId,
                    itemsUpdated: 0
                });
            }
        });
    });
});
// Отримати всі замовлення
app.get('/api/orders', async (req, res) => {
    console.log('--- Запит до /api/orders отримано ---');
    try {
        if (!orderQueries) {
            console.log('orderQueries не ініціалізовано, повертаю []');
            return res.json([]);
        }
        const orders = await orderQueries.getAll();
        console.log('Результат orderQueries.getAll:', orders);
        res.json(orders);
    } catch (error) {
        console.error('--- ПОМИЛКА в /api/orders ---');
        console.error(error);
        res.status(500).json({ error: 'Помилка сервера', details: error.message });
    }
});
// Отримати замовлення за ID
app.get('/api/orders/:id', async (req, res) => {
    try {
        if (!orderQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const order = await orderQueries.getById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }
        
        res.json(order);
    } catch (error) {
        console.error('Помилка отримання замовлення:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});
// Створити замовлення
app.post('/api/orders', async (req, res) => {
    try {
        if (!orderQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const { client_id, client_name, client_contact, order_date, delivery_date, notes, created_by, items } = req.body;
        
        // Валідація
        if (!client_name || !order_date || !items || items.length === 0) {
            return res.status(400).json({ 
                error: 'Обов\'язкові поля: client_name, order_date, items' 
            });
        }

        const orderData = {
            client_id: client_id || null,
            client_name,
            client_contact: client_contact || '',
            order_date,
            delivery_date: delivery_date || null,
            notes: notes || '',
            created_by: created_by || 'system',
            items: items.map(item => ({
                product_id: parseInt(item.product_id),
                quantity: parseInt(item.quantity),
                notes: item.notes || ''
            }))
        };

        const result = await orderQueries.create(orderData);
        
        // Логуємо створення замовлення
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            const newOrder = await orderQueries.getById(result.id);
            
            await OperationsLogController.logOrderOperation(
                OperationsLogController.OPERATION_TYPES.CREATE_ORDER,
                newOrder,
                created_by || 'system',
                null,
                req
            );
        } catch (logError) {
            console.error('Помилка логування створення замовлення:', logError);
            // Не блокуємо створення замовлення через помилку логування
        }
        
        res.status(201).json({ 
            message: 'Замовлення створено успішно', 
            id: result.id,
            order_number: result.order_number
        });
    } catch (error) {
        console.error('Помилка створення замовлення:', error);
        res.status(400).json({ error: error.message });
    }
});
// Оновити статус замовлення
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        if (!orderQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const { status, updated_by } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: 'Поле status обов\'язкове' });
        }

        // Отримуємо старе замовлення для логування
        const oldOrder = await orderQueries.getById(req.params.id);
        if (!oldOrder) {
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }

        const result = await orderQueries.updateStatus(req.params.id, status, updated_by);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }
        
        // Логуємо зміну статусу
        try {
            const OperationsLogController = require('./controllers/operations-log-controller');
            const newOrder = await orderQueries.getById(req.params.id);
            
            await OperationsLogController.logOrderOperation(
                OperationsLogController.OPERATION_TYPES.UPDATE_ORDER_STATUS,
                newOrder,
                updated_by || 'system',
                oldOrder,
                req
            );
        } catch (logError) {
            console.error('Помилка логування зміни статусу:', logError);
            // Не блокуємо операцію через помилку логування
        }
        
        res.json({ message: 'Статус замовлення оновлено успішно' });
    } catch (error) {
        console.error('Помилка оновлення статусу:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});
// Статистика
app.get('/api/stats', async (req, res) => {
    try {
        const products = await productQueries.getAll();
        
        const stats = {
            total_products: products.length,
            total_stock_pieces: products.reduce((sum, p) => sum + p.stock_pieces, 0),
            total_stock_boxes: products.reduce((sum, p) => sum + p.stock_boxes, 0),
            low_stock_count: products.filter(p => p.stock_status === 'low').length,
            warning_stock_count: products.filter(p => p.stock_status === 'warning').length,
            products_by_status: {
                good: products.filter(p => p.stock_status === 'good').length,
                warning: products.filter(p => p.stock_status === 'warning').length,
                low: products.filter(p => p.stock_status === 'low').length
            }
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Помилка отримання статистики:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/orders/:id/edit', async (req, res) => {
    console.log('=== GET /api/orders/:id/edit ===');
    console.log('Order ID:', req.params.id);
    
    try {
        const { orderQueries, productQueries } = require('./database');
        
        if (!orderQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        // Отримуємо замовлення
        const order = await orderQueries.getById(req.params.id);
        if (!order) {
            console.log('Замовлення не знайдено');
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }
        
        // Отримуємо всі товари для селекту
        const products = await productQueries.getAll();
        
        console.log('Відправляємо дані замовлення та', products.length, 'товарів');
        
        res.json({
            order: order,
            products: products
        });
        
    } catch (error) {
        console.error('Помилка отримання замовлення для редагування:', error);
        res.status(500).json({ error: 'Помилка сервера: ' + error.message });
    }
});
// Додати тестовий роут
app.all('/api/orders/:id', (req, res, next) => {
    console.log(`!!! Intercepted ${req.method} request to /api/orders/${req.params.id} !!!`);
    next();
});
// ================================
// API РОУТИ ДЛЯ ПЛАНУВАННЯ ВИРОБНИЦТВА
// ================================

// Аналіз потреб для планування
app.get('/api/production-analysis', async (req, res) => {
    try {
        // Отримуємо активні замовлення
        const activeOrders = await new Promise((resolve, reject) => {
            const { db } = require('./database');
            db.all(`
                SELECT o.*, COUNT(oi.id) as items_count
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.status IN ('NEW', 'CONFIRMED', 'IN_PRODUCTION')
                GROUP BY o.id
                ORDER BY o.delivery_date ASC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Отримуємо товари з низькими залишками
        const lowStockProducts = await productQueries.getAll();
        const criticalItems = lowStockProducts.filter(p => p.stock_status === 'low' || p.stock_status === 'warning');

        // Розрахунок потреб
        const totalOrderQuantity = activeOrders.reduce((sum, order) => sum + (order.total_quantity || 0), 0);
        
        res.json({
            active_orders: activeOrders.length,
            critical_items: criticalItems.length,
            total_order_quantity: totalOrderQuantity,
            orders: activeOrders,
            critical_products: criticalItems
        });
    } catch (error) {
        console.error('Помилка аналізу виробництва:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Отримати план виробництва на дату
app.get('/api/production-plans/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { db } = require('./database');
        
        // Отримуємо план на дату
        db.get(`SELECT * FROM production_plans WHERE plan_date = ?`, [date], (err, plan) => {
            if (err) {
                res.status(500).json({ error: 'Помилка сервера' });
                return;
            }
            
            if (!plan) {
                res.json({ plan: null, items: [] });
                return;
            }
            
            // Отримуємо позиції плану
            db.all(`
                SELECT ppi.*, p.name as product_name, p.code as product_code
                FROM production_plan_items ppi
                JOIN products p ON ppi.product_id = p.id
                WHERE ppi.plan_id = ?
                ORDER BY ppi.priority DESC, ppi.id
            `, [plan.id], (err, items) => {
                if (err) {
                    res.status(500).json({ error: 'Помилка сервера' });
                } else {
                    res.json({ plan, items });
                }
            });
        });
    } catch (error) {
        console.error('Помилка отримання плану:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Створити або оновити план виробництва
app.post('/api/production-plans', async (req, res) => {
    try {
        const { plan_date, items, notes } = req.body;
        const { db } = require('./database');
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Створюємо або оновлюємо план
            db.run(`
                INSERT OR REPLACE INTO production_plans 
                (plan_date, total_planned, notes, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `, [plan_date, items.reduce((sum, item) => sum + item.quantity_planned, 0), notes], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: 'Помилка створення плану' });
                    return;
                }
                
                const planId = this.lastID;
                
                // Видаляємо старі позиції плану
                db.run(`DELETE FROM production_plan_items WHERE plan_id = ?`, [planId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        res.status(500).json({ error: 'Помилка оновлення плану' });
                        return;
                    }
                    
                    // Додаємо нові позиції
                    let itemsProcessed = 0;
                    items.forEach(item => {
                        db.run(`
                            INSERT INTO production_plan_items 
                            (plan_id, product_id, quantity_needed, quantity_planned, priority, reason, order_id, notes)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [planId, item.product_id, item.quantity_needed, item.quantity_planned, 
                            item.priority, item.reason, item.order_id, item.notes], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                res.status(500).json({ error: 'Помилка додавання позицій' });
                                return;
                            }
                            
                            itemsProcessed++;
                            if (itemsProcessed === items.length) {
                                db.run('COMMIT');
                                res.json({ 
                                    message: 'План виробництва створено успішно',
                                    plan_id: planId 
                                });
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Помилка створення плану:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Автоматичне планування
app.post('/api/auto-planning', async (req, res) => {
    try {
        const { period, priority, max_capacity, include_forecast } = req.body;
        
        // Тут буде складний алгоритм автопланування
        // Поки що повертаємо тестовий результат
        res.json({
            success: true,
            days_planned: period,
            total_items: 15,
            total_quantity: 1250,
            efficiency: 87,
            message: 'Автоматичний план створено успішно!'
        });
    } catch (error) {
        console.error('Помилка автопланування:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Налаштування виробництва
app.get('/api/production-settings', async (req, res) => {
    try {
        const { db } = require('./database');
        db.get(`SELECT * FROM production_settings WHERE id = 1`, (err, settings) => {
            if (err) {
                res.status(500).json({ error: 'Помилка сервера' });
            } else {
                res.json(settings || {
                    daily_capacity: 500,
                    working_hours: 8,
                    min_batch_size: 10,
                    cost_per_unit: 0
                });
            }
        });
    } catch (error) {
        console.error('Помилка отримання налаштувань:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ================================
// РОЗУМНИЙ АЛГОРИТМ АВТОПЛАНУВАННЯ
// ================================

// Додати в app.js після існуючих ендпоінтів планування

// Розширений аналіз потреб
app.get('/api/production-demand', async (req, res) => {
    try {
        const { period = 7 } = req.query;
        const { db } = require('./database');
        
        // Збираємо всі дані паралельно
        const [orders, products, settings] = await Promise.all([
            // Активні замовлення з деталями
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT o.*, oi.product_id, oi.quantity, oi.boxes, oi.pieces,
                           p.name as product_name, p.pieces_per_box, p.stock_pieces, p.min_stock_pieces
                    FROM orders o
                    JOIN order_items oi ON o.id = oi.order_id
                    JOIN products p ON oi.product_id = p.id
                    WHERE o.status IN ('NEW', 'CONFIRMED', 'IN_PRODUCTION')
                    ORDER BY o.delivery_date ASC, o.order_date ASC
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }),
            
            // Всі товари з аналізом запасів
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT p.*,
                    CASE 
                        WHEN stock_pieces < min_stock_pieces THEN 'critical'
                        WHEN stock_pieces < min_stock_pieces * 1.5 THEN 'low'
                        WHEN stock_pieces < min_stock_pieces * 2 THEN 'warning'
                        ELSE 'good'
                    END as stock_urgency,
                    (min_stock_pieces * 2 - stock_pieces) as shortage_quantity
                    FROM products p
                    ORDER BY stock_pieces ASC
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }),
            
            // Налаштування виробництва
            new Promise((resolve, reject) => {
                db.get(`SELECT * FROM production_settings WHERE id = 1`, (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { daily_capacity: 500, working_hours: 8, min_batch_size: 10 });
                });
            })
        ]);
        
        // Аналізуємо попит
        const demandAnalysis = analyzeDemand(orders, products, settings, period);
        
        res.json(demandAnalysis);
    } catch (error) {
        console.error('Помилка аналізу попиту:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Головний ендпоінт автопланування
app.post('/api/auto-planning-advanced', async (req, res) => {
    try {
        const { 
            period = 7, 
            priority = 'balanced', 
            max_capacity = 85, 
            include_forecast = false,
            min_batch_size = 10 
        } = req.body;
        
        // Отримуємо аналіз попиту
        const demandResponse = await fetch(`http://localhost:3000/api/production-demand?period=${period}`);
        const demandData = await demandResponse.json();
        
        // Генеруємо оптимальний план
        const optimizedPlan = await generateOptimizedPlan(demandData, {
            period,
            priority,
            max_capacity,
            include_forecast,
            min_batch_size
        });
        
        res.json(optimizedPlan);
    } catch (error) {
        console.error('Помилка автопланування:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Застосування автоплану
app.post('/api/apply-auto-plan', async (req, res) => {
    try {
        const { plan_items, start_date, created_by = 'system' } = req.body;
        const { db } = require('./database');
        
        if (!plan_items || plan_items.length === 0) {
            return res.status(400).json({ error: 'Немає елементів для планування' });
        }
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            let plansCreated = 0;
            const plansByDate = groupBy(plan_items, 'plan_date');
            
            Object.keys(plansByDate).forEach(date => {
                const dayItems = plansByDate[date];
                const totalPlanned = dayItems.reduce((sum, item) => sum + item.quantity_planned, 0);
                
                // Створюємо план на день
                db.run(`
                    INSERT OR REPLACE INTO production_plans 
                    (plan_date, total_planned, status, created_by, notes, updated_at)
                    VALUES (?, ?, 'DRAFT', ?, 'Автоматично згенерований план', CURRENT_TIMESTAMP)
                `, [date, totalPlanned, created_by], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Помилка створення плану' });
                    }
                    
                    const planId = this.lastID;
                    
                    // Видаляємо старі позиції для цієї дати
                    db.run(`DELETE FROM production_plan_items WHERE plan_id = ?`, [planId], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Помилка очищення плану' });
                        }
                        
                        // Додаємо нові позиції
                        let itemsProcessed = 0;
                        dayItems.forEach(item => {
                            db.run(`
                                INSERT INTO production_plan_items 
                                (plan_id, product_id, quantity_needed, quantity_planned, priority, reason, order_id, notes)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                planId, 
                                item.product_id, 
                                item.quantity_needed, 
                                item.quantity_planned,
                                item.priority,
                                item.reason,
                                item.order_id || null,
                                item.notes || ''
                            ], (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Помилка додавання позицій' });
                                }
                                
                                itemsProcessed++;
                                if (itemsProcessed === dayItems.length) {
                                    plansCreated++;
                                    if (plansCreated === Object.keys(plansByDate).length) {
                                        db.run('COMMIT');
                                        res.json({ 
                                            message: 'Автоматичний план успішно застосовано',
                                            days_planned: Object.keys(plansByDate).length,
                                            total_items: plan_items.length
                                        });
                                    }
                                }
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Помилка застосування плану:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ================================
// ДОПОМІЖНІ ФУНКЦІЇ АЛГОРИТМУ
// ================================

function analyzeDemand(orders, products, settings, period) {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + period);
    
    // Групуємо замовлення по товарах
    const orderDemand = {};
    orders.forEach(order => {
        const deliveryDate = new Date(order.delivery_date || order.order_date);
        const daysUntilDelivery = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24));
        
        if (!orderDemand[order.product_id]) {
            orderDemand[order.product_id] = {
                product_name: order.product_name,
                stock_pieces: order.stock_pieces,
                min_stock_pieces: order.min_stock_pieces,
                pieces_per_box: order.pieces_per_box,
                total_demand: 0,
                urgent_demand: 0,
                orders: []
            };
        }
        
        orderDemand[order.product_id].total_demand += order.quantity;
        orderDemand[order.product_id].orders.push({
            order_id: order.id,
            quantity: order.quantity,
            delivery_date: order.delivery_date,
            days_until_delivery: daysUntilDelivery,
            is_urgent: daysUntilDelivery <= 2
        });
        
        if (daysUntilDelivery <= 2) {
            orderDemand[order.product_id].urgent_demand += order.quantity;
        }
    });
    
    // Аналізуємо критичні залишки
    const stockDemand = {};
    products.forEach(product => {
        if (product.stock_urgency === 'critical' || product.stock_urgency === 'low') {
            stockDemand[product.id] = {
                product_name: product.name,
                stock_pieces: product.stock_pieces,
                min_stock_pieces: product.min_stock_pieces,
                pieces_per_box: product.pieces_per_box,
                shortage_quantity: Math.max(0, product.shortage_quantity),
                urgency: product.stock_urgency,
                recommended_quantity: Math.max(product.min_stock_pieces * 2, product.shortage_quantity)
            };
        }
    });
    
    return {
        order_demand: orderDemand,
        stock_demand: stockDemand,
        production_settings: settings,
        analysis_period: period,
        total_products: products.length,
        critical_products: Object.keys(stockDemand).length,
        active_orders: Object.keys(orderDemand).length
    };
}

async function generateOptimizedPlan(demandData, options) {
    const { period, priority, max_capacity, min_batch_size } = options;
    const { order_demand, stock_demand, production_settings } = demandData;
    
    const dailyCapacity = Math.floor(production_settings.daily_capacity * (max_capacity / 100));
    const planItems = [];
    
    // Створюємо список всіх потреб
    const allNeeds = [];
    
    // Додаємо потреби з замовлень
    Object.keys(order_demand).forEach(productId => {
        const demand = order_demand[productId];
        const urgentOrders = demand.orders.filter(o => o.is_urgent);
        const normalOrders = demand.orders.filter(o => !o.is_urgent);
        
        // Термінові замовлення
        if (urgentOrders.length > 0) {
            const urgentQuantity = urgentOrders.reduce((sum, o) => sum + o.quantity, 0);
            allNeeds.push({
                product_id: parseInt(productId),
                product_name: demand.product_name,
                quantity_needed: urgentQuantity,
                priority_score: 100, // Найвищий пріоритет
                reason: 'ORDER_URGENT',
                orders: urgentOrders,
                type: 'urgent_order'
            });
        }
        
        // Звичайні замовлення
        if (normalOrders.length > 0) {
            const normalQuantity = normalOrders.reduce((sum, o) => sum + o.quantity, 0);
            const avgDaysUntilDelivery = normalOrders.reduce((sum, o) => sum + o.days_until_delivery, 0) / normalOrders.length;
            allNeeds.push({
                product_id: parseInt(productId),
                product_name: demand.product_name,
                quantity_needed: normalQuantity,
                priority_score: Math.max(10, 50 - avgDaysUntilDelivery * 5),
                reason: 'ORDER',
                orders: normalOrders,
                type: 'normal_order'
            });
        }
    });
    
    // Додаємо потреби з критичних залишків
    Object.keys(stock_demand).forEach(productId => {
        const demand = stock_demand[productId];
        const priorityScore = demand.urgency === 'critical' ? 80 : 40;
        
        allNeeds.push({
            product_id: parseInt(productId),
            product_name: demand.product_name,
            quantity_needed: demand.recommended_quantity,
            priority_score: priorityScore,
            reason: demand.urgency === 'critical' ? 'CRITICAL_STOCK' : 'LOW_STOCK',
            type: 'stock_replenishment'
        });
    });
    
    // Сортуємо за пріоритетом
    allNeeds.sort((a, b) => b.priority_score - a.priority_score);
    
    // Розподіляємо по днях
    const today = new Date();
    let currentDay = 0;
    let currentDayCapacity = dailyCapacity;
    
    allNeeds.forEach(need => {
        let remainingQuantity = need.quantity_needed;
        
        while (remainingQuantity > 0 && currentDay < period) {
            // Розраховуємо кількість для поточного дня
            const quantityForDay = Math.min(remainingQuantity, currentDayCapacity);
            
            if (quantityForDay >= min_batch_size) {
                const planDate = new Date(today);
                planDate.setDate(today.getDate() + currentDay);
                
                planItems.push({
                    product_id: need.product_id,
                    product_name: need.product_name,
                    quantity_needed: need.quantity_needed,
                    quantity_planned: quantityForDay,
                    priority: getPriorityLevel(need.priority_score),
                    reason: need.reason,
                    plan_date: planDate.toISOString().split('T')[0],
                    order_id: need.orders && need.orders.length > 0 ? need.orders[0].order_id : null,
                    notes: generatePlanNotes(need)
                });
                
                remainingQuantity -= quantityForDay;
                currentDayCapacity -= quantityForDay;
            }
            
            // Переходимо до наступного дня якщо потужність вичерпана
            if (currentDayCapacity < min_batch_size) {
                currentDay++;
                currentDayCapacity = dailyCapacity;
            }
        }
    });
    
    // Розраховуємо ефективність плану
    const totalPlanned = planItems.reduce((sum, item) => sum + item.quantity_planned, 0);
    const totalNeeded = allNeeds.reduce((sum, need) => sum + need.quantity_needed, 0);
    const efficiency = totalNeeded > 0 ? Math.round((totalPlanned / totalNeeded) * 100) : 0;
    
    return {
        success: true,
        plan_items: planItems,
        summary: {
            days_planned: Math.min(currentDay + 1, period),
            total_items: planItems.length,
            total_quantity: totalPlanned,
            efficiency: efficiency,
            daily_capacity_used: dailyCapacity,
            max_capacity_percent: max_capacity
        },
        demand_analysis: {
            urgent_orders: allNeeds.filter(n => n.type === 'urgent_order').length,
            normal_orders: allNeeds.filter(n => n.type === 'normal_order').length,
            stock_replenishments: allNeeds.filter(n => n.type === 'stock_replenishment').length
        }
    };
}

function getPriorityLevel(score) {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
}

function generatePlanNotes(need) {
    switch (need.reason) {
        case 'ORDER_URGENT':
            return `Термінові замовлення (${need.orders.length} шт)`;
        case 'ORDER':
            return `Замовлення (${need.orders.length} шт)`;
        case 'CRITICAL_STOCK':
            return 'Критично низькі залишки';
        case 'LOW_STOCK':
            return 'Поповнення запасів';
        default:
            return 'Планове виробництво';
    }
}

function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const group = item[key];
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(item);
        return groups;
    }, {});
}

// ===== ВАЛІДАЦІЯ ДАНИХ ТОВАРУ =====
function validateProductData(data) {
    const errors = [];
    const validatedData = {};
    // Перевірка обов'язкових полів
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Поле "name" обов\'язкове');
    } else {
        validatedData.name = data.name.trim();
    }
    if (!data.code || typeof data.code !== 'string' || data.code.trim() === '') {
        errors.push('Поле "code" обов\'язкове');
    } else {
        validatedData.code = data.code.trim();
    }
    if (!data.weight || isNaN(Number(data.weight))) {
        errors.push('Поле "weight" обов\'язкове і має бути числом');
    } else {
        validatedData.weight = Number(data.weight);
    }
    validatedData.barcode = data.barcode ? String(data.barcode).trim() : null;
    validatedData.pieces_per_box = data.pieces_per_box ? Number(data.pieces_per_box) : 1;
    validatedData.stock_pieces = data.stock_pieces ? Number(data.stock_pieces) : 0;
    validatedData.stock_boxes = data.stock_boxes ? Number(data.stock_boxes) : 0;
    validatedData.min_stock_pieces = data.min_stock_pieces ? Number(data.min_stock_pieces) : 0;
    return {
        isValid: errors.length === 0,
        errors,
        validatedData
    };
}

// Додаємо логуючу обгортку для POST /api/arrivals
const arrivalControllerWithLogging = {
    async createArrival(req, res) {
        // Викликаємо оригінальний контролер
        const originalJson = res.json;
        let arrivalResult = null;
        res.json = function(data) {
            arrivalResult = data;
            return originalJson.call(this, data);
        };
        await originalArrivalController.createArrival(req, res);
        // Якщо операція успішна, логуємо її
        if (arrivalResult && arrivalResult.success) {
            try {
                const OperationsLogController = require('./controllers/operations-log-controller');
                const { arrival_date, reason, items } = req.body;
                const totalQuantity = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);
                const itemsCount = items.length;
                await OperationsLogController.logOperation({
                    operation_type: OperationsLogController.OPERATION_TYPES.ARRIVAL,
                    operation_id: null,
                    entity_type: 'arrival',
                    entity_id: null,
                    new_data: {
                        arrival_number: arrivalResult.arrival_number,
                        total_quantity: totalQuantity,
                        items_count: itemsCount,
                        reason: reason
                    },
                    description: `Оприходування №${arrivalResult.arrival_number}: ${totalQuantity} шт (${itemsCount} позицій)`,
                    user_name: req.body.created_by || 'system',
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
            } catch (logError) {
                console.error('Помилка логування приходу:', logError);
            }
        }
    }
};
// Замінюємо роут приходу на версію з логуванням тільки для POST
app.use('/api/arrivals', (req, res, next) => {
    if (req.method === 'POST' && req.url === '/') {
        return arrivalControllerWithLogging.createArrival(req, res);
    }
    next();
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍕 Pizza Inventory API запущено на порту ${PORT}`);
    console.log(`🌐 Доступний за адресою: http://116.203.116.234:${PORT}`);
    console.log(`📊 API документація: http://116.203.116.234:${PORT}/`);
});
