/**
 * Test Migration Script
 * Tests connection and creates writeoff document tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        console.log('📡 Testing basic connection...');
        
        // Test basic connection
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name')
            .limit(1);
            
        if (productsError) {
            console.error('❌ Connection failed:', productsError);
            return false;
        }
        
        console.log('✅ Connection successful!');
        console.log('📊 Sample product:', products[0]);
        
        // Check if writeoff_documents table exists
        console.log('🔍 Checking if writeoff_documents table exists...');
        const { data: existingDocs, error: docsError } = await supabase
            .from('writeoff_documents')
            .select('id')
            .limit(1);
            
        if (docsError) {
            console.log('ℹ️  writeoff_documents table does not exist yet');
            console.log('📋 Need to create tables manually in Supabase Dashboard');
            return false;
        } else {
            console.log('✅ writeoff_documents table already exists!');
            return true;
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
        return false;
    }
}

async function testWriteoffQueries() {
    try {
        console.log('🧪 Testing writeoff document queries...');
        
        // Test the hybrid query
        const { writeoffDocumentQueries } = require('./supabase-database');
        
        console.log('📋 Testing getAllHybrid...');
        const result = await writeoffDocumentQueries.getAllHybrid();
        
        console.log('✅ Hybrid query successful!');
        console.log(`📊 Found ${result.length} total writeoff records`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Query test failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting Supabase Tests');
    console.log('==========================');
    
    const connectionOk = await testConnection();
    
    if (connectionOk) {
        await testWriteoffQueries();
    }
    
    console.log('==========================');
    console.log('🏁 Tests completed');
}

if (require.main === module) {
    runTests();
}

module.exports = { testConnection, testWriteoffQueries }; 