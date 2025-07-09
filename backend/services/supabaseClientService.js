const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { NotFoundError, DatabaseError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Supabase Client Service - бізнес-логіка для клієнтів через Supabase
 * Міграція з SQLite на PostgreSQL/Supabase
 */

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

class SupabaseClientService {
    constructor() {
        this.OperationsLogController = null;
        this.initialized = false;
    }

    /**
     * Ініціалізація сервісу з залежностями
     */
    initialize(dependencies) {
        this.OperationsLogController = dependencies.OperationsLogController;
        this.initialized = true;
        console.log('✅ SupabaseClientService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('SupabaseClientService не ініціалізовано');
        }
    }

    /**
     * Отримати всіх активних клієнтів
     */
    async getAllClients() {
        this._checkInitialization();
        
        try {
            const { data: clients, error } = await supabase
                .from('clients')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (error) {
                console.error('Supabase error in getAllClients:', error);
                throw new DatabaseError('Помилка отримання клієнтів з Supabase', error);
            }

            console.log(`📋 Отримано ${clients?.length || 0} клієнтів`);
            return clients || [];
        } catch (error) {
            console.error('❌ Помилка отримання клієнтів:', error);
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(`Помилка отримання клієнтів: ${error.message}`);
        }
    }

    /**
     * Отримати клієнта за ID
     */
    async getClientById(clientId) {
        this._checkInitialization();
        
        try {
            const { data: client, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', clientId)
                .eq('is_active', true)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(`⚠️ Клієнта з ID ${clientId} не знайдено`);
                    return null;
                }
                console.error('Supabase error in getClientById:', error);
                throw new DatabaseError('Помилка отримання клієнта з Supabase', error);
            }

            if (client) {
                console.log(`📋 Отримано клієнта: ${client.name} (ID: ${clientId})`);
            }
            
            return client;
        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            console.error(`❌ Помилка отримання клієнта ${clientId}:`, error);
            throw new DatabaseError(`Помилка отримання клієнта: ${error.message}`);
        }
    }

    /**
     * Створити нового клієнта
     */
    async createClient(clientData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Перевіряємо унікальність назви клієнта
            const existingClient = await this._findClientByName(clientData.name);
            if (existingClient) {
                throw new ValidationError(`Клієнт з назвою "${clientData.name}" вже існує`);
            }

            // Map data to Supabase format
            const supabaseData = {
                name: clientData.name,
                contact_person: clientData.contact_person || null,
                phone: clientData.phone || null,
                email: clientData.email || null,
                address: clientData.address || null,
                notes: clientData.notes || null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: result, error } = await supabase
                .from('clients')
                .insert([supabaseData])
                .select()
                .single();

            if (error) {
                console.error('Supabase error in createClient:', error);
                if (error.code === '23505') { // PostgreSQL unique constraint violation
                    throw new ValidationError(`Клієнт з назвою "${clientData.name}" вже існує`);
                }
                throw new DatabaseError('Помилка створення клієнта в Supabase', error);
            }
            
            console.log(`✅ Створено клієнта: ${clientData.name} (ID: ${result.id})`);

            // Логуємо операцію
            await this._logClientOperation('CREATE_CLIENT', result.id, {
                operation_id: result.id,
                entity_type: 'client',
                entity_id: result.id,
                new_data: clientData,
                description: `Створено клієнта "${clientData.name}"`,
                ...auditInfo
            });

            return { id: result.id };
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка створення клієнта:', error);
            throw new DatabaseError(`Помилка створення клієнта: ${error.message}`);
        }
    }

    /**
     * Оновити клієнта
     */
    async updateClient(clientId, clientData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо старі дані для логування
            const oldClient = await this.getClientById(clientId);
            if (!oldClient) {
                throw new NotFoundError('Клієнта не знайдено');
            }

            // Перевіряємо унікальність назви (якщо змінилась)
            if (clientData.name !== oldClient.name) {
                const existingClient = await this._findClientByName(clientData.name);
                if (existingClient && existingClient.id !== clientId) {
                    throw new ValidationError(`Клієнт з назвою "${clientData.name}" вже існує`);
                }
            }

            // Map data to Supabase format
            const supabaseData = {
                name: clientData.name,
                contact_person: clientData.contact_person !== undefined ? clientData.contact_person : oldClient.contact_person,
                phone: clientData.phone !== undefined ? clientData.phone : oldClient.phone,
                email: clientData.email !== undefined ? clientData.email : oldClient.email,
                address: clientData.address !== undefined ? clientData.address : oldClient.address,
                notes: clientData.notes !== undefined ? clientData.notes : oldClient.notes,
                updated_at: new Date().toISOString()
            };

            const { data: result, error } = await supabase
                .from('clients')
                .update(supabaseData)
                .eq('id', clientId)
                .eq('is_active', true)
                .select();

            if (error) {
                console.error('Supabase error in updateClient:', error);
                if (error.code === '23505') { // PostgreSQL unique constraint violation
                    throw new ValidationError(`Клієнт з назвою "${clientData.name}" вже існує`);
                }
                throw new DatabaseError('Помилка оновлення клієнта в Supabase', error);
            }

            if (!result || result.length === 0) {
                throw new NotFoundError('Клієнта не знайдено або не оновлено');
            }

            console.log(`✅ Оновлено клієнта: ${clientData.name} (ID: ${clientId})`);

            // Логуємо операцію
            await this._logClientOperation('UPDATE_CLIENT', clientId, {
                operation_id: clientId,
                entity_type: 'client',
                entity_id: clientId,
                old_data: oldClient,
                new_data: clientData,
                description: `Оновлено клієнта "${clientData.name}"`,
                ...auditInfo
            });

            return { changes: 1 };
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error(`❌ Помилка оновлення клієнта ${clientId}:`, error);
            throw new DatabaseError(`Помилка оновлення клієнта: ${error.message}`);
        }
    }

    /**
     * Деактивувати клієнта (soft delete)
     */
    async deactivateClient(clientId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо дані клієнта для логування
            const client = await this.getClientById(clientId);
            if (!client) {
                throw new NotFoundError('Клієнта не знайдено');
            }

            const { data: result, error } = await supabase
                .from('clients')
                .update({ 
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', clientId)
                .select();

            if (error) {
                console.error('Supabase error in deactivateClient:', error);
                throw new DatabaseError('Помилка деактивації клієнта в Supabase', error);
            }

            if (!result || result.length === 0) {
                throw new NotFoundError('Клієнта не знайдено або вже деактивовано');
            }

            console.log(`🗑️ Деактивовано клієнта: ${client.name} (ID: ${clientId})`);

            // Логуємо операцію
            await this._logClientOperation('DEACTIVATE_CLIENT', clientId, {
                operation_id: clientId,
                entity_type: 'client',
                entity_id: clientId,
                old_data: client,
                description: `Деактивовано клієнта "${client.name}"`,
                ...auditInfo
            });

            return { changes: 1 };
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка деактивації клієнта ${clientId}:`, error);
            throw new DatabaseError(`Помилка деактивації клієнта: ${error.message}`);
        }
    }

    /**
     * Пошук клієнтів
     */
    async searchClients(searchParams = {}) {
        this._checkInitialization();
        
        try {
            let query = supabase
                .from('clients')
                .select('*')
                .eq('is_active', true);

            // Додаємо фільтри
            if (searchParams.name) {
                query = query.ilike('name', `%${searchParams.name}%`);
            }
            if (searchParams.phone) {
                query = query.ilike('phone', `%${searchParams.phone}%`);
            }
            if (searchParams.email) {
                query = query.ilike('email', `%${searchParams.email}%`);
            }

            query = query.order('name');

            const { data: clients, error } = await query;

            if (error) {
                console.error('Supabase error in searchClients:', error);
                throw new DatabaseError('Помилка пошуку клієнтів в Supabase', error);
            }

            console.log(`🔍 Знайдено ${clients?.length || 0} клієнтів за критеріями пошуку`);
            return clients || [];
        } catch (error) {
            console.error('❌ Помилка пошуку клієнтів:', error);
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(`Помилка пошуку клієнтів: ${error.message}`);
        }
    }

    /**
     * Знайти клієнта за назвою (для перевірки унікальності)
     */
    async _findClientByName(name) {
        try {
            const { data: client, error } = await supabase
                .from('clients')
                .select('*')
                .eq('name', name)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Supabase error in _findClientByName:', error);
                throw new DatabaseError('Помилка пошуку клієнта за назвою', error);
            }

            return client;
        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            return null;
        }
    }

    /**
     * Логування операцій клієнтів
     */
    async _logClientOperation(operationType, clientId, logData) {
        try {
            if (this.OperationsLogController) {
                await this.OperationsLogController.logClientOperation(
                    operationType,
                    clientId,
                    logData
                );
            }
        } catch (logError) {
            console.error('❌ Помилка логування операції клієнта:', logError);
            // Не кидаємо помилку логування, щоб не зламати основну операцію
        }
    }

    /**
     * Отримати статистику клієнтів
     */
    async getClientStats() {
        this._checkInitialization();
        
        try {
            const { data: allClients, error: allError } = await supabase
                .from('clients')
                .select('id, is_active');

            if (allError) {
                console.error('Supabase error in getClientStats:', allError);
                throw new DatabaseError('Помилка отримання статистики клієнтів', allError);
            }

            const stats = {
                total: allClients?.length || 0,
                active: allClients?.filter(c => c.is_active).length || 0,
                inactive: allClients?.filter(c => !c.is_active).length || 0
            };

            console.log(`📊 Статистика клієнтів: ${stats.active} активних, ${stats.inactive} неактивних`);
            return stats;
        } catch (error) {
            console.error('❌ Помилка отримання статистики клієнтів:', error);
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(`Помилка отримання статистики клієнтів: ${error.message}`);
        }
    }
}

module.exports = SupabaseClientService; 