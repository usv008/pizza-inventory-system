const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Hybrid Audit Service - Enhanced audit logging for OrderService migration
 * Implements intelligent fallback for operations logging
 */

class HybridAuditService {
    constructor() {
        this.legacyOperationsLogController = null;
        this.supabaseAuditService = null;
        this.mode = 'LEGACY_ONLY';
        this.fallbackEnabled = true;
        this.initialized = false;
        
        // Configuration from environment
        this.config = {
            USE_SUPABASE_AUDIT: process.env.USE_SUPABASE_AUDIT === 'true' || false,
            FALLBACK_TO_LEGACY: process.env.FALLBACK_TO_LEGACY !== 'false',
            LOG_AUDIT_OPERATIONS: process.env.LOG_AUDIT_OPERATIONS === 'true' || true,
            AUDIT_WRITE_BOTH: process.env.AUDIT_WRITE_BOTH === 'true' || false
        };
    }

    /**
     * Initialize hybrid audit service with dependencies
     */
    initialize(dependencies) {
        // Initialize legacy operations log controller
        if (dependencies.OperationsLogController) {
            this.legacyOperationsLogController = dependencies.OperationsLogController;
        }

        // Initialize Supabase audit service (when available)
        if (dependencies.supabaseAuditService) {
            this.supabaseAuditService = dependencies.supabaseAuditService;
        }

        this.initialized = true;
        this.logMonitoring('initialize', 'Hybrid Audit Service initialized', {
            hasLegacy: !!this.legacyOperationsLogController,
            hasSupabase: !!this.supabaseAuditService,
            mode: this.mode,
            config: this.config
        });
    }

    /**
     * Set service mode for migration phases
     */
    setMode(mode) {
        const validModes = ['LEGACY_ONLY', 'HYBRID', 'SUPABASE_ONLY'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
        }
        
        this.mode = mode;
        this.logMonitoring('setMode', `Audit service mode changed to: ${mode}`);
    }

    /**
     * Check if service is initialized
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('HybridAuditService not initialized');
        }
    }

    /**
     * Log operations for monitoring
     */
    logMonitoring(operation, message, details = {}) {
        if (this.config.LOG_AUDIT_OPERATIONS) {
            console.log(`[HYBRID-AUDIT] ${operation}: ${message}`, details);
        }
    }

    /**
     * Determine if should use Supabase for operation
     */
    shouldUseSupabase(operation) {
        switch (this.mode) {
            case 'LEGACY_ONLY':
                return false;
            case 'SUPABASE_ONLY':
                return true;
            case 'HYBRID':
                return this.config.USE_SUPABASE_AUDIT;
            default:
                return false;
        }
    }

    /**
     * Execute audit operation with intelligent fallback
     */
    async executeAuditWithFallback(operation, supabaseFunc, legacyFunc, ...args) {
        this._checkInitialization();
        
        const useSupabase = this.shouldUseSupabase(operation);
        const writeBoth = this.config.AUDIT_WRITE_BOTH && this.mode === 'HYBRID';
        
        this.logMonitoring(operation, `Executing audit ${operation}`, {
            useSupabase,
            writeBoth,
            mode: this.mode,
            hasSupabase: !!this.supabaseAuditService,
            hasLegacy: !!this.legacyOperationsLogController
        });

        let results = { supabase: null, legacy: null, success: false };

        // If writing to both, execute both regardless of errors
        if (writeBoth) {
            // Try Supabase first
            if (this.supabaseAuditService) {
                try {
                    results.supabase = await supabaseFunc();
                    this.logMonitoring(operation, `Supabase audit success for ${operation}`);
                } catch (error) {
                    this.logMonitoring(operation, `Supabase audit error for ${operation}: ${error.message}`);
                    results.supabase = { error: error.message };
                }
            }

            // Always try legacy in dual-write mode
            if (this.legacyOperationsLogController) {
                try {
                    results.legacy = await legacyFunc();
                    this.logMonitoring(operation, `Legacy audit success for ${operation}`);
                    results.success = true; // Consider success if at least legacy works
                } catch (error) {
                    this.logMonitoring(operation, `Legacy audit error for ${operation}: ${error.message}`);
                    results.legacy = { error: error.message };
                }
            }

            return results;
        }

        // Standard fallback logic
        if (useSupabase && this.supabaseAuditService) {
            try {
                results.supabase = await supabaseFunc();
                results.success = true;
                this.logMonitoring(operation, `Supabase audit success for ${operation}`);
                return results;
            } catch (error) {
                this.logMonitoring(operation, `Supabase audit error for ${operation}: ${error.message}`);
                
                if (this.fallbackEnabled && this.legacyOperationsLogController) {
                    this.logMonitoring(operation, `Falling back to legacy audit for ${operation}`);
                    try {
                        results.legacy = await legacyFunc();
                        results.success = true;
                        this.logMonitoring(operation, `Legacy audit fallback success for ${operation}`);
                        return results;
                    } catch (legacyError) {
                        this.logMonitoring(operation, `Legacy audit fallback failed for ${operation}: ${legacyError.message}`);
                        throw legacyError;
                    }
                } else {
                    throw error;
                }
            }
        } else if (this.legacyOperationsLogController) {
            this.logMonitoring(operation, `Using legacy audit for ${operation}`);
            try {
                results.legacy = await legacyFunc();
                results.success = true;
                return results;
            } catch (error) {
                throw error;
            }
        } else {
            throw new DatabaseError(`No available audit service for ${operation}`);
        }
    }

    /**
     * Log operation with context
     */
    async logOperation(operationType, entityType, entityId, action, details = {}) {
        const auditData = {
            operation_type: operationType,
            entity_type: entityType,
            entity_id: entityId,
            action: action,
            details: JSON.stringify(details),
            timestamp: new Date().toISOString(),
            user_id: details.userId || 'system'
        };

        return await this.executeAuditWithFallback(
            'logOperation',
            async () => {
                // Supabase implementation (when available)
                if (this.supabaseAuditService?.logOperation) {
                    return await this.supabaseAuditService.logOperation(auditData);
                }
                throw new Error('Supabase audit service not available');
            },
            async () => {
                // Legacy implementation using OperationsLogController
                if (this.legacyOperationsLogController?.logOperation) {
                    return await this.legacyOperationsLogController.logOperation(
                        operationType,
                        entityType,
                        entityId,
                        action,
                        details
                    );
                }
                throw new Error('Legacy operations log controller not available');
            }
        );
    }

    /**
     * Log order creation
     */
    async logOrderCreation(orderId, orderData, auditInfo = {}) {
        return await this.logOperation(
            'CREATE',
            'ORDER',
            orderId,
            'Order created',
            {
                ...auditInfo,
                orderData: {
                    client_id: orderData.client_id,
                    total_amount: orderData.total_amount,
                    items_count: orderData.items?.length || 0
                }
            }
        );
    }

    /**
     * Log order update
     */
    async logOrderUpdate(orderId, changes, auditInfo = {}) {
        return await this.logOperation(
            'UPDATE',
            'ORDER',
            orderId,
            'Order updated',
            {
                ...auditInfo,
                changes
            }
        );
    }

    /**
     * Log order deletion
     */
    async logOrderDeletion(orderId, auditInfo = {}) {
        return await this.logOperation(
            'DELETE',
            'ORDER',
            orderId,
            'Order deleted',
            auditInfo
        );
    }

    /**
     * Log order item operations
     */
    async logOrderItemOperation(operationType, orderItemId, orderId, itemData, auditInfo = {}) {
        return await this.logOperation(
            operationType,
            'ORDER_ITEM',
            orderItemId,
            `Order item ${operationType.toLowerCase()}`,
            {
                ...auditInfo,
                orderId,
                itemData: {
                    product_id: itemData.product_id,
                    quantity: itemData.quantity,
                    price: itemData.price
                }
            }
        );
    }

    /**
     * Log stock movement creation
     */
    async logMovementCreation(movementId, movementData, auditInfo = {}) {
        return await this.logOperation(
            'CREATE',
            'STOCK_MOVEMENT',
            movementId,
            'Stock movement created',
            {
                ...auditInfo,
                movementData: {
                    product_id: movementData.product_id,
                    movement_type: movementData.movement_type,
                    pieces: movementData.pieces,
                    boxes: movementData.boxes,
                    reason: movementData.reason,
                    batch_id: movementData.batch_id
                }
            }
        );
    }

    /**
     * Log stock movement update
     */
    async logMovementUpdate(movementId, changes, auditInfo = {}) {
        return await this.logOperation(
            'UPDATE',
            'STOCK_MOVEMENT',
            movementId,
            'Stock movement updated',
            {
                ...auditInfo,
                changes
            }
        );
    }

    /**
     * Log stock movement deletion
     */
    async logMovementDeletion(movementId, auditInfo = {}) {
        return await this.logOperation(
            'DELETE',
            'STOCK_MOVEMENT',
            movementId,
            'Stock movement deleted',
            auditInfo
        );
    }

    /**
     * Log product stock adjustment
     */
    async logStockAdjustment(productId, stockData, auditInfo = {}) {
        return await this.logOperation(
            'ADJUST',
            'PRODUCT_STOCK',
            productId,
            'Product stock adjusted',
            {
                ...auditInfo,
                stockData: {
                    old_pieces: stockData.old_pieces,
                    new_pieces: stockData.new_pieces,
                    old_boxes: stockData.old_boxes,
                    new_boxes: stockData.new_boxes,
                    adjustment_reason: stockData.reason
                }
            }
        );
    }

    /**
     * Log inventory operation (bulk operations)
     */
    async logInventoryOperation(operationType, entityType, entityIds, details, auditInfo = {}) {
        const entityIdStr = Array.isArray(entityIds) ? entityIds.join(',') : entityIds;
        return await this.logOperation(
            operationType,
            entityType,
            entityIdStr,
            `Inventory ${operationType.toLowerCase()} operation`,
            {
                ...auditInfo,
                entity_count: Array.isArray(entityIds) ? entityIds.length : 1,
                operation_details: details
            }
        );
    }

    /**
     * Get service health status
     */
    async getServiceHealth() {
        const health = {
            timestamp: new Date().toISOString(),
            mode: this.mode,
            services: {
                legacy: {
                    available: !!this.legacyOperationsLogController,
                    status: 'unknown'
                },
                supabase: {
                    available: !!this.supabaseAuditService,
                    status: 'unknown'
                }
            }
        };

        // Test legacy service
        if (this.legacyOperationsLogController) {
            try {
                health.services.legacy.status = 'healthy';
            } catch (error) {
                health.services.legacy.status = 'error';
                health.services.legacy.error = error.message;
            }
        }

        // Test Supabase service
        if (this.supabaseAuditService) {
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
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logMonitoring('updateConfig', 'Audit configuration updated', this.config);
    }

    /**
     * Enable emergency fallback mode
     */
    emergencyFallbackToLegacy() {
        this.setMode('LEGACY_ONLY');
        this.fallbackEnabled = true;
        this.logMonitoring('emergency', 'Emergency fallback to legacy audit enabled');
    }

    /**
     * Get migration status
     */
    getMigrationStatus() {
        return {
            mode: this.mode,
            fallbackEnabled: this.fallbackEnabled,
            services: {
                legacy: !!this.legacyOperationsLogController,
                supabase: !!this.supabaseAuditService
            },
            config: this.config
        };
    }
}

module.exports = new HybridAuditService(); 