const supabaseClient = require('./supabaseClient');
const LegacyAuthService = require('../services/legacyAuthService');

/**
 * Auth Router - Dual Authentication System
 * Implements the Gradual Migration approach from Creative Phase
 * Supports both Supabase Auth and Legacy Express Sessions
 */
class AuthRouter {
  constructor() {
    this.legacyAuth = new LegacyAuthService();
    this.supabaseAuth = supabaseClient;
    
    console.log('🔀 Auth Router initialized with dual auth support');
  }

  /**
   * Primary authentication method
   * Checks Supabase JWT first, then falls back to legacy sessions
   */
  async authenticate(req) {
    try {
      // Option 1: Try Supabase JWT authentication first
      if (this.supabaseAuth.isAvailable()) {
        const supabaseUser = await this.authenticateSupabase(req);
        if (supabaseUser) {
          return {
            ...supabaseUser,
            authType: 'supabase',
            system: 'new'
          };
        }
      }

      // Option 2: Fallback to legacy session authentication
      const legacyUser = await this.legacyAuth.authenticate(req);
      if (legacyUser) {
        return {
          ...legacyUser,
          authType: 'legacy',
          system: 'old'
        };
      }

      // No authentication found
      return null;
    } catch (error) {
      console.error('🚨 Auth Router error:', error.message);
      throw error;
    }
  }

  /**
   * Authenticate using Supabase JWT
   */
  async authenticateSupabase(req) {
    try {
      // Extract JWT token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify JWT with Supabase
      const client = this.supabaseAuth.getClient();
      const { data: { user }, error } = await client.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }

      // Get user details from our custom users table
      const { data: userDetails, error: userError } = await client
        .from('users')
        .select('*')
        .eq('supabase_id', user.id)
        .single();

      if (userError || !userDetails) {
        // User exists in Supabase Auth but not in our users table
        // This might happen during migration
        console.warn(`⚠️ User ${user.id} found in Supabase Auth but not in users table`);
        return {
          id: user.id,
          email: user.email,
          username: user.email.split('@')[0],
          role: 'user',
          supabase_id: user.id,
          migrationNeeded: true
        };
      }

      return {
        id: userDetails.id,
        supabase_id: userDetails.supabase_id,
        username: userDetails.username,
        email: userDetails.email,
        full_name: userDetails.full_name,
        role: userDetails.role,
        permissions: userDetails.permissions,
        is_active: userDetails.is_active,
        last_login: userDetails.last_login
      };
    } catch (error) {
      console.error('🚨 Supabase authentication error:', error.message);
      return null;
    }
  }

  /**
   * Login with Supabase Auth
   */
  async loginSupabase(email, password) {
    try {
      const client = this.supabaseAuth.getClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        user: data.user,
        session: data.session,
        authType: 'supabase'
      };
    } catch (error) {
      console.error('🚨 Supabase login error:', error.message);
      throw error;
    }
  }

  /**
   * Register with Supabase Auth
   */
  async registerSupabase(email, password, userData = {}) {
    try {
      const client = this.supabaseAuth.getServiceClient();
      
      // Create user in Supabase Auth
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userData
      });

      if (error) {
        throw new Error(error.message);
      }

      // Create corresponding record in users table
      const { data: userRecord, error: userError } = await client
        .from('users')
        .insert({
          supabase_id: data.user.id,
          username: userData.username || email.split('@')[0],
          email: email,
          full_name: userData.full_name || '',
          role: userData.role || 'user',
          permissions: userData.permissions || {},
          is_active: true
        })
        .select()
        .single();

      if (userError) {
        console.error('🚨 Error creating user record:', userError);
        // Rollback: delete user from Supabase Auth
        await client.auth.admin.deleteUser(data.user.id);
        throw new Error('Failed to create user record');
      }

      return {
        user: data.user,
        userRecord: userRecord,
        authType: 'supabase'
      };
    } catch (error) {
      console.error('🚨 Supabase registration error:', error.message);
      throw error;
    }
  }

  /**
   * Logout from current authentication system
   */
  async logout(req, res) {
    try {
      const user = req.user;
      
      if (user && user.authType === 'supabase') {
        // Logout from Supabase
        const client = this.supabaseAuth.getClient();
        await client.auth.signOut();
      } else {
        // Logout from legacy session
        await this.legacyAuth.logout(req, res);
      }

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('🚨 Logout error:', error.message);
      throw error;
    }
  }

  /**
   * Migrate user from legacy to Supabase Auth
   */
  async migrateUser(userId, password) {
    try {
      // Get user from legacy system
      const legacyUser = await this.legacyAuth.getUserById(userId);
      if (!legacyUser) {
        throw new Error('Legacy user not found');
      }

      // Create user in Supabase Auth
      const migrationResult = await this.registerSupabase(
        legacyUser.email,
        password,
        {
          username: legacyUser.username,
          full_name: legacyUser.full_name,
          role: legacyUser.role,
          permissions: legacyUser.permissions
        }
      );

      // Update legacy user record with supabase_id
      await this.legacyAuth.updateUser(userId, {
        supabase_id: migrationResult.user.id,
        migration_status: 'completed',
        migrated_at: new Date().toISOString()
      });

      console.log(`✅ User ${legacyUser.username} migrated to Supabase`);
      
      return {
        success: true,
        user: migrationResult.userRecord,
        message: 'User migrated successfully'
      };
    } catch (error) {
      console.error('🚨 User migration error:', error.message);
      throw error;
    }
  }

  /**
   * Check authentication mode for request
   */
  getAuthMode(req) {
    const authHeader = req.headers.authorization;
    const sessionExists = req.session && req.session.userId;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return 'supabase';
    } else if (sessionExists) {
      return 'legacy';
    }
    
    return 'none';
  }

  /**
   * Get authentication system statistics
   */
  async getAuthStats() {
    try {
      const legacyCount = await this.legacyAuth.getUserCount();
      
      let supabaseCount = 0;
      if (this.supabaseAuth.isAvailable()) {
        const client = this.supabaseAuth.getServiceClient();
        const { count } = await client
          .from('users')
          .select('*', { count: 'exact', head: true })
          .not('supabase_id', 'is', null);
        supabaseCount = count || 0;
      }

      return {
        legacy: legacyCount,
        supabase: supabaseCount,
        total: legacyCount + supabaseCount,
        migrationProgress: legacyCount > 0 ? Math.round((supabaseCount / (legacyCount + supabaseCount)) * 100) : 100
      };
    } catch (error) {
      console.error('🚨 Auth stats error:', error.message);
      return {
        legacy: 0,
        supabase: 0,
        total: 0,
        migrationProgress: 0,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new AuthRouter(); 