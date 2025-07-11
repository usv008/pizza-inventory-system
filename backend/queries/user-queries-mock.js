const axios = require('axios');

const mockApiUrl = process.env.SUPABASE_URL || 'http://localhost:8080';
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

const api = axios.create({
    baseURL: `${mockApiUrl}/rest/v1`,
    headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    }
});

console.log('[USER QUERIES MOCK] Mock user queries ініціалізовано з', mockApiUrl);

const userQueries = {
    async getAll() {
        try {
            const response = await api.get('/users');
            console.log(`[USER QUERIES MOCK] Отримано ${response.data.length} користувачів`);
            return response.data;
        } catch (error) {
            console.error('[USER QUERIES MOCK] Помилка getAll:', error.message);
            throw new Error(`Помилка отримання користувачів: ${error.message}`);
        }
    },

    async getById(id) {
        try {
            const response = await api.get(`/users?id=eq.${id}`);
            const user = response.data[0];
            return user || null;
        } catch (error) {
            console.error('[USER QUERIES MOCK] Помилка getById:', error.message);
            throw new Error(`Помилка отримання користувача: ${error.message}`);
        }
    },

    async getByUsername(username) {
        try {
            const response = await api.get(`/users?username=eq.${username}`);
            const user = response.data[0];
            return user || null;
        } catch (error) {
            console.error('[USER QUERIES MOCK] Помилка getByUsername:', error.message);
            throw new Error(`Помилка пошуку користувача: ${error.message}`);
        }
    },

    async updatePassword(id, hashedPassword) {
        try {
            await api.patch(`/users?id=eq.${id}`, { 
                password_hash: hashedPassword, 
                first_login: 0 
            });
            return { changes: 1 };
        } catch (error) {
            console.error('[USER QUERIES MOCK] Помилка updatePassword:', error.message);
            throw new Error(`Помилка оновлення пароля: ${error.message}`);
        }
    }
};

module.exports = { userQueries };
