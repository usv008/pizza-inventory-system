const { supabase } = require('../supabase-client');
const bcrypt = require('bcrypt');

class SupabaseUserService {
    constructor() {
        console.log('✅ SupabaseUserService ініціалізовано');
    }

    async getAllUsers() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, email, role, active, created_at, updated_at')
                .order('username');
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[UserService] Помилка отримання користувачів:', err.message);
            throw err;
        }
    }

    async getUserById(id) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, email, role, active, created_at, updated_at')
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[UserService] Помилка отримання користувача:', err.message);
            throw err;
        }
    }

    async getUserByUsername(username) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') return null; // No rows found
                throw error;
            }
            return data;
        } catch (err) {
            console.error('[UserService] Помилка пошуку користувача:', err.message);
            throw err;
        }
    }

    async createUser(userData) {
        try {
            // Хешуємо пароль
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    username: userData.username,
                    email: userData.email || null,
                    password_hash: hashedPassword,
                    role: userData.role || 'ПРАЦІВНИК',
                    active: userData.active !== undefined ? userData.active : 1,
                    first_login: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select('id, username, email, role, active, created_at, updated_at')
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[UserService] Помилка створення користувача:', err.message);
            throw err;
        }
    }

    async updateUser(id, userData) {
        try {
            const updateData = {
                username: userData.username,
                email: userData.email,
                role: userData.role,
                active: userData.active,
                updated_at: new Date().toISOString()
            };

            // Якщо є новий пароль, хешуємо його
            if (userData.password) {
                updateData.password_hash = await bcrypt.hash(userData.password, 10);
                updateData.first_login = 0;
            }

            const { data, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', id)
                .select('id, username, email, role, active, created_at, updated_at')
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[UserService] Помилка оновлення користувача:', err.message);
            throw err;
        }
    }

    async deleteUser(id) {
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[UserService] Помилка видалення користувача:', err.message);
            throw err;
        }
    }

    async validateUserCredentials(username, password) {
        try {
            const user = await this.getUserByUsername(username);
            if (!user || !user.active) {
                return null;
            }

            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return null;
            }

            // Повертаємо користувача без пароля
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (err) {
            console.error('[UserService] Помилка валідації користувача:', err.message);
            throw err;
        }
    }

    async getUserStats() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('active, role');
                
            if (error) throw error;
            
            const stats = {
                total: data.length,
                active: data.filter(u => u.active === 1).length,
                inactive: data.filter(u => u.active === 0).length,
                by_role: {}
            };

            // Підрахунок за ролями
            data.forEach(user => {
                if (!stats.by_role[user.role]) {
                    stats.by_role[user.role] = 0;
                }
                stats.by_role[user.role]++;
            });
            
            return stats;
        } catch (err) {
            console.error('[UserService] Помилка отримання статистики користувачів:', err.message);
            throw err;
        }
    }

    async searchUsers(query) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, email, role, active, created_at, updated_at')
                .or(`username.ilike.%${query}%,email.ilike.%${query}%,role.ilike.%${query}%`)
                .order('username');
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[UserService] Помилка пошуку користувачів:', err.message);
            throw err;
        }
    }
}

module.exports = SupabaseUserService;
