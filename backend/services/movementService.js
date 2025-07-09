/**
 * Movement Service - Simple Supabase Implementation
 * Updated for fixed schema with pieces, boxes, created_by fields
 */

const { createClient } = require('@supabase/supabase-js');

let supabase;
let OperationsLogController;

const MovementService = {
    initialize(dependencies) {
        if (!supabase) {
            supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
        }
        
        OperationsLogController = dependencies.OperationsLogController;
        console.log('✅ MovementService ініціалізовано з Supabase (schema fixed)');
    },

    async getAllMovements(filters = {}) {
        try {
            console.log('📖 Читаю movements з Supabase...');
            
            let query = supabase
                .from('stock_movements')
                .select('*')
                .order('created_at', { ascending: false });

            // Додаємо фільтри якщо є
            if (filters.product_id) {
                query = query.eq('product_id', filters.product_id);
            }
            if (filters.movement_type) {
                query = query.eq('movement_type', filters.movement_type);
            }
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            if (filters.offset) {
                query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
            }

            const { data, error, count } = await query;

            if (error) {
                console.error('[MovementService] Supabase error:', error);
                throw error;
            }

            console.log(`✅ Знайдено ${data?.length || 0} movements в Supabase`);

            return {
                success: true,
                data: data || [],
                pagination: {
                    limit: filters.limit || 200,
                    offset: filters.offset || 0,
                    count: data?.length || 0
                }
            };
        } catch (error) {
            console.error('[MovementService] Помилка читання:', error);
            throw error;
        }
    },

    async createMovement(movementData, requestInfo = {}) {
        try {
            console.log('📝 Створюю movement в Supabase:', movementData);
            
            // Мапимо дані для Supabase схеми
            const supabaseData = {
                product_id: movementData.product_id,
                movement_type: movementData.movement_type,
                quantity: movementData.quantity || 0,
                pieces: movementData.pieces || 0,
                boxes: movementData.boxes || 0,
                reason: movementData.reason || '',
                created_by: movementData.user || movementData.created_by || 'system',
                notes: movementData.notes || null
            };

            const { data, error } = await supabase
                .from('stock_movements')
                .insert(supabaseData)
                .select()
                .single();

            if (error) {
                console.error('[MovementService] Supabase insert error:', error);
                throw error;
            }

            console.log('✅ Movement створено в Supabase:', data.id);

            // Логуємо операцію якщо OperationsLogController доступний
            if (OperationsLogController) {
                try {
                    await OperationsLogController.logOperation({
                        user_id: requestInfo.user_id || null,
                        operation: 'stock_movement_create',
                        table_name: 'stock_movements',
                        record_id: data.id,
                        old_values: null,
                        new_values: data,
                        ip_address: requestInfo.ip_address
                    });
                } catch (logError) {
                    console.error('[MovementService] Помилка логування:', logError);
                }
            }

            return {
                success: true,
                data: data,
                message: 'Movement успішно створено'
            };
        } catch (error) {
            console.error('[MovementService] Помилка створення:', error);
            throw error;
        }
    },

    async updateMovement(id, updateData, requestInfo = {}) {
        try {
            console.log(`📝 Оновлюю movement ${id} в Supabase`);
            
            const { data, error } = await supabase
                .from('stock_movements')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('[MovementService] Supabase update error:', error);
                throw error;
            }

            console.log('✅ Movement оновлено в Supabase');
            
            return {
                success: true,
                data: data,
                message: 'Movement успішно оновлено'
            };
        } catch (error) {
            console.error('[MovementService] Помилка оновлення:', error);
            throw error;
        }
    },

    async getMovementsByProduct(productId, filters = {}) {
        return this.getAllMovements({ ...filters, product_id: productId });
    },

    async getMovementStatistics(options = {}) {
        try {
            console.log('📊 Рахую статистику movements в Supabase...');
            
            const { data, error } = await supabase
                .from('stock_movements')
                .select('movement_type, quantity, pieces, boxes');

            if (error) {
                console.error('[MovementService] Stats error:', error);
                throw error;
            }

            const stats = {
                total_movements: data.length,
                total_in: data.filter(m => m.movement_type === 'IN').reduce((sum, m) => sum + (m.quantity || 0), 0),
                total_out: data.filter(m => m.movement_type === 'OUT').reduce((sum, m) => sum + (m.quantity || 0), 0),
                total_pieces_in: data.filter(m => m.movement_type === 'IN').reduce((sum, m) => sum + (m.pieces || 0), 0),
                total_pieces_out: data.filter(m => m.movement_type === 'OUT').reduce((sum, m) => sum + (m.pieces || 0), 0),
                total_boxes_in: data.filter(m => m.movement_type === 'IN').reduce((sum, m) => sum + (m.boxes || 0), 0),
                total_boxes_out: data.filter(m => m.movement_type === 'OUT').reduce((sum, m) => sum + (m.boxes || 0), 0)
            };

            return {
                success: true,
                data: stats
            };
        } catch (error) {
            console.error('[MovementService] Помилка статистики:', error);
            throw error;
        }
    },

    async deleteMovement(id, requestInfo = {}) {
        try {
            console.log(`🗑️ Видаляю movement ${id} з Supabase`);
            
            const { error } = await supabase
                .from('stock_movements')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('[MovementService] Delete error:', error);
                throw error;
            }

            console.log('✅ Movement видалено з Supabase');
            
            return {
                success: true,
                message: 'Movement успішно видалено'
            };
        } catch (error) {
            console.error('[MovementService] Помилка видалення:', error);
            throw error;
        }
    }
};

module.exports = MovementService;
