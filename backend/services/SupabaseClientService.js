const { supabase } = require('../supabase-client');

class SupabaseClientService {
    constructor() {
        console.log('✅ SupabaseClientService ініціалізовано');
    }

    async getAllClients() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('name');
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ClientService] Помилка отримання клієнтів:', err.message);
            throw err;
        }
    }

    async getClientById(id) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ClientService] Помилка отримання клієнта:', err.message);
            throw err;
        }
    }

    async createClient(clientData) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert([{
                    name: clientData.name,
                    contact_person: clientData.contact_person || null,
                    phone: clientData.phone || null,
                    email: clientData.email || null,
                    address: clientData.address || null,
                    notes: clientData.notes || null,
                    is_active: clientData.is_active !== undefined ? clientData.is_active : 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ClientService] Помилка створення клієнта:', err.message);
            throw err;
        }
    }

    async updateClient(id, clientData) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .update({
                    name: clientData.name,
                    contact_person: clientData.contact_person,
                    phone: clientData.phone,
                    email: clientData.email,
                    address: clientData.address,
                    notes: clientData.notes,
                    is_active: clientData.is_active,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ClientService] Помилка оновлення клієнта:', err.message);
            throw err;
        }
    }

    async deleteClient(id) {
        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[ClientService] Помилка видалення клієнта:', err.message);
            throw err;
        }
    }

    async searchClients(query) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .or(`name.ilike.%${query}%,contact_person.ilike.%${query}%,phone.ilike.%${query}%`)
                .order('name');
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ClientService] Помилка пошуку клієнтів:', err.message);
            throw err;
        }
    }

    async getActiveClients() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('is_active', 1)
                .order('name');
                
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[ClientService] Помилка отримання активних клієнтів:', err.message);
            throw err;
        }
    }

    async getClientStats() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('is_active');
                
            if (error) throw error;
            
            const stats = {
                total: data.length,
                active: data.filter(c => c.is_active === 1).length,
                inactive: data.filter(c => c.is_active === 0).length
            };
            
            return stats;
        } catch (err) {
            console.error('[ClientService] Помилка отримання статистики клієнтів:', err.message);
            throw err;
        }
    }
}

module.exports = SupabaseClientService;
