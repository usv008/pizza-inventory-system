const { NotFoundError, DatabaseError } = require('../middleware/errors/AppError');

/**
 * Supabase Production Queries - Enhanced query layer for production operations
 * Implements optimized production queries with proper joins and error handling
 */
class SupabaseProductionQueries {
    constructor(supabase) {
        this.supabase = supabase;
        this.tableName = 'production';
        this.productsTable = 'products';
        
        // Configuration for optimization
        this.config = {
            DEFAULT_LIMIT: 50,
            MAX_LIMIT: 1000,
            DEFAULT_ORDER: 'production_date',
            DEFAULT_ORDER_DIRECTION: 'desc',
            ENABLE_DETAILED_LOGGING: true
        };
        
        console.log('[SUPABASE-PRODUCTION-QUERIES] Initialized with optimized configuration');
    }

    /**
     * Get all production records with enhanced filtering and joins
     */
    async getAll(filters = {}) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Fetching all production records', { filters });

            let query = this.supabase
                .from(this.tableName)
                .select(`
                    *,
                    product:products!product_id (
                        id,
                        name,
                        stock_pieces,
                        stock_boxes,
                        category,
                        unit_cost
                    )
                `);

            // Apply filters
            if (filters.product_id) {
                query = query.eq('product_id', filters.product_id);
            }

            if (filters.start_date) {
                query = query.gte('production_date', filters.start_date);
            }

            if (filters.end_date) {
                query = query.lte('production_date', filters.end_date);
            }

            if (filters.responsible) {
                query = query.ilike('responsible', `%${filters.responsible}%`);
            }

            if (filters.min_quantity) {
                query = query.gte('total_quantity', filters.min_quantity);
            }

            if (filters.max_quantity) {
                query = query.lte('total_quantity', filters.max_quantity);
            }

            // Pagination - fixed limit issue
            const limit = Math.min(filters.limit || this.config.DEFAULT_LIMIT, this.config.MAX_LIMIT);
            const offset = filters.offset || 0;
            
            query = query.limit(limit);
            
            if (offset > 0) {
                query = query.range(offset, offset + limit - 1);
            }

            // Ordering
            const orderBy = filters.order_by || this.config.DEFAULT_ORDER;
            const orderDirection = filters.order_direction || this.config.DEFAULT_ORDER_DIRECTION;
            query = query.order(orderBy, { ascending: orderDirection === 'asc' });

            const { data, error, count } = await query;

            if (error) {
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error fetching production records:', error);
                throw new DatabaseError(`Failed to fetch production records: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully fetched ${data?.length || 0} production records`);
            
            return {
                data: data || [],
                count: count || data?.length || 0,
                pagination: {
                    limit,
                    offset,
                    total: count || data?.length || 0
                }
            };

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in getAll:', error);
            if (error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in getAll: ${error.message}`);
        }
    }

    /**
     * Get single production record by ID with joins
     */
    async getById(id) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Fetching production by ID:', id);

            if (!id || isNaN(id)) {
                throw new Error('Valid production ID is required');
            }

            const { data, error } = await this.supabase
                .from(this.tableName)
                .select(`
                    *,
                    product:products!product_id (
                        id,
                        name,
                        stock_pieces,
                        stock_boxes,
                        category,
                        unit_cost
                    )
                `)
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(`[SUPABASE-PRODUCTION-QUERIES] Production not found: ${id}`);
                    throw new NotFoundError(`Production with ID ${id} not found`);
                }
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error fetching production by ID:', error);
                throw new DatabaseError(`Failed to fetch production: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully fetched production: ${id}`);
            return data;

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in getById:', error);
            if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in getById: ${error.message}`);
        }
    }

    /**
     * Get production records by product ID with enhanced data - FIXED
     */
    async getByProductId(productId, filters = {}) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Fetching production by product ID:', productId, { filters });

            if (!productId || isNaN(productId)) {
                throw new Error('Valid product ID is required');
            }

            let query = this.supabase
                .from(this.tableName)
                .select(`
                    *,
                    product:products!product_id (
                        id,
                        name,
                        stock_pieces,
                        stock_boxes,
                        category
                    )
                `)
                .eq('product_id', productId);

            // Apply additional filters
            if (filters.start_date) {
                query = query.gte('production_date', filters.start_date);
            }

            if (filters.end_date) {
                query = query.lte('production_date', filters.end_date);
            }

            // Limit and ordering - FIXED
            const limit = Math.min(filters.limit || this.config.DEFAULT_LIMIT, this.config.MAX_LIMIT);
            query = query.limit(limit).order('production_date', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error fetching production by product:', error);
                throw new DatabaseError(`Failed to fetch production by product: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully fetched ${data?.length || 0} production records for product ${productId}`);
            return data || [];

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in getByProductId:', error);
            if (error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in getByProductId: ${error.message}`);
        }
    }

    /**
     * Create new production record
     */
    async create(productionData) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Creating production record', {
                product_id: productionData.product_id,
                quantity: productionData.total_quantity,
                date: productionData.production_date
            });

            // Validate required fields
            if (!productionData.product_id || !productionData.total_quantity || !productionData.production_date) {
                throw new Error('product_id, total_quantity, and production_date are required');
            }

            // Prepare data for insertion
            const insertData = {
                product_id: parseInt(productionData.product_id),
                production_date: productionData.production_date,
                total_quantity: parseInt(productionData.total_quantity),
                responsible: productionData.responsible || 'System',
                notes: productionData.notes || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from(this.tableName)
                .insert(insertData)
                .select(`
                    *,
                    product:products!product_id (
                        id,
                        name,
                        category
                    )
                `)
                .single();

            if (error) {
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error creating production:', error);
                throw new DatabaseError(`Failed to create production: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully created production: ${data.id}`);
            return data;

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in create:', error);
            if (error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in create: ${error.message}`);
        }
    }

    /**
     * Update production record
     */
    async update(id, updateData) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Updating production record:', id, {
                fields: Object.keys(updateData)
            });

            if (!id || isNaN(id)) {
                throw new Error('Valid production ID is required');
            }

            // Prepare data for update
            const preparedData = {
                ...updateData,
                updated_at: new Date().toISOString()
            };

            // Remove fields that shouldn't be updated
            delete preparedData.id;
            delete preparedData.created_at;

            const { data, error } = await this.supabase
                .from(this.tableName)
                .update(preparedData)
                .eq('id', id)
                .select(`
                    *,
                    product:products!product_id (
                        id,
                        name,
                        category
                    )
                `)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new NotFoundError(`Production with ID ${id} not found`);
                }
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error updating production:', error);
                throw new DatabaseError(`Failed to update production: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully updated production: ${id}`);
            return data;

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in update:', error);
            if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in update: ${error.message}`);
        }
    }

    /**
     * Delete production record
     */
    async delete(id) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Deleting production record:', id);

            if (!id || isNaN(id)) {
                throw new Error('Valid production ID is required');
            }

            const { data, error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('id', id)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new NotFoundError(`Production with ID ${id} not found`);
                }
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error deleting production:', error);
                throw new DatabaseError(`Failed to delete production: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully deleted production: ${id}`);
            return data;

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in delete:', error);
            if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in delete: ${error.message}`);
        }
    }

    /**
     * Get production records by date range
     */
    async getByDateRange(startDate, endDate, filters = {}) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Fetching production by date range', {
                startDate,
                endDate,
                filters
            });

            let query = this.supabase
                .from(this.tableName)
                .select(`
                    *,
                    product:products!product_id (
                        id,
                        name,
                        category
                    )
                `);

            // Apply date range
            if (startDate) {
                query = query.gte('production_date', startDate);
            }

            if (endDate) {
                query = query.lte('production_date', endDate);
            }

            // Additional filters
            if (filters.product_id) {
                query = query.eq('product_id', filters.product_id);
            }

            if (filters.responsible) {
                query = query.ilike('responsible', `%${filters.responsible}%`);
            }

            // Ordering
            query = query.order('production_date', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error fetching production by date range:', error);
                throw new DatabaseError(`Failed to fetch production by date range: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully fetched ${data?.length || 0} production records for date range`);
            return data || [];

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in getByDateRange:', error);
            if (error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in getByDateRange: ${error.message}`);
        }
    }

    /**
     * Get production statistics with enhanced calculations - FIXED
     */
    async getStatistics(filters = {}) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Fetching production statistics', { filters });

            let query = this.supabase
                .from(this.tableName)
                .select('*');

            // Apply date filters - FIXED
            if (filters.start_date) {
                query = query.gte('production_date', filters.start_date);
            }

            if (filters.end_date) {
                query = query.lte('production_date', filters.end_date);
            }

            // Additional filters
            if (filters.product_id) {
                query = query.eq('product_id', filters.product_id);
            }

            if (filters.responsible) {
                query = query.ilike('responsible', `%${filters.responsible}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error fetching production statistics:', error);
                throw new DatabaseError(`Failed to fetch production statistics: ${error.message}`);
            }

            console.log(`[SUPABASE-PRODUCTION-QUERIES] Successfully fetched ${data?.length || 0} production records for statistics`);
            return data || [];

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in getStatistics:', error);
            if (error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in getStatistics: ${error.message}`);
        }
    }

    /**
     * Validate duplicate production entries
     */
    async validateDuplicates(productId, productionDate, excludeId = null) {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Validating duplicates', {
                productId,
                productionDate,
                excludeId
            });

            let query = this.supabase
                .from(this.tableName)
                .select('id, product_id, production_date, total_quantity')
                .eq('product_id', productId)
                .eq('production_date', productionDate);

            if (excludeId) {
                query = query.neq('id', excludeId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error validating duplicates:', error);
                throw new DatabaseError(`Failed to validate duplicates: ${error.message}`);
            }

            const duplicates = data || [];
            console.log(`[SUPABASE-PRODUCTION-QUERIES] Found ${duplicates.length} potential duplicates`);

            return {
                hasDuplicates: duplicates.length > 0,
                duplicates,
                count: duplicates.length
            };

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in validateDuplicates:', error);
            if (error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in validateDuplicates: ${error.message}`);
        }
    }

    /**
     * Get table information and health check
     */
    async getTableInfo() {
        try {
            console.log('[SUPABASE-PRODUCTION-QUERIES] Getting table information');

            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('count(*)', { count: 'exact', head: true });

            if (error) {
                console.error('[SUPABASE-PRODUCTION-QUERIES] Error getting table info:', error);
                throw new DatabaseError(`Failed to get table info: ${error.message}`);
            }

            return {
                tableName: this.tableName,
                totalRecords: data || 0,
                status: 'healthy',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[SUPABASE-PRODUCTION-QUERIES] Error in getTableInfo:', error);
            if (error instanceof DatabaseError) throw error;
            throw new DatabaseError(`Database error in getTableInfo: ${error.message}`);
        }
    }
}

module.exports = SupabaseProductionQueries; 