// controllers/operations-log-controller.js - Реальний контролер операцій з Supabase

const { supabase } = require('../supabase-client');

class OperationsLogController {
    
    // Отримання логів операцій для frontend
    static async getLogs(req, res) {
        try {
            console.log('🔄 getLogs called');
            
            const { limit = 50, offset = 0, operation_type, entity_type, start_date, end_date } = req.query;
            
            let query = supabase
                .from('operations_log')
                .select(`
                    id,
                    operation_type,
                    entity_type,
                    entity_id,
                    user_id,
                    details,
                    created_at,
                    users:user_id (username)
                `)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            // Фільтри
            if (operation_type) {
                query = query.eq('operation_type', operation_type);
            }
            
            if (entity_type) {
                query = query.eq('entity_type', entity_type);
            }
            
            if (start_date) {
                query = query.gte('created_at', start_date);
            }
            
            if (end_date) {
                query = query.lte('created_at', end_date);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('❌ Помилка отримання логів:', error);
                return res.json([]); // Порожній масив для сумісності
            }
            
            // Форматуємо дані для frontend
            const formattedLogs = data.map(log => ({
                id: log.id,
                operation_type: log.operation_type,
                entity_type: log.entity_type,
                entity_id: log.entity_id,
                user_id: log.user_id,
                username: log.users?.username || 'Система',
                details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details),
                created_at: log.created_at,
                timestamp: new Date(log.created_at).toLocaleString('uk-UA')
            }));
            
            console.log(`✅ Повернуто ${formattedLogs.length} операцій`);
            res.json(formattedLogs);
            
        } catch (error) {
            console.error('❌ Помилка getLogs:', error);
            res.json([]); // Порожній масив при помилці
        }
    }
    
    // Статистика операцій
    static async getOperationsStats(req, res) {
        try {
            console.log('🔄 getOperationsStats called');
            
            const today = new Date().toISOString().split('T')[0];
            
            // Загальна кількість операцій
            const { data: totalData, error: totalError } = await supabase
                .from('operations_log')
                .select('id', { count: 'exact', head: true });
            
            // Операції за сьогодні
            const { data: todayData, error: todayError } = await supabase
                .from('operations_log')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', today);
            
            if (totalError || todayError) {
                console.error('❌ Помилка статистики:', totalError || todayError);
                return res.json({
                    total_operations: 0,
                    today_operations: 0
                });
            }
            
            res.json({
                total_operations: totalData?.length || 0,
                today_operations: todayData?.length || 0
            });
            
        } catch (error) {
            console.error('❌ Помилка getOperationsStats:', error);
            res.json({
                total_operations: 0,
                today_operations: 0
            });
        }
    }
    
    // Операції для конкретної сутності
    static async getEntityOperations(req, res) {
        try {
            const { entity_type, entity_id } = req.params;
            console.log(`🔄 getEntityOperations called for ${entity_type}:${entity_id}`);
            
            const { data, error } = await supabase
                .from('operations_log')
                .select(`
                    id,
                    operation_type,
                    details,
                    created_at,
                    users:user_id (username)
                `)
                .eq('entity_type', entity_type)
                .eq('entity_id', entity_id)
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) {
                console.error('❌ Помилка getEntityOperations:', error);
                return res.json([]);
            }
            
            const formattedLogs = data.map(log => ({
                id: log.id,
                operation_type: log.operation_type,
                username: log.users?.username || 'Система',
                details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details),
                created_at: log.created_at,
                timestamp: new Date(log.created_at).toLocaleString('uk-UA')
            }));
            
            res.json(formattedLogs);
            
        } catch (error) {
            console.error('❌ Помилка getEntityOperations:', error);
            res.json([]);
        }
    }
    
    // Методи для логування операцій (використовуються іншими сервісами)
    static async logOperation(operationType, details, userId = null, entityType = null, entityId = null) {
        try {
            const { data, error } = await supabase
                .from('operations_log')
                .insert({
                    operation_type: operationType,
                    entity_type: entityType,
                    entity_id: entityId,
                    user_id: userId,
                    details: typeof details === 'object' ? JSON.stringify(details) : details,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) {
                console.error(`❌ Помилка логування операції ${operationType}:`, error);
                return { success: false, error };
            }
            
            console.log(`📝 Операція залогована: ${operationType} (ID: ${data.id})`);
            return { success: true, logged: true, id: data.id };
            
        } catch (error) {
            console.error(`❌ Помилка logOperation для ${operationType}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    static async logProductOperation(productId, operationType, quantity, details = {}, userId = null) {
        const operationDetails = {
            product_id: productId,
            quantity,
            ...details
        };
        
        return await OperationsLogController.logOperation(
            operationType,
            operationDetails,
            userId, // Now properly accepts userId
            'PRODUCT',
            productId
        );
    }
    
    static async logOrderOperation(orderId, operationType, details = {}, userId = null) {
        const operationDetails = {
            order_id: orderId,
            ...details
        };
        
        return await OperationsLogController.logOperation(
            operationType,
            operationDetails,
            userId, // Now properly accepts userId
            'ORDER',
            orderId
        );
    }
    
    static async logBatchOperation(batchId, operationType, details = {}, userId = null) {
        const operationDetails = {
            batch_id: batchId,
            ...details
        };
        
        return await OperationsLogController.logOperation(
            operationType,
            operationDetails,
            userId, // Now properly accepts userId
            'BATCH',
            batchId
        );
    }
    
    // Alias для сумісності
    static async getAllLogs(req, res) {
        return OperationsLogController.getLogs(req, res);
    }
}

module.exports = OperationsLogController;
