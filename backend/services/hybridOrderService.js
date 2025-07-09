const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Order Service - Enhanced hybrid integration for OrderService migration
 * Combines SupabaseOrderService with legacy OrderService using intelligent fallback
 * Implements all 14 methods with configuration-driven behavior and dependency integration
 */

let legacyOrderService = null;
let supabaseOrderService = null;
let hybridBatchService = null;
let hybridAuditService = null;

let migrationConfig = {
    // Migration phase configuration
    USE_SUPABASE_ORDER_READ: process.env.USE_SUPABASE_ORDER_READ === 'true' || false,
    USE_SUPABASE_ORDER_WRITE: process.env.USE_SUPABASE_ORDER_WRITE === 'true' || false,
    FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false', // Default true
    LOG_OPERATIONS: process.env.LOG_HYBRID_OPERATIONS === 'true' || true,
    ORDER_MIGRATION_PHASE: process.env.ORDER_MIGRATION_PHASE || 'PHASE_1'
};

class HybridOrderService {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize hybrid order service with all dependencies
     */
    initialize(dependencies) {
        // Initialize legacy order service
        if (dependencies.legacyOrderService) {
            legacyOrderService = dependencies.legacyOrderService;
            const legacyDeps = {
                orderQueries: dependencies.orderQueries,
                productQueries: dependencies.productQueries,
                batchController: dependencies.batchController,
                OperationsLogController: dependencies.OperationsLogController
            };
            legacyOrderService.initialize(legacyDeps);
        }

        // Initialize Supabase order service
        if (dependencies.supabaseOrderService) {
            supabaseOrderService = dependencies.supabaseOrderService;
            const supabaseDeps = {
                hybridBatchService: dependencies.hybridBatchService,
                hybridAuditService: dependencies.hybridAuditService
            };
            supabaseOrderService.initialize(supabaseDeps);
        }

        // Initialize hybrid dependency services
        if (dependencies.hybridBatchService) {
            hybridBatchService = dependencies.hybridBatchService;
            const batchDeps = {
                legacyBatchController: dependencies.batchController,
                supabaseBatchService: dependencies.supabaseBatchService // When available
            };
            hybridBatchService.initialize(batchDeps);
        }

        if (dependencies.hybridAuditService) {
            hybridAuditService = dependencies.hybridAuditService;
            const auditDeps = {
                OperationsLogController: dependencies.OperationsLogController,
                supabaseAuditService: dependencies.supabaseAuditService // When available
            };
            hybridAuditService.initialize(auditDeps);
        }

        this.initialized = true;
        
        // Configure migration phase
        this.configureMigrationPhase();
        
        this.logOperation('initialize', 'Hybrid Order Service initialized', {
            hasLegacy: !!legacyOrderService,
            hasSupabase: !!supabaseOrderService,
            phase: migrationConfig.ORDER_MIGRATION_PHASE,
            config: migrationConfig
        });
    }

    /**
     * Configure services based on migration phase
     */
    configureMigrationPhase() {
        const phase = migrationConfig.ORDER_MIGRATION_PHASE;
        
        this.logOperation('configureMigrationPhase', `Configuring for ${phase}`);
        
        switch (phase) {
            case 'PHASE_1': // SQLite only - preparation phase
                migrationConfig.USE_SUPABASE_ORDER_READ = false;
                migrationConfig.USE_SUPABASE_ORDER_WRITE = false;
                hybridBatchService?.setMode('LEGACY_ONLY');
                hybridAuditService?.setMode('LEGACY_ONLY');
                break;
                
            case 'PHASE_2': // Supabase read + SQLite write - testing phase
                migrationConfig.USE_SUPABASE_ORDER_READ = true;
                migrationConfig.USE_SUPABASE_ORDER_WRITE = false;
                hybridBatchService?.setMode('HYBRID_READ');
                hybridAuditService?.setMode('HYBRID');
                break;
                
            case 'PHASE_3': // Full hybrid with fallback - migration phase
                migrationConfig.USE_SUPABASE_ORDER_READ = true;
                migrationConfig.USE_SUPABASE_ORDER_WRITE = true;
                hybridBatchService?.setMode('HYBRID_WRITE');
                hybridAuditService?.setMode('HYBRID');
                break;
                
            case 'PHASE_4': // Supabase only - completion phase
                migrationConfig.USE_SUPABASE_ORDER_READ = true;
                migrationConfig.USE_SUPABASE_ORDER_WRITE = true;
                hybridBatchService?.setMode('SUPABASE_ONLY');
                hybridAuditService?.setMode('SUPABASE_ONLY');
                break;
                
            default:
                console.warn(`[HYBRID-ORDER] Unknown migration phase: ${phase}, defaulting to PHASE_1`);
                migrationConfig.USE_SUPABASE_ORDER_READ = false;
                migrationConfig.USE_SUPABASE_ORDER_WRITE = false;
        }
        
        this.logOperation('configureMigrationPhase', `Phase ${phase} configured`, {
            useSupabaseRead: migrationConfig.USE_SUPABASE_ORDER_READ,
            useSupabaseWrite: migrationConfig.USE_SUPABASE_ORDER_WRITE,
            batchMode: hybridBatchService?.getMigrationStatus?.()?.mode,
            auditMode: hybridAuditService?.getMigrationStatus?.()?.mode
        });
    }

    /**
     * Check initialization
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('HybridOrderService not initialized');
        }
    }

    /**
     * Log operations for monitoring
     */
    logOperation(operation, message, details = {}) {
        if (migrationConfig.LOG_OPERATIONS) {
            console.log(`[HYBRID-ORDER] ${operation}: ${message}`, details);
        }
    }

    /**
     * Execute order operation with intelligent fallback
     */
    async executeOrderOperation(operation, supabaseFunc, legacyFunc, ...args) {
        this._checkInitialization();
        
        const useSupabase = operation.includes('read') || operation.includes('get') || operation.includes('search')
            ? migrationConfig.USE_SUPABASE_ORDER_READ 
            : migrationConfig.USE_SUPABASE_ORDER_WRITE;

        this.logOperation(operation, `Executing ${operation}`, { 
            useSupabase, 
            phase: migrationConfig.ORDER_MIGRATION_PHASE,
            args: args.map(arg => typeof arg === 'object' ? '[object]' : arg) 
        });

        if (useSupabase && supabaseOrderService) {
            try {
                const result = await supabaseFunc(...args);
                this.logOperation(operation, `Supabase success for ${operation}`);
                return result;
            } catch (error) {
                this.logOperation(operation, `Supabase error for ${operation}: ${error.message}`);
                
                if (migrationConfig.FALLBACK_TO_LEGACY && legacyOrderService) {
                    this.logOperation(operation, `Falling back to legacy for ${operation}`);
                    try {
                        const result = await legacyFunc(...args);
                        this.logOperation(operation, `Legacy fallback success for ${operation}`);
                        return result;
                    } catch (legacyError) {
                        this.logOperation(operation, `Legacy fallback failed for ${operation}: ${legacyError.message}`);
                        throw legacyError;
                    }
                } else {
                    throw error;
                }
            }
        } else if (legacyOrderService) {
            this.logOperation(operation, `Using legacy for ${operation}`);
            return await legacyFunc(...args);
        } else {
            throw new DatabaseError(`No available service for ${operation}`);
        }
    }

    /**
     * 1. Get all orders
     */
    async getAllOrders(filters = {}) {
        return await this.executeOrderOperation(
            'getAllOrders',
            () => supabaseOrderService?.getAllOrders(filters),
            () => legacyOrderService?.getAllOrders(filters),
            filters
        );
    }

    /**
     * 2. Get order by ID
     */
    async getOrderById(orderId) {
        return await this.executeOrderOperation(
            'getOrderById',
            () => supabaseOrderService?.getOrderById(orderId),
            () => legacyOrderService?.getOrderById(orderId),
            orderId
        );
    }

    /**
     * 3. Get order for edit
     */
    async getOrderForEdit(orderId) {
        return await this.executeOrderOperation(
            'getOrderForEdit',
            () => supabaseOrderService?.getOrderForEdit(orderId),
            () => legacyOrderService?.getOrderForEdit(orderId),
            orderId
        );
    }

    /**
     * 4. Create order
     */
    async createOrder(orderData, auditInfo = {}) {
        return await this.executeOrderOperation(
            'createOrder',
            () => supabaseOrderService?.createOrder(orderData, auditInfo),
            () => legacyOrderService?.createOrder(orderData, auditInfo),
            orderData,
            auditInfo
        );
    }

    /**
     * 5. Update order
     */
    async updateOrder(orderId, orderData, auditInfo = {}) {
        return await this.executeOrderOperation(
            'updateOrder',
            () => supabaseOrderService?.updateOrder(orderId, orderData, auditInfo),
            () => legacyOrderService?.updateOrder(orderId, orderData, auditInfo),
            orderId,
            orderData,
            auditInfo
        );
    }

    /**
     * 6. Update order status
     */
    async updateOrderStatus(orderId, status, auditInfo = {}) {
        return await this.executeOrderOperation(
            'updateOrderStatus',
            () => supabaseOrderService?.updateOrderStatus(orderId, status, auditInfo),
            () => legacyOrderService?.updateOrderStatus(orderId, status, auditInfo),
            orderId,
            status,
            auditInfo
        );
    }

    /**
     * 7. Cancel order
     */
    async cancelOrder(orderId, auditInfo = {}) {
        return await this.executeOrderOperation(
            'cancelOrder',
            () => supabaseOrderService?.cancelOrder(orderId, auditInfo),
            () => legacyOrderService?.cancelOrder(orderId, auditInfo),
            orderId,
            auditInfo
        );
    }

    /**
     * 8. Delete order
     */
    async deleteOrder(orderId, auditInfo = {}) {
        return await this.executeOrderOperation(
            'deleteOrder',
            () => supabaseOrderService?.deleteOrder(orderId, auditInfo),
            () => legacyOrderService?.deleteOrder(orderId, auditInfo),
            orderId,
            auditInfo
        );
    }

    /**
     * 9. Reserve batches for order
     */
    async reserveBatchesForOrder(orderId, auditInfo = {}) {
        return await this.executeOrderOperation(
            'reserveBatchesForOrder',
            () => supabaseOrderService?.reserveBatchesForOrder(orderId, auditInfo),
            () => legacyOrderService?.reserveBatchesForOrder(orderId, auditInfo),
            orderId,
            auditInfo
        );
    }

    /**
     * 10. Unreserve batches for order
     */
    async unreserveBatchesForOrder(orderId, auditInfo = {}) {
        return await this.executeOrderOperation(
            'unreserveBatchesForOrder',
            () => supabaseOrderService?.unreserveBatchesForOrder(orderId, auditInfo),
            () => legacyOrderService?.unreserveBatchesForOrder(orderId, auditInfo),
            orderId,
            auditInfo
        );
    }

    /**
     * 11. Get order statistics
     */
    async getOrderStats(period = 'month') {
        return await this.executeOrderOperation(
            'getOrderStats',
            () => supabaseOrderService?.getOrderStats(period),
            () => legacyOrderService?.getOrderStats(period),
            period
        );
    }

    /**
     * Dual write order operation (for specific migration scenarios)
     */
    async dualWriteOrder(operation, ...args) {
        this._checkInitialization();
        
        const results = { supabase: null, legacy: null, success: false };
        
        this.logOperation('dualWrite', `Dual writing ${operation}`, { args: args.length });

        // Try Supabase first
        if (supabaseOrderService) {
            try {
                results.supabase = await supabaseOrderService[operation](...args);
                this.logOperation('dualWrite', `Supabase success for dual write ${operation}`);
            } catch (error) {
                this.logOperation('dualWrite', `Supabase error for dual write ${operation}: ${error.message}`);
                results.supabase = { error: error.message };
            }
        }

        // Always try legacy in dual-write mode
        if (legacyOrderService) {
            try {
                results.legacy = await legacyOrderService[operation](...args);
                this.logOperation('dualWrite', `Legacy success for dual write ${operation}`);
                results.success = true; // Consider success if at least legacy works
            } catch (error) {
                this.logOperation('dualWrite', `Legacy error for dual write ${operation}: ${error.message}`);
                results.legacy = { error: error.message };
            }
        }

        if (!results.success) {
            throw new DatabaseError(`Dual write failed for ${operation}`);
        }

        return results;
    }

    /**
     * Get migration status
     */
    getMigrationStatus() {
        return {
            initialized: this.initialized,
            phase: migrationConfig.ORDER_MIGRATION_PHASE,
            configuration: migrationConfig,
            services: {
                legacy: !!legacyOrderService,
                supabase: !!supabaseOrderService,
                hybridBatch: !!hybridBatchService,
                hybridAudit: !!hybridAuditService
            },
            serviceStatus: {
                legacy: legacyOrderService?.initialized || false,
                supabase: supabaseOrderService?.getMigrationStatus?.() || null,
                hybridBatch: hybridBatchService?.getMigrationStatus?.() || null,
                hybridAudit: hybridAuditService?.getMigrationStatus?.() || null
            }
        };
    }

    /**
     * Update migration configuration
     */
    updateMigrationConfig(newConfig) {
        migrationConfig = { ...migrationConfig, ...newConfig };
        this.configureMigrationPhase();
        this.logOperation('updateConfig', 'Migration configuration updated', migrationConfig);
    }

    /**
     * Set migration phase
     */
    setMigrationPhase(phase) {
        migrationConfig.ORDER_MIGRATION_PHASE = phase;
        this.configureMigrationPhase();
        this.logOperation('setPhase', `Migration phase set to: ${phase}`);
    }

    /**
     * Test connectivity of all services
     */
    async testConnectivity() {
        const results = {
            timestamp: new Date().toISOString(),
            legacy: { available: false, status: 'unknown' },
            supabase: { available: false, status: 'unknown' },
            hybridBatch: { available: false, status: 'unknown' },
            hybridAudit: { available: false, status: 'unknown' }
        };

        // Test legacy service
        if (legacyOrderService) {
            try {
                await legacyOrderService.getAllOrders({ limit: 1 });
                results.legacy = { available: true, status: 'healthy' };
            } catch (error) {
                results.legacy = { available: true, status: 'error', error: error.message };
            }
        }

        // Test Supabase service
        if (supabaseOrderService) {
            try {
                await supabaseOrderService.getAllOrders({ limit: 1 });
                results.supabase = { available: true, status: 'healthy' };
            } catch (error) {
                results.supabase = { available: true, status: 'error', error: error.message };
            }
        }

        // Test hybrid services
        if (hybridBatchService) {
            try {
                results.hybridBatch = await hybridBatchService.getServiceHealth();
                results.hybridBatch.available = true;
            } catch (error) {
                results.hybridBatch = { available: true, status: 'error', error: error.message };
            }
        }

        if (hybridAuditService) {
            try {
                results.hybridAudit = await hybridAuditService.getServiceHealth();
                results.hybridAudit.available = true;
            } catch (error) {
                results.hybridAudit = { available: true, status: 'error', error: error.message };
            }
        }

        return results;
    }

    /**
     * Emergency fallback to legacy only
     */
    emergencyFallbackToLegacy() {
        migrationConfig.USE_SUPABASE_ORDER_READ = false;
        migrationConfig.USE_SUPABASE_ORDER_WRITE = false;
        migrationConfig.FALLBACK_TO_LEGACY = true;
        migrationConfig.ORDER_MIGRATION_PHASE = 'EMERGENCY_LEGACY';
        
        hybridBatchService?.emergencyFallbackToLegacy();
        hybridAuditService?.emergencyFallbackToLegacy();
        
        this.logOperation('emergency', 'Emergency fallback to legacy enabled');
    }

    /**
     * Enable full Supabase mode
     */
    enableFullSupabaseMode() {
        migrationConfig.USE_SUPABASE_ORDER_READ = true;
        migrationConfig.USE_SUPABASE_ORDER_WRITE = true;
        migrationConfig.ORDER_MIGRATION_PHASE = 'PHASE_4';
        
        this.configureMigrationPhase();
        this.logOperation('enableSupabase', 'Full Supabase mode enabled');
    }

    /**
     * Validate migration readiness
     */
    async validateMigrationReadiness() {
        const connectivity = await this.testConnectivity();
        const status = this.getMigrationStatus();
        
        const readiness = {
            ready: true,
            issues: [],
            recommendations: [],
            services: connectivity,
            configuration: status
        };

        // Check Supabase connectivity
        if (!connectivity.supabase.available || connectivity.supabase.status !== 'healthy') {
            readiness.ready = false;
            readiness.issues.push('Supabase service not healthy');
        }

        // Check hybrid services
        if (!connectivity.hybridBatch.available) {
            readiness.ready = false;
            readiness.issues.push('Hybrid batch service not available');
        }

        if (!connectivity.hybridAudit.available) {
            readiness.ready = false;
            readiness.issues.push('Hybrid audit service not available');
        }

        // Add recommendations based on current phase
        const phase = migrationConfig.ORDER_MIGRATION_PHASE;
        if (phase === 'PHASE_1') {
            readiness.recommendations.push('Consider moving to PHASE_2 for read testing');
        } else if (phase === 'PHASE_2' && connectivity.supabase.status === 'healthy') {
            readiness.recommendations.push('Supabase reads working, consider PHASE_3 for write testing');
        } else if (phase === 'PHASE_3' && connectivity.supabase.status === 'healthy') {
            readiness.recommendations.push('Full hybrid working, consider PHASE_4 for Supabase-only');
        }

        return readiness;
    }
}

module.exports = new HybridOrderService(); 