const { supabase } = require('../supabase-client');

class SupabaseOrderService {
    constructor() {
        console.log('✅ SupabaseOrderService ініціалізовано');
    }

    // Отримати всі замовлення
    async getAllOrders(filters = {}) {
        try {
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items(
                        id,
                        product_id,
                        quantity,
                        boxes,
                        pieces,
                        reserved_quantity,
                        produced_quantity,
                        notes,
                        products(id, name, code)
                    ),
                    clients(id, name, contact_person, phone)
                `)
                .order('created_at', { ascending: false });

            // Додаємо фільтри
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
            
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[OrderService] Помилка отримання замовлень:', err.message);
            throw err;
        }
    }

    // Отримати замовлення за ID
    async getOrderById(id) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items(
                        id,
                        product_id,
                        quantity,
                        boxes,
                        pieces,
                        reserved_quantity,
                        produced_quantity,
                        notes,
                        products(id, name, code, weight, pieces_per_box)
                    ),
                    clients(id, name, contact_person, phone, address)
                `)
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[OrderService] Помилка отримання замовлення:', err.message);
            throw err;
        }
    }

    // Створити замовлення
    async createOrder(orderData) {
        try {
            // Створюємо замовлення
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    order_number: orderData.order_number,
                    client_id: orderData.client_id,
                    client_name: orderData.client_name,
                    client_contact: orderData.client_contact,
                    order_date: orderData.order_date,
                    delivery_date: orderData.delivery_date,
                    status: orderData.status || 'NEW',
                    total_quantity: orderData.total_quantity || 0,
                    total_boxes: orderData.total_boxes || 0,
                    notes: orderData.notes,
                    created_by: orderData.created_by || 'system',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // Створюємо позиції замовлення
            if (orderData.items && orderData.items.length > 0) {
                const orderItems = orderData.items.map(item => ({
                    order_id: order.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    boxes: item.boxes || 0,
                    pieces: item.pieces || 0,
                    reserved_quantity: item.reserved_quantity || 0,
                    produced_quantity: item.produced_quantity || 0,
                    notes: item.notes,
                    created_at: new Date().toISOString()
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems);

                if (itemsError) throw itemsError;
            }

            return order;
        } catch (err) {
            console.error('[OrderService] Помилка створення замовлення:', err.message);
            throw err;
        }
    }

    // Оновити замовлення
    async updateOrder(id, orderData) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .update({
                    client_id: orderData.client_id,
                    client_name: orderData.client_name,
                    client_contact: orderData.client_contact,
                    order_date: orderData.order_date,
                    delivery_date: orderData.delivery_date,
                    status: orderData.status,
                    total_quantity: orderData.total_quantity,
                    total_boxes: orderData.total_boxes,
                    notes: orderData.notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[OrderService] Помилка оновлення замовлення:', err.message);
            throw err;
        }
    }

    // Видалити замовлення
    async deleteOrder(id) {
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[OrderService] Помилка видалення замовлення:', err.message);
            throw err;
        }
    }

    // Статистика замовлень
    async getOrderStats(period = 'month') {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('status, total_quantity, order_date');
                
            if (error) throw error;
            
            const stats = {
                total: data.length,
                by_status: {},
                total_quantity: data.reduce((sum, order) => sum + (order.total_quantity || 0), 0)
            };

            // Групуємо за статусом
            data.forEach(order => {
                const status = order.status || 'UNKNOWN';
                stats.by_status[status] = (stats.by_status[status] || 0) + 1;
            });
            
            return stats;
        } catch (err) {
            console.error('[OrderService] Помилка отримання статистики:', err.message);
            throw err;
        }
    }
}

module.exports = SupabaseOrderService;
