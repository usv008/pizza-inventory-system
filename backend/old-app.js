const express = require('express');
const cors = require('cors');

// Middleware
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const productsRouter = require('./routes/products');
const orderDocxRouter = require('./routes/order-docx');
const { router: orderPdfRouter, initPdfRoutes } = require('./routes/order-pdf');
const batchRoutes = require('./routes/batch-routes');
const arrivalRoutes = require('./routes/arrival-routes');
const operationsLogRoutes = require('./routes/operations-log-routes');

// Додаю підключення всіх модульних роутів
const productionRoutes = require('./routes/production-routes');
const writeoffRoutes = require('./routes/writeoff-routes');
const movementRoutes = require('./routes/movement-routes');
const clientRoutes = require('./routes/client-routes');
const orderRoutes = require('./routes/order-routes');

// Services
const productService = require('./services/productService');

// Додаю підключення всіх модульних сервісів
const productionService = require('./services/productionService');
const writeoffService = require('./services/writeoffService');
const movementService = require('./services/movementService');
const clientService = require('./services/clientService');
const orderService = require('./services/orderService');

const app = express();
const PORT = 3000;

// ================================
// MIDDLEWARE SETUP
// ================================
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// ================================
// DATABASE INITIALIZATION
// ================================
let productQueries, productionQueries, writeoffQueries, clientQueries, orderQueries, movementsQueries, initDatabase;
let OperationsLogController;

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
    
    // Operations Log Controller
    OperationsLogController = require('./controllers/operations-log-controller');
    
    if (typeof initDatabase !== 'function') {
        console.error('[DB LOG] FATAL: initDatabase не є функцією!');
        throw new Error('Помилка ініціалізації БД: функція не знайдена.');
    }

    // Ініціалізуємо базу даних
    initDatabase().then(() => {
        console.log('🚀 База даних готова до роботи');
        
        // Ініціалізуємо сервіси з залежностями
        productService.initialize({
            productQueries,
            OperationsLogController
        });
        
        // Ініціалізуємо всі модульні сервіси
        productionService.initialize({
            productionQueries,
            productQueries,
            OperationsLogController
        });
        
        writeoffService.initialize({
            writeoffQueries,
            productQueries,
            OperationsLogController
        });
        
        movementService.initialize({
            movementsQueries,
            productQueries,
            OperationsLogController
        });
        
        clientService.initialize({
            clientQueries,
            OperationsLogController
        });
        
        orderService.initialize({
            orderQueries,
            productQueries,
            clientQueries,
            OperationsLogController
        });
        
        // Ініціалізуємо PDF роути
        initPdfRoutes({
            orderQueries,
            productQueries
        });
        
        console.log('✅ Сервіси ініціалізовано');
    }).catch(err => {
        console.error('❌ Помилка ініціалізації БД:', err);
    });
} catch (error) {
    console.error('--- FATAL ERROR ON DATABASE LOAD ---');
    console.error(error);
    // Fallback до null
    productQueries = null;
    productionQueries = null;
    movementsQueries = null;
}

// ================================
// API ROUTES
// ================================

// Головна сторінка - перенаправлення на index.html
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Pizza Inventory System API - Modular Architecture',
        version: '3.0.0',
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
        architecture: 'Router + Service + Validator Pattern',
        timestamp: new Date().toISOString()
    });
});

// Mount routes
app.use('/api', productsRouter);
app.use(orderDocxRouter);
app.use('/api', orderPdfRouter);
app.use('/api', batchRoutes);
app.use('/api/arrivals', arrivalRoutes);
app.use('/api/operations', operationsLogRoutes);

// Підключаю всі модульні роути
app.use('/api', productionRoutes);
app.use('/api', writeoffRoutes);
app.use('/api', movementRoutes);
app.use('/api', clientRoutes);
app.use('/api', orderRoutes);

// ================================
// TEMPORARY LEGACY ROUTES (TO BE MIGRATED)
// ================================
// Ці роути будуть поступово мігровані в окремі модулі

// TODO: Migrate to statsService
app.get('/api/stats', async (req, res, next) => {
    try {
        if (!productQueries) {
            return res.status(503).json({ error: 'База даних недоступна' });
        }
        
        const products = await productQueries.getAll();
        
        const stats = {
            total_products: products.length,
            total_stock_pieces: products.reduce((sum, p) => sum + (p.stock_pieces || 0), 0),
            total_stock_boxes: products.reduce((sum, p) => sum + (p.stock_boxes || 0), 0),
            low_stock_count: products.filter(p => (p.stock_pieces || 0) <= (p.min_stock_pieces || 0)).length
        };
        
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

// Legacy endpoint for backward compatibility (старий формат)
app.get('/api/pizzas', async (req, res, next) => {
    try {
        const products = await productService.getAllProducts();
        // Повертаємо у старому форматі (простий масив)
        res.json(products);
    } catch (error) {
        next(error);
    }
});

// TODO: Migrate to other modules (writeoffs, movements, clients, orders)
// Залишаю тільки базові маршрути для збереження функціональності

// ================================
// ERROR HANDLING
// ================================
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ================================
// SERVER STARTUP
// ================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍕 Pizza Inventory API (Modular) запущено на порту ${PORT}`);
    console.log(`🌐 Доступний за адресою: http://116.203.116.234:${PORT}`);
    console.log(`📊 API документація: http://116.203.116.234:${PORT}/`);
    console.log(`🏗️ Архітектура: Router + Service + Validator Pattern`);
}); 