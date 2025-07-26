const { supabase } = require('./database-supabase');
require('dotenv').config();

async function checkSessionsTable() {
    console.log('🔍 Checking user_sessions table structure...\n');
    
    try {
        // Try to get table info by selecting with limit 0
        const { data, error } = await supabase
            .from('user_sessions')
            .select('*')
            .limit(0);
            
        if (error) {
            console.log('❌ Error accessing user_sessions table:', error);
            
            // Check if table exists at all
            console.log('\n🔍 Checking if table exists in schema...');
            const { data: tables, error: schemaError } = await supabase
                .rpc('get_table_info', { table_name: 'user_sessions' });
                
            if (schemaError) {
                console.log('❌ Schema check failed:', schemaError);
            } else {
                console.log('✅ Tables found:', tables);
            }
        } else {
            console.log('✅ user_sessions table exists and is accessible');
            console.log('📊 Current data structure (empty result):', data);
        }
        
        // Let's try to see all tables in the schema
        console.log('\n📋 Listing all available tables...');
        const { data: allTables, error: listError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');
            
        if (listError) {
            console.log('❌ Could not list tables:', listError);
        } else {
            console.log('✅ Available tables:', allTables.map(t => t.table_name));
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

checkSessionsTable();