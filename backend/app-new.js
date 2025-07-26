const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SupabaseSessionStore = require('./middleware/SupabaseSessionStore');

// Middleware
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const productsRouter = require('./routes/products');
const clientRoutes = require('./routes/client-routes');
const orderRoutes = require('./routes/order-routes');
const productionRoutes = require('./routes/production-routes');
const writeoffRoutes = require('./routes/writeoff-routes');
const movementRoutes = require('./routes/movement-routes');
const orderDocxRouter = require('./routes/order-docx');
const { router: orderPdfRouter, initPdfRoutes } = require('./routes/order-pdf');
const batchRoutes = require('./routes/batch-routes');
const arrivalRoutes = require('./routes/arrival-routes');
const operationsLogRoutes = require('./routes/operations-log-routes');
const authRoutes = require('./routes/auth-routes');
const userRoutes = require('./routes/user-routes');

// Services - використовуємо нові версії з підтримкою Supabase
const productService = require('./services/productService-v2');
const clientService = require('./services/clientService-v2');
const orderService = require('./services/orderService-v2');
const productionService = require('./services/productionService-v2');
const writeoffService = require('./services/writeoffService-v2');
const movementService = require('./services/movementService-v2');
const authService = require('./services/authService-v2');
const permissionService = require('./services/permissionService');
const userService = require('./services/userService-v2');

const app = express();
const PORT = 3000;

// ================================
// MIDDLEWARE SETUP
// ================================
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Debug middleware - логування всіх запитів
app.use((req, res, next) => {
    const fs = require('fs');
    fs.appendFileSync('/tmp/express_debug.log', `${new Date().toISOString()} - ${req.method} ${req.url}\n`);
    next();
});

// Session configuration with Supabase
const sessionStore = new SupabaseSessionStore({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
    tableName: 'user_sessions'
});

// Start cleanup interval for expired sessions
sessionStore.startCleanupInterval(60 * 60 * 1000); // 1 hour

app.use(session({
    store: sessionStore,
    secret: 'pizza-system-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ================================
// DATABASE INITIALIZATION
// ================================
let productQueries, productionQueries, writeoffQueries, clientQueries, orderQueries, movementsQueries, initDatabase;
let userQueries, sessionQueries, auditQueries;
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
    userQueries = database.userQueries || null;
    sessionQueries = database.sessionQueries || null;
    auditQueries = database.auditQueries || null;
    initDatabase = database.initDatabase;
    
    // Operations Log Service v2 (заміщує контролер)
    OperationsLogController = require('./services/operationsLogService-v2');
    
    if (typeof initDatabase !== 'function') {
        console.error('[DB LOG] FATAL: initDatabase не є функцією!');
        throw new Error('Помилка ініціалізації БД: функція не знайдена.');
    }

    // Ініціалізуємо базу даних
    initDatabase().then(() => {
        console.log('🚀 База даних готова до роботи');
        
        // Ініціалізуємо сервіси з залежностями
        // Нові v2 сервіси використовують DatabaseAdapter і потребують мінімальної ініціалізації
        productService.initialize({
            OperationsLogController
        });
        
        clientService.initialize({
            OperationsLogController
        });
        
        // Старі сервіси поки залишаємо як є
        orderService.initialize({
            OperationsLogController,
            batchController: null // поки не мігровано
        });
        
        productionService.initialize({
            OperationsLogController
        });
        
        writeoffService.initialize({
            OperationsLogController
        });
        
        movementService.initialize({
            OperationsLogController
        });
        
        // Ініціалізуємо OperationsLogService v2
        console.log('🔧 Ініціалізуємо operationsLogService-v2...');
        OperationsLogController.initialize();
        console.log('✅ operationsLogService-v2 ініціалізовано');
        
        // Нові v2 сервіси автентифікації
        console.log('🔧 Ініціалізуємо authService-v2...');
        authService.initialize({
            sessionQueries,
            auditQueries
        });
        console.log('✅ authService-v2 ініціалізовано');
        
        console.log('🔧 Ініціалізуємо userService-v2...');
        userService.initialize({
            auditQueries
        });
        console.log('✅ userService-v2 ініціалізовано');
        
        // Ініціалізуємо Permission Service
        permissionService.initialize();
        
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
    writeoffQueries = null;
    clientQueries = null;
    orderQueries = null;
    movementsQueries = null;
    userQueries = null;
    sessionQueries = null;
    auditQueries = null;
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
        version: '4.0.0',
        endpoints: {
            // Authentication Module
            authUsers: 'GET /api/auth/users',
            login: 'POST /api/auth/login',
            logout: 'POST /api/auth/logout',
            setPassword: 'POST /api/auth/set-password',
            changePassword: 'POST /api/auth/change-password',
            validateSession: 'GET /api/auth/validate',
            currentUser: 'GET /api/auth/me',
            
            // Users Module
            users: 'GET /api/users',
            createUser: 'POST /api/users',
            updateUser: 'PUT /api/users/:id',
            deleteUser: 'DELETE /api/users/:id',
            userRoles: 'GET /api/users/roles',
            userPermissions: 'GET /api/users/permissions',
            userStats: 'GET /api/users/stats',
            
            // Products Module
            products: 'GET /api/products',
            createProduct: 'POST /api/products',
            updateProduct: 'PUT /api/products/:id',
            deleteProduct: 'DELETE /api/products/:id',
            updateStock: 'POST /api/products/:id/stock',
            pizzas: 'GET /api/pizzas',
            stats: 'GET /api/stats',
            
            // Clients Module
            clients: 'GET /api/clients',
            createClient: 'POST /api/clients',
            updateClient: 'PUT /api/clients/:id',
            deleteClient: 'DELETE /api/clients/:id',
            
            // Orders Module
            orders: 'GET /api/orders',
            createOrder: 'POST /api/orders',
            orderById: 'GET /api/orders/:id',
            updateOrder: 'PUT /api/orders/:id',
            deleteOrder: 'DELETE /api/orders/:id',
            
            // Production Module
            production: 'GET /api/production',
            addProduction: 'POST /api/production',
            updateProduction: 'PUT /api/production/:id',
            deleteProduction: 'DELETE /api/production/:id',
            productionStatistics: 'GET /api/production/statistics',
            
            // Writeoffs Module
            writeoffs: 'GET /api/writeoffs',
            addWriteoff: 'POST /api/writeoffs',
            writeoffsByProduct: 'GET /api/writeoffs/product/:id',
            writeoffStatistics: 'GET /api/writeoffs/statistics',
            
            // Movements Module
            movements: 'GET /api/movements',
            createMovement: 'POST /api/movements',
            updateMovement: 'PUT /api/movements/:id',
            deleteMovement: 'DELETE /api/movements/:id?confirm=true',
            movementsByProduct: 'GET /api/movements/product/:id',
            movementStatistics: 'GET /api/movements/statistics',
            movementTypes: 'GET /api/movements/types',
            movementSummary: 'GET /api/movements/summary'
        },
        architecture: 'Router + Service + Validator Pattern',
        modules: {
            completed: ['Auth', 'Users', 'Products', 'Clients', 'Orders', 'Production', 'Writeoffs', 'Movements'],
            total: 8,
            completion: '100%'
        },
        timestamp: new Date().toISOString()
    });
});

// Mount routes
console.log('🔧 Mounting routes...');

// Test simple route first
app.get('/api/arrivals/test', (req, res) => {
    res.json({ message: 'Test arrivals route works!' });
});

// Mount arrivals and operations-log first to avoid conflicts
app.use('/api/arrivals', arrivalRoutes);
console.log('✅ Arrival router mounted at /api/arrivals');

app.use('/api/operations-log', operationsLogRoutes);
console.log('✅ Operations log router mounted at /api/operations-log');

// Mount other routes
app.use('/api', batchRoutes);
console.log('✅ Batch router mounted at /api');

app.use('/api', productsRouter);
console.log('✅ Products router mounted at /api');

app.use('/api/auth', authRoutes);
console.log('✅ Auth router mounted at /api/auth');

app.use('/api/users', userRoutes);
console.log('✅ Users router mounted at /api/users');

app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/writeoffs', writeoffRoutes);
app.use('/api/movements', movementRoutes);
app.use(orderDocxRouter);
app.use('/api', orderPdfRouter);

// ================================
// LEGACY ENDPOINTS (TEMPORARY)
// ================================

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

// Stats endpoint для compatibility
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

// ================================
// ERROR HANDLING
// ================================
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ================================
// ERROR HANDLING FOR UNCAUGHT EXCEPTIONS
// ================================
process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
    console.error('Stack:', reason?.stack);
    process.exit(1);
});

// ================================
// SERVER STARTUP
// ================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍕 Pizza Inventory API (Modular) запущено на порту ${PORT}`);
    console.log(`🌐 Доступний за адресою: http://116.203.116.234:${PORT}`);
    console.log(`📊 API документація: http://116.203.116.234:${PORT}/api`);
    console.log(`🏗️ Архітектура: Router + Service + Validator Pattern`);
    console.log(`📦 Завершені модулі: Auth, Users, Products, Clients, Orders, Production, Writeoffs, Movements (8/8 - 100%)`);
    console.log(`✅ Система авторизації та користувачів готова!`);
}); 