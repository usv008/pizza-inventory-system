/**
 * Movement Queries для Supabase PostgreSQL
 * Адаптовані SQL запити для роботи з таблицею stock_movements
 */

const { supabase } = require('../../database-supabase');

const MovementQueries = {
    // Отримання всіх рухів з фільтрацією та пагінацією
    async getAll(filters = {}) {
        try {
            let query = supabase
                .from('stock_movements')
                .select(`
                    id,
                    product_id,
                    movement_type,
                    pieces,
                    boxes,
                    reason,
                    user_name,
                    batch_id,
                    batch_date,
                    created_at,
                    products:product_id (
                        name,
                        code
                    )
                `);
            
            // Застосовуємо фільтри
            if (filters.product_id) {
                query = query.eq('product_id', filters.product_id);
            }
            
            if (filters.movement_type) {
                query = query.eq('movement_type', filters.movement_type);
            }
            
            if (filters.date_from) {
                query = query.gte('created_at', filters.date_from + 'T00:00:00Z');
            }
            
            if (filters.date_to) {
                query = query.lte('created_at', filters.date_to + 'T23:59:59Z');
            }
            
            if (filters.user) {
                query = query.eq('user_name', filters.user);
            }
            
            // Сортування, ліміт та offset
            query = query
                .order('created_at', { ascending: false })
                .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 200) - 1);
            
            const { data, error } = await query;
            
            if (error) {
                throw new Error(`Supabase getAll movements error: ${error.message}`);
            }
            
            // Перетворюємо структуру для сумісності з SQLite
            return (data || []).map(movement => ({
                ...movement,
                user: movement.user_name,
                product_name: movement.products?.name,
                product_code: movement.products?.code
            }));
        } catch (error) {
            console.error('movementQueries.getAll error:', error);
            throw error;
        }
    },

    // Створення нового руху
    async create(data) {
        try {
            const { data: result, error } = await supabase
                .from('stock_movements')
                .insert({
                    product_id: data.product_id,
                    movement_type: data.movement_type,
                    pieces: data.pieces,
                    boxes: data.boxes,
                    reason: data.reason,
                    user_name: data.user,
                    batch_id: data.batch_id,
                    batch_date: data.batch_date
                })
                .select('id')
                .single();
            
            if (error) {
                throw new Error(`Supabase create movement error: ${error.message}`);
            }
            
            return result?.id;
        } catch (error) {
            console.error('movementQueries.create error:', error);
            throw error;
        }
    },

    // Отримання руху за ID
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select(`
                    id,
                    product_id,
                    movement_type,
                    pieces,
                    boxes,
                    reason,
                    user_name,
                    batch_id,
                    batch_date,
                    created_at,
                    products:product_id (
                        name,
                        code
                    )
                `)
                .eq('id', id)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Запис не знайдено
                }
                throw new Error(`Supabase getById movement error: ${error.message}`);
            }
            
            // Перетворюємо структуру для сумісності
            return {
                ...data,
                user: data.user_name,
                product_name: data.products?.name,
                product_code: data.products?.code
            };
        } catch (error) {
            console.error('movementQueries.getById error:', error);
            throw error;
        }
    },

    // Оновлення руху (тільки дозволені поля)
    async update(id, data) {
        try {
            const updateData = {};
            
            if (data.reason !== undefined) {
                updateData.reason = data.reason;
            }
            
            if (data.user !== undefined) {
                updateData.user_name = data.user;
            }
            
            if (Object.keys(updateData).length === 0) {
                throw new Error('Немає полів для оновлення');
            }
            
            const { error } = await supabase
                .from('stock_movements')
                .update(updateData)
                .eq('id', id);
            
            if (error) {
                throw new Error(`Supabase update movement error: ${error.message}`);
            }
            
            return true;
        } catch (error) {
            console.error('movementQueries.update error:', error);
            throw error;
        }
    },

    // Видалення руху
    async delete(id) {
        try {
            const { error } = await supabase
                .from('stock_movements')
                .delete()
                .eq('id', id);
            
            if (error) {
                throw new Error(`Supabase delete movement error: ${error.message}`);
            }
            
            return true;
        } catch (error) {
            console.error('movementQueries.delete error:', error);
            throw error;
        }
    },

    // Статистика рухів
    async getStatistics(options = {}) {
        try {
            let query = supabase
                .from('stock_movements')
                .select(`
                    movement_type,
                    pieces,
                    boxes,
                    created_at
                `);
            
            // Фільтри
            if (options.product_id) {
                query = query.eq('product_id', options.product_id);
            }
            
            if (options.start_date) {
                query = query.gte('created_at', options.start_date + 'T00:00:00Z');
            }
            
            if (options.end_date) {
                query = query.lte('created_at', options.end_date + 'T23:59:59Z');
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) {
                throw new Error(`Supabase getStatistics error: ${error.message}`);
            }
            
            // Обробляємо дані для статистики
            const statsMap = {};
            
            (data || []).forEach(row => {
                const date = row.created_at.split('T')[0]; // Виділяємо дату
                const key = `${row.movement_type}-${date}`;
                
                if (!statsMap[key]) {
                    statsMap[key] = {
                        movement_type: row.movement_type,
                        count: 0,
                        total_pieces: 0,
                        total_boxes: 0,
                        movement_date: date
                    };
                }
                
                statsMap[key].count += 1;
                statsMap[key].total_pieces += row.pieces;
                statsMap[key].total_boxes += row.boxes;
            });
            
            return Object.values(statsMap);
        } catch (error) {
            console.error('movementQueries.getStatistics error:', error);
            throw error;
        }
    },

    // Оновлення залишків товару
    async updateProductStock(productId, movementType, pieces) {
        try {
            // Спочатку отримуємо поточні дані товару
            const { data: product, error: getError } = await supabase
                .from('products')
                .select('stock_pieces, pieces_per_box')
                .eq('id', productId)
                .single();
            
            if (getError) {
                throw new Error(`Помилка отримання товару: ${getError.message}`);
            }
            
            // Визначаємо новий залишок
            const isIncrease = ['IN', 'PRODUCTION', 'CORRECTION'].includes(movementType);
            const newStockPieces = isIncrease 
                ? product.stock_pieces + pieces 
                : product.stock_pieces - pieces;
            
            const newStockBoxes = Math.floor(newStockPieces / product.pieces_per_box);
            
            // Оновлюємо залишки
            const { error: updateError } = await supabase
                .from('products')
                .update({
                    stock_pieces: newStockPieces,
                    stock_boxes: newStockBoxes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId);
            
            if (updateError) {
                throw new Error(`Supabase updateProductStock error: ${updateError.message}`);
            }
            
            return true;
        } catch (error) {
            console.error('movementQueries.updateProductStock error:', error);
            throw error;
        }
    }
};

module.exports = MovementQueries;