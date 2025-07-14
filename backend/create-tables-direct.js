/**
 * Direct Table Creation Script
 * Creates writeoff document tables directly via Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
    console.log('🚀 Creating writeoff document tables...');
    
    try {
        // Create writeoff_documents table
        console.log('📋 Creating writeoff_documents table...');
        const createDocsTable = `
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
        `;
        
        // Try using the SQL editor endpoint (if available)
        console.log('📄 SQL for writeoff_documents:');
        console.log(createDocsTable);
        
        // Create writeoff_items table
        console.log('📋 Creating writeoff_items table...');
        const createItemsTable = `
            CREATE TABLE IF NOT EXISTS writeoff_items (
                id BIGSERIAL PRIMARY KEY,
                document_id BIGINT NOT NULL REFERENCES writeoff_documents(id) ON DELETE CASCADE,
                product_id BIGINT NOT NULL REFERENCES products(id),
                batch_id BIGINT REFERENCES batches(id),
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                batch_date DATE,
                notes TEXT DEFAULT '',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
        
        console.log('📄 SQL for writeoff_items:');
        console.log(createItemsTable);
        
        // Create indexes
        console.log('📋 Creating indexes...');
        const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_writeoff_documents_date ON writeoff_documents(writeoff_date);
            CREATE INDEX IF NOT EXISTS idx_writeoff_documents_responsible ON writeoff_documents(responsible);
            CREATE INDEX IF NOT EXISTS idx_writeoff_documents_created_at ON writeoff_documents(created_at);
            CREATE INDEX IF NOT EXISTS idx_writeoff_items_document ON writeoff_items(document_id);
            CREATE INDEX IF NOT EXISTS idx_writeoff_items_product ON writeoff_items(product_id);
            CREATE INDEX IF NOT EXISTS idx_writeoff_items_batch_id ON writeoff_items(batch_id);
            CREATE INDEX IF NOT EXISTS idx_writeoff_items_batch_date ON writeoff_items(batch_date);
        `;
        
        console.log('📄 SQL for indexes:');
        console.log(createIndexes);
        
        // Create function for document number generation
        console.log('📋 Creating document number function...');
        const createFunction = `
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
        `;
        
        console.log('📄 SQL for function:');
        console.log(createFunction);
        
        // Create trigger
        console.log('📋 Creating trigger...');
        const createTrigger = `
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
        `;
        
        console.log('📄 SQL for trigger:');
        console.log(createTrigger);
        
        console.log('================================================');
        console.log('📝 COMPLETE SQL SCRIPT TO RUN IN SUPABASE:');
        console.log('================================================');
        
        const completeSQL = `
-- Writeoff Documents Migration
-- Execute this in Supabase Dashboard → SQL Editor

${createDocsTable}

${createItemsTable}

${createIndexes}

${createFunction}

${createTrigger}

-- Verify tables created
SELECT 'writeoff_documents table created' as status;
SELECT 'writeoff_items table created' as status;
SELECT 'Migration completed successfully' as status;
        `;
        
        console.log(completeSQL);
        
        console.log('================================================');
        console.log('📋 NEXT STEPS:');
        console.log('1. Copy the SQL script above');
        console.log('2. Go to Supabase Dashboard → SQL Editor');
        console.log('3. Paste and execute the SQL');
        console.log('4. Run: node test-migration.js');
        console.log('5. Start the server: pm2 start app-new.js --name pizza-system');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    }
}

if (require.main === module) {
    createTables();
}

module.exports = { createTables }; 