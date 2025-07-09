const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Production Service - Revolutionary architecture for production migration
 * Implements intelligent fallback between legacy ProductionService and SupabaseProductionService
 * Features: 4-phase migration, configuration-driven behavior, perfect fallback capabilities
 */

let legacyProductionService = null;
let supabaseProductionService = null;
let hybridProductService = null;
let hybridAuditService = null;

// Migration configuration with 4-phase approach
let migrationConfig = {
    // Phase configuration
    MIGRATION_PHASE: process.env.PRODUCTION_MIGRATION_PHASE || 'PHASE_1',
    
    // Phase-specific settings
    USE_SUPABASE_READ: process.env.USE_SUPABASE_PRODUCTION_READ === 'true' || false,
    USE_SUPABASE_WRITE: process.env.USE_SUPABASE_PRODUCTION_WRITE === 'true' || false,
    FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false',
    
    // Advanced options
    LOG_OPERATIONS: process.env.LOG_HYBRID_PRODUCTION_OPERATIONS === 'true' || true,
    ENABLE_DUAL_WRITE: process.env.ENABLE_DUAL_WRITE_PRODUCTION === 'true' || false,
    VALIDATE_CROSS_DB: process.env.VALIDATE_CROSS_DB_PRODUCTION === 'true' || false,
    
    // Performance settings
    OPERATION_TIMEOUT: parseInt(process.env.PRODUCTION_OPERATION_TIMEOUT) || 30000,
    MAX_RETRY_ATTEMPTS: parseInt(process.env.PRODUCTION_MAX_RETRIES) || 3,
    
    // Production-specific settings
    ENABLE_PRODUCTION_ANALYTICS: process.env.ENABLE_PRODUCTION_ANALYTICS !== 'false',
    ENABLE_INVENTORY_INTEGRATION: process.env.ENABLE_PRODUCTION_INVENTORY_INTEGRATION !== 'false'
};

/**
 * Initialize hybrid production service with dependencies
 */
function initialize(dependencies) {
    // Initialize legacy production service
    if (dependencies.legacyProductionService) {
        legacyProductionService = dependencies.legacyProductionService;
        
        // Pass dependencies to legacy service
        const legacyDeps = {
            productionQueries: dependencies.productionQueries,
            productQueries: dependencies.productQueries,
            OperationsLogController: dependencies.OperationsLogController
        };
        
        if (legacyProductionService.initialize) {
            legacyProductionService.initialize(legacyDeps);
        }
    }

    // Initialize Supabase production service
    if (dependencies.supabaseProductionService) {
        supabaseProductionService = dependencies.supabaseProductionService;
        
        // Initialize with enhanced dependencies
        const supabaseDeps = {
            supabase: dependencies.supabase,
            hybridProductService: dependencies.hybridProductService,
            hybridAuditService: dependencies.hybridAuditService
        };
        
        if (supabaseProductionService.initialize) {
            supabaseProductionService.initialize(supabaseDeps);
        }
    }

    // Store hybrid services references
    hybridProductService = dependencies.hybridProductService;
    hybridAuditService = dependencies.hybridAuditService;

    // Update migration config based on phase
    _updateConfigForPhase(migrationConfig.MIGRATION_PHASE);

    logOperation('initialize', 'HybridProductionService initialized successfully', {
        phase: migrationConfig.MIGRATION_PHASE,
        hasLegacy: !!legacyProductionService,
        hasSupabase: !!supabaseProductionService,
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
        analyticsEnabled: migrationConfig.ENABLE_PRODUCTION_ANALYTICS,
        inventoryIntegration: migrationConfig.ENABLE_INVENTORY_INTEGRATION
    };
}

/**
 * Log operations for monitoring and debugging
 */
function logOperation(operation, message, details = {}) {
    if (migrationConfig.LOG_OPERATIONS) {
        console.log(`[HYBRID-PRODUCTION] ${operation}: ${message}`, details);
    }
}

/**
 * Determine which service to use for read operations
 */
function _shouldUseSupabaseForRead() {
    return migrationConfig.USE_SUPABASE_READ && supabaseProductionService;
}

/**
 * Determine which service to use for write operations
 */
function _shouldUseSupabaseForWrite() {
    return migrationConfig.USE_SUPABASE_WRITE && supabaseProductionService;
}

/**
 * Execute operation with intelligent fallback
 */
async function executeWithFallback(operation, supabaseFunc, legacyFunc, ...args) {
    const isReadOperation = operation.includes('get') || operation.includes('read') || operation.includes('statistics');
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
            
            if (migrationConfig.FALLBACK_TO_LEGACY && legacyProductionService) {
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
    } else {
        // Use legacy service
        if (legacyProductionService) {
            try {
                const result = await _executeWithTimeout(legacyFunc, ...args);
                logOperation(operation, `Legacy success for ${operation}`);
                return result;
            } catch (error) {
                logOperation(operation, `Legacy error for ${operation}: ${error.message}`);
                throw error;
            }
        } else {
            throw new DatabaseError(`No available service for ${operation}`);
        }
    }
}

/**
 * Execute operation with timeout protection
 */
async function _executeWithTimeout(func, ...args) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Operation timed out after ${migrationConfig.OPERATION_TIMEOUT}ms`));
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

    // Attempt Supabase operation
    try {
        supabaseResult = await _executeWithTimeout(supabaseFunc, ...args);
        logOperation(operation, `Supabase dual-write success for ${operation}`);
    } catch (error) {
        supabaseError = error;
        logOperation(operation, `Supabase dual-write failed for ${operation}: ${error.message}`);
    }

    // Attempt legacy operation
    try {
        legacyResult = await _executeWithTimeout(legacyFunc, ...args);
        logOperation(operation, `Legacy dual-write success for ${operation}`);
    } catch (error) {
        legacyError = error;
        logOperation(operation, `Legacy dual-write failed for ${operation}: ${error.message}`);
    }

    // Determine result based on success
    if (supabaseResult && legacyResult) {
        logOperation(operation, `Dual-write success for ${operation}`);
        return supabaseResult; // Prefer Supabase result
    } else if (supabaseResult) {
        logOperation(operation, `Partial dual-write success (Supabase only) for ${operation}`);
        return supabaseResult;
    } else if (legacyResult) {
        logOperation(operation, `Partial dual-write success (Legacy only) for ${operation}`);
        return legacyResult;
    } else {
        logOperation(operation, `Dual-write failed for ${operation}`);
        throw supabaseError || legacyError || new Error(`Dual-write operation failed for ${operation}`);
    }
}

// ========================================================================================
// CORE PRODUCTION METHODS - Revolutionary hybrid implementation
// ========================================================================================

/**
 * Get all production records with enhanced filtering and statistics
 */
async function getAllProduction(filters = {}) {
    return executeWithFallback(
        'getAllProduction',
        () => supabaseProductionService.getAllProduction(filters),
        () => legacyProductionService.getAllProduction(filters),
        filters
    );
}

/**
 * Get production records by product ID with enhanced data
 */
async function getProductionByProductId(productId) {
    return executeWithFallback(
        'getProductionByProductId',
        () => supabaseProductionService.getProductionByProductId(productId),
        () => legacyProductionService.getProductionByProductId(productId),
        productId
    );
}

/**
 * Create production record with inventory integration and audit trail
 */
async function createProduction(productionData, req = null) {
    // Enhanced production data with request context
    const requestInfo = req ? {
        user: req.user?.name || req.user?.username || 'Unknown',
        ip: req.ip,
        userAgent: req.get('User-Agent')
    } : {};

    return executeWithFallback(
        'createProduction',
        () => supabaseProductionService.createProduction(productionData, requestInfo),
        () => legacyProductionService.createProduction(productionData, req),
        productionData,
        req
    );
}

/**
 * Update production record with audit trail  
 */
async function updateProduction(id, updateData, req = null) {
    const requestInfo = req ? {
        user: req.user?.name || req.user?.username || 'Unknown',
        ip: req.ip,
        userAgent: req.get('User-Agent')
    } : {};

    return executeWithFallback(
        'updateProduction',
        () => supabaseProductionService.updateProduction(id, updateData, requestInfo),
        () => legacyProductionService.updateProduction ? 
              legacyProductionService.updateProduction(id, updateData, req) :
              Promise.reject(new Error('Update operation not supported by legacy service')),
        id,
        updateData,
        req
    );
}

/**
 * Delete production record with validation and audit trail
 */
async function deleteProduction(id, req = null) {
    const requestInfo = req ? {
        user: req.user?.name || req.user?.username || 'Unknown',
        ip: req.ip,
        userAgent: req.get('User-Agent')
    } : {};

    return executeWithFallback(
        'deleteProduction',
        () => supabaseProductionService.deleteProduction(id, requestInfo),
        () => legacyProductionService.deleteProduction ? 
              legacyProductionService.deleteProduction(id, req) :
              Promise.reject(new Error('Delete operation not supported by legacy service')),
        id,
        req
    );
}

/**
 * Get production statistics with advanced analytics
 */
async function getProductionStatistics(startDate, endDate) {
    // Enhanced statistics with hybrid capabilities
    if (migrationConfig.ENABLE_PRODUCTION_ANALYTICS && _shouldUseSupabaseForRead()) {
        return executeWithFallback(
            'getProductionStatistics',
            () => supabaseProductionService.getProductionStatistics(startDate, endDate, {
                includeProductBreakdown: true,
                includeTrends: true,
                includeEfficiency: true
            }),
            () => legacyProductionService.getProductionStatistics(startDate, endDate),
            startDate,
            endDate
        );
    } else {
        return executeWithFallback(
            'getProductionStatistics',
            () => supabaseProductionService.getProductionStatistics(startDate, endDate),
            () => legacyProductionService.getProductionStatistics(startDate, endDate),
            startDate,
            endDate
        );
    }
}

// ========================================================================================
// MIGRATION MANAGEMENT METHODS - Enhanced phase control
// ========================================================================================

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
 * Set migration phase with validation
 */
function setMigrationPhase(phase) {
    const validPhases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4'];
    
    if (!validPhases.includes(phase)) {
        throw new Error(`Invalid migration phase: ${phase}. Valid phases: ${validPhases.join(', ')}`);
    }
    
    const previousPhase = migrationConfig.MIGRATION_PHASE;
    migrationConfig.MIGRATION_PHASE = phase;
    _updateConfigForPhase(phase);
    
    logOperation('phaseChange', `Migration phase changed from ${previousPhase} to ${phase}`, {
        previousPhase,
        newPhase: phase,
        config: _getSafeConfig()
    });
    
    return {
        success: true,
        previousPhase,
        newPhase: phase,
        config: _getSafeConfig()
    };
}

/**
 * Get comprehensive migration status
 */
async function getMigrationStatus() {
    const status = {
        initialized: true,
        phase: migrationConfig.MIGRATION_PHASE,
        configuration: _getSafeConfig(),
        services: {
            legacy: {
                available: !!legacyProductionService,
                initialized: legacyProductionService?.initialized || false
            },
            supabase: {
                available: !!supabaseProductionService,
                initialized: supabaseProductionService?.initialized || false
            }
        },
        dependencies: {
            hybridProductService: !!hybridProductService,
            hybridAuditService: !!hybridAuditService
        },
        timestamp: new Date().toISOString()
    };

    // Get service-specific status
    try {
        if (supabaseProductionService && supabaseProductionService.getMigrationStatus) {
            status.services.supabase.details = await supabaseProductionService.getMigrationStatus();
        }
    } catch (error) {
        status.services.supabase.error = error.message;
    }

    try {
        if (legacyProductionService && legacyProductionService.getMigrationStatus) {
            status.services.legacy.details = await legacyProductionService.getMigrationStatus();
        }
    } catch (error) {
        status.services.legacy.error = error.message;
    }

    return status;
}

/**
 * Update migration configuration
 */
function updateMigrationConfig(newConfig) {
    const updatedFields = [];
    
    Object.keys(newConfig).forEach(key => {
        if (migrationConfig.hasOwnProperty(key)) {
            const oldValue = migrationConfig[key];
            migrationConfig[key] = newConfig[key];
            updatedFields.push({ key, oldValue, newValue: newConfig[key] });
        }
    });
    
    logOperation('configUpdate', 'Migration configuration updated', {
        updatedFields,
        newConfig: _getSafeConfig()
    });
    
    return {
        success: true,
        updatedFields,
        currentConfig: _getSafeConfig()
    };
}

/**
 * Test connectivity to both services
 */
async function testConnectivity() {
    const results = {
        legacy: { available: false, error: null },
        supabase: { available: false, error: null },
        timestamp: new Date().toISOString()
    };

    // Test legacy service
    if (legacyProductionService) {
        try {
            await legacyProductionService.getAllProduction({ limit: 1 });
            results.legacy.available = true;
        } catch (error) {
            results.legacy.error = error.message;
        }
    }

    // Test Supabase service
    if (supabaseProductionService) {
        try {
            await supabaseProductionService.getAllProduction({ limit: 1 });
            results.supabase.available = true;
        } catch (error) {
            results.supabase.error = error.message;
        }
    }

    logOperation('connectivity', 'Connectivity test completed', results);
    return results;
}

/**
 * Emergency fallback to legacy service
 */
function emergencyFallbackToLegacy() {
    const previousConfig = { ...migrationConfig };
    
    migrationConfig.USE_SUPABASE_READ = false;
    migrationConfig.USE_SUPABASE_WRITE = false;
    migrationConfig.FALLBACK_TO_LEGACY = true;
    migrationConfig.ENABLE_DUAL_WRITE = false;
    
    logOperation('emergency', 'Emergency fallback to legacy activated', {
        previousConfig: _getSafeConfig(),
        reason: 'Manual emergency procedure'
    });
    
    return {
        success: true,
        message: 'Emergency fallback to legacy activated',
        previousConfig,
        currentConfig: _getSafeConfig()
    };
}

/**
 * Enable full Supabase mode (Phase 4)
 */
function enableFullSupabaseMode() {
    const previousConfig = { ...migrationConfig };
    
    migrationConfig.MIGRATION_PHASE = 'PHASE_4';
    migrationConfig.USE_SUPABASE_READ = true;
    migrationConfig.USE_SUPABASE_WRITE = true;
    migrationConfig.FALLBACK_TO_LEGACY = false;
    migrationConfig.ENABLE_DUAL_WRITE = false;
    
    logOperation('fullSupabase', 'Full Supabase mode enabled', {
        previousConfig,
        currentConfig: _getSafeConfig()
    });
    
    return {
        success: true,
        message: 'Full Supabase mode enabled (Phase 4)',
        previousConfig,
        currentConfig: _getSafeConfig()
    };
}

/**
 * Validate migration readiness for next phase
 */
async function validateMigrationReadiness() {
    const validation = {
        ready: false,
        currentPhase: migrationConfig.MIGRATION_PHASE,
        checks: {},
        recommendations: [],
        timestamp: new Date().toISOString()
    };

    // Service availability checks
    validation.checks.legacyAvailable = !!legacyProductionService;
    validation.checks.supabaseAvailable = !!supabaseProductionService;
    validation.checks.dependenciesAvailable = !!(hybridProductService && hybridAuditService);

    // Connectivity checks
    try {
        const connectivity = await testConnectivity();
        validation.checks.legacyConnectivity = connectivity.legacy.available;
        validation.checks.supabaseConnectivity = connectivity.supabase.available;
    } catch (error) {
        validation.checks.connectivityTestFailed = error.message;
    }

    // Phase-specific readiness checks
    switch (migrationConfig.MIGRATION_PHASE) {
        case 'PHASE_1':
            validation.checks.phase1Ready = validation.checks.legacyAvailable && validation.checks.legacyConnectivity;
            if (!validation.checks.phase1Ready) {
                validation.recommendations.push('Ensure legacy production service is available and connected');
            }
            break;
            
        case 'PHASE_2':
            validation.checks.phase2Ready = validation.checks.supabaseConnectivity && validation.checks.legacyConnectivity;
            if (!validation.checks.phase2Ready) {
                validation.recommendations.push('Ensure both legacy and Supabase services are connected for Phase 2');
            }
            break;
            
        case 'PHASE_3':
            validation.checks.phase3Ready = validation.checks.supabaseConnectivity && 
                                           validation.checks.legacyConnectivity && 
                                           validation.checks.dependenciesAvailable;
            if (!validation.checks.phase3Ready) {
                validation.recommendations.push('Ensure all services and dependencies are available for Phase 3 dual-write');
            }
            break;
            
        case 'PHASE_4':
            validation.checks.phase4Ready = validation.checks.supabaseConnectivity && validation.checks.dependenciesAvailable;
            if (!validation.checks.phase4Ready) {
                validation.recommendations.push('Ensure Supabase service and dependencies are available for Phase 4');
            }
            break;
    }

    // Overall readiness determination
    const currentPhaseCheck = validation.checks[`${migrationConfig.MIGRATION_PHASE.toLowerCase()}Ready`];
    validation.ready = currentPhaseCheck === true;

    if (validation.ready) {
        validation.recommendations.push(`${migrationConfig.MIGRATION_PHASE} is ready for operation`);
    }

    logOperation('readinessValidation', 'Migration readiness validation completed', validation);
    return validation;
}

// ========================================================================================
// MODULE EXPORTS - Complete hybrid production service interface
// ========================================================================================

module.exports = {
    // Service lifecycle
    initialize,
    
    // Core production methods
    getAllProduction,
    getProductionByProductId,
    createProduction,
    updateProduction,
    deleteProduction,
    getProductionStatistics,
    
    // Migration management
    getCurrentPhase,
    setMigrationPhase,
    getMigrationStatus,
    updateMigrationConfig,
    
    // Service health & monitoring
    testConnectivity,
    validateMigrationReadiness,
    
    // Emergency procedures
    emergencyFallbackToLegacy,
    enableFullSupabaseMode,
    
    // Internal utilities (for testing)
    _getSafeConfig,
    _updateConfigForPhase
}; 