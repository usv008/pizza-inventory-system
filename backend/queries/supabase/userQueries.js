/**
 * User Queries для Supabase PostgreSQL
 * Замінює SQLite запити для роботи з користувачами
 */

const { supabase } = require('../../database-supabase');

const userQueries = {
    /**
     * Отримати всіх користувачів
     */
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('username');
                
            if (error) {
                throw new Error(`Supabase getAll users error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('userQueries.getAll error:', error);
            throw error;
        }
    },

    /**
     * Отримати користувача за ID
     */
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getById user error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('userQueries.getById error:', error);
            throw error;
        }
    },

    /**
     * Отримати користувача за username
     */
    async getByUsername(username) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getByUsername user error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('userQueries.getByUsername error:', error);
            throw error;
        }
    },

    /**
     * Отримати користувача за email
     */
    async getByEmail(email) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw new Error(`Supabase getByEmail user error: ${error.message}`);
            }
            
            return data;
        } catch (error) {
            console.error('userQueries.getByEmail error:', error);
            throw error;
        }
    },

    /**
     * Створити нового користувача
     */
    async create(userData) {
        try {
            // Підготувати дані для PostgreSQL
            const processedData = {
                ...userData,
                permissions: userData.permissions || '{}',
                first_login: userData.first_login ?? true,
                active: userData.active ?? true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('users')
                .insert(processedData)
                .select()
                .single();
                
            if (error) {
                // Обробка помилок унікальності
                if (error.code === '23505') { // unique_violation
                    if (error.message.includes('username')) {
                        throw new Error('Користувач з таким username вже існує');
                    }
                    if (error.message.includes('email')) {
                        throw new Error('Користувач з таким email вже існує');
                    }
                }
                throw new Error(`Supabase create user error: ${error.message}`);
            }
            
            return data.id; // Повертаємо тільки ID як в SQLite версії
        } catch (error) {
            console.error('userQueries.create error:', error);
            throw error;
        }
    },

    /**
     * Оновити користувача
     */
    async update(id, userData) {
        try {
            // Підготувати дані для PostgreSQL
            const processedData = {
                ...userData,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('users')
                .update(processedData)
                .eq('id', id)
                .select()
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    throw new Error('Користувача не знайдено');
                }
                // Обробка помилок унікальності
                if (error.code === '23505') { // unique_violation
                    if (error.message.includes('username')) {
                        throw new Error('Користувач з таким username вже існує');
                    }
                    if (error.message.includes('email')) {
                        throw new Error('Користувач з таким email вже існує');
                    }
                }
                throw new Error(`Supabase update user error: ${error.message}`);
            }
            
            return { changes: 1 }; // Імітуємо SQLite response
        } catch (error) {
            console.error('userQueries.update error:', error);
            throw error;
        }
    },

    /**
     * Оновити пароль користувача
     */
    async updatePassword(id, passwordHash) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash,
                    first_login: false, // Скидаємо прапорець першого входу
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    throw new Error('Користувача не знайдено');
                }
                throw new Error(`Supabase updatePassword user error: ${error.message}`);
            }
            
            return { changes: 1 }; // Імітуємо SQLite response
        } catch (error) {
            console.error('userQueries.updatePassword error:', error);
            throw error;
        }
    },

    /**
     * Видалити користувача (hard delete - використовувати обережно)
     */
    async delete(id) {
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', id);
                
            if (error) {
                throw new Error(`Supabase delete user error: ${error.message}`);
            }
            
            return true;
        } catch (error) {
            console.error('userQueries.delete error:', error);
            throw error;
        }
    },

    /**
     * Пошук користувачів за параметрами
     */
    async search(searchParams) {
        try {
            const { username, email, role, active, limit = 50, offset = 0 } = searchParams;
            
            let query = supabase.from('users').select('*');
            
            // Фільтри пошуку
            if (username) {
                query = query.ilike('username', `%${username}%`);
            }
            
            if (email) {
                query = query.ilike('email', `%${email}%`);
            }
            
            if (role) {
                query = query.eq('role', role);
            }
            
            // Фільтр активності
            if (active !== null && active !== undefined) {
                query = query.eq('active', active);
            }
            
            // Сортування та пагінація
            query = query
                .order('username')
                .range(offset, offset + limit - 1);
                
            const { data, error } = await query;
                
            if (error) {
                throw new Error(`Supabase search users error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('userQueries.search error:', error);
            throw error;
        }
    },

    /**
     * Отримати активних користувачів
     */
    async getActiveUsers() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('active', true)
                .order('username');
                
            if (error) {
                throw new Error(`Supabase getActiveUsers error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('userQueries.getActiveUsers error:', error);
            throw error;
        }
    },

    /**
     * Отримати користувачів за роллю
     */
    async getUsersByRole(role) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', role)
                .eq('active', true)
                .order('username');
                
            if (error) {
                throw new Error(`Supabase getUsersByRole error: ${error.message}`);
            }
            
            return data || [];
        } catch (error) {
            console.error('userQueries.getUsersByRole error:', error);
            throw error;
        }
    }
};

module.exports = userQueries;