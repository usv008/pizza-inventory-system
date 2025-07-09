const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Supabase Movement Service - Revolutionary architecture with transaction simulation
 * Implements all MovementService methods with enhanced capabilities for inventory management
 * Features: Multi-table transactions, stock consistency, advanced error handling
 */

class SupabaseMovementService {
    constructor() {
        this.supabase = null;
        this.hybridProductService = null;
        this.hybridAuditService = null;
        this.initialized = false;
        
        // Configuration for optimization
        this.config = {
            ENABLE_BATCH_OPERATIONS: true,
            ENABLE_TRANSACTION_SIMULATION: true,
            ENABLE_COMPREHENSIVE_VALIDATION: true,
            MAX_RETRY_ATTEMPTS: 3,
            OPERATION_TIMEOUT: 30000
        };
        
        // Table configurations
        this.tables = {
            movements: 'stock_movements',
            products: 'products'
        };
        
        console.log('📦 SupabaseMovementService instantiated');
    }

    /**
     * Initialize service with dependencies
     */
    initialize(dependencies) {
        if (!dependencies.supabase) {
            throw new DatabaseError('Supabase client is required for SupabaseMovementService');
        }

        this.supabase = dependencies.supabase;
        this.hybridProductService = dependencies.hybridProductService;
        this.hybridAuditService = dependencies.hybridAuditService;
        this.initialized = true;

        this.logOperation('initialize', 'SupabaseMovementService initialized successfully', {
            hasSupabase: !!this.supabase,
            hasProductService: !!this.hybridProductService,
            hasAuditService: !!this.hybridAuditService,
            tables: this.tables,
            config: this.config
        });
    }

    /**
     * Check initialization status
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('SupabaseMovementService not initialized');
        }
    }

    /**
     * Log operations for monitoring
     */
    logOperation(operation, message, details = {}) {
        console.log(`[SUPABASE-MOVEMENT] ${operation}: ${message}`, details);
    }

    /**
     * Multi-table transaction simulation with compensating actions
     */
    async _executeMovementTransaction(operation, operations, rollbackOperations = []) {
        const transactionId = `mov_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logOperation('transaction', `Starting ${operation} transaction: ${transactionId}`);
        
        const completed = [];
        const results = {};
        
        try {
            // Execute operations in sequence
            for (let i = 0; i < operations.length; i++) {
                const op = operations[i];
                this.logOperation('transaction', `Executing operation ${i + 1}/${operations.length}: ${op.name}`, {
                    transactionId,
                    operation: op.name
                });
                
                const result = await op.execute();
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
                        await rollbackOp.execute();
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
            
            throw new DatabaseError(`Transaction failed: ${error.message}`);
        }
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
     * Get all movements with advanced filtering and joins
     */
    async getAllMovements(filters = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('getAllMovements', 'Fetching movements with filters', {
                filters: this._sanitizeLogData(filters)
            });

            let query = this.supabase
                .from(this.tables.movements)
                .select(`
                    *,
                    product:products!product_id (
                        id,
                        name,
                        stock_pieces,
                        stock_boxes
                    )
                `)
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.product_id) {
                query = query.eq('product_id', filters.product_id);
            }
            
            if (filters.movement_type && filters.movement_type !== 'ALL') {
                query = query.eq('movement_type', filters.movement_type);
            }
            
            if (filters.date_from) {
                query = query.gte('created_at', filters.date_from);
            }
            
            if (filters.date_to) {
                query = query.lte('created_at', filters.date_to);
            }
            
            if (filters.user) {
                query = query.ilike('user', `%${filters.user}%`);
            }
            
            if (filters.batch_id) {
                query = query.eq('batch_id', filters.batch_id);
            }

            // Pagination
            const limit = Math.min(filters.limit || 200, 1000); // Max 1000 records
            const offset = filters.offset || 0;
            
            query = query.range(offset, offset + limit - 1);

            const { data, error } = await query;

            if (error) {
                this.logOperation('getAllMovements', `Database error: ${error.message}`);
                throw new DatabaseError(`Failed to fetch movements: ${error.message}`);
            }

            this.logOperation('getAllMovements', `Successfully fetched ${data?.length || 0} movements`);

            return {
                success: true,
                data: data || [],
                pagination: {
                    limit,
                    offset,
                    count: data?.length || 0
                },
                filters
            };

        } catch (error) {
            this.logOperation('getAllMovements', `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create new movement with multi-table transaction
     */
    async createMovement(movementData, requestInfo = {}) {
        this._checkInitialization();
        
        try {
            const { product_id, movement_type, pieces, boxes, reason, user = 'system', batch_id, batch_date } = movementData;
            
            this.logOperation('createMovement', 'Creating movement with transaction', {
                product_id,
                movement_type,
                pieces,
                boxes,
                user
            });

            // Validation operations
            const validateProduct = {
                name: 'validateProduct',
                execute: async () => {
                    if (this.hybridProductService) {
                        return await this.hybridProductService.getProductById(product_id);
                    } else {
                        const { data, error } = await this.supabase
                            .from(this.tables.products)
                            .select('*')
                            .eq('id', product_id)
                            .single();
                        
                        if (error || !data) {
                            throw new NotFoundError(`Product with ID ${product_id} not found`);
                        }
                        return data;
                    }
                }
            };

            // Stock validation for OUT movements
            const validateStock = {
                name: 'validateStock',
                execute: async () => {
                    if (movement_type === 'OUT' || movement_type === 'WRITEOFF') {
                        const product = await validateProduct.execute();
                        if (product.stock_pieces < pieces) {
                            throw new DatabaseError(`Insufficient stock. Available: ${product.stock_pieces}, required: ${pieces}`);
                        }
                    }
                    return { valid: true };
                }
            };

            // Create movement record
            const createMovementRecord = {
                name: 'createMovementRecord',
                execute: async () => {
                    const { data, error } = await this.supabase
                        .from(this.tables.movements)
                        .insert({
                            product_id,
                            movement_type,
                            pieces: pieces || 0,
                            boxes: boxes || 0,
                            reason: reason || '',
                            user,
                            batch_id,
                            batch_date,
                            created_at: new Date().toISOString()
                        })
                        .select()
                        .single();

                    if (error) {
                        throw new DatabaseError(`Failed to create movement: ${error.message}`);
                    }

                    return data;
                }
            };

            // Update product stock
            const updateProductStock = {
                name: 'updateProductStock',
                execute: async () => {
                    const stockChange = movement_type === 'IN' || movement_type === 'ADJUSTMENT' 
                        ? pieces 
                        : -pieces;

                    if (this.hybridProductService) {
                        const stockData = {
                            stock_pieces_delta: stockChange,
                            updated_at: new Date().toISOString()
                        };
                        return await this.hybridProductService.adjustProductStock(product_id, stockData, requestInfo);
                    } else {
                        // Direct Supabase update with increment
                        const { data, error } = await this.supabase.rpc('increment_product_stock', {
                            product_id: product_id,
                            pieces_delta: stockChange
                        });

                        if (error) {
                            throw new DatabaseError(`Failed to update product stock: ${error.message}`);
                        }

                        return data;
                    }
                }
            };

            // Audit logging
            const logAuditTrail = {
                name: 'logAuditTrail',
                execute: async () => {
                    if (this.hybridAuditService) {
                        return await this.hybridAuditService.logMovementCreation(
                            null, // Will be set after movement creation
                            movementData,
                            requestInfo
                        );
                    }
                    return { audit: 'skipped' };
                }
            };

            // Execute transaction
            const operations = [validateProduct, validateStock, createMovementRecord, updateProductStock];
            const rollbackOperations = []; // We'll implement compensating actions if needed

            const results = await this._executeMovementTransaction('createMovement', operations, rollbackOperations);

            // Log audit with actual movement ID
            if (this.hybridAuditService && results.createMovementRecord) {
                await this.hybridAuditService.logMovementCreation(
                    results.createMovementRecord.id,
                    movementData,
                    requestInfo
                );
            }

            this.logOperation('createMovement', 'Movement created successfully', {
                movementId: results.createMovementRecord?.id,
                product_id,
                movement_type
            });

            return {
                success: true,
                data: results.createMovementRecord,
                message: 'Movement created successfully'
            };

        } catch (error) {
            this.logOperation('createMovement', `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update movement (controlled updates with audit trail)
     */
    async updateMovement(id, updateData, requestInfo = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('updateMovement', `Updating movement ${id}`, {
                updateData: this._sanitizeLogData(updateData)
            });

            // Get current movement
            const { data: currentMovement, error: fetchError } = await this.supabase
                .from(this.tables.movements)
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !currentMovement) {
                throw new NotFoundError(`Movement with ID ${id} not found`);
            }

            // Only allow specific fields to be updated
            const allowedFields = ['reason', 'user'];
            const updateFields = {};
            
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    updateFields[field] = updateData[field];
                }
            }

            if (Object.keys(updateFields).length === 0) {
                throw new DatabaseError('No valid fields to update');
            }

            updateFields.updated_at = new Date().toISOString();

            // Update movement
            const { data, error } = await this.supabase
                .from(this.tables.movements)
                .update(updateFields)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                throw new DatabaseError(`Failed to update movement: ${error.message}`);
            }

            // Log audit trail
            if (this.hybridAuditService) {
                await this.hybridAuditService.logMovementUpdate(id, updateFields, requestInfo);
            }

            this.logOperation('updateMovement', `Movement ${id} updated successfully`);

            return {
                success: true,
                data,
                message: 'Movement updated successfully'
            };

        } catch (error) {
            this.logOperation('updateMovement', `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete movement with stock reversal
     */
    async deleteMovement(id, requestInfo = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('deleteMovement', `Deleting movement ${id}`);

            // Get movement to delete
            const getMovement = {
                name: 'getMovement',
                execute: async () => {
                    const { data, error } = await this.supabase
                        .from(this.tables.movements)
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (error || !data) {
                        throw new NotFoundError(`Movement with ID ${id} not found`);
                    }

                    return data;
                }
            };

            // Reverse stock change
            const reverseStockChange = {
                name: 'reverseStockChange',
                execute: async (movement) => {
                    const stockChange = movement.movement_type === 'IN' || movement.movement_type === 'ADJUSTMENT'
                        ? -movement.pieces  // Reverse IN by subtracting
                        : movement.pieces;  // Reverse OUT by adding back

                    if (this.hybridProductService) {
                        const stockData = {
                            stock_pieces_delta: stockChange,
                            updated_at: new Date().toISOString()
                        };
                        return await this.hybridProductService.adjustProductStock(movement.product_id, stockData, requestInfo);
                    } else {
                        const { data, error } = await this.supabase.rpc('increment_product_stock', {
                            product_id: movement.product_id,
                            pieces_delta: stockChange
                        });

                        if (error) {
                            throw new DatabaseError(`Failed to reverse stock change: ${error.message}`);
                        }

                        return data;
                    }
                }
            };

            // Delete movement record
            const deleteMovementRecord = {
                name: 'deleteMovementRecord',
                execute: async () => {
                    const { error } = await this.supabase
                        .from(this.tables.movements)
                        .delete()
                        .eq('id', id);

                    if (error) {
                        throw new DatabaseError(`Failed to delete movement: ${error.message}`);
                    }

                    return { deleted: true };
                }
            };

            // Execute transaction
            const movement = await getMovement.execute();
            
            const operations = [
                {
                    name: 'reverseStockChange',
                    execute: () => reverseStockChange.execute(movement)
                },
                deleteMovementRecord
            ];

            await this._executeMovementTransaction('deleteMovement', operations);

            // Log audit trail
            if (this.hybridAuditService) {
                await this.hybridAuditService.logMovementDeletion(id, requestInfo);
            }

            this.logOperation('deleteMovement', `Movement ${id} deleted successfully`);

            return {
                success: true,
                message: 'Movement deleted successfully'
            };

        } catch (error) {
            this.logOperation('deleteMovement', `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get movements by product with enhanced filtering
     */
    async getMovementsByProduct(productId, filters = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('getMovementsByProduct', `Fetching movements for product ${productId}`);

            // Verify product exists using hybrid service if available
            if (this.hybridProductService) {
                await this.hybridProductService.getProductById(productId);
            } else {
                const { data: product, error } = await this.supabase
                    .from(this.tables.products)
                    .select('id')
                    .eq('id', productId)
                    .single();

                if (error || !product) {
                    throw new NotFoundError(`Product with ID ${productId} not found`);
                }
            }

            // Add product_id to filters and call getAllMovements
            const productFilters = { ...filters, product_id: productId };
            return await this.getAllMovements(productFilters);

        } catch (error) {
            this.logOperation('getMovementsByProduct', `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get movement statistics with advanced analytics
     */
    async getMovementStatistics(options = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('getMovementStatistics', 'Calculating movement statistics', {
                options: this._sanitizeLogData(options)
            });

            const {
                date_from = null,
                date_to = null,
                product_id = null,
                movement_type = null,
                group_by = 'movement_type' // movement_type, product, date
            } = options;

            let query = this.supabase
                .from(this.tables.movements)
                .select(`
                    movement_type,
                    product_id,
                    pieces,
                    boxes,
                    created_at,
                    product:products!product_id (
                        name
                    )
                `);

            // Apply filters
            if (date_from) {
                query = query.gte('created_at', date_from);
            }
            
            if (date_to) {
                query = query.lte('created_at', date_to);
            }
            
            if (product_id) {
                query = query.eq('product_id', product_id);
            }
            
            if (movement_type) {
                query = query.eq('movement_type', movement_type);
            }

            const { data, error } = await query;

            if (error) {
                throw new DatabaseError(`Failed to fetch statistics: ${error.message}`);
            }

            // Process statistics
            const stats = this._processStatistics(data || [], group_by);

            this.logOperation('getMovementStatistics', 'Statistics calculated successfully', {
                totalRecords: data?.length || 0,
                groupBy: group_by
            });

            return {
                success: true,
                data: stats,
                options,
                total_records: data?.length || 0
            };

        } catch (error) {
            this.logOperation('getMovementStatistics', `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process statistics data based on grouping
     */
    _processStatistics(data, groupBy) {
        const stats = {
            summary: {
                total_movements: data.length,
                total_pieces: data.reduce((sum, item) => sum + (item.pieces || 0), 0),
                total_boxes: data.reduce((sum, item) => sum + (item.boxes || 0), 0)
            },
            by_type: {},
            by_product: {},
            by_date: {}
        };

        // Group by movement type
        data.forEach(item => {
            const type = item.movement_type;
            if (!stats.by_type[type]) {
                stats.by_type[type] = {
                    count: 0,
                    pieces: 0,
                    boxes: 0
                };
            }
            stats.by_type[type].count++;
            stats.by_type[type].pieces += item.pieces || 0;
            stats.by_type[type].boxes += item.boxes || 0;
        });

        // Group by product
        data.forEach(item => {
            const productId = item.product_id;
            const productName = item.product?.name || `Product ${productId}`;
            const key = `${productId}_${productName}`;
            
            if (!stats.by_product[key]) {
                stats.by_product[key] = {
                    product_id: productId,
                    product_name: productName,
                    count: 0,
                    pieces: 0,
                    boxes: 0
                };
            }
            stats.by_product[key].count++;
            stats.by_product[key].pieces += item.pieces || 0;
            stats.by_product[key].boxes += item.boxes || 0;
        });

        // Group by date (daily)
        data.forEach(item => {
            const date = item.created_at?.split('T')[0] || 'unknown';
            if (!stats.by_date[date]) {
                stats.by_date[date] = {
                    count: 0,
                    pieces: 0,
                    boxes: 0
                };
            }
            stats.by_date[date].count++;
            stats.by_date[date].pieces += item.pieces || 0;
            stats.by_date[date].boxes += item.boxes || 0;
        });

        return stats;
    }

    /**
     * Get migration status and service health
     */
    async getMigrationStatus() {
        const status = {
            service: 'SupabaseMovementService',
            initialized: this.initialized,
            config: this.config,
            dependencies: {
                supabase: !!this.supabase,
                hybridProductService: !!this.hybridProductService,
                hybridAuditService: !!this.hybridAuditService
            },
            tables: this.tables,
            timestamp: new Date().toISOString()
        };

        // Test connectivity
        if (this.initialized) {
            try {
                const { data, error } = await this.supabase
                    .from(this.tables.movements)
                    .select('count(*)')
                    .limit(1);
                
                status.connectivity = error ? 'error' : 'healthy';
                status.error = error?.message;
            } catch (error) {
                status.connectivity = 'error';
                status.error = error.message;
            }
        }

        return status;
    }
}

module.exports = SupabaseMovementService; 