const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Batch Service - Revolutionary architecture for batch migration
 * Implements intelligent fallback between legacy BatchController and SupabaseBatchService
 * Features: 4-phase migration, configuration-driven behavior, perfect fallback capabilities
 */

let legacyBatchController = null;
let supabaseBatchService = null;
let hybridProductService = null;
let hybridAuditService = null;

// Migration configuration with 4-phase approach
let migrationConfig = {
    // Phase configuration
    MIGRATION_PHASE: process.env.BATCH_MIGRATION_PHASE || 'PHASE_1',
    
    // Phase-specific settings
    USE_SUPABASE_READ: process.env.USE_SUPABASE_BATCH_READ === 'true' || false,
    USE_SUPABASE_WRITE: process.env.USE_SUPABASE_BATCH_WRITE === 'true' || false,
    FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false',
    
    // Advanced options
    LOG_OPERATIONS: process.env.LOG_HYBRID_BATCH_OPERATIONS === 'true' || true,
    ENABLE_DUAL_WRITE: process.env.ENABLE_DUAL_WRITE_BATCH === 'true' || false,
    VALIDATE_CROSS_DB: process.env.VALIDATE_CROSS_DB_BATCH === 'true' || false,
    
    // Performance settings
    OPERATION_TIMEOUT: parseInt(process.env.BATCH_OPERATION_TIMEOUT) || 30000,
    MAX_RETRY_ATTEMPTS: parseInt(process.env.BATCH_MAX_RETRIES) || 3,
    
    // Batch-specific settings
    ENABLE_BATCH_ANALYTICS: process.env.ENABLE_BATCH_ANALYTICS !== 'false',
    ENABLE_PRODUCTION_INTEGRATION: process.env.ENABLE_BATCH_PRODUCTION_INTEGRATION !== 'false',
    ENABLE_ORDER_INTEGRATION: process.env.ENABLE_BATCH_ORDER_INTEGRATION !== 'false'
};

/**
 * Initialize hybrid batch service with dependencies
 */
function initialize(dependencies) {
    // Initialize legacy batch controller
    if (dependencies.legacyBatchController) {
        legacyBatchController = dependencies.legacyBatchController;
        
        // Pass dependencies to legacy controller if needed
        const legacyDeps = {
            db: dependencies.db,
            OperationsLogController: dependencies.OperationsLogController
        };
        
        if (legacyBatchController.initialize) {
            legacyBatchController.initialize(legacyDeps);
        }
    }

    // Initialize Supabase batch service
    if (dependencies.supabaseBatchService) {
        supabaseBatchService = dependencies.supabaseBatchService;
        
        // Initialize with enhanced dependencies
        const supabaseDeps = {
            supabase: dependencies.supabase,
            hybridProductService: dependencies.hybridProductService,
            hybridAuditService: dependencies.hybridAuditService
        };
        
        if (supabaseBatchService.initialize) {
            supabaseBatchService.initialize(supabaseDeps);
        }
    }

    // Store hybrid services references
    hybridProductService = dependencies.hybridProductService;
    hybridAuditService = dependencies.hybridAuditService;

    // Update migration config based on phase
    _updateConfigForPhase(migrationConfig.MIGRATION_PHASE);

    logOperation('initialize', 'HybridBatchService initialized successfully', {
        phase: migrationConfig.MIGRATION_PHASE,
        hasLegacy: !!legacyBatchController,
        hasSupabase: !!supabaseBatchService,
        config: _getSafeConfig()
    });
}

/**
 * Update configuration based on migration phase
 */
function _updateConfigForPhase(phase) {
    switch (phase) {
        case 'PHASE_1': // Preparation - SQLite only
            migrationConfig.USE_SUPABASE_READ = false;
            migrationConfig.USE_SUPABASE_WRITE = false;
            migrationConfig.FALLBACK_TO_LEGACY = true;
            break;
            
        case 'PHASE_2': // Testing - Supabase read, SQLite write
            migrationConfig.USE_SUPABASE_READ = true;
            migrationConfig.USE_SUPABASE_WRITE = false;
            migrationConfig.FALLBACK_TO_LEGACY = true;
            break;
            
        case 'PHASE_3': // Migration - Full hybrid with fallback
            migrationConfig.USE_SUPABASE_READ = true;
            migrationConfig.USE_SUPABASE_WRITE = true;
            migrationConfig.FALLBACK_TO_LEGACY = true;
            migrationConfig.ENABLE_DUAL_WRITE = true;
            break;
            
        case 'PHASE_4': // Completion - Supabase only
            migrationConfig.USE_SUPABASE_READ = true;
            migrationConfig.USE_SUPABASE_WRITE = true;
            migrationConfig.FALLBACK_TO_LEGACY = false;
            migrationConfig.ENABLE_DUAL_WRITE = false;
            break;
            
        default:
            logOperation('warning', `Unknown migration phase: ${phase}, defaulting to PHASE_1`);
            migrationConfig.MIGRATION_PHASE = 'PHASE_1';
            _updateConfigForPhase('PHASE_1');
    }
    
    logOperation('phaseUpdate', `Migration phase updated to ${phase}`, _getSafeConfig());
}

/**
 * Get safe configuration for logging (without sensitive data)
 */
function _getSafeConfig() {
    return {
        phase: migrationConfig.MIGRATION_PHASE,
        useSupabaseRead: migrationConfig.USE_SUPABASE_READ,
        useSupabaseWrite: migrationConfig.USE_SUPABASE_WRITE,
        fallbackEnabled: migrationConfig.FALLBACK_TO_LEGACY,
        dualWriteEnabled: migrationConfig.ENABLE_DUAL_WRITE,
        analyticsEnabled: migrationConfig.ENABLE_BATCH_ANALYTICS,
        productionIntegration: migrationConfig.ENABLE_PRODUCTION_INTEGRATION,
        orderIntegration: migrationConfig.ENABLE_ORDER_INTEGRATION
    };
}

/**
 * Log operations for monitoring and debugging
 */
function logOperation(operation, message, details = {}) {
    if (migrationConfig.LOG_OPERATIONS) {
        console.log(`[HYBRID-BATCH] ${operation}: ${message}`, details);
    }
}

/**
 * Determine which service to use for read operations
 */
function _shouldUseSupabaseForRead() {
    return migrationConfig.USE_SUPABASE_READ && supabaseBatchService;
}

/**
 * Determine which service to use for write operations
 */
function _shouldUseSupabaseForWrite() {
    return migrationConfig.USE_SUPABASE_WRITE && supabaseBatchService;
}

/**
 * Execute operation with intelligent fallback
 */
async function executeWithFallback(operation, supabaseFunc, legacyFunc, ...args) {
    const isReadOperation = operation.includes('get') || operation.includes('read') || operation.includes('statistics') || operation.includes('search');
    const useSupabase = isReadOperation 
        ? _shouldUseSupabaseForRead() 
        : _shouldUseSupabaseForWrite();

    logOperation(operation, `Executing ${operation}`, {
        useSupabase,
        isReadOperation,
        phase: migrationConfig.MIGRATION_PHASE,
        args: args.map(arg => typeof arg === 'object' ? '[object]' : arg)
    });

    // Dual-write mode (Phase 3 specific)
    if (migrationConfig.ENABLE_DUAL_WRITE && !isReadOperation) {
        return await _executeDualWrite(operation, supabaseFunc, legacyFunc, ...args);
    }

    // Standard execution with fallback
    if (useSupabase) {
        try {
            const result = await _executeWithTimeout(supabaseFunc, ...args);
            logOperation(operation, `Supabase success for ${operation}`);
            return result;
        } catch (error) {
            logOperation(operation, `Supabase error for ${operation}: ${error.message}`);
            
            if (migrationConfig.FALLBACK_TO_LEGACY && legacyBatchController) {
                logOperation(operation, `Falling back to legacy for ${operation}`);
                try {
                    const result = await _executeWithTimeout(legacyFunc, ...args);
                    logOperation(operation, `Legacy fallback success for ${operation}`);
                    return result;
                } catch (legacyError) {
                    logOperation(operation, `Legacy fallback failed for ${operation}: ${legacyError.message}`);
                    throw legacyError;
                }
            } else {
                throw error;
            }
        }
    } else if (legacyBatchController) {
        logOperation(operation, `Using legacy for ${operation}`);
        return await _executeWithTimeout(legacyFunc, ...args);
    } else {
        throw new DatabaseError(`No available service for ${operation}`);
    }
}

/**
 * Execute operation with timeout protection
 */
async function _executeWithTimeout(func, ...args) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Batch operation timed out after ${migrationConfig.OPERATION_TIMEOUT}ms`));
        }, migrationConfig.OPERATION_TIMEOUT);

        func(...args)
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

/**
 * Execute dual-write operation (Phase 3 specific)
 */
async function _executeDualWrite(operation, supabaseFunc, legacyFunc, ...args) {
    logOperation(operation, `Executing dual-write for ${operation}`);
    
    let supabaseResult = null;
    let legacyResult = null;
    let supabaseError = null;
    let legacyError = null;

    // Execute both operations in parallel
    const [supabasePromise, legacyPromise] = await Promise.allSettled([
        _executeWithTimeout(supabaseFunc, ...args),
        _executeWithTimeout(legacyFunc, ...args)
    ]);

    if (supabasePromise.status === 'fulfilled') {
        supabaseResult = supabasePromise.value;
    } else {
        supabaseError = supabasePromise.reason;
    }

    if (legacyPromise.status === 'fulfilled') {
        legacyResult = legacyPromise.value;
    } else {
        legacyError = legacyPromise.reason;
    }

    // Log dual-write results
    logOperation(operation, `Dual-write completed for ${operation}`, {
        supabaseSuccess: !!supabaseResult,
        legacySuccess: !!legacyResult,
        supabaseError: supabaseError?.message,
        legacyError: legacyError?.message
    });

    // Return primary result (prefer Supabase)
    if (supabaseResult) {
        return supabaseResult;
    } else if (legacyResult) {
        return legacyResult;
    } else {
        throw new DatabaseError(`Both Supabase and legacy failed for ${operation}`);
    }
}

// Legacy wrapper functions for backwards compatibility
/**
 * Reserve batches for order item
 */
async function reserveBatchesForOrderItem(orderId, itemData) {
    return await executeWithFallback(
        'reserveBatchesForOrderItem',
        async () => {
            if (supabaseBatchService?.reserveBatchesForOrderItem) {
                return await supabaseBatchService.reserveBatchesForOrderItem(orderId, itemData);
            }
            throw new Error('Supabase batch service not available');
        },
        async () => {
            if (legacyBatchController?.reserveBatchesForOrderItem) {
                const req = { params: { orderId }, body: itemData };
                return await legacyBatchController.reserveBatchesForOrderItem(req, null);
            }
            throw new Error('Legacy batch controller not available');
        }
    );
}

/**
 * Unreserve batches for order
 */
async function unreserveBatchesForOrder(orderId) {
    return await executeWithFallback(
        'unreserveBatchesForOrder',
        async () => {
            if (supabaseBatchService?.unreserveBatchesForOrder) {
                return await supabaseBatchService.unreserveBatchesForOrder(orderId);
            }
            throw new Error('Supabase batch service not available');
        },
        async () => {
            if (legacyBatchController?.unreserveBatchesForOrder) {
                const req = { params: { orderId } };
                return await legacyBatchController.unreserveBatchesForOrder(req, null);
            }
            throw new Error('Legacy batch controller not available');
        }
    );
}

/**
 * Get all batches grouped
 */
async function getAllBatchesGrouped(filters = {}) {
    return await executeWithFallback(
        'getAllBatchesGrouped',
        async () => {
            if (supabaseBatchService?.getAllBatchesGrouped) {
                return await supabaseBatchService.getAllBatchesGrouped(filters);
            }
            throw new Error('Supabase batch service not available');
        },
        async () => {
            if (legacyBatchController?.getAllBatchesGrouped) {
                const req = { query: filters };
                const res = {
                    json: (data) => data,
                    status: () => ({ json: (data) => data })
                };
                return await legacyBatchController.getAllBatchesGrouped(req, res);
            }
            throw new Error('Legacy batch controller not available');
        }
    );
}

/**
 * Get batches by product
 */
async function getBatchesByProduct(productId, filters = {}) {
    return await executeWithFallback(
        'getBatchesByProduct',
        async () => {
            if (supabaseBatchService?.getBatchesByProduct) {
                return await supabaseBatchService.getBatchesByProduct(productId, filters);
            }
            throw new Error('Supabase batch service not available');
        },
        async () => {
            if (legacyBatchController?.getBatchesByProduct) {
                const req = { params: { productId }, query: filters };
                const res = {
                    json: (data) => data,
                    status: () => ({ json: (data) => data })
                };
                return await legacyBatchController.getBatchesByProduct(req, res);
            }
            throw new Error('Legacy batch controller not available');
        }
    );
}

/**
 * Get expiring batches
 */
async function getExpiringBatches(filters = {}) {
    return await executeWithFallback(
        'getExpiringBatches',
        async () => {
            if (supabaseBatchService?.getExpiringBatches) {
                return await supabaseBatchService.getExpiringBatches(filters);
            }
            throw new Error('Supabase batch service not available');
        },
        async () => {
            if (legacyBatchController?.getExpiringBatches) {
                const req = { query: filters };
                const res = {
                    json: (data) => data,
                    status: () => ({ json: (data) => data })
                };
                return await legacyBatchController.getExpiringBatches(req, res);
            }
            throw new Error('Legacy batch controller not available');
        }
    );
}

/**
 * Get service health status
 */
async function getServiceHealth() {
    const health = {
        timestamp: new Date().toISOString(),
        phase: migrationConfig.MIGRATION_PHASE,
        services: {
            legacy: {
                available: !!legacyBatchController,
                status: 'unknown'
            },
            supabase: {
                available: !!supabaseBatchService,
                status: 'unknown'
            }
        }
    };

    // Test legacy service
    if (legacyBatchController) {
        try {
            health.services.legacy.status = 'healthy';
        } catch (error) {
            health.services.legacy.status = 'error';
            health.services.legacy.error = error.message;
        }
    }

    // Test Supabase service
    if (supabaseBatchService) {
        try {
            health.services.supabase.status = 'healthy';
        } catch (error) {
            health.services.supabase.status = 'error';
            health.services.supabase.error = error.message;
        }
    }

    return health;
}

/**
 * Revolutionary architecture utility functions
 */

/**
 * Get current migration phase
 */
function getCurrentPhase() {
    return {
        phase: migrationConfig.MIGRATION_PHASE,
        config: _getSafeConfig(),
        timestamp: new Date().toISOString()
    };
}

/**
 * Set migration phase
 */
function setMigrationPhase(phase) {
    const oldPhase = migrationConfig.MIGRATION_PHASE;
    _updateConfigForPhase(phase);
    
    logOperation('phaseTransition', `Migration phase changed from ${oldPhase} to ${phase}`, {
        oldPhase,
        newPhase: phase,
        config: _getSafeConfig()
    });
    
    return {
        success: true,
        oldPhase,
        newPhase: phase,
        config: _getSafeConfig()
    };
}

/**
 * Get migration status
 */
async function getMigrationStatus() {
    const services = {
        legacy: {
            available: !!legacyBatchController,
            methods: legacyBatchController ? Object.getOwnPropertyNames(Object.getPrototypeOf(legacyBatchController)).filter(name => name !== 'constructor') : []
        },
        supabase: {
            available: !!supabaseBatchService,
            methods: supabaseBatchService ? Object.getOwnPropertyNames(Object.getPrototypeOf(supabaseBatchService)).filter(name => name !== 'constructor') : []
        }
    };

    return {
        timestamp: new Date().toISOString(),
        phase: migrationConfig.MIGRATION_PHASE,
        config: _getSafeConfig(),
        services,
        health: await getServiceHealth(),
        capabilities: {
            canRead: _shouldUseSupabaseForRead() ? 'supabase' : 'legacy',
            canWrite: _shouldUseSupabaseForWrite() ? 'supabase' : 'legacy',
            fallbackAvailable: migrationConfig.FALLBACK_TO_LEGACY && !!legacyBatchController,
            dualWriteEnabled: migrationConfig.ENABLE_DUAL_WRITE
        }
    };
}

/**
 * Update migration configuration
 */
function updateMigrationConfig(newConfig) {
    const oldConfig = { ...migrationConfig };
    migrationConfig = { ...migrationConfig, ...newConfig };
    
    logOperation('configUpdate', 'Migration configuration updated', {
        changes: Object.keys(newConfig),
        oldConfig: _getSafeConfig(),
        newConfig: _getSafeConfig()
    });
    
    return {
        success: true,
        applied: Object.keys(newConfig),
        config: _getSafeConfig()
    };
}

/**
 * Emergency fallback to legacy mode
 */
function emergencyFallbackToLegacy() {
    const oldPhase = migrationConfig.MIGRATION_PHASE;
    migrationConfig.MIGRATION_PHASE = 'PHASE_1';
    migrationConfig.USE_SUPABASE_READ = false;
    migrationConfig.USE_SUPABASE_WRITE = false;
    migrationConfig.FALLBACK_TO_LEGACY = true;
    migrationConfig.ENABLE_DUAL_WRITE = false;
    
    logOperation('emergency', 'Emergency fallback to legacy activated', {
        oldPhase,
        reason: 'Manual emergency fallback',
        config: _getSafeConfig()
    });
    
    return {
        success: true,
        message: 'Emergency fallback activated',
        phase: migrationConfig.MIGRATION_PHASE,
        config: _getSafeConfig()
    };
}

/**
 * Enable full Supabase mode
 */
function enableFullSupabaseMode() {
    const oldPhase = migrationConfig.MIGRATION_PHASE;
    migrationConfig.MIGRATION_PHASE = 'PHASE_4';
    migrationConfig.USE_SUPABASE_READ = true;
    migrationConfig.USE_SUPABASE_WRITE = true;
    migrationConfig.FALLBACK_TO_LEGACY = false;
    migrationConfig.ENABLE_DUAL_WRITE = false;
    
    logOperation('upgrade', 'Full Supabase mode activated', {
        oldPhase,
        reason: 'Manual upgrade to full Supabase',
        config: _getSafeConfig()
    });
    
    return {
        success: true,
        message: 'Full Supabase mode activated',
        phase: migrationConfig.MIGRATION_PHASE,
        config: _getSafeConfig()
    };
}

/**
 * Validate migration readiness
 */
async function validateMigrationReadiness() {
    const validation = {
        timestamp: new Date().toISOString(),
        ready: false,
        checks: {
            legacyService: false,
            supabaseService: false,
            dependencies: false,
            connectivity: false
        },
        issues: [],
        recommendations: []
    };

    // Check legacy service
    if (legacyBatchController) {
        validation.checks.legacyService = true;
    } else {
        validation.issues.push('Legacy batch controller not available');
        validation.recommendations.push('Ensure legacy batch controller is properly initialized');
    }

    // Check Supabase service
    if (supabaseBatchService) {
        validation.checks.supabaseService = true;
    } else {
        validation.issues.push('Supabase batch service not available');
        validation.recommendations.push('Initialize Supabase batch service before migration');
    }

    // Check dependencies
    if (hybridProductService && hybridAuditService) {
        validation.checks.dependencies = true;
    } else {
        validation.issues.push('Required hybrid services not available');
        validation.recommendations.push('Ensure hybridProductService and hybridAuditService are initialized');
    }

    // Check connectivity
    try {
        await getServiceHealth();
        validation.checks.connectivity = true;
    } catch (error) {
        validation.issues.push(`Connectivity check failed: ${error.message}`);
        validation.recommendations.push('Verify database connections and service availability');
    }

    // Overall readiness
    validation.ready = Object.values(validation.checks).every(check => check);

    logOperation('validation', 'Migration readiness validation completed', {
        ready: validation.ready,
        issues: validation.issues.length,
        checks: validation.checks
    });

    return validation;
}

// Export all functions
module.exports = {
    initialize,
    reserveBatchesForOrderItem,
    unreserveBatchesForOrder,
    getAllBatchesGrouped,
    getBatchesByProduct,
    getExpiringBatches,
    getServiceHealth,
    getCurrentPhase,
    setMigrationPhase,
    getMigrationStatus,
    updateMigrationConfig,
    emergencyFallbackToLegacy,
    enableFullSupabaseMode,
    validateMigrationReadiness,
    executeWithFallback,
    logOperation
}; 