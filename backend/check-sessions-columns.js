const { supabase } = require('./database-supabase');
require('dotenv').config();

async function checkSessionsColumns() {
    console.log('🔍 Checking user_sessions table columns...\n');
    
    try {
        // First, let's see if the table has any data to understand its structure
        const { data: existingData, error: dataError } = await supabase
            .from('user_sessions')
            .select('*')
            .limit(1);
            
        if (dataError) {
            console.log('❌ Error querying existing data:', dataError);
        } else {
            console.log('📊 Existing data sample:', existingData);
            if (existingData.length > 0) {
                console.log('📝 Detected columns:', Object.keys(existingData[0]));
            } else {
                console.log('📝 Table is empty, will try to insert test data...');
            }
        }
        
        // Try a simple insert to see what columns are expected
        console.log('\n🧪 Testing minimal insert...');
        const { data: insertData, error: insertError } = await supabase
            .from('user_sessions')
            .insert({
                session_id: 'test-column-check',
                data: '{"test": true}' // Try different column names
            })
            .select();
            
        if (insertError) {
            console.log('❌ Insert with "data" column failed:', insertError);
            
            // Try with session_data
            console.log('\n🧪 Testing with session_data column...');
            const { data: insertData2, error: insertError2 } = await supabase
                .from('user_sessions')
                .insert({
                    session_id: 'test-column-check-2',
                    session_data: '{"test": true}'
                })
                .select();
                
            if (insertError2) {
                console.log('❌ Insert with "session_data" column failed:', insertError2);
                
                // Let's check the actual schema using PostgreSQL system tables
                console.log('\n🔍 Querying PostgreSQL system catalog...');
                const { data: schemaData, error: schemaError } = await supabase
                    .rpc('get_table_columns', { table_name: 'user_sessions' });
                    
                if (schemaError) {
                    console.log('❌ Schema query failed, trying raw SQL approach...');
                    
                    // Last resort - try to use the REST API with a deliberate error to see schema
                    const { data: errorData, error: testError } = await supabase
                        .from('user_sessions')
                        .insert({
                            nonexistent_column: 'test'
                        });
                        
                    console.log('🔍 Error response (may show expected columns):', testError);
                } else {
                    console.log('✅ Schema data:', schemaData);
                }
            } else {
                console.log('✅ Insert with "session_data" succeeded:', insertData2);
                
                // Clean up test data
                await supabase
                    .from('user_sessions')
                    .delete()
                    .eq('session_id', 'test-column-check-2');
            }
        } else {
            console.log('✅ Insert with "data" succeeded:', insertData);
            
            // Clean up test data
            await supabase
                .from('user_sessions')
                .delete()
                .eq('session_id', 'test-column-check');
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

checkSessionsColumns();