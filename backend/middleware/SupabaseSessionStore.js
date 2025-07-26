const { Store } = require('express-session');
const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase session store for express-session
 * Replaces SQLiteStore to complete the Supabase migration
 */
class SupabaseSessionStore extends Store {
    constructor(options = {}) {
        super(options);
        
        this.supabase = createClient(
            options.supabaseUrl || process.env.SUPABASE_URL,
            options.supabaseKey || process.env.SUPABASE_SERVICE_KEY
        );
        
        this.tableName = options.tableName || 'http_sessions';
        this.fallbackToMemory = options.fallbackToMemory !== false; // Default true
        this.memoryStore = new Map(); // Fallback for when table doesn't exist
        
        this.useMemoryFallback = undefined; // Will be set after verification
        
        console.log(`✅ SupabaseSessionStore initialized with table: ${this.tableName}`);
        
        // Test table existence asynchronously
        this.verifyTable();
    }
    
    /**
     * Verify table exists and is accessible
     */
    async verifyTable() {
        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .select('id')
                .limit(1);
                
            if (error) {
                console.warn(`⚠️ SupabaseSessionStore: Table ${this.tableName} not accessible:`, error.message);
                if (this.fallbackToMemory) {
                    console.log('📝 SupabaseSessionStore: Using memory fallback until table is created');
                    this.useMemoryFallback = true;
                } else {
                    throw error;
                }
            } else {
                console.log(`✅ SupabaseSessionStore: Table ${this.tableName} verified`);
                this.useMemoryFallback = false;
            }
        } catch (err) {
            console.error('❌ SupabaseSessionStore: Table verification failed:', err);
            this.useMemoryFallback = this.fallbackToMemory;
        }
    }
    
    /**
     * Attempt to fetch session by the given session ID
     */
    async get(sessionId, callback) {
        try {
            // Ensure table verification is complete
            if (this.useMemoryFallback === undefined) {
                await this.verifyTable();
            }
            
            // Use memory fallback if table not available
            if (this.useMemoryFallback) {
                const sessionData = this.memoryStore.get(sessionId);
                if (!sessionData) {
                    return callback(null, null);
                }
                
                // Check expiry
                if (sessionData.expires_at && new Date(sessionData.expires_at) < new Date()) {
                    this.memoryStore.delete(sessionId);
                    return callback(null, null);
                }
                
                return callback(null, sessionData.data);
            }
            
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('session_data, expires_at')
                .eq('session_id', sessionId)
                .single();
                
            if (error) {
                if (error.code === 'PGRST116' || error.code === '42P01') {
                    // No rows returned or table doesn't exist - session not found
                    return callback(null, null);
                }
                throw error;
            }
            
            // Check if session has expired
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                // Session expired - delete it and return null
                await this.destroy(sessionId, () => {}); // Silent cleanup
                return callback(null, null);
            }
            
            const sessionData = JSON.parse(data.session_data);
            callback(null, sessionData);
            
        } catch (err) {
            console.error('SupabaseSessionStore.get error:', err);
            callback(err);
        }
    }
    
    /**
     * Commit the given session object associated with the given session ID
     */
    async set(sessionId, session, callback) {
        try {
            // Ensure table verification is complete
            if (this.useMemoryFallback === undefined) {
                await this.verifyTable();
            }
            
            // Calculate expiry time
            let expiresAt;
            if (session.cookie && session.cookie.expires) {
                expiresAt = session.cookie.expires;
            } else if (session.cookie && session.cookie.maxAge) {
                expiresAt = new Date(Date.now() + session.cookie.maxAge);
            } else {
                // Default to 24 hours if no expiry set
                expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            }
            
            // Use memory fallback if table not available
            if (this.useMemoryFallback) {
                this.memoryStore.set(sessionId, {
                    data: session,
                    expires_at: expiresAt
                });
                return callback(null);
            }
            
            const sessionData = JSON.stringify(session);
            
            const { error } = await this.supabase
                .from(this.tableName)
                .upsert({
                    session_id: sessionId,
                    session_data: sessionData,
                    expires_at: expiresAt.toISOString(),
                    updated_at: new Date().toISOString()
                });
                
            if (error) {
                throw error;
            }
            
            callback(null);
            
        } catch (err) {
            console.error('SupabaseSessionStore.set error:', err);
            callback(err);
        }
    }
    
    /**
     * Destroy the session associated with the given session ID
     */
    async destroy(sessionId, callback) {
        try {
            // Use memory fallback if table not available
            if (this.useMemoryFallback) {
                this.memoryStore.delete(sessionId);
                return callback(null);
            }
            
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('session_id', sessionId);
                
            if (error && error.code !== '42P01') { // Ignore table not found
                throw error;
            }
            
            callback(null);
            
        } catch (err) {
            console.error('SupabaseSessionStore.destroy error:', err);
            callback(err);
        }
    }
    
    /**
     * Invoke the given callback function with all active sessions
     */
    async all(callback) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('session_id, session_data')
                .gt('expires_at', new Date().toISOString());
                
            if (error) {
                throw error;
            }
            
            const sessions = {};
            data.forEach(row => {
                sessions[row.session_id] = JSON.parse(row.session_data);
            });
            
            callback(null, sessions);
            
        } catch (err) {
            console.error('SupabaseSessionStore.all error:', err);
            callback(err);
        }
    }
    
    /**
     * Return the number of sessions
     */
    async length(callback) {
        try {
            const { count, error } = await this.supabase
                .from(this.tableName)
                .select('session_id', { count: 'exact' })
                .gt('expires_at', new Date().toISOString());
                
            if (error) {
                throw error;
            }
            
            callback(null, count);
            
        } catch (err) {
            console.error('SupabaseSessionStore.length error:', err);
            callback(err);
        }
    }
    
    /**
     * Clear all sessions
     */
    async clear(callback) {
        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .neq('session_id', ''); // Delete all rows
                
            if (error) {
                throw error;
            }
            
            callback(null);
            
        } catch (err) {
            console.error('SupabaseSessionStore.clear error:', err);
            callback(err);
        }
    }
    
    /**
     * Cleanup expired sessions
     */
    async cleanupExpired() {
        try {
            // Clean memory store
            if (this.useMemoryFallback) {
                const now = new Date();
                for (const [sessionId, sessionData] of this.memoryStore.entries()) {
                    if (sessionData.expires_at && new Date(sessionData.expires_at) < now) {
                        this.memoryStore.delete(sessionId);
                    }
                }
                console.log('✅ Expired memory sessions cleaned up');
                return;
            }
            
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .lt('expires_at', new Date().toISOString());
                
            if (error && error.code !== '42P01') { // Ignore table not found
                throw error;
            }
            
            console.log('✅ Expired sessions cleaned up');
            
        } catch (err) {
            console.error('SupabaseSessionStore.cleanupExpired error:', err);
        }
    }
    
    /**
     * Start periodic cleanup of expired sessions
     */
    startCleanupInterval(intervalMs = 60 * 60 * 1000) { // Default: 1 hour
        setInterval(() => {
            this.cleanupExpired();
        }, intervalMs);
        
        console.log(`✅ SupabaseSessionStore cleanup interval started (${intervalMs}ms)`);
    }
}

module.exports = SupabaseSessionStore;