const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Supabase Client Configuration
 * Базовий клієнт для підключення до Supabase API
 */
class SupabaseClient {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.warn('⚠️  Supabase credentials not found. Running in legacy mode.');
      this.client = null;
      this.serviceClient = null;
      return;
    }

    // Клієнт для користувацьких операцій (з anon key)
    this.client = createClient(this.supabaseUrl, this.supabaseAnonKey);
    
    // Клієнт для адміністративних операцій (з service role key)
    if (this.supabaseServiceKey) {
      this.serviceClient = createClient(this.supabaseUrl, this.supabaseServiceKey);
    }
    
    console.log('✅ Supabase client initialized');
  }

  /**
   * Отримати клієнт для користувацьких операцій
   */
  getClient() {
    return this.client;
  }

  /**
   * Отримати сервісний клієнт для адміністративних операцій
   */
  getServiceClient() {
    return this.serviceClient;
  }

  /**
   * Перевірити підключення до Supabase
   */
  async testConnection() {
    if (!this.client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('users')
        .select('count(*)')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = table not found (expected)
        throw error;
      }
      
      return { success: true, message: 'Supabase connection working' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Перевірити чи доступний Supabase
   */
  isAvailable() {
    return this.client !== null;
  }
}

// Створити singleton instance
const supabaseClient = new SupabaseClient();

module.exports = supabaseClient; 