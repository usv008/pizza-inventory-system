const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');
const SupabaseBatchQueries = require('../database/supabaseBatchQueries');

/**
 * Supabase Batch Service - Revolutionary architecture for batch management
 * Implements all BatchController methods with enhanced capabilities for business operations
 * Features: Multi-table transactions, batch analytics, production integration, audit trail
 */

class SupabaseBatchService {
    constructor() {
        this.supabase = null;
        this.supabaseBatchQueries = null;
        this.hybridProductService = null;
        this.hybridAuditService = null;
        this.initialized = false;
        
        // Configuration for optimization
        this.config = {
            ENABLE_BATCH_OPERATIONS: true,
            ENABLE_TRANSACTION_SIMULATION: true,
            ENABLE_COMPREHENSIVE_VALIDATION: true,
            ENABLE_PRODUCTION_INTEGRATION: true,
            ENABLE_ORDER_INTEGRATION: true,
            ENABLE_ADVANCED_ANALYTICS: true,
            MAX_RETRY_ATTEMPTS: 3,
            OPERATION_TIMEOUT: 30000,
            DEFAULT_RESPONSIBLE: 'System'
        };
        
        // Batch domain configuration
        this.batchConfig = {
            MIN_BATCH_QUANTITY: 0,
            MAX_BATCH_QUANTITY: 100000,
            MAX_RESERVATION_DAYS: 30,
            BATCH_EXPIRY_WARNING_DAYS: 7,
            STATISTICS_CACHE_TTL: 300000, // 5 minutes
            BATCH_SIZE_LIMIT: 100,
            MIN_AVAILABILITY_THRESHOLD: 0.1
        };
        
        console.log('📦 SupabaseBatchService instantiated');
    }

    /**
     * Initialize service with dependencies
     */
    initialize(dependencies) {
        if (!dependencies.supabase) {
            throw new DatabaseError('Supabase client is required for SupabaseBatchService');
        }

        this.supabase = dependencies.supabase;
        this.supabaseBatchQueries = new SupabaseBatchQueries(this.supabase);
        this.hybridProductService = dependencies.hybridProductService;
        this.hybridAuditService = dependencies.hybridAuditService;
        this.initialized = true;

        this.logOperation('initialize', 'SupabaseBatchService initialized successfully', {
            hasSupabase: !!this.supabase,
            hasProductService: !!this.hybridProductService,
            hasAuditService: !!this.hybridAuditService,
            config: this.config,
            batchConfig: this.batchConfig
        });
    }

    /**
     * Check initialization status
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('SupabaseBatchService not initialized');
        }
    }

    /**
     * Log operations for monitoring
     */
    logOperation(operation, message, details = {}) {
        console.log(`[SUPABASE-BATCH] ${operation}: ${message}`, details);
    }

    /**
     * Multi-table transaction simulation with compensating actions for batch operations
     */
    async _executeBatchTransaction(operation, operations, rollbackOperations = []) {
        const transactionId = `batch_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logOperation('transaction', `Starting ${operation} transaction: ${transactionId}`);
        
        const completed = [];
        const results = {};
        
        try {
            // Execute operations in sequence with tracking
            for (let i = 0; i < operations.length; i++) {
                const op = operations[i];
                this.logOperation('transaction', `Executing operation ${i + 1}/${operations.length}: ${op.name}`, {
                    transactionId,
                    operation: op.name
                });
                
                const result = await this._executeWithTimeout(op.execute, this.config.OPERATION_TIMEOUT);
                results[op.name] = result;
                completed.push(op);
                
                this.logOperation('transaction', `Operation ${op.name} completed successfully`, {
                    transactionId,
                    operation: op.name,
                    result: this._sanitizeLogData(result)
                });
            }
            
            this.logOperation('transaction', `Transaction ${transactionId} completed successfully`);
            return results;
            
        } catch (error) {
            this.logOperation('transaction', `Transaction ${transactionId} failed: ${error.message}`, {
                transactionId,
                error: error.message,
                completedOperations: completed.map(op => op.name)
            });
            
            // Execute compensating actions in reverse order
            if (rollbackOperations.length > 0) {
                this.logOperation('transaction', `Executing ${rollbackOperations.length} rollback operations for ${transactionId}`);
                
                for (let i = rollbackOperations.length - 1; i >= 0; i--) {
                    const rollbackOp = rollbackOperations[i];
                    try {
                        await this._executeWithTimeout(rollbackOp.execute, this.config.OPERATION_TIMEOUT);
                        this.logOperation('transaction', `Rollback operation ${rollbackOp.name} completed`, {
                            transactionId
                        });
                    } catch (rollbackError) {
                        this.logOperation('transaction', `Rollback operation ${rollbackOp.name} failed: ${rollbackError.message}`, {
                            transactionId,
                            rollbackError: rollbackError.message
                        });
                    }
                }
            }
            
            throw new DatabaseError(`Batch transaction failed: ${error.message}`);
        }
    }

    /**
     * Execute operation with timeout protection
     */
    async _executeWithTimeout(operation, timeout = this.config.OPERATION_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeout}ms`));
            }, timeout);

            operation()
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
     * Sanitize data for logging (remove sensitive information)
     */
    _sanitizeLogData(data) {
        if (!data || typeof data !== 'object') return data;
        
        const sanitized = { ...data };
        // Remove potentially large fields for cleaner logs
        if (sanitized.data && Array.isArray(sanitized.data) && sanitized.data.length > 5) {
            sanitized.data = `[${sanitized.data.length} items]`;
        }
        return sanitized;
    }

    /**
     * Enhanced batch data validation with business rules
     */
    async _validateBatchData(batchData, operation = 'create') {
        const errors = [];

        // Required fields validation
        if (!batchData.product_id) {
            errors.push('product_id is required');
        }

        if (batchData.total_quantity === undefined || batchData.total_quantity === null) {
            errors.push('total_quantity is required');
        }

        if (!batchData.production_date && operation === 'create') {
            errors.push('production_date is required for new batches');
        }

        // Business rules validation
        if (batchData.total_quantity !== undefined) {
            if (batchData.total_quantity < this.batchConfig.MIN_BATCH_QUANTITY) {
                errors.push(`total_quantity must be at least ${this.batchConfig.MIN_BATCH_QUANTITY}`);
            }

            if (batchData.total_quantity > this.batchConfig.MAX_BATCH_QUANTITY) {
                errors.push(`total_quantity cannot exceed ${this.batchConfig.MAX_BATCH_QUANTITY}`);
            }
        }

        // Validate expiry date if provided
        if (batchData.expiry_date) {
            const expiryDate = new Date(batchData.expiry_date);
            const today = new Date();
            
            if (expiryDate <= today) {
                errors.push('expiry_date must be in the future');
            }
        }

        // Validate quantities consistency
        if (batchData.reserved_quantity !== undefined && batchData.available_quantity !== undefined && batchData.total_quantity !== undefined) {
            const calculatedTotal = (batchData.reserved_quantity || 0) + (batchData.available_quantity || 0);
            if (Math.abs(calculatedTotal - batchData.total_quantity) > 0.01) {
                errors.push('reserved_quantity + available_quantity must equal total_quantity');
            }
        }

        // Product existence validation (if product service available)
        if (batchData.product_id && this.hybridProductService) {
            try {
                const product = await this.hybridProductService.getProductById(batchData.product_id);
                if (!product) {
                    errors.push(`Product with ID ${batchData.product_id} does not exist`);
                }
            } catch (error) {
                this.logOperation('validation', `Product validation failed: ${error.message}`);
                errors.push('Unable to validate product existence');
            }
        }

        if (errors.length > 0) {
            throw new DatabaseError(`Batch validation failed: ${errors.join(', ')}`);
        }

        return true;
    }

    /**
     * Log batch operation for audit trail
     */
    async _logBatchOperation(operation, batchData, result, requestInfo = {}) {
        if (!this.hybridAuditService) {
            this.logOperation('audit', 'Audit service not available, skipping operation log');
            return;
        }

        try {
            const logEntry = {
                operation: operation,
                table_name: 'production_batches',
                record_id: result?.id || batchData?.id || 'unknown',
                old_values: operation === 'update' ? (requestInfo.oldData || {}) : null,
                new_values: operation === 'delete' ? null : (result || batchData),
                changed_by: requestInfo.user || this.config.DEFAULT_RESPONSIBLE,
                operation_details: {
                    operation_type: operation,
                    batch_id: result?.id || batchData?.id,
                    product_id: batchData?.product_id,
                    quantity_affected: batchData?.total_quantity || batchData?.quantity,
                    request_source: requestInfo.source || 'batch_service',
                    operation_context: this._generateOperationDescription(operation, batchData, result)
                }
            };

            await this.hybridAuditService.logDatabaseOperation(logEntry);
            this.logOperation('audit', `Batch operation logged: ${operation}`, {
                recordId: logEntry.record_id,
                operation: operation
            });

        } catch (error) {
            this.logOperation('audit', `Failed to log batch operation: ${error.message}`, {
                operation,
                error: error.message
            });
        }
    }

    /**
     * Generate human-readable operation description
     */
    _generateOperationDescription(operation, batchData, result) {
        const productId = batchData?.product_id || result?.product_id || 'unknown';
        const quantity = batchData?.total_quantity || batchData?.quantity || result?.total_quantity || 'unknown';
        
        switch (operation) {
            case 'create':
                return `Created new batch for product ${productId} with quantity ${quantity}`;
            case 'update':
                return `Updated batch for product ${productId}`;
            case 'delete':
                return `Deleted batch for product ${productId}`;
            case 'reserve':
                return `Reserved ${quantity} units from batches for product ${productId}`;
            case 'unreserve':
                return `Released reservations for product ${productId}`;
            default:
                return `Performed ${operation} on batch for product ${productId}`;
        }
    }

    /**
     * Get all batches grouped by product with enhanced filtering and analytics
     */
    async getAllBatchesGrouped(filters = {}) {
        this._checkInitialization();
        this.logOperation('getAllBatchesGrouped', 'Fetching all batches grouped by product', { filters });

        try {
            const result = await this.supabaseBatchQueries.getAllBatchesGrouped(filters);
            
            this.logOperation('getAllBatchesGrouped', 'Successfully fetched grouped batches', {
                totalGroups: result?.data?.length || 0,
                filters
            });

            // Enhance with analytics if enabled
            if (this.config.ENABLE_ADVANCED_ANALYTICS && result?.data) {
                result.analytics = this._calculateBatchGroupAnalytics(result.data);
            }

            return result;

        } catch (error) {
            this.logOperation('getAllBatchesGrouped', `Failed to fetch grouped batches: ${error.message}`, { error: error.message });
            throw new DatabaseError(`Failed to fetch grouped batches: ${error.message}`);
        }
    }

    /**
     * Get batches by product with detailed information
     */
    async getBatchesByProduct(productId, filters = {}) {
        this._checkInitialization();
        this.logOperation('getBatchesByProduct', `Fetching batches for product ${productId}`, { productId, filters });

        try {
            // Validate product exists if product service available
            if (this.hybridProductService) {
                const product = await this.hybridProductService.getProductById(productId);
                if (!product) {
                    throw new NotFoundError(`Product with ID ${productId} not found`);
                }
            }

            const result = await this.supabaseBatchQueries.getBatchesByProduct(productId, filters);
            
            this.logOperation('getBatchesByProduct', `Successfully fetched batches for product ${productId}`, {
                productId,
                batchCount: result?.data?.length || 0,
                totalQuantity: result?.data?.reduce((sum, batch) => sum + (batch.total_quantity || 0), 0) || 0
            });

            // Enhance with product-specific analytics
            if (this.config.ENABLE_ADVANCED_ANALYTICS && result?.data) {
                result.analytics = this._calculateProductBatchAnalytics(result.data, productId);
            }

            return result;

        } catch (error) {
            this.logOperation('getBatchesByProduct', `Failed to fetch batches for product ${productId}: ${error.message}`, { 
                productId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get expiring batches with advanced warning system
     */
    async getExpiringBatches(filters = {}) {
        this._checkInitialization();
        this.logOperation('getExpiringBatches', 'Fetching expiring batches', { filters });

        try {
            // Set default expiry warning period if not specified
            const warningDays = filters.days || this.batchConfig.BATCH_EXPIRY_WARNING_DAYS;
            
            const result = await this.supabaseBatchQueries.getExpiringBatches({
                ...filters,
                days: warningDays
            });
            
            this.logOperation('getExpiringBatches', 'Successfully fetched expiring batches', {
                expiringCount: result?.data?.length || 0,
                warningDays,
                totalValue: result?.data?.reduce((sum, batch) => sum + (batch.total_quantity || 0), 0) || 0
            });

            // Enhance with expiry analytics
            if (this.config.ENABLE_ADVANCED_ANALYTICS && result?.data) {
                result.analytics = this._calculateExpiryAnalytics(result.data, warningDays);
            }

            return result;

        } catch (error) {
            this.logOperation('getExpiringBatches', `Failed to fetch expiring batches: ${error.message}`, { error: error.message });
            throw new DatabaseError(`Failed to fetch expiring batches: ${error.message}`);
        }
    }

    /**
     * Reserve batches for order item with advanced allocation strategy
     */
    async reserveBatchesForOrderItem(orderId, itemData) {
        this._checkInitialization();
        this.logOperation('reserveBatchesForOrderItem', `Reserving batches for order ${orderId}`, { 
            orderId, 
            productId: itemData?.product_id,
            quantity: itemData?.quantity 
        });

        try {
            if (!itemData.product_id || !itemData.quantity || itemData.quantity <= 0) {
                throw new DatabaseError('Invalid item data: product_id and positive quantity are required');
            }

            const operations = [
                {
                    name: 'validateProduct',
                    execute: async () => {
                        if (this.hybridProductService) {
                            const product = await this.hybridProductService.getProductById(itemData.product_id);
                            if (!product) {
                                throw new NotFoundError(`Product ${itemData.product_id} not found`);
                            }
                            return product;
                        }
                        return { id: itemData.product_id };
                    }
                },
                {
                    name: 'reserveBatches',
                    execute: async () => {
                        return await this.supabaseBatchQueries.reserveBatchesForProduct(
                            itemData.product_id, 
                            itemData.quantity,
                            orderId
                        );
                    }
                }
            ];

            const rollbackOperations = [
                {
                    name: 'unreserveBatches',
                    execute: async () => {
                        return await this.supabaseBatchQueries.unreserveBatchesForOrder(orderId);
                    }
                }
            ];

            const results = await this._executeBatchTransaction(
                'reserveBatchesForOrderItem',
                operations,
                rollbackOperations
            );

            // Log the operation
            await this._logBatchOperation('reserve', itemData, results.reserveBatches, {
                user: 'System',
                source: 'order_processing',
                orderId
            });

            this.logOperation('reserveBatchesForOrderItem', `Successfully reserved batches for order ${orderId}`, {
                orderId,
                productId: itemData.product_id,
                quantityRequested: itemData.quantity,
                quantityReserved: results.reserveBatches?.quantity_reserved || 0
            });

            return results.reserveBatches;

        } catch (error) {
            this.logOperation('reserveBatchesForOrderItem', `Failed to reserve batches for order ${orderId}: ${error.message}`, {
                orderId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Unreserve batches for order with comprehensive cleanup
     */
    async unreserveBatchesForOrder(orderId) {
        this._checkInitialization();
        this.logOperation('unreserveBatchesForOrder', `Unreserving batches for order ${orderId}`, { orderId });

        try {
            const result = await this.supabaseBatchQueries.unreserveBatchesForOrder(orderId);

            // Log the operation
            await this._logBatchOperation('unreserve', { order_id: orderId }, result, {
                user: 'System',
                source: 'order_processing',
                orderId
            });

            this.logOperation('unreserveBatchesForOrder', `Successfully unreserved batches for order ${orderId}`, {
                orderId,
                releasedQuantity: result?.released_quantity || 0
            });

            return result;

        } catch (error) {
            this.logOperation('unreserveBatchesForOrder', `Failed to unreserve batches for order ${orderId}: ${error.message}`, {
                orderId,
                error: error.message
            });
            throw new DatabaseError(`Failed to unreserve batches for order ${orderId}: ${error.message}`);
        }
    }

    /**
     * Get product availability with detailed batch breakdown
     */
    async getProductAvailability(productId, filters = {}) {
        this._checkInitialization();
        this.logOperation('getProductAvailability', `Getting availability for product ${productId}`, { productId, filters });

        try {
            const result = await this.supabaseBatchQueries.getProductAvailability(productId, filters);

            this.logOperation('getProductAvailability', `Successfully retrieved availability for product ${productId}`, {
                productId,
                totalAvailable: result?.total_available || 0,
                batchCount: result?.batches?.length || 0
            });

            // Enhance with availability analytics
            if (this.config.ENABLE_ADVANCED_ANALYTICS && result) {
                result.analytics = this._calculateAvailabilityAnalytics(result, productId);
            }

            return result;

        } catch (error) {
            this.logOperation('getProductAvailability', `Failed to get availability for product ${productId}: ${error.message}`, {
                productId,
                error: error.message
            });
            throw new DatabaseError(`Failed to get product availability: ${error.message}`);
        }
    }

    /**
     * Advanced analytics calculations for batch groups
     */
    _calculateBatchGroupAnalytics(batchGroups) {
        const analytics = {
            overview: {
                totalProducts: batchGroups.length,
                totalBatches: 0,
                totalQuantity: 0,
                totalAvailable: 0,
                totalReserved: 0
            },
            insights: {
                avgBatchesPerProduct: 0,
                avgQuantityPerBatch: 0,
                utilizationRate: 0,
                lowStockProducts: 0
            },
            trends: {
                expiringBatches: 0,
                recentProduction: 0
            }
        };

        let totalBatchCount = 0;
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        batchGroups.forEach(group => {
            const groupBatches = group.batches || [];
            totalBatchCount += groupBatches.length;
            
            groupBatches.forEach(batch => {
                analytics.overview.totalQuantity += batch.total_quantity || 0;
                analytics.overview.totalAvailable += batch.available_quantity || 0;
                analytics.overview.totalReserved += batch.reserved_quantity || 0;

                // Check for expiring batches
                if (batch.expiry_date) {
                    const expiryDate = new Date(batch.expiry_date);
                    const daysToExpiry = (expiryDate - today) / (24 * 60 * 60 * 1000);
                    if (daysToExpiry <= this.batchConfig.BATCH_EXPIRY_WARNING_DAYS) {
                        analytics.trends.expiringBatches++;
                    }
                }

                // Check for recent production
                if (batch.production_date) {
                    const productionDate = new Date(batch.production_date);
                    if (productionDate >= weekAgo) {
                        analytics.trends.recentProduction++;
                    }
                }
            });

            // Check for low stock
            const totalAvailable = groupBatches.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0);
            const totalQuantity = groupBatches.reduce((sum, batch) => sum + (batch.total_quantity || 0), 0);
            
            if (totalQuantity > 0 && (totalAvailable / totalQuantity) < this.batchConfig.MIN_AVAILABILITY_THRESHOLD) {
                analytics.insights.lowStockProducts++;
            }
        });

        analytics.overview.totalBatches = totalBatchCount;
        analytics.insights.avgBatchesPerProduct = analytics.overview.totalProducts > 0 
            ? (totalBatchCount / analytics.overview.totalProducts).toFixed(2) 
            : 0;
        analytics.insights.avgQuantityPerBatch = totalBatchCount > 0 
            ? (analytics.overview.totalQuantity / totalBatchCount).toFixed(2) 
            : 0;
        analytics.insights.utilizationRate = analytics.overview.totalQuantity > 0 
            ? ((analytics.overview.totalReserved / analytics.overview.totalQuantity) * 100).toFixed(2) 
            : 0;

        return analytics;
    }

    /**
     * Calculate product-specific batch analytics
     */
    _calculateProductBatchAnalytics(batches, productId) {
        const analytics = {
            productId,
            batchCount: batches.length,
            totalQuantity: 0,
            availableQuantity: 0,
            reservedQuantity: 0,
            oldestBatch: null,
            newestBatch: null,
            expiringBatches: 0,
            averageAge: 0
        };

        if (batches.length === 0) return analytics;

        let totalAge = 0;
        const today = new Date();

        batches.forEach(batch => {
            analytics.totalQuantity += batch.total_quantity || 0;
            analytics.availableQuantity += batch.available_quantity || 0;
            analytics.reservedQuantity += batch.reserved_quantity || 0;

            // Track oldest and newest batches
            if (batch.production_date) {
                const productionDate = new Date(batch.production_date);
                
                if (!analytics.oldestBatch || productionDate < new Date(analytics.oldestBatch.production_date)) {
                    analytics.oldestBatch = batch;
                }
                
                if (!analytics.newestBatch || productionDate > new Date(analytics.newestBatch.production_date)) {
                    analytics.newestBatch = batch;
                }

                // Calculate age
                const age = (today - productionDate) / (24 * 60 * 60 * 1000);
                totalAge += age;
            }

            // Check expiry
            if (batch.expiry_date) {
                const expiryDate = new Date(batch.expiry_date);
                const daysToExpiry = (expiryDate - today) / (24 * 60 * 60 * 1000);
                if (daysToExpiry <= this.batchConfig.BATCH_EXPIRY_WARNING_DAYS) {
                    analytics.expiringBatches++;
                }
            }
        });

        analytics.averageAge = batches.length > 0 ? (totalAge / batches.length).toFixed(1) : 0;
        analytics.utilizationRate = analytics.totalQuantity > 0 
            ? ((analytics.reservedQuantity / analytics.totalQuantity) * 100).toFixed(2) 
            : 0;

        return analytics;
    }

    /**
     * Calculate expiry analytics for batch management
     */
    _calculateExpiryAnalytics(expiringBatches, warningDays) {
        const analytics = {
            warningDays,
            totalBatches: expiringBatches.length,
            totalQuantity: 0,
            totalValue: 0,
            urgencyBreakdown: {
                expired: 0,
                critical: 0, // 1-2 days
                warning: 0,  // 3-7 days
                caution: 0   // 8+ days
            },
            productBreakdown: {}
        };

        const today = new Date();

        expiringBatches.forEach(batch => {
            analytics.totalQuantity += batch.total_quantity || 0;
            
            // Calculate days to expiry
            const expiryDate = new Date(batch.expiry_date);
            const daysToExpiry = Math.ceil((expiryDate - today) / (24 * 60 * 60 * 1000));

            // Categorize by urgency
            if (daysToExpiry <= 0) {
                analytics.urgencyBreakdown.expired++;
            } else if (daysToExpiry <= 2) {
                analytics.urgencyBreakdown.critical++;
            } else if (daysToExpiry <= 7) {
                analytics.urgencyBreakdown.warning++;
            } else {
                analytics.urgencyBreakdown.caution++;
            }

            // Product breakdown
            const productId = batch.product_id;
            if (!analytics.productBreakdown[productId]) {
                analytics.productBreakdown[productId] = {
                    batches: 0,
                    quantity: 0,
                    mostUrgent: daysToExpiry
                };
            }
            
            analytics.productBreakdown[productId].batches++;
            analytics.productBreakdown[productId].quantity += batch.total_quantity || 0;
            analytics.productBreakdown[productId].mostUrgent = Math.min(
                analytics.productBreakdown[productId].mostUrgent,
                daysToExpiry
            );
        });

        return analytics;
    }

    /**
     * Calculate availability analytics for product management
     */
    _calculateAvailabilityAnalytics(availabilityData, productId) {
        const analytics = {
            productId,
            totalBatches: availabilityData.batches?.length || 0,
            totalQuantity: availabilityData.total_quantity || 0,
            availableQuantity: availabilityData.total_available || 0,
            reservedQuantity: availabilityData.total_reserved || 0,
            availabilityRate: 0,
            stockStatus: 'unknown',
            projectedDays: 0
        };

        if (analytics.totalQuantity > 0) {
            analytics.availabilityRate = ((analytics.availableQuantity / analytics.totalQuantity) * 100).toFixed(2);
            
            // Determine stock status
            if (analytics.availabilityRate >= 80) {
                analytics.stockStatus = 'excellent';
            } else if (analytics.availabilityRate >= 50) {
                analytics.stockStatus = 'good';
            } else if (analytics.availabilityRate >= 20) {
                analytics.stockStatus = 'low';
            } else if (analytics.availabilityRate > 0) {
                analytics.stockStatus = 'critical';
            } else {
                analytics.stockStatus = 'out_of_stock';
            }
        }

        return analytics;
    }

    /**
     * Get service health status and metrics
     */
    async getMigrationStatus() {
        this._checkInitialization();
        
        const status = {
            timestamp: new Date().toISOString(),
            service: 'SupabaseBatchService',
            status: 'operational',
            version: '1.0.0',
            features: {
                batchOperations: this.config.ENABLE_BATCH_OPERATIONS,
                productionIntegration: this.config.ENABLE_PRODUCTION_INTEGRATION,
                orderIntegration: this.config.ENABLE_ORDER_INTEGRATION,
                advancedAnalytics: this.config.ENABLE_ADVANCED_ANALYTICS,
                auditTrail: !!this.hybridAuditService
            },
            dependencies: {
                supabase: !!this.supabase,
                batchQueries: !!this.supabaseBatchQueries,
                productService: !!this.hybridProductService,
                auditService: !!this.hybridAuditService
            },
            configuration: {
                batchConfig: this.batchConfig,
                operationTimeout: this.config.OPERATION_TIMEOUT,
                maxRetries: this.config.MAX_RETRY_ATTEMPTS
            }
        };

        return status;
    }
}

module.exports = SupabaseBatchService; 