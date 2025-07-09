const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Movement Service - Revolutionary architecture for inventory migration
 * Implements intelligent fallback between legacy MovementService and SupabaseMovementService
 * Features: 4-phase migration, configuration-driven behavior, perfect fallback capabilities
 */

let legacyMovementService = null;
let supabaseMovementService = null;
let hybridProductService = null;
let hybridAuditService = null;

// Migration configuration with 4-phase approach
let migrationConfig = {
    // Phase configuration
    MIGRATION_PHASE: process.env.MOVEMENT_MIGRATION_PHASE || 'PHASE_1',
    
    // Phase-specific settings
    USE_SUPABASE_READ: process.env.USE_SUPABASE_MOVEMENT_READ === 'true' || false,
    USE_SUPABASE_WRITE: process.env.USE_SUPABASE_MOVEMENT_WRITE === 'true' || false,
    FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false',
    
    // Advanced options
    LOG_OPERATIONS: process.env.LOG_HYBRID_MOVEMENT_OPERATIONS === 'true' || true,
    ENABLE_DUAL_WRITE: process.env.ENABLE_DUAL_WRITE_MOVEMENTS === 'true' || false,
    VALIDATE_CROSS_DB: process.env.VALIDATE_CROSS_DB_MOVEMENTS === 'true' || false,
    
    // Performance settings
    OPERATION_TIMEOUT: parseInt(process.env.MOVEMENT_OPERATION_TIMEOUT) || 30000,
    MAX_RETRY_ATTEMPTS: parseInt(process.env.MOVEMENT_MAX_RETRIES) || 3
};

/**
 * Initialize hybrid movement service with dependencies
 */
function initialize(dependencies) {
    // Initialize legacy movement service
    if (dependencies.legacyMovementService) {
        legacyMovementService = dependencies.legacyMovementService;
        
        // Pass dependencies to legacy service
        const legacyDeps = {
            movementsQueries: dependencies.movementsQueries,
            productQueries: dependencies.productQueries,
            OperationsLogController: dependencies.OperationsLogController
        };
        
        if (legacyMovementService.initialize) {
            legacyMovementService.initialize(legacyDeps);
        }
    }

    // Initialize Supabase movement service
    if (dependencies.supabaseMovementService) {
        supabaseMovementService = dependencies.supabaseMovementService;
        
        // Initialize with enhanced dependencies
        const supabaseDeps = {
            supabase: dependencies.supabase,
            hybridProductService: dependencies.hybridProductService,
            hybridAuditService: dependencies.hybridAuditService
        };
        
        if (supabaseMovementService.initialize) {
            supabaseMovementService.initialize(supabaseDeps);
        }
    }

    // Store hybrid services references
    hybridProductService = dependencies.hybridProductService;
    hybridAuditService = dependencies.hybridAuditService;

    // Update migration config based on phase
    _updateConfigForPhase(migrationConfig.MIGRATION_PHASE);

    logOperation('initialize', 'HybridMovementService initialized successfully', {
        phase: migrationConfig.MIGRATION_PHASE,
        hasLegacy: !!legacyMovementService,
        hasSupabase: !!supabaseMovementService,
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
        dualWriteEnabled: migrationConfig.ENABLE_DUAL_WRITE
    };
}

/**
 * Log operations for monitoring and debugging
 */
function logOperation(operation, message, details = {}) {
    if (migrationConfig.LOG_OPERATIONS) {
        console.log(`[HYBRID-MOVEMENT] ${operation}: ${message}`, details);
    }
}

/**
 * Determine which service to use for read operations
 */
function _shouldUseSupabaseForRead() {
    return migrationConfig.USE_SUPABASE_READ && supabaseMovementService;
}

/**
 * Determine which service to use for write operations
 */
function _shouldUseSupabaseForWrite() {
    return migrationConfig.USE_SUPABASE_WRITE && supabaseMovementService;
}

/**
 * Execute operation with intelligent fallback
 */
async function executeWithFallback(operation, supabaseFunc, legacyFunc, ...args) {
    const isReadOperation = operation.includes('get') || operation.includes('read');
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
            
            if (migrationConfig.FALLBACK_TO_LEGACY && legacyMovementService) {
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
    } else if (legacyMovementService) {
        logOperation(operation, `Using legacy service for ${operation}`);
        return await _executeWithTimeout(legacyFunc, ...args);
    } else {
        throw new DatabaseError(`No available service for ${operation}`);
    }
}

/**
 * Execute operation with timeout protection
 */
async function _executeWithTimeout(func, ...args) {
    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Operation timeout after ${migrationConfig.OPERATION_TIMEOUT}ms`));
        }, migrationConfig.OPERATION_TIMEOUT);

        try {
            const result = await func(...args);
            clearTimeout(timeout);
            resolve(result);
        } catch (error) {
            clearTimeout(timeout);
            reject(error);
        }
    });
}

/**
 * Execute dual-write operation (write to both services)
 */
async function _executeDualWrite(operation, supabaseFunc, legacyFunc, ...args) {
    const results = { supabase: null, legacy: null, errors: [] };
    
    logOperation('dualWrite', `Executing dual-write for ${operation}`);

    // Execute both operations concurrently
    const operations = [];
    
    if (supabaseMovementService) {
        operations.push(
            _executeWithTimeout(supabaseFunc, ...args)
                .then(result => { results.supabase = result; })
                .catch(error => { results.errors.push({ service: 'supabase', error: error.message }); })
        );
    }
    
    if (legacyMovementService) {
        operations.push(
            _executeWithTimeout(legacyFunc, ...args)
                .then(result => { results.legacy = result; })
                .catch(error => { results.errors.push({ service: 'legacy', error: error.message }); })
        );
    }

    await Promise.allSettled(operations);

    // Determine result
    if (results.supabase && results.legacy) {
        logOperation('dualWrite', `Dual-write success for ${operation}`);
        return results.supabase; // Prefer Supabase result
    } else if (results.supabase) {
        logOperation('dualWrite', `Dual-write partial success (Supabase only) for ${operation}`);
        return results.supabase;
    } else if (results.legacy) {
        logOperation('dualWrite', `Dual-write partial success (Legacy only) for ${operation}`);
        return results.legacy;
    } else {
        const errorMsg = `Dual-write failed for ${operation}: ${JSON.stringify(results.errors)}`;
        logOperation('dualWrite', errorMsg);
        throw new DatabaseError(errorMsg);
    }
}

/**
 * Get all movements with advanced filtering
 */
async function getAllMovements(filters = {}) {
    return await executeWithFallback(
        'getAllMovements',
        async () => supabaseMovementService?.getAllMovements?.(filters),
        async () => legacyMovementService?.getAllMovements?.(filters),
        filters
    );
}

/**
 * Create new movement with transaction support
 */
async function createMovement(movementData, requestInfo = {}) {
    return await executeWithFallback(
        'createMovement',
        async () => supabaseMovementService?.createMovement?.(movementData, requestInfo),
        async () => legacyMovementService?.createMovement?.(movementData, requestInfo),
        movementData,
        requestInfo
    );
}

/**
 * Update movement with controlled changes
 */
async function updateMovement(id, updateData, requestInfo = {}) {
    return await executeWithFallback(
        'updateMovement',
        async () => supabaseMovementService?.updateMovement?.(id, updateData, requestInfo),
        async () => legacyMovementService?.updateMovement?.(id, updateData, requestInfo),
        id,
        updateData,
        requestInfo
    );
}

/**
 * Delete movement with stock reversal
 */
async function deleteMovement(id, requestInfo = {}) {
    return await executeWithFallback(
        'deleteMovement',
        async () => supabaseMovementService?.deleteMovement?.(id, requestInfo),
        async () => legacyMovementService?.deleteMovement?.(id, requestInfo),
        id,
        requestInfo
    );
}

/**
 * Get movements by product
 */
async function getMovementsByProduct(productId, filters = {}) {
    return await executeWithFallback(
        'getMovementsByProduct',
        async () => supabaseMovementService?.getMovementsByProduct?.(productId, filters),
        async () => legacyMovementService?.getMovementsByProduct?.(productId, filters),
        productId,
        filters
    );
}

/**
 * Get movement statistics
 */
async function getMovementStatistics(options = {}) {
    return await executeWithFallback(
        'getMovementStatistics',
        async () => supabaseMovementService?.getMovementStatistics?.(options),
        async () => legacyMovementService?.getMovementStatistics?.(options),
        options
    );
}

/**
 * Export movements (enhanced method)
 */
async function exportMovements(filters = {}) {
    return await executeWithFallback(
        'exportMovements',
        async () => supabaseMovementService?.exportMovements?.(filters),
        async () => legacyMovementService?.exportMovements?.(filters),
        filters
    );
}

/**
 * Import movements (enhanced method)
 */
async function importMovements(movementsData, options = {}) {
    return await executeWithFallback(
        'importMovements',
        async () => supabaseMovementService?.importMovements?.(movementsData, options),
        async () => legacyMovementService?.importMovements?.(movementsData, options),
        movementsData,
        options
    );
}

/**
 * Get current migration phase
 */
function getCurrentPhase() {
    return migrationConfig.MIGRATION_PHASE;
}

/**
 * Set migration phase
 */
function setMigrationPhase(phase) {
    const validPhases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4'];
    if (!validPhases.includes(phase)) {
        throw new Error(`Invalid migration phase: ${phase}. Valid phases: ${validPhases.join(', ')}`);
    }
    
    const oldPhase = migrationConfig.MIGRATION_PHASE;
    migrationConfig.MIGRATION_PHASE = phase;
    _updateConfigForPhase(phase);
    
    logOperation('phaseChange', `Migration phase changed from ${oldPhase} to ${phase}`, _getSafeConfig());
    return { oldPhase, newPhase: phase, config: _getSafeConfig() };
}

/**
 * Get migration status and service health
 */
async function getMigrationStatus() {
    const status = {
        service: 'HybridMovementService',
        phase: migrationConfig.MIGRATION_PHASE,
        config: _getSafeConfig(),
        services: {
            legacy: {
                available: !!legacyMovementService,
                status: 'unknown'
            },
            supabase: {
                available: !!supabaseMovementService,
                status: 'unknown'
            }
        },
        dependencies: {
            hybridProductService: !!hybridProductService,
            hybridAuditService: !!hybridAuditService
        },
        timestamp: new Date().toISOString()
    };

    // Test service connectivity
    if (legacyMovementService) {
        try {
            await legacyMovementService.getAllMovements({ limit: 1 });
            status.services.legacy.status = 'healthy';
        } catch (error) {
            status.services.legacy.status = 'error';
            status.services.legacy.error = error.message;
        }
    }

    if (supabaseMovementService) {
        try {
            const supabaseStatus = await supabaseMovementService.getMigrationStatus?.();
            status.services.supabase.status = supabaseStatus?.connectivity || 'unknown';
            if (supabaseStatus?.error) {
                status.services.supabase.error = supabaseStatus.error;
            }
        } catch (error) {
            status.services.supabase.status = 'error';
            status.services.supabase.error = error.message;
        }
    }

    return status;
}

/**
 * Update migration configuration
 */
function updateMigrationConfig(newConfig) {
    const oldConfig = { ...migrationConfig };
    migrationConfig = { ...migrationConfig, ...newConfig };
    
    // Re-apply phase configuration if phase changed
    if (newConfig.MIGRATION_PHASE && newConfig.MIGRATION_PHASE !== oldConfig.MIGRATION_PHASE) {
        _updateConfigForPhase(newConfig.MIGRATION_PHASE);
    }
    
    logOperation('configUpdate', 'Migration configuration updated', {
        oldConfig: _getSafeConfig(),
        newConfig: _getSafeConfig()
    });
    
    return migrationConfig;
}

/**
 * Test connectivity to both services
 */
async function testConnectivity() {
    const results = { legacy: false, supabase: false, errors: [] };

    // Test legacy service
    if (legacyMovementService) {
        try {
            await legacyMovementService.getAllMovements({ limit: 1 });
            results.legacy = true;
            logOperation('connectivity', 'Legacy service connectivity: OK');
        } catch (error) {
            results.errors.push({ service: 'legacy', error: error.message });
            logOperation('connectivity', `Legacy service connectivity: ERROR - ${error.message}`);
        }
    }

    // Test Supabase service
    if (supabaseMovementService) {
        try {
            await supabaseMovementService.getAllMovements({ limit: 1 });
            results.supabase = true;
            logOperation('connectivity', 'Supabase service connectivity: OK');
        } catch (error) {
            results.errors.push({ service: 'supabase', error: error.message });
            logOperation('connectivity', `Supabase service connectivity: ERROR - ${error.message}`);
        }
    }

    return results;
}

/**
 * Emergency fallback to legacy only
 */
function emergencyFallbackToLegacy() {
    logOperation('emergency', 'Emergency fallback to legacy activated');
    
    const oldPhase = migrationConfig.MIGRATION_PHASE;
    migrationConfig.MIGRATION_PHASE = 'PHASE_1';
    migrationConfig.USE_SUPABASE_READ = false;
    migrationConfig.USE_SUPABASE_WRITE = false;
    migrationConfig.FALLBACK_TO_LEGACY = true;
    migrationConfig.ENABLE_DUAL_WRITE = false;
    
    return {
        action: 'emergency_fallback',
        oldPhase,
        newPhase: 'PHASE_1',
        timestamp: new Date().toISOString()
    };
}

/**
 * Enable full Supabase mode
 */
function enableFullSupabaseMode() {
    logOperation('migration', 'Full Supabase mode activated');
    
    const oldPhase = migrationConfig.MIGRATION_PHASE;
    migrationConfig.MIGRATION_PHASE = 'PHASE_4';
    migrationConfig.USE_SUPABASE_READ = true;
    migrationConfig.USE_SUPABASE_WRITE = true;
    migrationConfig.FALLBACK_TO_LEGACY = false;
    migrationConfig.ENABLE_DUAL_WRITE = false;
    
    return {
        action: 'full_supabase_mode',
        oldPhase,
        newPhase: 'PHASE_4',
        timestamp: new Date().toISOString()
    };
}

/**
 * Validate migration readiness
 */
async function validateMigrationReadiness() {
    const validation = {
        ready: false,
        checks: {
            legacyService: false,
            supabaseService: false,
            connectivity: false,
            dataConsistency: false
        },
        errors: [],
        timestamp: new Date().toISOString()
    };

    try {
        // Check legacy service
        if (legacyMovementService) {
            await legacyMovementService.getAllMovements({ limit: 1 });
            validation.checks.legacyService = true;
        } else {
            validation.errors.push('Legacy movement service not available');
        }

        // Check Supabase service
        if (supabaseMovementService) {
            await supabaseMovementService.getAllMovements({ limit: 1 });
            validation.checks.supabaseService = true;
        } else {
            validation.errors.push('Supabase movement service not available');
        }

        // Check connectivity
        const connectivity = await testConnectivity();
        validation.checks.connectivity = connectivity.legacy && connectivity.supabase;
        if (!validation.checks.connectivity) {
            validation.errors.push('Connectivity issues detected');
        }

        // Basic data consistency check (compare record counts)
        if (validation.checks.legacyService && validation.checks.supabaseService) {
            try {
                const legacyResult = await legacyMovementService.getAllMovements({ limit: 1000 });
                const supabaseResult = await supabaseMovementService.getAllMovements({ limit: 1000 });
                
                const legacyCount = legacyResult?.data?.length || 0;
                const supabaseCount = supabaseResult?.data?.length || 0;
                
                // Allow some variance in counts (new records might be added)
                validation.checks.dataConsistency = Math.abs(legacyCount - supabaseCount) <= 10;
                
                if (!validation.checks.dataConsistency) {
                    validation.errors.push(`Data count mismatch: Legacy(${legacyCount}) vs Supabase(${supabaseCount})`);
                }
            } catch (error) {
                validation.errors.push(`Data consistency check failed: ${error.message}`);
            }
        }

        // Overall readiness
        validation.ready = Object.values(validation.checks).every(check => check === true);

    } catch (error) {
        validation.errors.push(`Migration validation failed: ${error.message}`);
    }

    logOperation('validation', `Migration readiness: ${validation.ready ? 'READY' : 'NOT READY'}`, {
        checks: validation.checks,
        errorCount: validation.errors.length
    });

    return validation;
}

module.exports = {
    initialize,
    getAllMovements,
    createMovement,
    updateMovement,
    deleteMovement,
    getMovementsByProduct,
    getMovementStatistics,
    exportMovements,
    importMovements,
    getCurrentPhase,
    setMigrationPhase,
    getMigrationStatus,
    updateMigrationConfig,
    testConnectivity,
    emergencyFallbackToLegacy,
    enableFullSupabaseMode,
    validateMigrationReadiness,
    logOperation
}; 