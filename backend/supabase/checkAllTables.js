const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tables to check
const TABLES_TO_CHECK = [
    'products',
    'clients', 
    'orders',
    'order_items',
    'production',
    'production_batches',
    'stock_movements',
    'writeoffs',
    'arrivals',
    'arrival_items', // Note: arrival_items (not arrivals_items)
    'production_plans',
    'production_plan_items',
    'operations_log',
    'user_audit',
    'security_events',
    'production_settings'
];

async function checkTableSchema(tableName) {
    console.log(`\n🔍 Checking table: ${tableName}`);
    
    try {
        // Try to get table structure by selecting with limit 0
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
        
        if (error) {
            console.log(`   ❌ Error: ${error.message}`);
            return false;
        }
        
        // If we have data, show columns
        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            console.log(`   ✅ Columns (${columns.length}):`);
            columns.forEach(col => console.log(`      - ${col}`));
        } else {
            // Try to get count to verify table exists
            const { count, error: countError } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });
            
            if (countError) {
                console.log(`   ❌ Table doesn't exist: ${countError.message}`);
                return false;
            } else {
                console.log(`   ✅ Table exists but is empty (${count} records)`);
                
                // Try a test insert to see required columns
                const { error: insertError } = await supabase
                    .from(tableName)
                    .insert({ test: 'test' });
                
                if (insertError) {
                    console.log(`   📋 Required columns info:`);
                    console.log(`      ${insertError.message}`);
                }
            }
        }
        
        return true;
        
    } catch (err) {
        console.log(`   ❌ Error checking ${tableName}: ${err.message}`);
        return false;
    }
}

async function checkAllTables() {
    console.log('🚀 Checking all Supabase tables...\n');
    
    const results = {};
    
    for (const tableName of TABLES_TO_CHECK) {
        const exists = await checkTableSchema(tableName);
        results[tableName] = exists;
    }
    
    console.log('\n📊 SUMMARY:');
    const existingTables = Object.entries(results).filter(([name, exists]) => exists);
    const missingTables = Object.entries(results).filter(([name, exists]) => !exists);
    
    console.log(`✅ Existing tables (${existingTables.length}):`);
    existingTables.forEach(([name]) => console.log(`   - ${name}`));
    
    if (missingTables.length > 0) {
        console.log(`❌ Missing tables (${missingTables.length}):`);
        missingTables.forEach(([name]) => console.log(`   - ${name}`));
    }
    
    return results;
}

// Run if script is executed directly
if (require.main === module) {
    checkAllTables()
        .then(results => {
            const missingCount = Object.values(results).filter(exists => !exists).length;
            if (missingCount === 0) {
                console.log('\n🎉 All tables are available in Supabase!');
                process.exit(0);
            } else {
                console.log(`\n⚠️ ${missingCount} tables are missing. Check schema migration.`);
                process.exit(1);
            }
        })
        .catch(err => {
            console.error('❌ Error checking tables:', err.message);
            process.exit(1);
        });
}

module.exports = { checkAllTables, checkTableSchema }; 