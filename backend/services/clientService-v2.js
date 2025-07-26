/**
 * Client Service v2 - з підтримкою Supabase та SQLite
 * Використовує DatabaseAdapter для універсальної роботи з БД
 */

const { NotFoundError, DatabaseError, UniqueConstraintError } = require('../middleware/errors/AppError');
const { createDatabaseAdapter } = require('../config/database');

// Залежності для операційного логування
let OperationsLogController = null;

/**
 * Ініціалізація залежностей
 */
function initialize(dependencies) {
    OperationsLogController = dependencies.OperationsLogController;
}

/**
 * Отримати всіх активних клієнтів
 */
async function getAllClients() {
    const adapter = createDatabaseAdapter();
    
    try {
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const activeValue = useSupabase ? true : 1; // Boolean для Supabase, Integer для SQLite
        
        const clients = await adapter
            .table('clients')
            .select('*', { 
                where: { is_active: activeValue }, 
                orderBy: { column: 'name', direction: 'asc' } 
            });
            
        return clients;
    } catch (error) {
        console.error('Error in getAllClients:', error);
        throw new DatabaseError('Помилка отримання клієнтів', error);
    } finally {
        adapter.close();
    }
}

/**
 * Отримати клієнта за ID
 */
async function getClientById(id) {
    const adapter = createDatabaseAdapter();
    
    try {
        const clients = await adapter
            .table('clients')
            .select('*', { where: { id }, limit: 1 });
            
        const client = clients[0];
        
        if (!client) {
            throw new NotFoundError('Клієнт');
        }
        
        return client;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in getClientById:', error);
        throw new DatabaseError('Помилка отримання клієнта', error);
    } finally {
        adapter.close();
    }
}

/**
 * Отримати клієнта за назвою
 */
async function getClientByName(name) {
    const adapter = createDatabaseAdapter();
    
    try {
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const activeValue = useSupabase ? true : 1; // Boolean для Supabase, Integer для SQLite
        
        const clients = await adapter
            .table('clients')
            .select('*', { 
                where: { name, is_active: activeValue }, 
                limit: 1 
            });
            
        return clients[0] || null;
    } catch (error) {
        console.error('Error in getClientByName:', error);
        throw new DatabaseError('Помилка пошуку клієнта за назвою', error);
    } finally {
        adapter.close();
    }
}

/**
 * Створити нового клієнта
 */
async function createClient(validatedData, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Перевірити унікальність назви
        const existingByName = await getClientByName(validatedData.name);
        if (existingByName) {
            throw new UniqueConstraintError('Клієнт з такою назвою');
        }
        
        // Підготувати дані для створення (структура однакова в обох БД)
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const clientData = {
            ...validatedData,
            is_active: useSupabase ? true : 1, // Boolean для Supabase, Integer для SQLite
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Створити клієнта
        const result = await adapter.table('clients').insert(clientData);
        
        // Отримати створеного клієнта
        const newClient = await getClientById(result.id);
        
        // Логуємо створення клієнта
        if (OperationsLogController && newClient.id) {
            try {
                await OperationsLogController.logClientOperation(
                    OperationsLogController.OPERATION_TYPES.CREATE_CLIENT,
                    newClient,
                    userContext.userName || 'Адміністратор системи',
                    null,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування створення клієнта:', logError);
                // Не кидаємо помилку логування, щоб не зламати основну операцію
            }
        }
        
        return newClient;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in createClient:', error);
        throw new DatabaseError('Помилка створення клієнта', error);
    } finally {
        adapter.close();
    }
}

/**
 * Оновити клієнта
 */
async function updateClient(id, validatedData, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Отримати поточного клієнта
        const oldClient = await getClientById(id);
        
        // Перевірити унікальність назви (якщо змінюється)
        if (validatedData.name && validatedData.name !== oldClient.name) {
            const existingByName = await getClientByName(validatedData.name);
            if (existingByName) {
                throw new UniqueConstraintError('Клієнт з такою назвою');
            }
        }
        
        // Підготувати дані для оновлення (структура однакова в обох БД)
        const updateData = {
            ...validatedData,
            updated_at: new Date().toISOString()
        };
        
        // Оновити клієнта
        await adapter.table('clients').update(updateData, { id });
        
        // Отримати оновленого клієнта
        const updatedClient = await getClientById(id);
        
        // Логуємо оновлення клієнта
        if (OperationsLogController && updatedClient.id) {
            try {
                await OperationsLogController.logClientOperation(
                    OperationsLogController.OPERATION_TYPES.UPDATE_CLIENT,
                    updatedClient,
                    userContext.userName || 'Адміністратор системи',
                    oldClient,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування оновлення клієнта:', logError);
            }
        }
        
        return updatedClient;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in updateClient:', error);
        throw new DatabaseError('Помилка оновлення клієнта', error);
    } finally {
        adapter.close();
    }
}

/**
 * Деактивувати клієнта (soft delete)
 */
async function deactivateClient(id, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Отримати клієнта перед деактивацією
        const client = await getClientById(id);
        
        // Деактивувати клієнта
        const useSupabase = process.env.USE_SUPABASE === 'true';
        const updateData = {
            is_active: useSupabase ? false : 0, // Boolean для Supabase, Integer для SQLite
            updated_at: new Date().toISOString()
        };
        
        await adapter.table('clients').update(updateData, { id });
        
        // Отримати оновленого клієнта
        const deactivatedClient = await getClientById(id);
        
        // Логуємо деактивацію клієнта
        if (OperationsLogController && client.id) {
            try {
                await OperationsLogController.logClientOperation(
                    OperationsLogController.OPERATION_TYPES.DEACTIVATE_CLIENT,
                    deactivatedClient,
                    userContext.userName || 'Адміністратор системи',
                    client,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування деактивації клієнта:', logError);
            }
        }
        
        return true;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in deactivateClient:', error);
        throw new DatabaseError('Помилка деактивації клієнта', error);
    } finally {
        adapter.close();
    }
}

/**
 * Видалити клієнта (hard delete)
 */
async function deleteClient(id, userContext = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        // Отримати клієнта перед видаленням
        const client = await getClientById(id);
        
        // Видалити клієнта
        const deleted = await adapter.table('clients').delete({ id });
        
        if (!deleted) {
            throw new DatabaseError('Не вдалося видалити клієнта');
        }
        
        // Логуємо видалення клієнта
        if (OperationsLogController && client.id) {
            try {
                await OperationsLogController.logClientOperation(
                    OperationsLogController.OPERATION_TYPES.DELETE_CLIENT,
                    client,
                    userContext.userName || 'Адміністратор системи',
                    client,
                    userContext.req
                );
            } catch (logError) {
                console.error('Помилка логування видалення клієнта:', logError);
            }
        }
        
        return true;
    } catch (error) {
        if (error.isOperational) {
            throw error;
        }
        console.error('Error in deleteClient:', error);
        throw new DatabaseError('Помилка видалення клієнта', error);
    } finally {
        adapter.close();
    }
}

/**
 * Пошук клієнтів
 */
async function searchClients(searchParams = {}) {
    const adapter = createDatabaseAdapter();
    
    try {
        const useSupabase = process.env.USE_SUPABASE === 'true';
        if (useSupabase) {
            // Використовуємо Supabase специфічний запит
            const { supabase } = require('../database-supabase');
            const { name, phone, email, active = true, limit = 50, offset = 0 } = searchParams;
            
            let query = supabase.from('clients').select('*');
            
            if (name) {
                query = query.ilike('name', `%${name}%`);
            }
            
            if (phone) {
                query = query.ilike('phone', `%${phone}%`);
            }
            
            if (email) {
                query = query.ilike('email', `%${email}%`);
            }
            
            if (active !== null && active !== undefined) {
                query = query.eq('is_active', active);
            }
            
            query = query
                .order('name')
                .range(offset, offset + limit - 1);
                
            const { data, error } = await query;
                
            if (error) {
                throw new Error(`Supabase searchClients error: ${error.message}`);
            }
            
            return data || [];
        } else {
            // Для SQLite використовуємо простий пошук
            const { name, phone, email, active = true } = searchParams;
            let whereClause = 'is_active = ?';
            let params = [active ? 1 : 0];
            
            if (name) {
                whereClause += ' AND name LIKE ?';
                params.push(`%${name}%`);
            }
            
            if (phone) {
                whereClause += ' AND phone LIKE ?';
                params.push(`%${phone}%`);
            }
            
            if (email) {
                whereClause += ' AND email LIKE ?';
                params.push(`%${email}%`);
            }
            
            const sql = `
                SELECT * FROM clients 
                WHERE ${whereClause}
                ORDER BY name
                LIMIT 50
            `;
            return await adapter.raw(sql, params);
        }
    } catch (error) {
        console.error('Error in searchClients:', error);
        throw new DatabaseError('Помилка пошуку клієнтів', error);
    } finally {
        adapter.close();
    }
}


/**
 * Отримати статистику клієнтів
 */
async function getClientStats() {
    const adapter = createDatabaseAdapter();
    
    try {
        const allClients = await adapter.table('clients').select('*');
        const activeClients = allClients.filter(c => c.is_active);
        
        const stats = {
            total_clients: allClients.length,
            active_clients: activeClients.length,
            inactive_clients: allClients.length - activeClients.length,
            clients_with_phone: activeClients.filter(c => c.phone && c.phone.trim()).length,
            clients_with_email: activeClients.filter(c => c.email && c.email.trim()).length,
            clients_with_address: activeClients.filter(c => c.address && c.address.trim()).length
        };
        
        return stats;
    } catch (error) {
        console.error('Error in getClientStats:', error);
        throw new DatabaseError('Помилка отримання статистики клієнтів', error);
    } finally {
        adapter.close();
    }
}

module.exports = {
    initialize,
    getAllClients,
    getClientById,
    getClientByName,
    createClient,
    updateClient,
    deactivateClient,
    deleteClient,
    searchClients,
    getClientStats
};