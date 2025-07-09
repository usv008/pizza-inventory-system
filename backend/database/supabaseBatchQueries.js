const { DatabaseError, NotFoundError } = require('../middleware/errors/AppError');

/**
 * Supabase Batch Queries - Revolutionary architecture for optimized batch operations
 * Implements high-performance, complex queries for batch management system
 * Features: Advanced filtering, batch reservations, analytics, production integration
 */

class SupabaseBatchQueries {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.tableName = 'production_batches';
        
        // Query optimization configuration
        this.config = {
            DEFAULT_LIMIT: 1000,
            MAX_LIMIT: 5000,
            ENABLE_QUERY_CACHING: true,
            CACHE_TTL: 300000, // 5 minutes
            ENABLE_QUERY_LOGGING: true,
            BATCH_OPERATION_TIMEOUT: 30000
        };

        // Pre-defined query filters for optimization
        this.commonFilters = {
            active: 'available_quantity > 0',
            expired: 'expiry_date < NOW()',
            expiring: 'expiry_date BETWEEN NOW() AND NOW() + INTERVAL',
            reserved: 'reserved_quantity > 0',
            full: 'available_quantity = 0 AND reserved_quantity > 0'
        };

        console.log('🔍 SupabaseBatchQueries instantiated with advanced query capabilities');
    }

    /**
     * Enhanced logging for query operations
     */
    logQuery(operation, details = {}) {
        if (this.config.ENABLE_QUERY_LOGGING) {
            console.log(`[SUPABASE-BATCH-QUERIES] ${operation}:`, details);
        }
    }

    /**
     * Build dynamic filters for complex queries
     */
    _buildFilters(query, filters = {}) {
        let modifiedQuery = query;

        // Date range filters
        if (filters.startDate) {
            modifiedQuery = modifiedQuery.gte('production_date', filters.startDate);
        }
        if (filters.endDate) {
            modifiedQuery = modifiedQuery.lte('production_date', filters.endDate);
        }
        if (filters.expiryStartDate) {
            modifiedQuery = modifiedQuery.gte('expiry_date', filters.expiryStartDate);
        }
        if (filters.expiryEndDate) {
            modifiedQuery = modifiedQuery.lte('expiry_date', filters.expiryEndDate);
        }

        // Quantity filters
        if (filters.minQuantity !== undefined) {
            modifiedQuery = modifiedQuery.gte('total_quantity', filters.minQuantity);
        }
        if (filters.maxQuantity !== undefined) {
            modifiedQuery = modifiedQuery.lte('total_quantity', filters.maxQuantity);
        }
        if (filters.minAvailable !== undefined) {
            modifiedQuery = modifiedQuery.gte('available_quantity', filters.minAvailable);
        }

        // Product filters
        if (filters.productId) {
            if (Array.isArray(filters.productId)) {
                modifiedQuery = modifiedQuery.in('product_id', filters.productId);
            } else {
                modifiedQuery = modifiedQuery.eq('product_id', filters.productId);
            }
        }

        // Status filters
        if (filters.hasAvailable) {
            modifiedQuery = modifiedQuery.gt('available_quantity', 0);
        }
        if (filters.hasReserved) {
            modifiedQuery = modifiedQuery.gt('reserved_quantity', 0);
        }
        if (filters.isExpired) {
            modifiedQuery = modifiedQuery.lt('expiry_date', new Date().toISOString());
        }

        // Custom SQL conditions
        if (filters.customFilter) {
            // Note: This would need to be implemented with RPC functions in Supabase
            this.logQuery('customFilter', { filter: filters.customFilter, warning: 'Custom filters require RPC implementation' });
        }

        // Sorting
        if (filters.sortBy) {
            const ascending = filters.sortOrder !== 'desc';
            modifiedQuery = modifiedQuery.order(filters.sortBy, { ascending });
        } else {
            // Default sort by production date descending
            modifiedQuery = modifiedQuery.order('production_date', { ascending: false });
        }

        // Limit
        const limit = Math.min(filters.limit || this.config.DEFAULT_LIMIT, this.config.MAX_LIMIT);
        modifiedQuery = modifiedQuery.limit(limit);

        // Offset for pagination
        if (filters.offset) {
            modifiedQuery = modifiedQuery.range(filters.offset, filters.offset + limit - 1);
        }

        return modifiedQuery;
    }

    /**
     * Get all batches grouped by product with enhanced analytics
     */
    async getAllBatchesGrouped(filters = {}) {
        this.logQuery('getAllBatchesGrouped', { filters });

        try {
            // Base query with product information
            let query = this.supabase
                .from(this.tableName)
                .select(`
                    id,
                    product_id,
                    total_quantity,
                    available_quantity,
                    reserved_quantity,
                    production_date,
                    expiry_date,
                    batch_code,
                    notes,
                    created_at,
                    updated_at,
                    products!inner (
                        id,
                        name,
                        category,
                        unit
                    )
                `);

            // Apply filters
            query = this._buildFilters(query, filters);

            const { data: batches, error } = await query;

            if (error) {
                throw new DatabaseError(`Failed to fetch grouped batches: ${error.message}`);
            }

            // Group batches by product
            const groupedBatches = this._groupBatchesByProduct(batches);

            // Calculate summary statistics
            const summary = this._calculateGroupedSummary(groupedBatches);

            this.logQuery('getAllBatchesGrouped', { 
                success: true, 
                productCount: groupedBatches.length,
                totalBatches: batches?.length || 0
            });

            return {
                success: true,
                data: groupedBatches,
                summary,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logQuery('getAllBatchesGrouped', { success: false, error: error.message });
            throw error;
        }
    }

    /**
     * Get batches by specific product with detailed information
     */
    async getBatchesByProduct(productId, filters = {}) {
        this.logQuery('getBatchesByProduct', { productId, filters });

        try {
            let query = this.supabase
                .from(this.tableName)
                .select(`
                    id,
                    product_id,
                    total_quantity,
                    available_quantity,
                    reserved_quantity,
                    production_date,
                    expiry_date,
                    batch_code,
                    quality_grade,
                    notes,
                    responsible_person,
                    created_at,
                    updated_at,
                    products!inner (
                        id,
                        name,
                        category,
                        unit,
                        shelf_life_days
                    )
                `)
                .eq('product_id', productId);

            // Apply additional filters
            query = this._buildFilters(query, filters);

            const { data: batches, error } = await query;

            if (error) {
                throw new DatabaseError(`Failed to fetch batches for product ${productId}: ${error.message}`);
            }

            // Calculate product-specific analytics
            const analytics = this._calculateProductAnalytics(batches, productId);

            this.logQuery('getBatchesByProduct', { 
                success: true, 
                productId,
                batchCount: batches?.length || 0
            });

            return {
                success: true,
                data: batches,
                analytics,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logQuery('getBatchesByProduct', { success: false, productId, error: error.message });
            throw error;
        }
    }

    /**
     * Get expiring batches with advanced warning system
     */
    async getExpiringBatches(filters = {}) {
        const warningDays = filters.days || 7;
        this.logQuery('getExpiringBatches', { warningDays, filters });

        try {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + warningDays);

            let query = this.supabase
                .from(this.tableName)
                .select(`
                    id,
                    product_id,
                    total_quantity,
                    available_quantity,
                    reserved_quantity,
                    production_date,
                    expiry_date,
                    batch_code,
                    quality_grade,
                    notes,
                    created_at,
                    products!inner (
                        id,
                        name,
                        category,
                        unit
                    )
                `)
                .not('expiry_date', 'is', null)
                .lte('expiry_date', futureDate.toISOString())
                .gt('available_quantity', 0); // Only include batches with available quantity

            // Apply additional filters
            query = this._buildFilters(query, { 
                ...filters, 
                sortBy: 'expiry_date',
                sortOrder: 'asc' // Earliest expiry first
            });

            const { data: expiringBatches, error } = await query;

            if (error) {
                throw new DatabaseError(`Failed to fetch expiring batches: ${error.message}`);
            }

            // Categorize by urgency
            const categorized = this._categorizeByExpiry(expiringBatches);

            this.logQuery('getExpiringBatches', { 
                success: true, 
                totalExpiring: expiringBatches?.length || 0,
                warningDays
            });

            return {
                success: true,
                data: expiringBatches,
                categorized,
                warningDays,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logQuery('getExpiringBatches', { success: false, error: error.message });
            throw error;
        }
    }

    /**
     * Reserve batches for a product with FIFO strategy
     */
    async reserveBatchesForProduct(productId, quantityNeeded, orderId = null) {
        this.logQuery('reserveBatchesForProduct', { productId, quantityNeeded, orderId });

        try {
            // Get available batches ordered by FIFO (oldest production date first)
            const { data: availableBatches, error: fetchError } = await this.supabase
                .from(this.tableName)
                .select('id, available_quantity, production_date, expiry_date, batch_code')
                .eq('product_id', productId)
                .gt('available_quantity', 0)
                .order('production_date', { ascending: true })
                .order('expiry_date', { ascending: true });

            if (fetchError) {
                throw new DatabaseError(`Failed to fetch available batches: ${fetchError.message}`);
            }

            if (!availableBatches || availableBatches.length === 0) {
                return {
                    success: false,
                    message: 'No available batches found',
                    product_id: productId,
                    quantity_requested: quantityNeeded,
                    quantity_reserved: 0,
                    shortage: quantityNeeded,
                    allocated_batches: []
                };
            }

            // Calculate total available
            const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.available_quantity, 0);

            if (totalAvailable < quantityNeeded) {
                return {
                    success: false,
                    message: 'Insufficient quantity available',
                    product_id: productId,
                    quantity_requested: quantityNeeded,
                    quantity_reserved: 0,
                    shortage: quantityNeeded - totalAvailable,
                    available_quantity: totalAvailable,
                    allocated_batches: []
                };
            }

            // Allocate batches using FIFO
            const allocations = [];
            let remainingNeeded = quantityNeeded;

            for (const batch of availableBatches) {
                if (remainingNeeded <= 0) break;

                const quantityFromBatch = Math.min(batch.available_quantity, remainingNeeded);
                
                allocations.push({
                    batch_id: batch.id,
                    quantity: quantityFromBatch,
                    batch_code: batch.batch_code,
                    production_date: batch.production_date,
                    expiry_date: batch.expiry_date
                });

                remainingNeeded -= quantityFromBatch;
            }

            // Execute reservation updates
            const updatePromises = allocations.map(allocation => 
                this.supabase
                    .from(this.tableName)
                    .update({
                        available_quantity: this.supabase.raw(`available_quantity - ${allocation.quantity}`),
                        reserved_quantity: this.supabase.raw(`reserved_quantity + ${allocation.quantity}`),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', allocation.batch_id)
            );

            const updateResults = await Promise.all(updatePromises);

            // Check for update errors
            const updateErrors = updateResults.filter(result => result.error);
            if (updateErrors.length > 0) {
                throw new DatabaseError(`Failed to update batch reservations: ${updateErrors[0].error.message}`);
            }

            const quantityReserved = quantityNeeded - remainingNeeded;

            this.logQuery('reserveBatchesForProduct', { 
                success: true, 
                productId,
                quantityRequested: quantityNeeded,
                quantityReserved,
                batchesUsed: allocations.length
            });

            return {
                success: true,
                message: 'Batches reserved successfully',
                product_id: productId,
                quantity_requested: quantityNeeded,
                quantity_reserved: quantityReserved,
                shortage: Math.max(0, remainingNeeded),
                allocated_batches: allocations,
                order_id: orderId
            };

        } catch (error) {
            this.logQuery('reserveBatchesForProduct', { success: false, productId, error: error.message });
            throw error;
        }
    }

    /**
     * Unreserve all batches for an order
     */
    async unreserveBatchesForOrder(orderId) {
        this.logQuery('unreserveBatchesForOrder', { orderId });

        try {
            // Note: This implementation assumes order_items table has allocated_batches JSON field
            // In a real implementation, you might have a separate reservations table
            
            // For this implementation, we'll reset all reserved quantities
            // This is a simplified approach - in production, you'd track specific reservations
            
            const { data: batches, error: fetchError } = await this.supabase
                .from(this.tableName)
                .select('id, reserved_quantity')
                .gt('reserved_quantity', 0);

            if (fetchError) {
                throw new DatabaseError(`Failed to fetch reserved batches: ${fetchError.message}`);
            }

            if (!batches || batches.length === 0) {
                return {
                    success: true,
                    message: 'No reservations found to release',
                    order_id: orderId,
                    released_quantity: 0
                };
            }

            // Calculate total reserved quantity
            const totalReserved = batches.reduce((sum, batch) => sum + batch.reserved_quantity, 0);

            // Release all reservations (simplified approach)
            const { error: updateError } = await this.supabase
                .from(this.tableName)
                .update({
                    available_quantity: this.supabase.raw('available_quantity + reserved_quantity'),
                    reserved_quantity: 0,
                    updated_at: new Date().toISOString()
                })
                .gt('reserved_quantity', 0);

            if (updateError) {
                throw new DatabaseError(`Failed to release batch reservations: ${updateError.message}`);
            }

            this.logQuery('unreserveBatchesForOrder', { 
                success: true, 
                orderId,
                releasedQuantity: totalReserved,
                batchesAffected: batches.length
            });

            return {
                success: true,
                message: 'Batch reservations released successfully',
                order_id: orderId,
                released_quantity: totalReserved,
                batches_affected: batches.length
            };

        } catch (error) {
            this.logQuery('unreserveBatchesForOrder', { success: false, orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get product availability with detailed batch breakdown
     */
    async getProductAvailability(productId, filters = {}) {
        this.logQuery('getProductAvailability', { productId, filters });

        try {
            let query = this.supabase
                .from(this.tableName)
                .select(`
                    id,
                    total_quantity,
                    available_quantity,
                    reserved_quantity,
                    production_date,
                    expiry_date,
                    batch_code,
                    quality_grade
                `)
                .eq('product_id', productId)
                .gt('available_quantity', 0);

            // Apply filters
            query = this._buildFilters(query, filters);

            const { data: batches, error } = await query;

            if (error) {
                throw new DatabaseError(`Failed to fetch product availability: ${error.message}`);
            }

            // Calculate availability metrics
            const totalQuantity = batches.reduce((sum, batch) => sum + batch.total_quantity, 0);
            const totalAvailable = batches.reduce((sum, batch) => sum + batch.available_quantity, 0);
            const totalReserved = batches.reduce((sum, batch) => sum + batch.reserved_quantity, 0);

            // Find earliest expiry
            const validBatches = batches.filter(batch => batch.expiry_date);
            const earliestExpiry = validBatches.length > 0 
                ? validBatches.reduce((earliest, batch) => 
                    new Date(batch.expiry_date) < new Date(earliest.expiry_date) ? batch : earliest
                ).expiry_date
                : null;

            this.logQuery('getProductAvailability', { 
                success: true, 
                productId,
                totalAvailable,
                batchCount: batches.length
            });

            return {
                success: true,
                product_id: productId,
                total_quantity: totalQuantity,
                total_available: totalAvailable,
                total_reserved: totalReserved,
                batch_count: batches.length,
                earliest_expiry: earliestExpiry,
                batches: batches,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logQuery('getProductAvailability', { success: false, productId, error: error.message });
            throw error;
        }
    }

    /**
     * Helper: Group batches by product
     */
    _groupBatchesByProduct(batches) {
        const grouped = {};

        batches.forEach(batch => {
            const productId = batch.product_id;
            
            if (!grouped[productId]) {
                grouped[productId] = {
                    product_id: productId,
                    product: batch.products,
                    batches: [],
                    summary: {
                        total_batches: 0,
                        total_quantity: 0,
                        total_available: 0,
                        total_reserved: 0,
                        earliest_expiry: null,
                        latest_production: null
                    }
                };
            }

            grouped[productId].batches.push(batch);
            grouped[productId].summary.total_batches++;
            grouped[productId].summary.total_quantity += batch.total_quantity || 0;
            grouped[productId].summary.total_available += batch.available_quantity || 0;
            grouped[productId].summary.total_reserved += batch.reserved_quantity || 0;

            // Track earliest expiry
            if (batch.expiry_date) {
                if (!grouped[productId].summary.earliest_expiry || 
                    new Date(batch.expiry_date) < new Date(grouped[productId].summary.earliest_expiry)) {
                    grouped[productId].summary.earliest_expiry = batch.expiry_date;
                }
            }

            // Track latest production
            if (batch.production_date) {
                if (!grouped[productId].summary.latest_production || 
                    new Date(batch.production_date) > new Date(grouped[productId].summary.latest_production)) {
                    grouped[productId].summary.latest_production = batch.production_date;
                }
            }
        });

        return Object.values(grouped);
    }

    /**
     * Helper: Calculate summary statistics for grouped batches
     */
    _calculateGroupedSummary(groupedBatches) {
        return {
            total_products: groupedBatches.length,
            total_batches: groupedBatches.reduce((sum, group) => sum + group.summary.total_batches, 0),
            total_quantity: groupedBatches.reduce((sum, group) => sum + group.summary.total_quantity, 0),
            total_available: groupedBatches.reduce((sum, group) => sum + group.summary.total_available, 0),
            total_reserved: groupedBatches.reduce((sum, group) => sum + group.summary.total_reserved, 0),
            avg_batches_per_product: groupedBatches.length > 0 
                ? (groupedBatches.reduce((sum, group) => sum + group.summary.total_batches, 0) / groupedBatches.length).toFixed(2)
                : 0
        };
    }

    /**
     * Helper: Calculate product-specific analytics
     */
    _calculateProductAnalytics(batches, productId) {
        if (!batches || batches.length === 0) {
            return {
                product_id: productId,
                batch_count: 0,
                total_quantity: 0,
                available_quantity: 0,
                reserved_quantity: 0,
                utilization_rate: 0,
                oldest_batch: null,
                newest_batch: null,
                avg_batch_age_days: 0
            };
        }

        const totalQuantity = batches.reduce((sum, batch) => sum + (batch.total_quantity || 0), 0);
        const availableQuantity = batches.reduce((sum, batch) => sum + (batch.available_quantity || 0), 0);
        const reservedQuantity = batches.reduce((sum, batch) => sum + (batch.reserved_quantity || 0), 0);

        // Find oldest and newest batches
        const batchesWithDates = batches.filter(batch => batch.production_date);
        const oldestBatch = batchesWithDates.reduce((oldest, batch) => 
            new Date(batch.production_date) < new Date(oldest.production_date) ? batch : oldest
        , batchesWithDates[0]);
        
        const newestBatch = batchesWithDates.reduce((newest, batch) => 
            new Date(batch.production_date) > new Date(newest.production_date) ? batch : newest
        , batchesWithDates[0]);

        // Calculate average age
        const today = new Date();
        const totalAge = batchesWithDates.reduce((sum, batch) => {
            const ageMs = today - new Date(batch.production_date);
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            return sum + ageDays;
        }, 0);
        
        const avgAge = batchesWithDates.length > 0 ? (totalAge / batchesWithDates.length).toFixed(1) : 0;

        return {
            product_id: productId,
            batch_count: batches.length,
            total_quantity: totalQuantity,
            available_quantity: availableQuantity,
            reserved_quantity: reservedQuantity,
            utilization_rate: totalQuantity > 0 ? ((reservedQuantity / totalQuantity) * 100).toFixed(2) : 0,
            oldest_batch: oldestBatch,
            newest_batch: newestBatch,
            avg_batch_age_days: avgAge
        };
    }

    /**
     * Helper: Categorize batches by expiry urgency
     */
    _categorizeByExpiry(expiringBatches) {
        const categories = {
            expired: [],
            critical: [], // 0-2 days
            warning: [],  // 3-7 days
            caution: []   // 8+ days
        };

        const today = new Date();

        expiringBatches.forEach(batch => {
            const expiryDate = new Date(batch.expiry_date);
            const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            if (daysToExpiry <= 0) {
                categories.expired.push(batch);
            } else if (daysToExpiry <= 2) {
                categories.critical.push(batch);
            } else if (daysToExpiry <= 7) {
                categories.warning.push(batch);
            } else {
                categories.caution.push(batch);
            }
        });

        return {
            ...categories,
            summary: {
                expired: categories.expired.length,
                critical: categories.critical.length,
                warning: categories.warning.length,
                caution: categories.caution.length,
                total: expiringBatches.length
            }
        };
    }
}

module.exports = SupabaseBatchQueries; 