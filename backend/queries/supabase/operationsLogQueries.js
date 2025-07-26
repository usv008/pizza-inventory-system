// queries/supabase/operationsLogQueries.js - Supabase запити для логування операцій

const DatabaseAdapter = require('../../adapters/DatabaseAdapter');

/**
 * Клас для роботи з логами операцій в Supabase
 */
class OperationsLogQueries {
    constructor() {
        this.adapter = new DatabaseAdapter(true); // Використовуємо Supabase
    }

    /**
     * Логувати операцію в систему
     */
    async logOperation({
        operation_type,
        operation_id = null,
        entity_type,
        entity_id,
        old_data = null,
        new_data = null,
        description,
        user_name,
        ip_address = null,
        user_agent = null
    }) {
        const logEntry = {
            operation_type,
            operation_id,
            entity_type,
            entity_id,
            old_data: old_data ? JSON.stringify(old_data) : null,
            new_data: new_data ? JSON.stringify(new_data) : null,
            description,
            user_name,
            ip_address,
            user_agent,
            created_at: new Date().toISOString()
        };

        const { data, error } = await this.adapter.client
            .from('operations_log')
            .insert(logEntry)
            .select()
            .single();

        if (error) {
            throw new Error(`Помилка логування операції: ${error.message}`);
        }

        return data.id;
    }

    /**
     * Отримати логи з фільтрацією
     */
    async getLogs(filters = {}) {
        const {
            operation_type,
            entity_type,
            entity_id,
            user_name,
            date_from,
            date_to,
            limit = 200,
            offset = 0
        } = filters;

        let query = this.adapter.client
            .from('operations_log')
            .select(`
                *,
                orders:entity_id!left (
                    order_number,
                    client_name
                ),
                products:entity_id!left (
                    name,
                    code
                ),
                clients:entity_id!left (
                    name,
                    contact_person
                )
            `);

        if (operation_type) {
            query = query.eq('operation_type', operation_type);
        }

        if (entity_type) {
            query = query.eq('entity_type', entity_type);
        }

        if (entity_id) {
            query = query.eq('entity_id', parseInt(entity_id));
        }

        if (user_name) {
            query = query.ilike('user_name', `%${user_name}%`);
        }

        if (date_from) {
            query = query.gte('created_at', `${date_from}T00:00:00`);
        }

        if (date_to) {
            query = query.lte('created_at', `${date_to}T23:59:59`);
        }

        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error) {
            throw new Error(`Помилка отримання логів: ${error.message}`);
        }

        // Обробляємо дані та додаємо entity_display_name
        return data.map(row => {
            let entity_display_name = row.entity_id?.toString() || 'N/A';
            let additional_info = null;

            // Визначаємо display name в залежності від типу сутності
            if (row.entity_type === 'order' && row.orders?.length > 0) {
                entity_display_name = row.orders[0].order_number;
                additional_info = row.orders[0].client_name;
            } else if (row.entity_type === 'product' && row.products?.length > 0) {
                entity_display_name = `${row.products[0].name} (${row.products[0].code})`;
                additional_info = row.products[0].code;
            } else if (row.entity_type === 'client' && row.clients?.length > 0) {
                entity_display_name = row.clients[0].name;
                additional_info = row.clients[0].contact_person;
            }

            return {
                ...row,
                entity_display_name,
                additional_info,
                old_data: row.old_data ? JSON.parse(row.old_data) : null,
                new_data: row.new_data ? JSON.parse(row.new_data) : null,
                // Видаляємо joined дані для чистоти
                orders: undefined,
                products: undefined,
                clients: undefined
            };
        });
    }

    /**
     * Отримати статистику операцій
     */
    async getOperationsStats(periodDays = 30) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - periodDays);
        const fromDateISO = fromDate.toISOString();

        // Отримуємо денну статистику
        const { data: dailyStats, error: dailyError } = await this.adapter.client
            .from('operations_log')
            .select('operation_type, created_at')
            .gte('created_at', fromDateISO)
            .order('created_at', { ascending: false });

        if (dailyError) {
            throw new Error(`Помилка отримання денної статистики: ${dailyError.message}`);
        }

        // Отримуємо підсумкову статистику
        const { data: summaryStats, error: summaryError } = await this.adapter.client
            .from('operations_log')
            .select('operation_type, user_name, created_at')
            .gte('created_at', fromDateISO);

        if (summaryError) {
            throw new Error(`Помилка отримання підсумкової статистики: ${summaryError.message}`);
        }

        // Обробляємо денну статистику
        const dailyStatsProcessed = this.processDailyStats(dailyStats);
        
        // Обробляємо підсумкову статистику
        const summaryStatsProcessed = this.processSummaryStats(summaryStats);

        return {
            period_days: periodDays,
            daily_stats: dailyStatsProcessed,
            summary: summaryStatsProcessed,
            total_operations: summaryStatsProcessed.reduce((sum, row) => sum + row.total_count, 0)
        };
    }

    /**
     * Обробити денну статистику
     */
    processDailyStats(rawData) {
        const statsMap = {};

        rawData.forEach(record => {
            const date = record.created_at.split('T')[0]; // Отримуємо дату
            const key = `${record.operation_type}_${date}`;

            if (!statsMap[key]) {
                statsMap[key] = {
                    operation_type: record.operation_type,
                    operation_date: date,
                    count: 0
                };
            }
            statsMap[key].count++;
        });

        return Object.values(statsMap).sort((a, b) => {
            // Сортуємо по даті (спадання) та по кількості (спадання)
            if (a.operation_date !== b.operation_date) {
                return b.operation_date.localeCompare(a.operation_date);
            }
            return b.count - a.count;
        });
    }

    /**
     * Обробити підсумкову статистику
     */
    processSummaryStats(rawData) {
        const summaryMap = {};

        rawData.forEach(record => {
            const type = record.operation_type;

            if (!summaryMap[type]) {
                summaryMap[type] = {
                    operation_type: type,
                    total_count: 0,
                    unique_users: new Set(),
                    last_operation: null
                };
            }

            summaryMap[type].total_count++;
            summaryMap[type].unique_users.add(record.user_name);
            
            if (!summaryMap[type].last_operation || record.created_at > summaryMap[type].last_operation) {
                summaryMap[type].last_operation = record.created_at;
            }
        });

        return Object.values(summaryMap).map(summary => ({
            operation_type: summary.operation_type,
            total_count: summary.total_count,
            unique_users: summary.unique_users.size,
            last_operation: summary.last_operation
        })).sort((a, b) => b.total_count - a.total_count);
    }

    /**
     * Отримати операції по конкретній сутності
     */
    async getEntityOperations(entity_type, entity_id, limit = 50) {
        const { data, error } = await this.adapter.client
            .from('operations_log')
            .select('*')
            .eq('entity_type', entity_type)
            .eq('entity_id', parseInt(entity_id))
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Помилка отримання операцій сутності: ${error.message}`);
        }

        return data.map(row => ({
            ...row,
            old_data: row.old_data ? JSON.parse(row.old_data) : null,
            new_data: row.new_data ? JSON.parse(row.new_data) : null
        }));
    }
}

module.exports = new OperationsLogQueries();