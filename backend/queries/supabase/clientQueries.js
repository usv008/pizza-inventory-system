/**
 * Client Queries для Supabase PostgreSQL
 * Замінює SQLite запити для роботи з клієнтами
 */

const { supabase } = require('../../database-supabase');

const clientQueries = {
    /**
     * Отримати всіх активних клієнтів
     */
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('is_active', true)
                .order('name');
                
            if (error) {
                throw new Error(`Supabase getAll clients error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('clientQueries.getAll error:', error);
            throw error;
        }
    },

    /**
     * Отримати клієнта за ID
     */
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getById client error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('clientQueries.getById error:', error);
            throw error;
        }
    },

    /**
     * Отримати клієнта за назвою
     */
    async getByName(name) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('name', name)
                .eq('is_active', true)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getByName client error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('clientQueries.getByName error:', error);
            throw error;
        }
    },

    /**
     * Створити нового клієнта
     */
    async create(clientData) {
        try {
            // Підготувати дані для PostgreSQL
            const processedData = {
                ...clientData,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('clients')
                .insert(processedData)
                .select()
                .single();
                
            if (error) {
                // Обробка помилок унікальності
                if (error.code === '23505') { // unique_violation
                    if (error.message.includes('name')) {
                        throw new Error('Клієнт з такою назвою вже існує');
                    }
                    if (error.message.includes('email')) {
                        throw new Error('Клієнт з таким email вже існує');
                    }
                }
                throw new Error(`Supabase create client error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('clientQueries.create error:', error);
            throw error;
        }
    },

    /**
     * Оновити клієнта
     */
    async update(id, clientData) {
        try {
            // Підготувати дані для PostgreSQL
            const processedData = {
                ...clientData,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('clients')
                .update(processedData)
                .eq('id', id)
                .select()
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    throw new Error('Клієнта не знайдено');
                }
                // Обробка помилок унікальності
                if (error.code === '23505') { // unique_violation
                    if (error.message.includes('name')) {
                        throw new Error('Клієнт з такою назвою вже існує');
                    }
                    if (error.message.includes('email')) {
                        throw new Error('Клієнт з таким email вже існує');
                    }
                }
                throw new Error(`Supabase update client error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('clientQueries.update error:', error);
            throw error;
        }
    },

    /**
     * Деактивувати клієнта (soft delete)
     */
    async deactivate(id) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    throw new Error('Клієнта не знайдено');
                }
                throw new Error(`Supabase deactivate client error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('clientQueries.deactivate error:', error);
            throw error;
        }
    },

    /**
     * Видалити клієнта (hard delete - використовувати обережно)
     */
    async delete(id) {
        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id);
                
            if (error) {
                throw new Error(`Supabase delete client error: ${error.message}`);
            }
            
            return true;
        } catch (error) {
            console.error('clientQueries.delete error:', error);
            throw error;
        }
    },

    /**
     * Пошук клієнтів за параметрами
     */
    async search(searchParams) {
        try {
            const { name, phone, email, active = true, limit = 50, offset = 0 } = searchParams;
            
            let query = supabase.from('clients').select('*');
            
            // Фільтри пошуку
            if (name) {
                query = query.ilike('name', `%${name}%`);
            }
            
            if (phone) {
                query = query.ilike('phone', `%${phone}%`);
            }
            
            if (email) {
                query = query.ilike('email', `%${email}%`);
            }
            
            // Фільтр активності
            if (active !== null && active !== undefined) {
                query = query.eq('is_active', active);
            }
            
            // Сортування та пагінація
            query = query
                .order('name')
                .range(offset, offset + limit - 1);
                
            const { data, error } = await query;
                
            if (error) {
                throw new Error(`Supabase search clients error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('clientQueries.search error:', error);
            throw error;
        }
    },

};

module.exports = clientQueries;