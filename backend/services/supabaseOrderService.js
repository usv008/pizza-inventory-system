const { createClient } = require('@supabase/supabase-js');
const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Supabase Order Service - Enhanced direct migration pattern
 * Implements multi-table transaction simulation with compensating actions
 * Optimized complex queries with efficient joins for 14 OrderService methods
 */

class SupabaseOrderService {
    constructor() {
        this.supabaseClient = null;
        this.hybridBatchService = null;
        this.hybridAuditService = null;
        this.initialized = false;
    }

    /**
     * Initialize Supabase Order Service
     */
    initialize(dependencies) {
        // Initialize Supabase client
        this.supabaseClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Initialize hybrid dependencies
        this.hybridBatchService = dependencies.hybridBatchService;
        this.hybridAuditService = dependencies.hybridAuditService;

        this.initialized = true;
        console.log('[SUPABASE-ORDER] ✅ Supabase Order Service initialized');
    }

    /**
     * Check initialization
     */
    _checkInitialization() {
        if (!this.initialized || !this.supabaseClient) {
            throw new DatabaseError('SupabaseOrderService not initialized');
        }
    }

    /**
     * Create comprehensive error context
     */
    _createErrorContext(operation, details = {}) {
        return {
            timestamp: new Date().toISOString(),
            operation,
            service: 'SupabaseOrderService',
            ...details
        };
    }

    /**
     * Execute multi-table operation with transaction simulation
     */
    async _executeMultiTableTransaction(operation, operations) {
        const executedOperations = [];
        const compensatingActions = [];
        
        console.log(`[SUPABASE-ORDER] Starting multi-table transaction: ${operation}`);
        
        try {
            // Execute all operations in sequence, tracking each one
            for (const op of operations) {
                console.log(`[SUPABASE-ORDER] Executing: ${op.description}`);
                
                const result = await op.execute();
                executedOperations.push({
                    operation: op.description,
                    result,
                    compensate: op.compensate
                });
                
                // Add compensating action to front of stack
                if (op.compensate) {
                    compensatingActions.unshift(() => op.compensate(result));
                }
                
                console.log(`[SUPABASE-ORDER] Success: ${op.description}`);
            }
            
            console.log(`[SUPABASE-ORDER] Multi-table transaction completed: ${operation}`);
            return executedOperations[executedOperations.length - 1]?.result;
            
        } catch (error) {
            console.error(`[SUPABASE-ORDER] Error in multi-table transaction: ${operation}`, error);
            
            // Execute compensating actions in reverse order
            for (const compensate of compensatingActions) {
                try {
                    console.log('[SUPABASE-ORDER] Executing compensating action');
                    await compensate();
                } catch (compensateError) {
                    console.error('[SUPABASE-ORDER] Compensating action failed:', compensateError);
                }
            }
            
            throw error;
        }
    }

    /**
     * 1. Get all orders with optimized joins
     */
    async getAllOrders(filters = {}) {
        this._checkInitialization();
        
        try {
            let query = this.supabaseClient
                .from('orders')
                .select(`
                    *,
                    clients!inner(id, name, email, phone),
                    order_items(
                        id, quantity, unit_price, total_price,
                        products!inner(id, name, unit, selling_price)
                    )
                `)
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.client_id) {
                query = query.eq('client_id', filters.client_id);
            }
            if (filters.date_from) {
                query = query.gte('order_date', filters.date_from);
            }
            if (filters.date_to) {
                query = query.lte('order_date', filters.date_to);
            }

            const { data, error } = await query;

            if (error) {
                throw new DatabaseError(`Supabase error in getAllOrders: ${error.message}`);
            }

            console.log(`[SUPABASE-ORDER] Retrieved ${data.length} orders with full details`);
            return data || [];
            
        } catch (error) {
            console.error('[SUPABASE-ORDER] Error in getAllOrders:', error);
            throw new DatabaseError(`Error retrieving orders: ${error.message}`);
        }
    }

    /**
     * 2. Get order by ID with comprehensive details
     */
    async getOrderById(orderId) {
        this._checkInitialization();
        
        try {
            const { data, error } = await this.supabaseClient
                .from('orders')
                .select(`
                    *,
                    clients!inner(id, name, email, phone, address),
                    order_items(
                        id, quantity, unit_price, total_price,
                        products!inner(id, name, unit, selling_price, description)
                    )
                `)
                .eq('id', orderId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(`[SUPABASE-ORDER] Order not found: ${orderId}`);
                    return null;
                }
                throw new DatabaseError(`Supabase error in getOrderById: ${error.message}`);
            }

            console.log(`[SUPABASE-ORDER] Retrieved order: ${data.order_number} (ID: ${orderId})`);
            return data;
            
        } catch (error) {
            console.error(`[SUPABASE-ORDER] Error in getOrderById ${orderId}:`, error);
            throw new DatabaseError(`Error retrieving order: ${error.message}`);
        }
    }

    /**
     * 3. Get order for edit with products list
     */
    async getOrderForEdit(orderId) {
        this._checkInitialization();
        
        try {
            // Get order and products in parallel for efficiency
            const [orderResult, productsResult] = await Promise.all([
                this.supabaseClient
                    .from('orders')
                    .select(`
                        *,
                        clients!inner(id, name, email),
                        order_items(
                            id, quantity, unit_price, total_price,
                            products!inner(id, name, unit, selling_price)
                        )
                    `)
                    .eq('id', orderId)
                    .single(),
                this.supabaseClient
                    .from('products')
                    .select('id, name, unit, selling_price, description')
                    .order('name')
            ]);

            if (orderResult.error && orderResult.error.code === 'PGRST116') {
                console.log(`[SUPABASE-ORDER] Order for edit not found: ${orderId}`);
                return { order: null, products: productsResult.data || [] };
            }

            if (orderResult.error) {
                throw new DatabaseError(`Supabase error in getOrderForEdit: ${orderResult.error.message}`);
            }

            if (productsResult.error) {
                console.warn('[SUPABASE-ORDER] Error loading products for edit:', productsResult.error);
            }

            console.log(`[SUPABASE-ORDER] Retrieved order for edit: ${orderResult.data.order_number}`);
            
            return {
                order: orderResult.data,
                products: productsResult.data || []
            };
            
        } catch (error) {
            console.error(`[SUPABASE-ORDER] Error in getOrderForEdit ${orderId}:`, error);
            throw new DatabaseError(`Error retrieving order for edit: ${error.message}`);
        }
    }

    /**
     * 4. Create order with multi-table transaction simulation
     */
    async createOrder(orderData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Validate products before creating
            await this._validateOrderProducts(orderData.items);

            const result = await this._executeMultiTableTransaction('createOrder', [
                {
                    description: 'Create order record',
                    execute: async () => {
                        const { data, error } = await this.supabaseClient
                            .from('orders')
                            .insert([{
                                order_number: orderData.order_number,
                                client_id: orderData.client_id,
                                order_date: orderData.order_date || new Date().toISOString(),
                                status: orderData.status || 'NEW',
                                notes: orderData.notes || '',
                                total_amount: orderData.total_amount || 0,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }])
                            .select()
                            .single();

                        if (error) {
                            throw new DatabaseError(`Error creating order: ${error.message}`);
                        }
                        
                        return data;
                    },
                    compensate: async (orderData) => {
                        // Delete created order if subsequent operations fail
                        await this.supabaseClient
                            .from('orders')
                            .delete()
                            .eq('id', orderData.id);
                        console.log('[SUPABASE-ORDER] Compensated: deleted order', orderData.id);
                    }
                },
                {
                    description: 'Create order items',
                    execute: async () => {
                        const orderResult = result || arguments[0];
                        const orderId = orderResult.id;
                        
                        if (!orderData.items || orderData.items.length === 0) {
                            return [];
                        }

                        const orderItems = orderData.items.map(item => ({
                            order_id: orderId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price || item.price || 0,
                            total_price: (item.unit_price || item.price || 0) * item.quantity,
                            created_at: new Date().toISOString()
                        }));

                        const { data, error } = await this.supabaseClient
                            .from('order_items')
                            .insert(orderItems)
                            .select();

                        if (error) {
                            throw new DatabaseError(`Error creating order items: ${error.message}`);
                        }

                        return data;
                    },
                    compensate: async (itemsData) => {
                        // Delete created order items
                        if (itemsData && itemsData.length > 0) {
                            const itemIds = itemsData.map(item => item.id);
                            await this.supabaseClient
                                .from('order_items')
                                .delete()
                                .in('id', itemIds);
                            console.log('[SUPABASE-ORDER] Compensated: deleted order items', itemIds);
                        }
                    }
                }
            ]);

            // Try to reserve batches (non-blocking)
            let batchReservations = null;
            let warnings = null;

            if (this.hybridBatchService && orderData.items) {
                try {
                    const reservationResult = await this._reserveBatchesForNewOrder(result.id, orderData.items);
                    batchReservations = reservationResult.reservations;
                    warnings = reservationResult.warnings;
                } catch (batchError) {
                    console.warn('[SUPABASE-ORDER] Batch reservation error:', batchError.message);
                    warnings = [`Batch reservation error: ${batchError.message}`];
                }
            }

            // Log operation
            if (this.hybridAuditService) {
                try {
                    await this.hybridAuditService.logOrderCreation(result.id, orderData, auditInfo);
                } catch (auditError) {
                    console.warn('[SUPABASE-ORDER] Audit logging error:', auditError.message);
                }
            }

            console.log(`[SUPABASE-ORDER] ✅ Created order: ${result.order_number} (ID: ${result.id})`);

            return {
                id: result.id,
                order_number: result.order_number,
                batch_reservations: batchReservations,
                warnings: warnings
            };
            
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.error('[SUPABASE-ORDER] Error in createOrder:', error);
            throw new DatabaseError(`Error creating order: ${error.message}`);
        }
    }

    /**
     * 5. Update order with intelligent batch re-reservation
     */
    async updateOrder(orderId, orderData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Get old order for logging and compensation
            const oldOrder = await this.getOrderById(orderId);
            if (!oldOrder) {
                throw new NotFoundError('Order not found');
            }

            // Validate products if provided
            if (orderData.items) {
                await this._validateOrderProducts(orderData.items);
            }

            const result = await this._executeMultiTableTransaction('updateOrder', [
                {
                    description: 'Update order record',
                    execute: async () => {
                        const updateData = {
                            ...orderData,
                            updated_at: new Date().toISOString()
                        };
                        delete updateData.items; // Handle items separately

                        const { data, error } = await this.supabaseClient
                            .from('orders')
                            .update(updateData)
                            .eq('id', orderId)
                            .select()
                            .single();

                        if (error) {
                            throw new DatabaseError(`Error updating order: ${error.message}`);
                        }

                        return data;
                    },
                    compensate: async () => {
                        // Restore old order data
                        const restoreData = {
                            order_number: oldOrder.order_number,
                            client_id: oldOrder.client_id,
                            order_date: oldOrder.order_date,
                            status: oldOrder.status,
                            notes: oldOrder.notes,
                            total_amount: oldOrder.total_amount,
                            updated_at: oldOrder.updated_at
                        };
                        
                        await this.supabaseClient
                            .from('orders')
                            .update(restoreData)
                            .eq('id', orderId);
                        console.log('[SUPABASE-ORDER] Compensated: restored order data', orderId);
                    }
                },
                {
                    description: 'Update order items if provided',
                    execute: async () => {
                        if (!orderData.items) {
                            return null; // No items to update
                        }

                        // Delete existing order items
                        const { error: deleteError } = await this.supabaseClient
                            .from('order_items')
                            .delete()
                            .eq('order_id', orderId);

                        if (deleteError) {
                            throw new DatabaseError(`Error deleting old order items: ${deleteError.message}`);
                        }

                        // Insert new order items
                        const orderItems = orderData.items.map(item => ({
                            order_id: orderId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price || item.price || 0,
                            total_price: (item.unit_price || item.price || 0) * item.quantity,
                            created_at: new Date().toISOString()
                        }));

                        const { data, error } = await this.supabaseClient
                            .from('order_items')
                            .insert(orderItems)
                            .select();

                        if (error) {
                            throw new DatabaseError(`Error creating new order items: ${error.message}`);
                        }

                        return data;
                    },
                    compensate: async () => {
                        if (!orderData.items || !oldOrder.order_items) {
                            return;
                        }

                        // Delete new items and restore old items
                        await this.supabaseClient
                            .from('order_items')
                            .delete()
                            .eq('order_id', orderId);

                        // Restore old items
                        const oldItems = oldOrder.order_items.map(item => ({
                            order_id: orderId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total_price: item.total_price,
                            created_at: item.created_at || new Date().toISOString()
                        }));

                        await this.supabaseClient
                            .from('order_items')
                            .insert(oldItems);
                        console.log('[SUPABASE-ORDER] Compensated: restored old order items', orderId);
                    }
                }
            ]);

            // Handle batch reservations if items were updated
            let batchReservations = null;
            let warnings = null;

            if (orderData.items && this.hybridBatchService) {
                try {
                    // Unreserve old batches
                    await this.hybridBatchService.unreserveBatchesForOrder(orderId);
                    
                    // Reserve new batches
                    const reservationResult = await this._reserveBatchesForNewOrder(orderId, orderData.items);
                    batchReservations = reservationResult.reservations;
                    warnings = reservationResult.warnings;
                } catch (batchError) {
                    console.warn('[SUPABASE-ORDER] Batch re-reservation error:', batchError.message);
                    warnings = [`Batch re-reservation error: ${batchError.message}`];
                }
            }

            // Log operation
            if (this.hybridAuditService) {
                try {
                    await this.hybridAuditService.logOrderUpdate(orderId, orderData, auditInfo);
                } catch (auditError) {
                    console.warn('[SUPABASE-ORDER] Audit logging error:', auditError.message);
                }
            }

            console.log(`[SUPABASE-ORDER] ✅ Updated order: ${oldOrder.order_number} (ID: ${orderId})`);

            return {
                updated: true,
                order_number: result.order_number,
                batch_reservations: batchReservations,
                warnings: warnings
            };
            
        } catch (error) {
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            console.error(`[SUPABASE-ORDER] Error in updateOrder ${orderId}:`, error);
            throw new DatabaseError(`Error updating order: ${error.message}`);
        }
    }

    /**
     * 6. Update order status
     */
    async updateOrderStatus(orderId, status, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            const { data, error } = await this.supabaseClient
                .from('orders')
                .update({ 
                    status, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', orderId)
                .select('id, order_number, status')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new NotFoundError('Order not found');
                }
                throw new DatabaseError(`Error updating order status: ${error.message}`);
            }

            // Log operation
            if (this.hybridAuditService) {
                try {
                    await this.hybridAuditService.logOrderUpdate(orderId, { status }, auditInfo);
                } catch (auditError) {
                    console.warn('[SUPABASE-ORDER] Audit logging error:', auditError.message);
                }
            }

            console.log(`[SUPABASE-ORDER] ✅ Updated order status: ${data.order_number} -> ${status}`);
            return data;
            
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`[SUPABASE-ORDER] Error in updateOrderStatus ${orderId}:`, error);
            throw new DatabaseError(`Error updating order status: ${error.message}`);
        }
    }

    /**
     * 7. Cancel order with batch unreservation
     */
    async cancelOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new NotFoundError('Order not found');
            }

            // Update status to CANCELLED
            const { data, error } = await this.supabaseClient
                .from('orders')
                .update({ 
                    status: 'CANCELLED',
                    updated_at: new Date().toISOString() 
                })
                .eq('id', orderId)
                .select('id, order_number, status')
                .single();

            if (error) {
                throw new DatabaseError(`Error cancelling order: ${error.message}`);
            }

            // Unreserve batches
            let unreserveResult = null;
            if (this.hybridBatchService) {
                try {
                    unreserveResult = await this.hybridBatchService.unreserveBatchesForOrder(orderId);
                } catch (batchError) {
                    console.warn('[SUPABASE-ORDER] Batch unreservation error:', batchError.message);
                }
            }

            // Log operation
            if (this.hybridAuditService) {
                try {
                    await this.hybridAuditService.logOrderUpdate(orderId, { status: 'CANCELLED' }, auditInfo);
                } catch (auditError) {
                    console.warn('[SUPABASE-ORDER] Audit logging error:', auditError.message);
                }
            }

            console.log(`[SUPABASE-ORDER] ✅ Cancelled order: ${order.order_number} (ID: ${orderId})`);

            return {
                cancelled: true,
                order_number: data.order_number,
                freed_batches: unreserveResult?.freed_count || 0
            };
            
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`[SUPABASE-ORDER] Error in cancelOrder ${orderId}:`, error);
            throw new DatabaseError(`Error cancelling order: ${error.message}`);
        }
    }

    /**
     * 8. Delete order with multi-table cleanup
     */
    async deleteOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new NotFoundError('Order not found');
            }

            await this._executeMultiTableTransaction('deleteOrder', [
                {
                    description: 'Unreserve batches',
                    execute: async () => {
                        if (this.hybridBatchService) {
                            try {
                                return await this.hybridBatchService.unreserveBatchesForOrder(orderId);
                            } catch (error) {
                                console.warn('[SUPABASE-ORDER] Batch unreservation error on delete:', error.message);
                                return null;
                            }
                        }
                        return null;
                    },
                    compensate: null // Can't easily compensate batch operations
                },
                {
                    description: 'Delete order items',
                    execute: async () => {
                        const { error } = await this.supabaseClient
                            .from('order_items')
                            .delete()
                            .eq('order_id', orderId);

                        if (error) {
                            throw new DatabaseError(`Error deleting order items: ${error.message}`);
                        }
                        
                        return { deleted_items: true };
                    },
                    compensate: async () => {
                        // Restore order items if main delete fails
                        if (order.order_items && order.order_items.length > 0) {
                            const restoreItems = order.order_items.map(item => ({
                                order_id: orderId,
                                product_id: item.product_id,
                                quantity: item.quantity,
                                unit_price: item.unit_price,
                                total_price: item.total_price,
                                created_at: item.created_at || new Date().toISOString()
                            }));

                            await this.supabaseClient
                                .from('order_items')
                                .insert(restoreItems);
                            console.log('[SUPABASE-ORDER] Compensated: restored order items', orderId);
                        }
                    }
                },
                {
                    description: 'Delete order',
                    execute: async () => {
                        const { error } = await this.supabaseClient
                            .from('orders')
                            .delete()
                            .eq('id', orderId);

                        if (error) {
                            throw new DatabaseError(`Error deleting order: ${error.message}`);
                        }
                        
                        return { deleted_order: true };
                    },
                    compensate: async () => {
                        // Restore order if something fails after deletion
                        const restoreOrder = {
                            id: order.id,
                            order_number: order.order_number,
                            client_id: order.client_id,
                            order_date: order.order_date,
                            status: order.status,
                            notes: order.notes,
                            total_amount: order.total_amount,
                            created_at: order.created_at,
                            updated_at: order.updated_at
                        };

                        await this.supabaseClient
                            .from('orders')
                            .insert([restoreOrder]);
                        console.log('[SUPABASE-ORDER] Compensated: restored order', orderId);
                    }
                }
            ]);

            // Log operation
            if (this.hybridAuditService) {
                try {
                    await this.hybridAuditService.logOrderDeletion(orderId, auditInfo);
                } catch (auditError) {
                    console.warn('[SUPABASE-ORDER] Audit logging error:', auditError.message);
                }
            }

            console.log(`[SUPABASE-ORDER] ✅ Deleted order: ${order.order_number} (ID: ${orderId})`);

            return {
                deleted: true,
                order_number: order.order_number
            };
            
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`[SUPABASE-ORDER] Error in deleteOrder ${orderId}:`, error);
            throw new DatabaseError(`Error deleting order: ${error.message}`);
        }
    }

    /**
     * 9. Reserve batches for order
     */
    async reserveBatchesForOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new NotFoundError('Order not found');
            }

            if (!this.hybridBatchService) {
                throw new ValidationError('Batch service unavailable');
            }

            const reservationResult = await this._reserveBatchesForNewOrder(orderId, order.order_items);

            // Log operation
            if (this.hybridAuditService) {
                try {
                    await this.hybridAuditService.logOrderUpdate(orderId, { batch_operation: 'RESERVE' }, auditInfo);
                } catch (auditError) {
                    console.warn('[SUPABASE-ORDER] Audit logging error:', auditError.message);
                }
            }

            console.log(`[SUPABASE-ORDER] ✅ Reserved batches for order: ${order.order_number}`);

            return reservationResult;
            
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error(`[SUPABASE-ORDER] Error in reserveBatchesForOrder ${orderId}:`, error);
            throw new DatabaseError(`Error reserving batches: ${error.message}`);
        }
    }

    /**
     * 10. Unreserve batches for order
     */
    async unreserveBatchesForOrder(orderId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new NotFoundError('Order not found');
            }

            if (!this.hybridBatchService) {
                throw new ValidationError('Batch service unavailable');
            }

            const result = await this.hybridBatchService.unreserveBatchesForOrder(orderId);

            // Log operation
            if (this.hybridAuditService) {
                try {
                    await this.hybridAuditService.logOrderUpdate(orderId, { batch_operation: 'UNRESERVE' }, auditInfo);
                } catch (auditError) {
                    console.warn('[SUPABASE-ORDER] Audit logging error:', auditError.message);
                }
            }

            console.log(`[SUPABASE-ORDER] ✅ Unreserved batches for order: ${order.order_number}`);

            return { freed_count: result?.freed_count || 0 };
            
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error(`[SUPABASE-ORDER] Error in unreserveBatchesForOrder ${orderId}:`, error);
            throw new DatabaseError(`Error unreserving batches: ${error.message}`);
        }
    }

    /**
     * 11. Get order statistics with optimized aggregation
     */
    async getOrderStats(period = 'month') {
        this._checkInitialization();
        
        try {
            // Calculate date filter
            const now = new Date();
            let filterDate = new Date();
            
            switch (period) {
                case 'day':
                    filterDate.setDate(now.getDate() - 1);
                    break;
                case 'week':
                    filterDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    filterDate.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    filterDate.setFullYear(now.getFullYear() - 1);
                    break;
                default:
                    filterDate.setMonth(now.getMonth() - 1);
            }

            // Get all orders with items count
            const { data: allOrders, error: allError } = await this.supabaseClient
                .from('orders')
                .select(`
                    id, status, order_date, total_amount,
                    order_items(quantity)
                `);

            if (allError) {
                throw new DatabaseError(`Error getting all orders for stats: ${allError.message}`);
            }

            // Get period orders
            const { data: periodOrders, error: periodError } = await this.supabaseClient
                .from('orders')
                .select(`
                    id, status, order_date, total_amount,
                    order_items(quantity)
                `)
                .gte('order_date', filterDate.toISOString());

            if (periodError) {
                throw new DatabaseError(`Error getting period orders for stats: ${periodError.message}`);
            }

            // Calculate statistics
            const stats = {
                total_orders: allOrders.length,
                period_orders: periodOrders.length,
                orders_by_status: {},
                total_items: allOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0),
                total_quantity: allOrders.reduce((sum, o) => 
                    sum + (o.order_items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0), 0),
                period_items: periodOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0),
                period_quantity: periodOrders.reduce((sum, o) => 
                    sum + (o.order_items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0), 0),
                avg_items_per_order: allOrders.length > 0 ? 
                    (allOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0) / allOrders.length).toFixed(1) : 0,
                avg_quantity_per_order: allOrders.length > 0 ? 
                    (allOrders.reduce((sum, o) => 
                        sum + (o.order_items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0), 0) / allOrders.length).toFixed(1) : 0,
                total_amount: allOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
                period_amount: periodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
            };

            // Count by status
            const statuses = ['NEW', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
            statuses.forEach(status => {
                stats.orders_by_status[status] = allOrders.filter(o => o.status === status).length;
            });

            console.log(`[SUPABASE-ORDER] ✅ Generated order statistics for ${period}: ${stats.period_orders} orders`);
            return stats;
            
        } catch (error) {
            console.error('[SUPABASE-ORDER] Error in getOrderStats:', error);
            throw new DatabaseError(`Error getting order statistics: ${error.message}`);
        }
    }

    /**
     * 12. Validate order products
     */
    async _validateOrderProducts(items) {
        if (!items || items.length === 0) {
            return;
        }
        
        try {
            const productIds = items.map(item => item.product_id);
            
            const { data: products, error } = await this.supabaseClient
                .from('products')
                .select('id, name')
                .in('id', productIds);

            if (error) {
                console.warn('[SUPABASE-ORDER] Error validating products:', error.message);
                return; // Non-blocking validation
            }

            const foundProductIds = products.map(p => p.id);
            
            for (const item of items) {
                if (!foundProductIds.includes(item.product_id)) {
                    throw new ValidationError(`Product with ID ${item.product_id} not found`);
                }
            }
            
            console.log('[SUPABASE-ORDER] Products validated successfully');
            
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.warn('[SUPABASE-ORDER] Product validation error:', error.message);
        }
    }

    /**
     * 13. Reserve batches for new order (helper)
     */
    async _reserveBatchesForNewOrder(orderId, items) {
        const reservations = [];
        const warnings = [];

        if (!this.hybridBatchService || !items || items.length === 0) {
            return { reservations: [], warnings: null };
        }

        for (const item of items) {
            try {
                const batchResult = await this.hybridBatchService.reserveBatchesForOrderItem(orderId, {
                    product_id: item.product_id || item.products?.id,
                    quantity: item.quantity
                });

                if (batchResult && batchResult.reservations) {
                    reservations.push(...batchResult.reservations);
                }

                if (batchResult && batchResult.shortage) {
                    warnings.push(`Product ID ${item.product_id} shortage: ${batchResult.shortage} units`);
                }
            } catch (error) {
                console.warn(`[SUPABASE-ORDER] Batch reservation error for product ${item.product_id}:`, error.message);
                warnings.push(`Batch reservation error for product ID ${item.product_id}: ${error.message}`);
            }
        }

        return { 
            reservations: reservations.length > 0 ? reservations : [], 
            warnings: warnings.length > 0 ? warnings : null 
        };
    }

    /**
     * 14. Get migration health status
     */
    getMigrationStatus() {
        return {
            service: 'SupabaseOrderService',
            initialized: this.initialized,
            supabaseConnected: !!this.supabaseClient,
            dependencies: {
                hybridBatchService: !!this.hybridBatchService,
                hybridAuditService: !!this.hybridAuditService
            },
            capabilities: {
                multiTableTransactions: true,
                compensatingActions: true,
                optimizedQueries: true,
                batchIntegration: !!this.hybridBatchService,
                auditLogging: !!this.hybridAuditService
            }
        };
    }
}

module.exports = new SupabaseOrderService(); 