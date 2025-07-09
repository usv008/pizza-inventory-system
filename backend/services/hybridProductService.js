const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Product Service - поступова міграція з SQLite на Supabase
 * Підтримує як legacy SQLite queries, так і нові Supabase operations
 */

let legacyProductService = null;
let supabaseProductService = null;
let migrationConfig = {
    // Configuration flags для поступової міграції
    USE_SUPABASE_READ: process.env.USE_SUPABASE_READ === 'true' || false,
    USE_SUPABASE_WRITE: process.env.USE_SUPABASE_WRITE === 'true' || false,
    FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false', // Default true
    LOG_OPERATIONS: process.env.LOG_HYBRID_OPERATIONS === 'true' || true
};

// Ініціалізація сервісів
function initialize(dependencies) {
    // Ініціалізуємо legacy service (існуючий SQLite)
    if (dependencies.legacyProductService) {
        legacyProductService = dependencies.legacyProductService;
        // Передаємо всі потрібні залежності для legacy service
        const legacyDeps = {
            productQueries: dependencies.productQueries,
            OperationsLogController: dependencies.OperationsLogController
        };
        legacyProductService.initialize(legacyDeps);
    }

    // Ініціалізуємо Supabase service
    if (dependencies.supabaseProductService) {
        supabaseProductService = dependencies.supabaseProductService;
        // Для Supabase service потрібен тільки OperationsLogController
        const supabaseDeps = {
            OperationsLogController: dependencies.OperationsLogController
        };
        supabaseProductService.initialize(supabaseDeps);
    }

    logOperation('initialize', 'Hybrid Product Service initialized', {
        useSupabaseRead: migrationConfig.USE_SUPABASE_READ,
        useSupabaseWrite: migrationConfig.USE_SUPABASE_WRITE,
        fallbackToLegacy: migrationConfig.FALLBACK_TO_LEGACY
    });
}

/**
 * Логування операцій міграції
 */
function logOperation(operation, message, details = {}) {
    if (migrationConfig.LOG_OPERATIONS) {
        console.log(`[HYBRID-PRODUCT] ${operation}: ${message}`, details);
    }
}

/**
 * Wrapper для виконання операції з fallback логікою
 */
async function executeWithFallback(operation, supabaseFunc, legacyFunc, ...args) {
    const useSupabase = operation.includes('read') || operation.includes('get') 
        ? migrationConfig.USE_SUPABASE_READ 
        : migrationConfig.USE_SUPABASE_WRITE;

    logOperation(operation, `Executing ${operation}`, { 
        useSupabase, 
        args: args.map(arg => typeof arg === 'object' ? '[object]' : arg) 
    });

    if (useSupabase && supabaseProductService) {
        try {
            const result = await supabaseFunc(...args);
            logOperation(operation, `Supabase success for ${operation}`);
            return result;
        } catch (error) {
            logOperation(operation, `Supabase error for ${operation}: ${error.message}`);
            
            if (migrationConfig.FALLBACK_TO_LEGACY && legacyProductService) {
                logOperation(operation, `Falling back to legacy for ${operation}`);
                try {
                    const result = await legacyFunc(...args);
                    logOperation(operation, `Legacy fallback success for ${operation}`);
                    return result;
                } catch (legacyError) {
                    logOperation(operation, `Legacy fallback also failed for ${operation}: ${legacyError.message}`);
                    throw legacyError;
                }
            } else {
                throw error;
            }
        }
    } else if (legacyProductService) {
        logOperation(operation, `Using legacy for ${operation}`);
        return await legacyFunc(...args);
    } else {
        throw new DatabaseError('Ні Supabase, ні legacy service недоступні');
    }
}

/**
 * Отримати всі товари
 */
async function getAllProducts() {
    return await executeWithFallback(
        'getAllProducts',
        () => supabaseProductService?.getAllProducts(),
        () => legacyProductService?.getAllProducts()
    );
}

/**
 * Отримати товар за ID
 */
async function getProductById(id) {
    return await executeWithFallback(
        'getProductById',
        () => supabaseProductService?.getProductById(id),
        () => legacyProductService?.getProductById(id),
        id
    );
}

/**
 * Створити новий товар
 */
async function createProduct(validatedData, userContext = {}) {
    return await executeWithFallback(
        'createProduct',
        () => supabaseProductService?.createProduct(validatedData, userContext),
        () => legacyProductService?.createProduct(validatedData, userContext),
        validatedData,
        userContext
    );
}

/**
 * Оновити товар
 */
async function updateProduct(id, validatedData, userContext = {}) {
    return await executeWithFallback(
        'updateProduct', 
        () => supabaseProductService?.updateProduct(id, validatedData, userContext),
        () => legacyProductService?.updateProduct(id, validatedData, userContext),
        id,
        validatedData,
        userContext
    );
}

/**
 * Видалити товар
 */
async function deleteProduct(id, userContext = {}) {
    return await executeWithFallback(
        'deleteProduct',
        () => supabaseProductService?.deleteProduct(id, userContext),
        () => legacyProductService?.deleteProduct(id, userContext),
        id,
        userContext
    );
}

/**
 * Оновити склад товару
 */
async function updateProductStock(id, stockData, userContext = {}) {
    return await executeWithFallback(
        'updateProductStock',
        () => supabaseProductService?.updateProductStock(id, stockData, userContext),
        () => legacyProductService?.updateProductStock(id, stockData, userContext),
        id,
        stockData,
        userContext
    );
}

/**
 * Отримати поточний склад товару
 */
async function getProductStock(id) {
    return await executeWithFallback(
        'getProductStock',
        () => supabaseProductService?.getProductStock?.(id),
        () => legacyProductService?.getProductStock?.(id),
        id
    );
}

/**
 * Bulk stock update for multiple products (for movement operations)
 */
async function bulkUpdateProductStock(stockUpdates, userContext = {}) {
    return await executeWithFallback(
        'bulkUpdateProductStock',
        () => supabaseProductService?.bulkUpdateProductStock?.(stockUpdates, userContext),
        () => legacyProductService?.bulkUpdateProductStock?.(stockUpdates, userContext),
        stockUpdates,
        userContext
    );
}

/**
 * Validate stock availability before movement
 */
async function validateStockAvailability(productId, requiredPieces = 0, requiredBoxes = 0) {
    return await executeWithFallback(
        'validateStockAvailability',
        () => supabaseProductService?.validateStockAvailability?.(productId, requiredPieces, requiredBoxes),
        () => legacyProductService?.validateStockAvailability?.(productId, requiredPieces, requiredBoxes),
        productId,
        requiredPieces,
        requiredBoxes
    );
}

/**
 * Stock adjustment with audit trail (for movement operations)
 */
async function adjustProductStock(id, adjustment, userContext = {}) {
    return await executeWithFallback(
        'adjustProductStock',
        () => supabaseProductService?.adjustProductStock?.(id, adjustment, userContext),
        () => legacyProductService?.adjustProductStock?.(id, adjustment, userContext),
        id,
        adjustment,
        userContext
    );
}

/**
 * Get products with low stock (for inventory management)
 */
async function getProductsWithLowStock(thresholds = {}) {
    return await executeWithFallback(
        'getProductsWithLowStock',
        () => supabaseProductService?.getProductsWithLowStock?.(thresholds),
        () => legacyProductService?.getProductsWithLowStock?.(thresholds),
        thresholds
    );
}

/**
 * Dual-write operation: записати в обидві БД для синхронізації
 */
async function dualWriteProduct(operation, ...args) {
    const results = { supabase: null, legacy: null, errors: [] };

    // Спробувати Supabase
    if (supabaseProductService) {
        try {
            results.supabase = await supabaseProductService[operation](...args);
            logOperation('dualWrite', `Supabase ${operation} success`);
        } catch (error) {
            results.errors.push({ service: 'supabase', error: error.message });
            logOperation('dualWrite', `Supabase ${operation} failed: ${error.message}`);
        }
    }

    // Спробувати Legacy
    if (legacyProductService) {
        try {
            results.legacy = await legacyProductService[operation](...args);
            logOperation('dualWrite', `Legacy ${operation} success`);
        } catch (error) {
            results.errors.push({ service: 'legacy', error: error.message });
            logOperation('dualWrite', `Legacy ${operation} failed: ${error.message}`);
        }
    }

    // Повернути успішний результат або кинути помилку
    if (results.supabase || results.legacy) {
        return results.supabase || results.legacy;
    } else {
        const errorMsg = `Dual-write ${operation} failed in both services: ${JSON.stringify(results.errors)}`;
        logOperation('dualWrite', errorMsg);
        throw new DatabaseError(errorMsg);
    }
}

/**
 * Migration utilities
 */
function getMigrationStatus() {
    return {
        config: migrationConfig,
        services: {
            legacy: !!legacyProductService,
            supabase: !!supabaseProductService
        },
        timestamp: new Date().toISOString()
    };
}

function updateMigrationConfig(newConfig) {
    migrationConfig = { ...migrationConfig, ...newConfig };
    logOperation('configUpdate', 'Migration config updated', migrationConfig);
}

/**
 * Test connectivity to both services
 */
async function testConnectivity() {
    const results = { legacy: false, supabase: false, errors: [] };

    // Test legacy
    if (legacyProductService) {
        try {
            await legacyProductService.getAllProducts();
            results.legacy = true;
        } catch (error) {
            results.errors.push({ service: 'legacy', error: error.message });
        }
    }

    // Test Supabase
    if (supabaseProductService) {
        try {
            await supabaseProductService.getAllProducts();
            results.supabase = true;
        } catch (error) {
            results.errors.push({ service: 'supabase', error: error.message });
        }
    }

    return results;
}

/**
 * Emergency fallback to legacy only
 */
function emergencyFallbackToLegacy() {
    logOperation('emergency', 'Emergency fallback to legacy activated');
    migrationConfig.USE_SUPABASE_READ = false;
    migrationConfig.USE_SUPABASE_WRITE = false;
    migrationConfig.FALLBACK_TO_LEGACY = true;
}

/**
 * Enable full Supabase mode
 */
function enableFullSupabaseMode() {
    logOperation('migration', 'Full Supabase mode activated');
    migrationConfig.USE_SUPABASE_READ = true;
    migrationConfig.USE_SUPABASE_WRITE = true;
    migrationConfig.FALLBACK_TO_LEGACY = false;
}

module.exports = {
    initialize,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    getProductStock,
    bulkUpdateProductStock,
    validateStockAvailability,
    adjustProductStock,
    getProductsWithLowStock,
    dualWriteProduct,
    getMigrationStatus,
    updateMigrationConfig,
    testConnectivity,
    emergencyFallbackToLegacy,
    enableFullSupabaseMode,
    logOperation
}; 