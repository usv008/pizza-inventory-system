const { supabase } = require('./database-supabase');
require('dotenv').config();

async function executeSQLMigration() {
    console.log('🔧 Attempting to execute SQL migration for http_sessions table...\n');
    
    // Simple table creation without triggers first
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS http_sessions (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL UNIQUE,
            session_data TEXT NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;
    
    try {
        console.log('📋 Creating basic table structure...');
        
        // Try using the supabase client's sql method if available
        if (supabase.sql) {
            console.log('🔧 Using supabase.sql() method...');
            const result = await supabase.sql`
                CREATE TABLE IF NOT EXISTS http_sessions (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR(255) NOT NULL UNIQUE,
                    session_data TEXT NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `;
            console.log('✅ Table created via sql method:', result);
        } else {
            console.log('❌ supabase.sql() not available');
            
            // Try with rpc if we have a function for it
            console.log('🔧 Attempting with rpc exec_sql...');
            const { data, error } = await supabase.rpc('exec_sql', { 
                query: createTableSQL 
            });
            
            if (error) {
                console.log('❌ RPC exec_sql failed:', error);
                
                // Manual approach - try to use insert/upsert to trigger table creation
                console.log('🔧 Trying manual table detection...');
                const { data: testData, error: testError } = await supabase
                    .from('http_sessions')
                    .select('*')
                    .limit(1);
                    
                if (testError) {
                    console.log('❌ Table does not exist:', testError);
                    console.log('\n📋 MANUAL STEPS REQUIRED:');
                    console.log('1. Go to Supabase Dashboard > SQL Editor');
                    console.log('2. Create a new query');
                    console.log('3. Paste and execute this SQL:');
                    console.log('\n```sql');
                    console.log(createTableSQL);
                    console.log('```\n');
                    console.log('4. Then run this script again');
                } else {
                    console.log('✅ Table already exists!');
                }
            } else {
                console.log('✅ Table created via RPC:', data);
            }
        }
        
        // Verify table existence
        console.log('\n🔍 Verifying table existence...');
        const { data: verifyData, error: verifyError } = await supabase
            .from('http_sessions')
            .select('*')
            .limit(1);
            
        if (verifyError) {
            console.log('❌ Table verification failed:', verifyError);
            return false;
        } else {
            console.log('✅ Table http_sessions verified successfully!');
            
            // Add indexes if table exists
            console.log('\n🔧 Adding indexes...');
            try {
                if (supabase.rpc) {
                    await supabase.rpc('exec_sql', { 
                        query: 'CREATE INDEX IF NOT EXISTS idx_http_sessions_session_id ON http_sessions(session_id)'
                    });
                    await supabase.rpc('exec_sql', { 
                        query: 'CREATE INDEX IF NOT EXISTS idx_http_sessions_expires_at ON http_sessions(expires_at)'
                    });
                    console.log('✅ Indexes added');
                }
            } catch (indexError) {
                console.log('⚠️ Index creation skipped:', indexError.message);
            }
            
            return true;
        }
        
    } catch (error) {
        console.error('❌ Migration execution failed:', error);
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    executeSQLMigration()
        .then(success => {
            if (success) {
                console.log('\n🎉 Migration completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Migration failed - manual intervention required');
                process.exit(1);
            }
        });
}

module.exports = { executeSQLMigration };