const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');
const SupabaseProductionQueries = require('../database/supabaseProductionQueries');

/**
 * Supabase Production Service - Revolutionary architecture for production management
 * Implements all ProductionService methods with enhanced capabilities for business operations
 * Features: Multi-table transactions, production analytics, inventory integration, audit trail
 */

class SupabaseProductionService {
    constructor() {
        this.supabase = null;
        this.supabaseProductionQueries = null;
        this.hybridProductService = null;
        this.hybridAuditService = null;
        this.initialized = false;
        
        // Configuration for optimization
        this.config = {
            ENABLE_BATCH_OPERATIONS: true,
            ENABLE_TRANSACTION_SIMULATION: true,
            ENABLE_COMPREHENSIVE_VALIDATION: true,
            ENABLE_INVENTORY_INTEGRATION: true,
            ENABLE_ADVANCED_ANALYTICS: true,
            MAX_RETRY_ATTEMPTS: 3,
            OPERATION_TIMEOUT: 30000,
            DEFAULT_RESPONSIBLE: 'System'
        };
        
        // Production domain configuration
        this.productionConfig = {
            MIN_PRODUCTION_QUANTITY: 1,
            MAX_PRODUCTION_QUANTITY: 10000,
            DUPLICATE_WARNING_THRESHOLD: 2,
            STATISTICS_CACHE_TTL: 300000, // 5 minutes
            BATCH_SIZE_LIMIT: 100
        };
        
        console.log('🏭 SupabaseProductionService instantiated');
    }

    /**
     * Initialize service with dependencies
     */
    initialize(dependencies) {
        if (!dependencies.supabase) {
            throw new DatabaseError('Supabase client is required for SupabaseProductionService');
        }

        this.supabase = dependencies.supabase;
        this.supabaseProductionQueries = new SupabaseProductionQueries(this.supabase);
        this.hybridProductService = dependencies.hybridProductService;
        this.hybridAuditService = dependencies.hybridAuditService;
        this.initialized = true;

        this.logOperation('initialize', 'SupabaseProductionService initialized successfully', {
            hasSupabase: !!this.supabase,
            hasProductService: !!this.hybridProductService,
            hasAuditService: !!this.hybridAuditService,
            config: this.config,
            productionConfig: this.productionConfig
        });
    }

    /**
     * Check initialization status
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('SupabaseProductionService not initialized');
        }
    }

    /**
     * Log operations for monitoring
     */
    logOperation(operation, message, details = {}) {
        console.log(`[SUPABASE-PRODUCTION] ${operation}: ${message}`, details);
    }

    /**
     * Multi-table transaction simulation with compensating actions for production operations
     */
    async _executeProductionTransaction(operation, operations, rollbackOperations = []) {
        const transactionId = `prod_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
            
            throw new DatabaseError(`Production transaction failed: ${error.message}`);
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
     * Enhanced production data validation with business rules
     */
    async _validateProductionData(productionData, operation = 'create') {
        const errors = [];

        // Required fields validation
        if (!productionData.product_id) {
            errors.push('product_id is required');
        }

        if (!productionData.total_quantity) {
            errors.push('total_quantity is required');
        }

        if (!productionData.production_date) {
            errors.push('production_date is required');
        }

        // Business rules validation
        if (productionData.total_quantity) {
            const quantity = parseInt(productionData.total_quantity);
            if (quantity < this.productionConfig.MIN_PRODUCTION_QUANTITY) {
                errors.push(`Minimum production quantity is ${this.productionConfig.MIN_PRODUCTION_QUANTITY}`);
            }
            if (quantity > this.productionConfig.MAX_PRODUCTION_QUANTITY) {
                errors.push(`Maximum production quantity is ${this.productionConfig.MAX_PRODUCTION_QUANTITY}`);
            }
        }

        // Product validation with enhanced ProductService
        if (productionData.product_id && this.hybridProductService) {
            try {
                const product = await this.hybridProductService.getById(productionData.product_id);
                if (!product) {
                    errors.push(`Product with ID ${productionData.product_id} not found`);
                }
            } catch (error) {
                errors.push(`Product validation failed: ${error.message}`);
            }
        }

        // Date validation
        if (productionData.production_date) {
            const productionDate = new Date(productionData.production_date);
            const today = new Date();
            const futureLimit = new Date();
            futureLimit.setDate(today.getDate() + 30); // Allow up to 30 days in future

            if (productionDate > futureLimit) {
                errors.push('Production date cannot be more than 30 days in the future');
            }
        }

        if (errors.length > 0) {
            throw new Error(`Production validation failed: ${errors.join(', ')}`);
        }

        return true;
    }

    /**
     * Enhanced audit logging integration for production operations
     */
    async _logProductionOperation(operation, productionData, result, requestInfo = {}) {
        try {
            if (!this.hybridAuditService) {
                this.logOperation('audit', 'Audit service not available, skipping audit log');
                return;
            }

            const auditData = {
                operation_type: 'PRODUCTION',
                entity_type: 'production',
                entity_id: result?.id || null,
                operation: operation,
                old_data: operation === 'UPDATE' ? requestInfo.oldData : null,
                new_data: {
                    product_id: productionData.product_id,
                    production_date: productionData.production_date,
                    total_quantity: productionData.total_quantity,
                    responsible: productionData.responsible || this.config.DEFAULT_RESPONSIBLE,
                    notes: productionData.notes
                },
                description: this._generateOperationDescription(operation, productionData, result),
                user_name: requestInfo.user || productionData.responsible || this.config.DEFAULT_RESPONSIBLE,
                ip_address: requestInfo.ip || null,
                user_agent: requestInfo.userAgent || null,
                success: !!result,
                timestamp: new Date().toISOString()
            };

            await this.hybridAuditService.logProductionOperation(auditData);
            
            this.logOperation('audit', `Production operation ${operation} logged successfully`, {
                entity_id: result?.id,
                operation
            });

        } catch (error) {
            this.logOperation('audit', `Failed to log production operation: ${error.message}`, {
                operation,
                error: error.message
            });
            // Don't throw - audit failure shouldn't break main operation
        }
    }

    /**
     * Generate human-readable operation description
     */
    _generateOperationDescription(operation, productionData, result) {
        const productInfo = result?.product?.name || `Product ID ${productionData.product_id}`;
        const quantity = productionData.total_quantity;
        const date = productionData.production_date;

        switch (operation) {
            case 'CREATE':
                return `Created production record: ${productInfo} - ${quantity} units (${date})`;
            case 'UPDATE':
                return `Updated production record: ${productInfo} - ${quantity} units (${date})`;
            case 'DELETE':
                return `Deleted production record: ${productInfo} - ${quantity} units (${date})`;
            default:
                return `Production operation ${operation}: ${productInfo}`;
        }
    }

    /**
     * Get all production records with enhanced filtering and statistics
     */
    async getAllProduction(filters = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('getAllProduction', 'Fetching production records with filters', {
                filters: this._sanitizeLogData(filters)
            });

            const result = await this.supabaseProductionQueries.getAll(filters);
            
            // Calculate enhanced statistics
            const stats = this._calculateAdvancedProductionStats(result.data, { includeProductBreakdown: true });
            
            this.logOperation('getAllProduction', `Successfully fetched ${result.data.length} production records`);
            
            return {
                production: result.data,
                stats,
                count: result.count,
                pagination: result.pagination
            };

        } catch (error) {
            this.logOperation('getAllProduction', `Error fetching production records: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get production records by product ID with enhanced data
     */
    async getProductionByProductId(productId, filters = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('getProductionByProductId', `Fetching production for product ${productId}`, {
                productId,
                filters: this._sanitizeLogData(filters)
            });

            if (!productId || isNaN(productId)) {
                throw new Error('Valid product ID is required');
            }

            // Validate product exists
            if (this.hybridProductService) {
                await this.hybridProductService.getById(productId);
            }

            const production = await this.supabaseProductionQueries.getByProductId(productId, filters);
            
            // Calculate product-specific statistics
            const stats = this._calculateAdvancedProductionStats(production, {
                includeProductBreakdown: false,
                includeTrends: true
            });

            this.logOperation('getProductionByProductId', `Successfully fetched ${production.length} records for product ${productId}`);
            
            return {
                production,
                stats,
                count: production.length,
                product_id: parseInt(productId)
            };

        } catch (error) {
            this.logOperation('getProductionByProductId', `Error fetching production by product: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create production record with inventory integration and audit trail
     */
    async createProduction(productionData, requestInfo = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('createProduction', 'Creating production record', {
                product_id: productionData.product_id,
                quantity: productionData.total_quantity,
                date: productionData.production_date
            });

            // Enhanced validation
            await this._validateProductionData(productionData, 'create');

            // Check for duplicates
            const duplicates = await this.supabaseProductionQueries.validateDuplicates(
                productionData.product_id,
                productionData.production_date
            );

            if (duplicates.length >= this.productionConfig.DUPLICATE_WARNING_THRESHOLD) {
                this.logOperation('createProduction', `Warning: ${duplicates.length} existing productions found for same product and date`);
            }

            // Prepare production data
            const enhancedProductionData = {
                ...productionData,
                responsible: productionData.responsible || requestInfo.user || this.config.DEFAULT_RESPONSIBLE
            };

            // Execute production creation with inventory integration
            if (this.config.ENABLE_INVENTORY_INTEGRATION && this.hybridProductService) {
                return await this._createProductionWithInventoryUpdate(enhancedProductionData, requestInfo);
            } else {
                // Standard creation without inventory integration
                const result = await this.supabaseProductionQueries.create(enhancedProductionData);
                
                // Log operation
                await this._logProductionOperation('CREATE', enhancedProductionData, result, requestInfo);
                
                this.logOperation('createProduction', `Successfully created production: ${result.id}`);
                
                return {
                    success: true,
                    production: result,
                    message: 'Production successfully created'
                };
            }

        } catch (error) {
            this.logOperation('createProduction', `Error creating production: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create production with inventory integration using transaction simulation
     */
    async _createProductionWithInventoryUpdate(productionData, requestInfo = {}) {
        const operations = [
            {
                name: 'createProduction',
                execute: () => this.supabaseProductionQueries.create(productionData)
            },
            {
                name: 'updateProductStock',
                execute: () => this.hybridProductService.adjustProductStock(
                    productionData.product_id,
                    productionData.total_quantity,
                    'PRODUCTION_ADD'
                )
            }
        ];

        const rollbackOperations = [
            {
                name: 'revertStockAdjustment',
                execute: () => this.hybridProductService.adjustProductStock(
                    productionData.product_id,
                    -productionData.total_quantity,
                    'PRODUCTION_REVERT'
                )
            }
        ];

        try {
            const results = await this._executeProductionTransaction(
                'createWithInventory',
                operations,
                rollbackOperations
            );

            const production = results.createProduction;
            const stockUpdate = results.updateProductStock;

            // Log operation with inventory context
            await this._logProductionOperation('CREATE_WITH_INVENTORY', productionData, production, requestInfo);

            this.logOperation('createProduction', `Successfully created production with inventory update: ${production.id}`, {
                productionId: production.id,
                stockAdjustment: productionData.total_quantity
            });

            return {
                success: true,
                production,
                stock_update: stockUpdate,
                message: 'Production created with inventory update'
            };

        } catch (error) {
            this.logOperation('createProduction', `Transaction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update production record with audit trail
     */
    async updateProduction(id, updateData, requestInfo = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('updateProduction', `Updating production ${id}`, {
                id,
                fields: Object.keys(updateData)
            });

            if (!id || isNaN(id)) {
                throw new Error('Valid production ID is required');
            }

            // Get current record for audit trail
            const currentRecord = await this.supabaseProductionQueries.getById(id);
            
            // Validate update data
            const validationData = { ...currentRecord, ...updateData };
            await this._validateProductionData(validationData, 'update');

            // Update record
            const result = await this.supabaseProductionQueries.update(id, updateData);

            // Log operation with before/after data
            await this._logProductionOperation('UPDATE', updateData, result, {
                ...requestInfo,
                oldData: currentRecord
            });

            this.logOperation('updateProduction', `Successfully updated production: ${id}`);
            
            return {
                success: true,
                production: result,
                message: 'Production successfully updated'
            };

        } catch (error) {
            this.logOperation('updateProduction', `Error updating production: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete production record with validation and audit trail
     */
    async deleteProduction(id, requestInfo = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('deleteProduction', `Deleting production ${id}`, { id });

            if (!id || isNaN(id)) {
                throw new Error('Valid production ID is required');
            }

            // Get record before deletion for audit
            const record = await this.supabaseProductionQueries.getById(id);
            
            // Delete record
            const deletedRecord = await this.supabaseProductionQueries.delete(id);

            // Log operation
            await this._logProductionOperation('DELETE', record, deletedRecord, requestInfo);

            this.logOperation('deleteProduction', `Successfully deleted production: ${id}`);
            
            return {
                success: true,
                production: deletedRecord,
                message: 'Production successfully deleted'
            };

        } catch (error) {
            this.logOperation('deleteProduction', `Error deleting production: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get production statistics with advanced analytics
     */
    async getProductionStatistics(startDate, endDate, options = {}) {
        this._checkInitialization();
        
        try {
            this.logOperation('getProductionStatistics', 'Generating production statistics', {
                startDate,
                endDate,
                options
            });

            const filters = {};
            if (startDate) filters.start_date = startDate;
            if (endDate) filters.end_date = endDate;
            if (options.product_id) filters.product_id = options.product_id;

            const production = await this.supabaseProductionQueries.getStatistics(filters);
            
            // Generate comprehensive statistics
            const stats = this._calculateAdvancedProductionStats(production, {
                includeProductBreakdown: true,
                includeTrends: true,
                includeEfficiency: true,
                groupBy: options.group_by || 'date'
            });

            this.logOperation('getProductionStatistics', `Successfully generated statistics for ${production.length} records`);
            
            return {
                overview: stats.overview,
                by_products: stats.by_products,
                trends: stats.trends,
                efficiency: stats.efficiency,
                period: { start: startDate, end: endDate },
                options
            };

        } catch (error) {
            this.logOperation('getProductionStatistics', `Error generating statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculate advanced production statistics with business intelligence
     */
    _calculateAdvancedProductionStats(production, options = {}) {
        if (!production || production.length === 0) {
            return this._getEmptyStats();
        }

        const stats = {
            overview: this._calculateOverviewStats(production),
            by_products: options.includeProductBreakdown ? this._calculateProductBreakdown(production) : null,
            trends: options.includeTrends ? this._calculateTrends(production) : null,
            efficiency: options.includeEfficiency ? this._calculateEfficiencyMetrics(production) : null
        };

        return stats;
    }

    /**
     * Calculate overview statistics
     */
    _calculateOverviewStats(production) {
        const totalQuantity = production.reduce((sum, p) => sum + (p.total_quantity || 0), 0);
        const totalRecords = production.length;
        
        // Calculate unique production dates and products
        const uniqueDates = new Set(production.map(p => p.production_date));
        const uniqueProducts = new Set(production.map(p => p.product_id));
        
        // Date range
        const dates = production.map(p => new Date(p.production_date)).sort();
        const dateRange = dates.length > 0 ? {
            start: dates[0].toISOString().split('T')[0],
            end: dates[dates.length - 1].toISOString().split('T')[0]
        } : null;

        return {
            total_records: totalRecords,
            total_quantity: totalQuantity,
            unique_products: uniqueProducts.size,
            unique_dates: uniqueDates.size,
            avg_quantity_per_record: totalRecords > 0 ? Math.round(totalQuantity / totalRecords) : 0,
            avg_quantity_per_day: uniqueDates.size > 0 ? Math.round(totalQuantity / uniqueDates.size) : 0,
            date_range: dateRange
        };
    }

    /**
     * Calculate product breakdown statistics
     */
    _calculateProductBreakdown(production) {
        const productStats = {};
        
        production.forEach(p => {
            const productId = p.product_id;
            if (!productStats[productId]) {
                productStats[productId] = {
                    product_id: productId,
                    product_name: p.product?.name || `Product ${productId}`,
                    total_quantity: 0,
                    records_count: 0,
                    production_dates: new Set(),
                    responsible_persons: new Set()
                };
            }
            
            productStats[productId].total_quantity += p.total_quantity || 0;
            productStats[productId].records_count += 1;
            productStats[productId].production_dates.add(p.production_date);
            productStats[productId].responsible_persons.add(p.responsible || 'Unknown');
        });

        // Convert Sets to counts and add calculated fields
        return Object.values(productStats).map(stat => ({
            ...stat,
            unique_dates: stat.production_dates.size,
            unique_responsible: stat.responsible_persons.size,
            avg_quantity_per_record: stat.records_count > 0 ? Math.round(stat.total_quantity / stat.records_count) : 0,
            production_dates: undefined, // Remove Set object
            responsible_persons: undefined // Remove Set object
        }));
    }

    /**
     * Calculate production trends
     */
    _calculateTrends(production) {
        // Group by date
        const dailyProduction = {};
        production.forEach(p => {
            const date = p.production_date;
            if (!dailyProduction[date]) {
                dailyProduction[date] = {
                    date,
                    total_quantity: 0,
                    records_count: 0,
                    products: new Set()
                };
            }
            dailyProduction[date].total_quantity += p.total_quantity || 0;
            dailyProduction[date].records_count += 1;
            dailyProduction[date].products.add(p.product_id);
        });

        // Convert to array and sort by date
        const trends = Object.values(dailyProduction)
            .map(day => ({
                ...day,
                unique_products: day.products.size,
                products: undefined // Remove Set object
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return {
            daily_production: trends,
            total_days: trends.length,
            peak_day: trends.reduce((max, day) => day.total_quantity > max.total_quantity ? day : max, trends[0]),
            avg_daily_production: trends.length > 0 ? Math.round(trends.reduce((sum, day) => sum + day.total_quantity, 0) / trends.length) : 0
        };
    }

    /**
     * Calculate efficiency metrics
     */
    _calculateEfficiencyMetrics(production) {
        const totalDays = new Set(production.map(p => p.production_date)).size;
        const totalQuantity = production.reduce((sum, p) => sum + (p.total_quantity || 0), 0);
        
        return {
            daily_average: totalDays > 0 ? Math.round(totalQuantity / totalDays) : 0,
            productivity_score: this._calculateProductivityScore(production),
            consistency_score: this._calculateConsistencyScore(production),
            utilization_metrics: this._calculateUtilizationMetrics(production)
        };
    }

    /**
     * Calculate productivity score (0-100)
     */
    _calculateProductivityScore(production) {
        if (production.length === 0) return 0;
        
        const avgQuantity = production.reduce((sum, p) => sum + (p.total_quantity || 0), 0) / production.length;
        const targetQuantity = this.productionConfig.MAX_PRODUCTION_QUANTITY * 0.7; // 70% of max as target
        
        return Math.min(100, Math.round((avgQuantity / targetQuantity) * 100));
    }

    /**
     * Calculate consistency score (0-100)
     */
    _calculateConsistencyScore(production) {
        if (production.length < 2) return 100;
        
        const quantities = production.map(p => p.total_quantity || 0);
        const avg = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
        const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avg, 2), 0) / quantities.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Lower standard deviation relative to mean = higher consistency
        const coefficientOfVariation = avg > 0 ? standardDeviation / avg : 0;
        return Math.max(0, Math.round((1 - Math.min(1, coefficientOfVariation)) * 100));
    }

    /**
     * Calculate utilization metrics
     */
    _calculateUtilizationMetrics(production) {
        const uniqueDates = new Set(production.map(p => p.production_date));
        const totalDays = uniqueDates.size;
        
        // Calculate capacity utilization (assuming 8 hours/day, theoretical max production)
        const dailyCapacity = 500; // Example daily capacity
        const totalCapacity = totalDays * dailyCapacity;
        const actualProduction = production.reduce((sum, p) => sum + (p.total_quantity || 0), 0);
        
        return {
            capacity_utilization: totalCapacity > 0 ? Math.round((actualProduction / totalCapacity) * 100) : 0,
            active_days: totalDays,
            avg_production_per_day: totalDays > 0 ? Math.round(actualProduction / totalDays) : 0,
            theoretical_capacity: totalCapacity,
            actual_production: actualProduction
        };
    }

    /**
     * Get empty statistics structure
     */
    _getEmptyStats() {
        return {
            overview: {
                total_records: 0,
                total_quantity: 0,
                unique_products: 0,
                unique_dates: 0,
                avg_quantity_per_record: 0,
                avg_quantity_per_day: 0,
                date_range: null
            }
        };
    }

    /**
     * Get migration status for monitoring
     */
    async getMigrationStatus() {
        try {
            const tableInfo = await this.supabaseProductionQueries.getTableInfo();
            
            return {
                service: 'SupabaseProductionService',
                status: 'operational',
                initialized: this.initialized,
                database: {
                    accessible: tableInfo.accessible,
                    table: tableInfo.tableName,
                    record_count: tableInfo.recordCount
                },
                dependencies: {
                    supabase: !!this.supabase,
                    productService: !!this.hybridProductService,
                    auditService: !!this.hybridAuditService
                },
                config: this.config
            };
        } catch (error) {
            return {
                service: 'SupabaseProductionService',
                status: 'error',
                initialized: this.initialized,
                error: error.message
            };
        }
    }
}

module.exports = SupabaseProductionService; 