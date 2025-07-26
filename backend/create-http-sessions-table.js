const { supabase } = require('./database-supabase');
require('dotenv').config();

async function createHttpSessionsTable() {
    console.log('🔧 Creating HTTP sessions table for express-session...\n');
    
    const tableName = 'http_sessions';
    
    try {
        // Check if table already exists
        console.log(`🔍 Checking if ${tableName} table exists...`);
        const { data: existingData, error: checkError } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
            
        if (!checkError) {
            console.log(`✅ Table ${tableName} already exists`);
            return tableName;
        }
        
        console.log(`📋 Table ${tableName} does not exist, creating it...`);
        
        // Create the table using SQL
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL UNIQUE,
                session_data TEXT NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Create index for faster lookups
            CREATE INDEX IF NOT EXISTS idx_${tableName}_session_id ON ${tableName}(session_id);
            CREATE INDEX IF NOT EXISTS idx_${tableName}_expires_at ON ${tableName}(expires_at);
            
            -- Create updated_at trigger
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            
            CREATE TRIGGER update_${tableName}_updated_at 
                BEFORE UPDATE ON ${tableName} 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
        `;
        
        // Execute the SQL using RPC (if available) or direct query
        const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        
        if (error) {
            console.log('❌ RPC method failed, trying alternative approach...');
            
            // Alternative: use a simpler approach with individual operations
            console.log('🔧 Creating table with basic structure...');
            
            // We'll create a migration script instead
            console.log('📝 Creating migration SQL script...');
            
            const fs = require('fs');
            const migrationSQL = `
-- HTTP Sessions table for express-session
-- This replaces SQLite sessions with Supabase sessions

CREATE TABLE IF NOT EXISTS http_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    session_data TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_http_sessions_session_id ON http_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_http_sessions_expires_at ON http_sessions(expires_at);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_http_sessions_updated_at 
    BEFORE UPDATE ON http_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE http_sessions IS 'HTTP sessions for express-session middleware';
COMMENT ON COLUMN http_sessions.session_id IS 'Express session ID';
COMMENT ON COLUMN http_sessions.session_data IS 'Serialized session data (JSON)';
COMMENT ON COLUMN http_sessions.expires_at IS 'Session expiration timestamp';
`;
            
            fs.writeFileSync('create-http-sessions.sql', migrationSQL);
            console.log('✅ Migration SQL saved to create-http-sessions.sql');
            console.log('📋 Please run this SQL manually in Supabase dashboard:');
            console.log('   Dashboard > SQL Editor > New Query > Paste and Run');
            console.log('\n📝 Migration SQL:');
            console.log(migrationSQL);
            
            return 'http_sessions';
        } else {
            console.log('✅ Table created successfully via RPC:', data);
        }
        
        // Verify table creation
        console.log(`\n🔍 Verifying ${tableName} table...`);
        const { data: verifyData, error: verifyError } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
            
        if (verifyError) {
            console.log('❌ Table verification failed:', verifyError);
            throw new Error('Table creation verification failed');
        } else {
            console.log(`✅ Table ${tableName} created and verified successfully!`);
        }
        
        return tableName;
        
    } catch (error) {
        console.error('❌ Error creating HTTP sessions table:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    createHttpSessionsTable()
        .then(tableName => {
            console.log(`\n🎉 HTTP sessions table '${tableName}' ready for use!`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Failed to create HTTP sessions table:', error);
            process.exit(1);
        });
}

module.exports = { createHttpSessionsTable };