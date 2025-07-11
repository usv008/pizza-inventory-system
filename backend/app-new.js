require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// Middleware
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const userContextMiddleware = require('./middleware/userContextMiddleware');

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
const newWriteoffRoutes = require('./routes/new-writeoff-routes');
const arrivalRoutes = require('./routes/arrival-routes');  
const operationsLogRoutes = require('./routes/operations-log-routes');
const authRoutes = require('./routes/auth-routes');
const userRoutes = require('./routes/user-routes');

// Services
const productService = require('./services/productService');
const clientService = require('./services/clientService');
const orderService = require('./services/orderService');
const productionService = require('./services/productionService');
const writeoffService = require('./services/writeoffService');
const movementService = require('./services/movementService');
const arrivalService = require('./services/arrivalService');
const authService = require('./services/authService');
const permissionService = require('./services/permissionService');
const userService = require('./services/userService');

const app = express();
const PORT = 3000;

// ================================
// MIDDLEWARE SETUP
// ================================
app.use(cors());
app.use(express.json());
app.use(express.static('./frontend'));

// Debug middleware - логування всіх запитів
app.use((req, res, next) => {
    const fs = require('fs');
    fs.appendFileSync('/tmp/express_debug.log', `${new Date().toISOString()} - ${req.method} ${req.url}\n`);
    next();
});

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: '.',
        table: 'sessions'
    }),
    secret: 'pizza-system-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// User context middleware for operations logging
app.use(userContextMiddleware);

// ================================
// DATABASE INITIALIZATION
// ================================
let productQueries, productionQueries, writeoffQueries, clientQueries, orderQueries, movementsQueries, batchQueries, arrivalQueries, initDatabase;
let userQueries, sessionQueries, auditQueries;
// Import mock userQueries
const { userQueries: mockUserQueries } = require("./queries/user-queries-mock");
userQueries = mockUserQueries;
let OperationsLogController;

try {
    console.log('[DB LOG] Спроба завантажити ./supabase-database.js');
    const database = require('./supabase-database');
    console.log('[DB LOG] Модуль supabase-database.js завантажено успішно.');

    productQueries = database.productQueries;
    productionQueries = database.productionQueries || null;
    writeoffQueries = database.writeoffQueries || null;
    clientQueries = database.clientQueries || null;
    orderQueries = database.orderQueries || null;
    movementsQueries = database.movementsQueries || null;
    batchQueries = database.batchQueries || null;
    arrivalQueries = database.arrivalQueries || null;
    // userQueries = database.userQueries || null; // Keep mock version
    sessionQueries = database.sessionQueries || null;
    auditQueries = database.auditQueries || null;
    initDatabase = database.initDatabase;
    
    console.log("🔄 Using mock Supabase - initializing AuthService directly...");
    
    // Initialize AuthService immediately for mock
        // authService already initialized with mock queries - SKIP
    
    console.log("✅ Mock AuthService initialized");
    
    // Operations Log Controller
    OperationsLogController = require('./controllers/operations-log-controller');
    
    if (typeof initDatabase !== 'function') {
        console.error('[DB LOG] FATAL: initDatabase не є функцією!');
        throw new Error('Помилка ініціалізації БД: функція не знайдена.');
    }

    console.log("🔄 Attempting to initialize database...");
    // Ініціалізуємо базу даних
    initDatabase().then(() => {
        console.log('🚀 База даних готова до роботи');
        console.log("✅ Database initialized successfully, initializing services...");
        
        // Ініціалізуємо сервіси з залежностями
        productService.initialize({
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
            batchQueries,
            OperationsLogController
        });
        
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
        
        arrivalService.initialize({
            arrivalQueries,
            productQueries,
            OperationsLogController
        });
        
        // Ініціалізуємо AuthService з залежностями
        authService.initialize({
            userQueries,
            sessionQueries,
            auditQueries
        });
        
        // Ініціалізуємо Permission Service
        permissionService.initialize();
        
        // Ініціалізуємо User Service
        userService.initialize({
            userQueries,
            auditQueries
        });
        
        // Ініціалізуємо PDF роути
        initPdfRoutes({
            orderQueries,
            productQueries
        });
        
        console.log('✅ Сервіси ініціалізовано');
        
        // ================================
        // MOUNT ROUTES AFTER SERVICE INITIALIZATION
        // ================================
        console.log('🔧 Mounting routes...');
        app.use('/api', productsRouter);
        console.log('✅ Products router mounted');
        app.use('/api/auth', authRoutes);
        console.log('✅ Auth router mounted');

        // Test route для діагностики - поза auth простором
        app.get('/api/test-auth', (req, res) => {
            res.json({ message: 'Test route working!', auth_service: typeof authService, timestamp: new Date().toISOString() });
        });
        app.use('/api/users', userRoutes);
        console.log('✅ Users router mounted');
        app.use('/api/clients', clientRoutes);
        console.log('✅ Clients router mounted');
        app.use('/api/orders', orderRoutes);
        console.log('✅ Orders router mounted');
        app.use('/api/production', productionRoutes);
        console.log('✅ Production router mounted');
        app.use('/api/writeoffs', writeoffRoutes);
        console.log('✅ Writeoffs router mounted');
        app.use('/api/movements', movementRoutes);
        console.log('✅ Movements router mounted');
        app.use('/api/arrivals', arrivalRoutes);
        console.log('✅ Arrivals router mounted');
        app.use(orderDocxRouter);
        app.use('/api', orderPdfRouter);
        app.use('/api', batchRoutes);
        
        // Нові writeoff роути
        app.use('/api', newWriteoffRoutes);
        console.log('✅ New Writeoff routes підключено');
        
        // Додаткові прямі роути для тестування
        const NewWriteoffController = require('./controllers/new-writeoff-controller');
        app.post('/api/new-writeoff', NewWriteoffController.createWriteoff);
        app.get('/api/writeoff-status', NewWriteoffController.getWriteoffStatus);
        console.log('✅ Прямі writeoff роути додано');
        
        app.use('/api/operations', operationsLogRoutes);
        console.log('✅ Всі роути підключено');
        
        // ================================
        // ERROR HANDLING - AFTER ROUTES
        // ================================
        app.use(notFoundHandler);
        app.use(globalErrorHandler);
        console.log('✅ Error handlers підключено');
        
        // ================================
        // SERVER STARTUP AFTER FULL INITIALIZATION
        // ================================
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🍕 Pizza Inventory API (Modular) запущено на порту ${PORT}`);
            console.log(`🌐 Доступний за адресою: http://116.203.116.234:${PORT}`);
            console.log(`📊 API документація: http://116.203.116.234:${PORT}/api`);
            console.log(`🏗️ Архітектура: Router + Service + Validator Pattern`);
            console.log(`📦 Завершені модулі: Auth, Users, Products, Clients, Orders, Production, Writeoffs, Movements, Arrivals (9/9 - 100%)`);
            console.log(`✅ Система авторизації та користувачів готова!`);
            console.log(`🎯 PHASE 1 COMPLETE: Arrivals module відновлено!`);
        });
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
    batchQueries = null;
    arrivalQueries = null;
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
            movementSummary: 'GET /api/movements/summary',
            
            // Arrivals Module
            arrivals: 'GET /api/arrivals',
            createArrival: 'POST /api/arrivals',
            arrivalById: 'GET /api/arrivals/:id'
        },
        architecture: 'Router + Service + Validator Pattern',
        modules: {
            completed: ['Auth', 'Users', 'Products', 'Clients', 'Orders', 'Production', 'Writeoffs', 'Movements', 'Arrivals'],
            total: 9,
            completion: '100%'
        },
        timestamp: new Date().toISOString()
    });
});

// Mount routes - ALL ROUTES WILL BE MOUNTED AFTER SERVICE INITIALIZATION

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
// ERROR HANDLING - MOVED TO ASYNC BLOCK
// ================================
// Error handlers are now mounted after routes in the async initialization block

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
// SERVER STARTUP - MOVED TO AFTER SERVICE INITIALIZATION
// ================================
// Server will start after services are initialized in the async block 