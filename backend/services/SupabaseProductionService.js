const { supabase } = require('../supabase-client');

class SupabaseProductionService {
    constructor() {
        console.log('✅ SupabaseProductionService ініціалізовано');
    }

    // Отримати всі записи виробництва
    async getAllProduction(filters = {}) {
        try {
            let query = supabase
                .from('production')
                .select(`
                    *,
                    products(id, name, code, weight, pieces_per_box)
                `)
                .order('production_date', { ascending: false });

            // Додаємо фільтри
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
                query = query.eq('responsible', filters.responsible);
            }

            const { data, error } = await query;
            
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductionService] Помилка отримання виробництва:', err.message);
            throw err;
        }
    }

    // Отримати виробництво за ID товару
    async getProductionByProductId(productId) {
        try {
            const { data, error } = await supabase
                .from('production')
                .select(`
                    *,
                    products(id, name, code, weight, pieces_per_box)
                `)
                .eq('product_id', productId)
                .order('production_date', { ascending: false });
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductionService] Помилка отримання виробництва по товару:', err.message);
            throw err;
        }
    }

    // Створити запис виробництва
    async createProduction(productionData) {
        try {
            const { data, error } = await supabase
                .from('production')
                .insert([{
                    product_id: productionData.product_id,
                    production_date: productionData.production_date,
                    production_time: productionData.production_time,
                    total_quantity: productionData.total_quantity,
                    boxes_quantity: productionData.boxes_quantity || 0,
                    pieces_quantity: productionData.pieces_quantity || 0,
                    expiry_date: productionData.expiry_date,
                    responsible: productionData.responsible || 'system',
                    notes: productionData.notes,
                    created_at: new Date().toISOString()
                }])
                .select(`
                    *,
                    products(id, name, code)
                `)
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductionService] Помилка створення виробництва:', err.message);
            throw err;
        }
    }

    // Оновити запис виробництва
    async updateProduction(id, productionData) {
        try {
            const { data, error } = await supabase
                .from('production')
                .update({
                    product_id: productionData.product_id,
                    production_date: productionData.production_date,
                    production_time: productionData.production_time,
                    total_quantity: productionData.total_quantity,
                    boxes_quantity: productionData.boxes_quantity,
                    pieces_quantity: productionData.pieces_quantity,
                    expiry_date: productionData.expiry_date,
                    responsible: productionData.responsible,
                    notes: productionData.notes
                })
                .eq('id', id)
                .select(`
                    *,
                    products(id, name, code)
                `)
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ProductionService] Помилка оновлення виробництва:', err.message);
            throw err;
        }
    }

    // Видалити запис виробництва
    async deleteProduction(id) {
        try {
            const { error } = await supabase
                .from('production')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[ProductionService] Помилка видалення виробництва:', err.message);
            throw err;
        }
    }

    // Статистика виробництва
    async getProductionStatistics(startDate, endDate) {
        try {
            let query = supabase
                .from('production')
                .select('total_quantity, boxes_quantity, pieces_quantity, production_date, product_id, products(name)');

            if (startDate) {
                query = query.gte('production_date', startDate);
            }
            if (endDate) {
                query = query.lte('production_date', endDate);
            }

            const { data, error } = await query;
            
            if (error) throw error;

            const stats = {
                total_records: data.length,
                total_quantity: data.reduce((sum, p) => sum + (p.total_quantity || 0), 0),
                total_boxes: data.reduce((sum, p) => sum + (p.boxes_quantity || 0), 0),
                total_pieces: data.reduce((sum, p) => sum + (p.pieces_quantity || 0), 0),
                unique_products: new Set(data.map(p => p.product_id)).size,
                by_product: {}
            };

            // Групуємо за товарами
            data.forEach(production => {
                const productName = production.products?.name || 'Unknown';
                if (!stats.by_product[productName]) {
                    stats.by_product[productName] = {
                        total_quantity: 0,
                        records_count: 0
                    };
                }
                stats.by_product[productName].total_quantity += production.total_quantity || 0;
                stats.by_product[productName].records_count += 1;
            });
            
            return stats;
        } catch (err) {
            console.error('[ProductionService] Помилка отримання статистики:', err.message);
            throw err;
        }
    }
}

module.exports = SupabaseProductionService;
