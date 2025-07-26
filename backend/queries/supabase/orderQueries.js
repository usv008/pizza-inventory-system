/**
 * Order Queries для Supabase PostgreSQL
 * Запити для роботи з замовленнями та позиціями замовлень
 */

const { supabase } = require('../../database-supabase');

const OrderQueries = {
    /**
     * Отримати всі замовлення з фільтрацією
     */
    async getAll(filters = {}) {
        try {
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id,
                        product_id,
                        quantity,
                        boxes,
                        pieces,
                        reserved_quantity,
                        produced_quantity,
                        notes,
                        allocated_batches,
                        products:product_id (
                            name,
                            code
                        )
                    )
                `);

            // Фільтри
            if (filters.status && filters.status !== 'ALL') {
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

            // Сортування та пагінація
            query = query
                .order('order_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            if (filters.offset) {
                query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Supabase getAll orders error: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('orderQueries.getAll error:', error);
            throw error;
        }
    },

    /**
     * Отримати замовлення за ID з позиціями
     */
    async getById(orderId) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id,
                        product_id,
                        quantity,
                        boxes,
                        pieces,
                        reserved_quantity,
                        produced_quantity,
                        notes,
                        allocated_batches,
                        products:product_id (
                            name,
                            code,
                            weight,
                            pieces_per_box
                        )
                    )
                `)
                .eq('id', orderId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Замовлення не знайдено
                }
                throw new Error(`Supabase getById order error: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('orderQueries.getById error:', error);
            throw error;
        }
    },

    /**
     * Створити нове замовлення
     */
    async create(orderData) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .insert({
                    order_number: orderData.order_number,
                    client_id: orderData.client_id,
                    client_name: orderData.client_name,
                    client_contact: orderData.client_contact,
                    order_date: orderData.order_date,
                    delivery_date: orderData.delivery_date,
                    status: orderData.status || 'NEW',
                    notes: orderData.notes,
                    created_by: orderData.created_by || 'system',
                    created_by_user_id: orderData.created_by_user_id
                })
                .select('id')
                .single();

            if (error) {
                throw new Error(`Supabase create order error: ${error.message}`);
            }

            return data.id;
        } catch (error) {
            console.error('orderQueries.create error:', error);
            throw error;
        }
    },

    /**
     * Оновити замовлення
     */
    async update(orderId, orderData) {
        try {
            const updateData = {};

            // Дозволені поля для оновлення
            const allowedFields = [
                'client_id', 'client_name', 'client_contact', 
                'order_date', 'delivery_date', 'status', 'notes'
            ];

            for (const field of allowedFields) {
                if (orderData[field] !== undefined) {
                    updateData[field] = orderData[field];
                }
            }

            if (Object.keys(updateData).length === 0) {
                throw new Error('Немає полів для оновлення');
            }

            const { error } = await supabase
                .from('orders')
                .update(updateData)
                .eq('id', orderId);

            if (error) {
                throw new Error(`Supabase update order error: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('orderQueries.update error:', error);
            throw error;
        }
    },

    /**
     * Видалити замовлення (CASCADE видалить позиції автоматично)
     */
    async delete(orderId) {
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) {
                throw new Error(`Supabase delete order error: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('orderQueries.delete error:', error);
            throw error;
        }
    },

    /**
     * Створити позицію замовлення
     */
    async createItem(itemData) {
        try {
            const { data, error } = await supabase
                .from('order_items')
                .insert({
                    order_id: itemData.order_id,
                    product_id: itemData.product_id,
                    quantity: itemData.quantity,
                    boxes: itemData.boxes,
                    pieces: itemData.pieces,
                    reserved_quantity: itemData.reserved_quantity || 0,
                    produced_quantity: itemData.produced_quantity || 0,
                    notes: itemData.notes,
                    allocated_batches: itemData.allocated_batches || null
                })
                .select('id')
                .single();

            if (error) {
                throw new Error(`Supabase create order item error: ${error.message}`);
            }

            return data.id;
        } catch (error) {
            console.error('orderQueries.createItem error:', error);
            throw error;
        }
    },

    /**
     * Оновити позицію замовлення
     */
    async updateItem(itemId, itemData) {
        try {
            const updateData = {};

            // Дозволені поля для оновлення
            const allowedFields = [
                'quantity', 'boxes', 'pieces', 'reserved_quantity', 
                'produced_quantity', 'notes', 'allocated_batches'
            ];

            for (const field of allowedFields) {
                if (itemData[field] !== undefined) {
                    updateData[field] = itemData[field];
                }
            }

            if (Object.keys(updateData).length === 0) {
                throw new Error('Немає полів для оновлення позиції');
            }

            const { error } = await supabase
                .from('order_items')
                .update(updateData)
                .eq('id', itemId);

            if (error) {
                throw new Error(`Supabase update order item error: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('orderQueries.updateItem error:', error);
            throw error;
        }
    },

    /**
     * Видалити позицію замовлення
     */
    async deleteItem(itemId) {
        try {
            const { error } = await supabase
                .from('order_items')
                .delete()
                .eq('id', itemId);

            if (error) {
                throw new Error(`Supabase delete order item error: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('orderQueries.deleteItem error:', error);
            throw error;
        }
    },

    /**
     * Видалити всі позиції замовлення
     */
    async deleteAllItems(orderId) {
        try {
            const { error } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', orderId);

            if (error) {
                throw new Error(`Supabase delete all order items error: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('orderQueries.deleteAllItems error:', error);
            throw error;
        }
    },

    /**
     * Оновити загальні підсумки замовлення
     */
    async updateTotals(orderId) {
        try {
            // Отримуємо суми з позицій
            const { data: totals, error: totalsError } = await supabase
                .from('order_items')
                .select('quantity, boxes')
                .eq('order_id', orderId);

            if (totalsError) {
                throw new Error(`Error getting order totals: ${totalsError.message}`);
            }

            const totalQuantity = totals.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalBoxes = totals.reduce((sum, item) => sum + (item.boxes || 0), 0);

            // Оновлюємо замовлення
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    total_quantity: totalQuantity,
                    total_boxes: totalBoxes
                })
                .eq('id', orderId);

            if (updateError) {
                throw new Error(`Error updating order totals: ${updateError.message}`);
            }

            return { totalQuantity, totalBoxes };
        } catch (error) {
            console.error('orderQueries.updateTotals error:', error);
            throw error;
        }
    },

    /**
     * Статистика замовлень
     */
    async getStats(period = 'month') {
        try {
            let dateFilter = '';
            
            if (period === 'month') {
                dateFilter = `order_date >= date_trunc('month', current_date)`;
            } else if (period === 'week') {
                dateFilter = `order_date >= date_trunc('week', current_date)`;
            } else if (period === 'year') {
                dateFilter = `order_date >= date_trunc('year', current_date)`;
            }

            // Отримуємо базову статистику
            let query = supabase
                .from('orders')
                .select('status, total_quantity, total_boxes, order_date');

            if (dateFilter) {
                // PostgreSQL specific filtering - треба використовувати rpc або raw query
                const { data, error } = await supabase.rpc('get_order_stats', {
                    period_type: period
                });

                if (error) {
                    // Fallback до простого запиту без фільтра дат
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from('orders')
                        .select('status, total_quantity, total_boxes');

                    if (fallbackError) {
                        throw new Error(`Supabase stats error: ${fallbackError.message}`);
                    }

                    return this._processStats(fallbackData || []);
                }

                return data;
            } else {
                const { data, error } = await query;

                if (error) {
                    throw new Error(`Supabase getStats error: ${error.message}`);
                }

                return this._processStats(data || []);
            }
        } catch (error) {
            console.error('orderQueries.getStats error:', error);
            throw error;
        }
    },

    /**
     * Обробка статистики
     */
    _processStats(orders) {
        const stats = {
            total_orders: orders.length,
            new_orders: 0,
            in_progress_orders: 0,
            completed_orders: 0,
            total_quantity: 0,
            total_boxes: 0
        };

        orders.forEach(order => {
            stats.total_quantity += order.total_quantity || 0;
            stats.total_boxes += order.total_boxes || 0;

            switch (order.status) {
                case 'NEW':
                    stats.new_orders++;
                    break;
                case 'IN_PROGRESS':
                    stats.in_progress_orders++;
                    break;
                case 'COMPLETED':
                    stats.completed_orders++;
                    break;
            }
        });

        return stats;
    }
};

module.exports = OrderQueries;