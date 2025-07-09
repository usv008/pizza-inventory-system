const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { NotFoundError, DatabaseError, ValidationError } = require('../middleware/errors/AppError');

/**
 * Supabase Writeoff Service - бізнес-логіка для списань через Supabase
 * Міграція з SQLite на PostgreSQL/Supabase
 */

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

class SupabaseWriteoffService {
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
        console.log('✅ SupabaseWriteoffService ініціалізовано');
    }

    /**
     * Перевірка ініціалізації
     */
    _checkInitialization() {
        if (!this.initialized) {
            throw new DatabaseError('SupabaseWriteoffService не ініціалізовано');
        }
    }

    /**
     * Отримати всі списання
     */
    async getAllWriteoffs() {
        this._checkInitialization();
        
        try {
            const { data: writeoffs, error } = await supabase
                .from('writeoffs')
                .select(`
                    *,
                    products!inner (
                        id,
                        name
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase error in getAllWriteoffs:', error);
                throw new DatabaseError('Помилка отримання списань з Supabase', error);
            }

            console.log(`📋 Отримано ${writeoffs?.length || 0} списань`);
            return writeoffs || [];
        } catch (error) {
            console.error('❌ Помилка отримання списань:', error);
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(`Помилка отримання списань: ${error.message}`);
        }
    }

    /**
     * Отримати списання за ID
     */
    async getWriteoffById(writeoffId) {
        this._checkInitialization();
        
        try {
            const { data: writeoff, error } = await supabase
                .from('writeoffs')
                .select(`
                    *,
                    products (
                        id,
                        name
                    )
                `)
                .eq('id', writeoffId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(`⚠️ Списання з ID ${writeoffId} не знайдено`);
                    return null;
                }
                console.error('Supabase error in getWriteoffById:', error);
                throw new DatabaseError('Помилка отримання списання з Supabase', error);
            }

            if (writeoff) {
                console.log(`📋 Отримано списання: ${writeoff.quantity} шт. продукту ${writeoff.products?.name || 'N/A'} (ID: ${writeoffId})`);
            }
            
            return writeoff;
        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            console.error(`❌ Помилка отримання списання ${writeoffId}:`, error);
            throw new DatabaseError(`Помилка отримання списання: ${error.message}`);
        }
    }

    /**
     * Створити нове списання
     */
    async createWriteoff(writeoffData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Map data to Supabase format (спрощена версія для поточної схеми)
            const supabaseData = {
                product_id: writeoffData.product_id,
                quantity: writeoffData.total_quantity || writeoffData.quantity,
                reason: writeoffData.reason || null,
                notes: writeoffData.notes || null,
                writeoff_date: writeoffData.writeoff_date || new Date().toISOString().split('T')[0]
                // Прибрали created_at та updated_at так як Supabase їх автоматично створює
            };

            const { data: result, error } = await supabase
                .from('writeoffs')
                .insert([supabaseData])
                .select(`
                    *,
                    products (name)
                `)
                .single();

            if (error) {
                console.error('Supabase error in createWriteoff:', error);
                if (error.code === '23503') { // Foreign key violation
                    throw new ValidationError('Продукт або партія не існує');
                }
                throw new DatabaseError('Помилка створення списання в Supabase', error);
            }
            
            console.log(`✅ Створено списання: ${result.quantity} шт. продукту "${result.products?.name || 'N/A'}" (ID: ${result.id})`);

            // Логуємо операцію
            await this._logWriteoffOperation('CREATE_WRITEOFF', result.id, {
                operation_id: result.id,
                entity_type: 'writeoff',
                entity_id: result.id,
                new_data: writeoffData,
                description: `Створено списання: ${result.quantity} шт. продукту "${result.products?.name || 'N/A'}"`,
                ...auditInfo
            });

            return { id: result.id };
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            console.error('❌ Помилка створення списання:', error);
            throw new DatabaseError(`Помилка створення списання: ${error.message}`);
        }
    }

    /**
     * Оновити списання
     */
    async updateWriteoff(writeoffId, writeoffData, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо старі дані для логування
            const oldWriteoff = await this.getWriteoffById(writeoffId);
            if (!oldWriteoff) {
                throw new NotFoundError('Списання не знайдено');
            }

            // Map data to Supabase format (спрощена версія для поточної схеми)
            const supabaseData = {
                product_id: writeoffData.product_id !== undefined ? writeoffData.product_id : oldWriteoff.product_id,
                quantity: writeoffData.total_quantity !== undefined ? writeoffData.total_quantity : (writeoffData.quantity !== undefined ? writeoffData.quantity : oldWriteoff.quantity),
                reason: writeoffData.reason !== undefined ? writeoffData.reason : oldWriteoff.reason,
                notes: writeoffData.notes !== undefined ? writeoffData.notes : oldWriteoff.notes,
                writeoff_date: writeoffData.writeoff_date !== undefined ? writeoffData.writeoff_date : oldWriteoff.writeoff_date
                // Прибрали updated_at - Supabase оновлює автоматично
            };

            const { data: result, error } = await supabase
                .from('writeoffs')
                .update(supabaseData)
                .eq('id', writeoffId)
                .select(`
                    *,
                    products (name)
                `);

            if (error) {
                console.error('Supabase error in updateWriteoff:', error);
                if (error.code === '23503') { // Foreign key violation
                    throw new ValidationError('Продукт або партія не існує');
                }
                throw new DatabaseError('Помилка оновлення списання в Supabase', error);
            }

            if (!result || result.length === 0) {
                throw new NotFoundError('Списання не знайдено або не оновлено');
            }

            console.log(`✅ Оновлено списання: ${result[0].quantity} шт. продукту "${result[0].products?.name || 'N/A'}" (ID: ${writeoffId})`);

            // Логуємо операцію
            await this._logWriteoffOperation('UPDATE_WRITEOFF', writeoffId, {
                operation_id: writeoffId,
                entity_type: 'writeoff',
                entity_id: writeoffId,
                old_data: oldWriteoff,
                new_data: writeoffData,
                description: `Оновлено списання: ${result[0].quantity} шт. продукту "${result[0].products?.name || 'N/A'}"`,
                ...auditInfo
            });

            return { changes: 1 };
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            console.error(`❌ Помилка оновлення списання ${writeoffId}:`, error);
            throw new DatabaseError(`Помилка оновлення списання: ${error.message}`);
        }
    }

    /**
     * Видалити списання
     */
    async deleteWriteoff(writeoffId, auditInfo = {}) {
        this._checkInitialization();
        
        try {
            // Отримуємо дані списання для логування
            const writeoff = await this.getWriteoffById(writeoffId);
            if (!writeoff) {
                throw new NotFoundError('Списання не знайдено');
            }

            const { data: result, error } = await supabase
                .from('writeoffs')
                .delete()
                .eq('id', writeoffId)
                .select();

            if (error) {
                console.error('Supabase error in deleteWriteoff:', error);
                throw new DatabaseError('Помилка видалення списання в Supabase', error);
            }

            if (!result || result.length === 0) {
                throw new NotFoundError('Списання не знайдено');
            }

            console.log(`🗑️ Видалено списання: ${writeoff.quantity} шт. продукту "${writeoff.products?.name || 'N/A'}" (ID: ${writeoffId})`);

            // Логуємо операцію
            await this._logWriteoffOperation('DELETE_WRITEOFF', writeoffId, {
                operation_id: writeoffId,
                entity_type: 'writeoff',
                entity_id: writeoffId,
                old_data: writeoff,
                description: `Видалено списання: ${writeoff.quantity} шт. продукту "${writeoff.products?.name || 'N/A'}"`,
                ...auditInfo
            });

            return { changes: 1 };
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            console.error(`❌ Помилка видалення списання ${writeoffId}:`, error);
            throw new DatabaseError(`Помилка видалення списання: ${error.message}`);
        }
    }

    /**
     * Пошук списань
     */
    async searchWriteoffs(searchParams = {}) {
        this._checkInitialization();
        
        try {
            let query = supabase
                .from('writeoffs')
                .select(`
                    *,
                    products (
                        id,
                        name,
                        code
                    ),
                    production_batches (
                        id,
                        batch_number
                    )
                `);

            // Додаємо фільтри
            if (searchParams.product_id) {
                query = query.eq('product_id', searchParams.product_id);
            }
            if (searchParams.batch_id) {
                query = query.eq('batch_id', searchParams.batch_id);
            }
            if (searchParams.reason) {
                query = query.ilike('reason', `%${searchParams.reason}%`);
            }
            if (searchParams.created_by) {
                query = query.ilike('created_by', `%${searchParams.created_by}%`);
            }
            if (searchParams.date_from) {
                query = query.gte('writeoff_date', searchParams.date_from);
            }
            if (searchParams.date_to) {
                query = query.lte('writeoff_date', searchParams.date_to);
            }

            query = query.order('created_at', { ascending: false });

            const { data: writeoffs, error } = await query;

            if (error) {
                console.error('Supabase error in searchWriteoffs:', error);
                throw new DatabaseError('Помилка пошуку списань в Supabase', error);
            }

            console.log(`🔍 Знайдено ${writeoffs?.length || 0} списань за критеріями пошуку`);
            return writeoffs || [];
        } catch (error) {
            console.error('❌ Помилка пошуку списань:', error);
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(`Помилка пошуку списань: ${error.message}`);
        }
    }

    /**
     * Отримати статистику списань
     */
    async getWriteoffStats(dateRange = {}) {
        this._checkInitialization();
        
        try {
            let query = supabase
                .from('writeoffs')
                .select(`
                    id,
                    quantity,
                    writeoff_date,
                    reason,
                    products (
                        id,
                        name,
                        code
                    )
                `);

            // Додаємо фільтр дат якщо заданий
            if (dateRange.from) {
                query = query.gte('writeoff_date', dateRange.from);
            }
            if (dateRange.to) {
                query = query.lte('writeoff_date', dateRange.to);
            }

            const { data: writeoffs, error } = await query;

            if (error) {
                console.error('Supabase error in getWriteoffStats:', error);
                throw new DatabaseError('Помилка отримання статистики списань', error);
            }

            // Обчислюємо статистику
            const stats = {
                total_writeoffs: writeoffs?.length || 0,
                total_quantity: writeoffs?.reduce((sum, w) => sum + (w.quantity || 0), 0) || 0,
                by_reason: {},
                by_product: {},
                by_date: {}
            };

            // Групуємо за причинами
            writeoffs?.forEach(writeoff => {
                const reason = writeoff.reason || 'Не вказано';
                stats.by_reason[reason] = (stats.by_reason[reason] || 0) + writeoff.quantity;

                const productName = writeoff.products?.name || 'Невідомий продукт';
                stats.by_product[productName] = (stats.by_product[productName] || 0) + writeoff.quantity;

                const date = writeoff.writeoff_date?.split('T')[0] || 'Невідома дата';
                stats.by_date[date] = (stats.by_date[date] || 0) + writeoff.quantity;
            });

            console.log(`📊 Статистика списань: ${stats.total_writeoffs} записів, ${stats.total_quantity} одиниць списано`);
            return stats;
        } catch (error) {
            console.error('❌ Помилка отримання статистики списань:', error);
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(`Помилка отримання статистики списань: ${error.message}`);
        }
    }

    /**
     * Логування операцій списань
     */
    async _logWriteoffOperation(operationType, writeoffId, logData) {
        try {
            if (this.OperationsLogController) {
                await this.OperationsLogController.logOperation({
                    operation_type: operationType,
                    ...logData
                });
            }
        } catch (logError) {
            console.error('❌ Помилка логування операції списання:', logError);
            // Не кидаємо помилку логування, щоб не зламати основну операцію
        }
    }
}

module.exports = SupabaseWriteoffService; 