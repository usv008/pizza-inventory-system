/**
 * Simple Migration Runner for Writeoff Documents
 * This script executes the SQL commands manually through Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🚀 Starting Writeoff Documents Migration (Manual)');
    console.log('================================================');
    
    try {
        console.log('📋 SQL Commands to execute in Supabase Dashboard:');
        console.log('================================================');
        
        console.log(`
-- 1. Create writeoff_documents table
CREATE TABLE IF NOT EXISTS writeoff_documents (
    id BIGSERIAL PRIMARY KEY,
    document_number TEXT UNIQUE NOT NULL,
    writeoff_date DATE NOT NULL,
    reason TEXT NOT NULL,
    responsible TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create writeoff_items table
CREATE TABLE IF NOT EXISTS writeoff_items (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES writeoff_documents(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    batch_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_writeoff_documents_date ON writeoff_documents(writeoff_date);
CREATE INDEX IF NOT EXISTS idx_writeoff_documents_responsible ON writeoff_documents(responsible);
CREATE INDEX IF NOT EXISTS idx_writeoff_documents_created_at ON writeoff_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_writeoff_items_document ON writeoff_items(document_id);
CREATE INDEX IF NOT EXISTS idx_writeoff_items_product ON writeoff_items(product_id);
CREATE INDEX IF NOT EXISTS idx_writeoff_items_batch_date ON writeoff_items(batch_date);

-- 4. Create document number generation function
CREATE OR REPLACE FUNCTION generate_writeoff_document_number(writeoff_date DATE)
RETURNS TEXT AS $$
DECLARE
    date_str TEXT;
    existing_count INTEGER;
    new_number TEXT;
BEGIN
    -- Format date as YYYYMMDD
    date_str := TO_CHAR(writeoff_date, 'YYYYMMDD');
    
    -- Count existing documents for this date
    SELECT COUNT(*) INTO existing_count
    FROM writeoff_documents
    WHERE writeoff_date = $1;
    
    -- Generate new document number: WO-YYYYMMDD-NNN
    new_number := 'WO-' || date_str || '-' || LPAD((existing_count + 1)::TEXT, 3, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 5. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_writeoff_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_writeoff_documents_updated_at
    BEFORE UPDATE ON writeoff_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_writeoff_documents_updated_at();
        `);
        
        console.log('================================================');
        console.log('📝 Instructions:');
        console.log('1. Copy the SQL commands above');
        console.log('2. Go to your Supabase Dashboard → SQL Editor');
        console.log('3. Paste and execute the SQL commands');
        console.log('4. Verify tables are created successfully');
        console.log('5. Test the backend API endpoints');
        
        console.log('================================================');
        console.log('🔍 Testing connection to Supabase...');
        
        // Test connection
        const { data, error } = await supabase
            .from('products')
            .select('id')
            .limit(1);
            
        if (error) {
            console.error('❌ Connection test failed:', error);
        } else {
            console.log('✅ Supabase connection successful');
        }
        
        console.log('================================================');
        console.log('⏭️  Next steps after running SQL:');
        console.log('1. Test the new API endpoints:');
        console.log('   - GET /api/writeoff-documents');
        console.log('   - GET /api/writeoff-documents/preview-number?date=2025-07-13');
        console.log('   - POST /api/writeoff-documents');
        console.log('2. Create frontend interface');
        console.log('3. Test document creation');
        
    } catch (error) {
        console.error('💥 Migration preparation failed:', error);
        process.exit(1);
    }
}

// Execute migration preparation
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration }; 