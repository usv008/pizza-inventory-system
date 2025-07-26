/**
 * Writeoff Queries для Supabase PostgreSQL
 * Адаптер для роботи зі списаннями в Supabase БД
 */

const { supabase } = require('../../database-supabase');
const { AppError } = require('../../middleware/errors/AppError');

const WriteoffQueries = {
    /**
     * Отримати всі записи списань з join до products
     */
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('writeoffs')
                .select(`
                    *,
                    products!inner (
                        id,
                        name,
                        code,
                        pieces_per_box,
                        stock_pieces,
                        stock_boxes
                    )
                `)
                .order('writeoff_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Помилка отримання списань (Supabase):', error);
                throw new AppError('Помилка отримання списань з Supabase', 500, 'SUPABASE_FETCH_ERROR');
            }

            // Адаптуємо структуру для сумісності з SQLite версією
            const adaptedData = (data || []).map(writeoff => ({
                id: writeoff.id,
                product_id: writeoff.product_id,
                writeoff_date: writeoff.writeoff_date,
                total_quantity: writeoff.total_quantity,
                boxes_quantity: writeoff.boxes_quantity || 0,
                pieces_quantity: writeoff.pieces_quantity || 0,
                reason: writeoff.reason,
                responsible: writeoff.responsible,
                notes: writeoff.notes || '',
                created_at: writeoff.created_at,
                updated_at: writeoff.updated_at,
                // Дані з products table
                product_name: writeoff.products.name,
                product_code: writeoff.products.code,
                pieces_per_box: writeoff.products.pieces_per_box,
                product_stock_pieces: writeoff.products.stock_pieces,
                product_stock_boxes: writeoff.products.stock_boxes
            }));

            console.log(`✅ Supabase: отримано ${adaptedData.length} записів списань`);
            return adaptedData;
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            console.error('Unexpected error in writeoffQueries.getAll:', error);
            throw new AppError('Непередбачена помилка при отриманні списань', 500, 'UNEXPECTED_ERROR');
        }
    },

    /**
     * Отримати списання за ID товару
     */
    async getByProductId(productId) {
        try {
            const { data, error } = await supabase
                .from('writeoffs')
                .select(`
                    *,
                    products!inner (
                        id,
                        name,
                        code,
                        pieces_per_box,
                        stock_pieces,
                        stock_boxes
                    )
                `)
                .eq('product_id', productId)
                .order('writeoff_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Помилка отримання списань за товаром (Supabase):', error);
                throw new AppError('Помилка отримання списань за товаром з Supabase', 500, 'SUPABASE_FETCH_ERROR');
            }

            // Адаптуємо структуру для сумісності з SQLite версією
            const adaptedData = (data || []).map(writeoff => ({
                id: writeoff.id,
                product_id: writeoff.product_id,
                writeoff_date: writeoff.writeoff_date,
                total_quantity: writeoff.total_quantity,
                boxes_quantity: writeoff.boxes_quantity || 0,
                pieces_quantity: writeoff.pieces_quantity || 0,
                reason: writeoff.reason,
                responsible: writeoff.responsible,
                notes: writeoff.notes || '',
                created_at: writeoff.created_at,
                updated_at: writeoff.updated_at,
                // Дані з products table
                product_name: writeoff.products.name,
                product_code: writeoff.products.code,
                pieces_per_box: writeoff.products.pieces_per_box,
                product_stock_pieces: writeoff.products.stock_pieces,
                product_stock_boxes: writeoff.products.stock_boxes
            }));

            console.log(`✅ Supabase: отримано ${adaptedData.length} записів списань для товару ${productId}`);
            return adaptedData;
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            console.error('Unexpected error in writeoffQueries.getByProductId:', error);
            throw new AppError('Непередбачена помилка при отриманні списань за товаром', 500, 'UNEXPECTED_ERROR');
        }
    },

    /**
     * Створити новий запис списання з оновленням залишків
     */
    async create(writeoffData) {
        try {
            const {
                product_id,
                writeoff_date,
                total_quantity,
                reason,
                responsible,
                notes = ''
            } = writeoffData;

            // Початок транзакції через rpc функцію
            const { data: result, error } = await supabase.rpc('create_writeoff_with_stock_update', {
                p_product_id: product_id,
                p_writeoff_date: writeoff_date,
                p_total_quantity: total_quantity,
                p_reason: reason,
                p_responsible: responsible,
                p_notes: notes
            });

            if (error) {
                console.error('Помилка створення списання (Supabase):', error);
                throw new AppError(`Помилка створення списання: ${error.message}`, 500, 'SUPABASE_CREATE_ERROR');
            }

            if (!result || result.length === 0) {
                throw new AppError('Не вдалося створити запис списання', 500, 'CREATE_RESULT_EMPTY');
            }

            const writeoffResult = result[0];

            console.log(`✅ Supabase: створено списання ID ${writeoffResult.writeoff_id} для товару ${product_id}`);
            return {
                id: writeoffResult.writeoff_id,
                boxes_quantity: writeoffResult.boxes_quantity,
                pieces_quantity: writeoffResult.pieces_quantity,
                stock_movement_id: writeoffResult.stock_movement_id
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            console.error('Unexpected error in writeoffQueries.create:', error);
            throw new AppError('Непередбачена помилка при створенні списання', 500, 'UNEXPECTED_ERROR');
        }
    },

    /**
     * Отримати статистики списань за період
     */
    async getStats(startDate, endDate) {
        try {
            let query = supabase
                .from('writeoffs')
                .select(`
                    id,
                    product_id,
                    writeoff_date,
                    total_quantity,
                    reason,
                    responsible,
                    products!inner (
                        name,
                        code
                    )
                `);

            // Додаємо фільтри за датами
            if (startDate) {
                query = query.gte('writeoff_date', startDate);
            }

            if (endDate) {
                query = query.lte('writeoff_date', endDate);
            }

            const { data, error } = await query.order('writeoff_date', { ascending: false });

            if (error) {
                console.error('Помилка отримання статистик списань (Supabase):', error);
                throw new AppError('Помилка отримання статистик списань з Supabase', 500, 'SUPABASE_STATS_ERROR');
            }

            // Обчислюємо статистики
            const stats = {
                total_records: data.length,
                total_quantity: data.reduce((sum, item) => sum + (item.total_quantity || 0), 0),
                unique_products: new Set(data.map(item => item.product_id)).size,
                date_range: null
            };

            if (data.length > 0) {
                const dates = data.map(item => new Date(item.writeoff_date)).sort();
                stats.date_range = {
                    start: dates[0].toISOString().split('T')[0],
                    end: dates[dates.length - 1].toISOString().split('T')[0]
                };
            }

            // Статистики по товарах
            const productStats = {};
            data.forEach(item => {
                if (!productStats[item.product_id]) {
                    productStats[item.product_id] = {
                        product_id: item.product_id,
                        product_name: item.products.name,
                        product_code: item.products.code,
                        total_quantity: 0,
                        records_count: 0
                    };
                }
                productStats[item.product_id].total_quantity += item.total_quantity;
                productStats[item.product_id].records_count += 1;
            });

            // Статистики по причинах
            const reasonStats = {};
            data.forEach(item => {
                if (!reasonStats[item.reason]) {
                    reasonStats[item.reason] = {
                        reason: item.reason,
                        total_quantity: 0,
                        records_count: 0
                    };
                }
                reasonStats[item.reason].total_quantity += item.total_quantity;
                reasonStats[item.reason].records_count += 1;
            });

            // Статистики по відповідальних
            const responsibleStats = {};
            data.forEach(item => {
                if (!responsibleStats[item.responsible]) {
                    responsibleStats[item.responsible] = {
                        responsible: item.responsible,
                        total_quantity: 0,
                        records_count: 0
                    };
                }
                responsibleStats[item.responsible].total_quantity += item.total_quantity;
                responsibleStats[item.responsible].records_count += 1;
            });

            console.log(`✅ Supabase: обчислено статистики для ${data.length} списань`);
            return {
                overview: stats,
                by_products: Object.values(productStats),
                by_reasons: Object.values(reasonStats),
                by_responsible: Object.values(responsibleStats),
                period: { start: startDate, end: endDate }
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            console.error('Unexpected error in writeoffQueries.getStats:', error);
            throw new AppError('Непередбачена помилка при отриманні статистик списань', 500, 'UNEXPECTED_ERROR');
        }
    }
};

module.exports = WriteoffQueries;