require('dotenv').config();

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch;

async function createSessionsTableViaAPI() {
    console.log('🔧 Creating http_sessions table via Supabase REST API...\n');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        return false;
    }
    
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS http_sessions (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL UNIQUE,
            session_data TEXT NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_http_sessions_session_id ON http_sessions(session_id);
        CREATE INDEX IF NOT EXISTS idx_http_sessions_expires_at ON http_sessions(expires_at);
    `;
    
    try {
        // Try using Supabase's SQL endpoint
        console.log('📡 Attempting to execute SQL via REST API...');
        
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
                'apikey': serviceKey
            },
            body: JSON.stringify({
                query: createTableSQL
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Table created successfully via API:', result);
            return true;
        } else {
            const error = await response.text();
            console.log('❌ API request failed:', response.status, error);
            
            // Try alternative approach - create via INSERT (will fail but show table structure)
            console.log('\n🔧 Trying alternative table creation approach...');
            
            const insertResponse = await fetch(`${supabaseUrl}/rest/v1/http_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceKey}`,
                    'apikey': serviceKey,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    session_id: 'test',
                    session_data: '{}',
                    expires_at: new Date().toISOString()
                })
            });
            
            if (!insertResponse.ok) {
                const insertError = await insertResponse.text();
                console.log('❌ Table does not exist, creation required:', insertError);
                
                // Extract helpful information from error
                if (insertError.includes('relation') && insertError.includes('does not exist')) {
                    console.log('\n📋 Manual table creation required:');
                    console.log('1. Go to Supabase Dashboard > SQL Editor');
                    console.log('2. Execute this SQL:');
                    console.log('\n```sql');
                    console.log(createTableSQL);
                    console.log('```');
                }
                
                return false;
            } else {
                console.log('✅ Table already exists and working');
                
                // Clean up test data
                await fetch(`${supabaseUrl}/rest/v1/http_sessions?session_id=eq.test`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceKey}`,
                        'apikey': serviceKey
                    }
                });
                
                return true;
            }
        }
        
    } catch (error) {
        console.error('❌ API request failed:', error);
        
        // Show manual steps
        console.log('\n📋 Please create the table manually:');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to SQL Editor');
        console.log('4. Create new query and execute:');
        console.log('\n```sql');
        console.log(createTableSQL);
        console.log('```');
        
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    createSessionsTableViaAPI()
        .then(success => {
            process.exit(success ? 0 : 1);
        });
}

module.exports = { createSessionsTableViaAPI };