-- Migration: Create Writeoff Documents System
-- Date: 2025-07-13
-- Purpose: Create new tables for group writeoff functionality
-- Based on creative phase decisions: Hybrid architecture with extended structure

-- 1. Create writeoff_documents table (main document table)
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

-- 2. Create writeoff_items table (document items/positions)
CREATE TABLE IF NOT EXISTS writeoff_items (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES writeoff_documents(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    batch_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create optimized indexes for search and analytics
CREATE INDEX IF NOT EXISTS idx_writeoff_documents_date 
    ON writeoff_documents(writeoff_date);

CREATE INDEX IF NOT EXISTS idx_writeoff_documents_responsible 
    ON writeoff_documents(responsible);

CREATE INDEX IF NOT EXISTS idx_writeoff_documents_created_at 
    ON writeoff_documents(created_at);

CREATE INDEX IF NOT EXISTS idx_writeoff_items_document 
    ON writeoff_items(document_id);

CREATE INDEX IF NOT EXISTS idx_writeoff_items_product 
    ON writeoff_items(product_id);

CREATE INDEX IF NOT EXISTS idx_writeoff_items_batch_date 
    ON writeoff_items(batch_date);

-- 4. Create function for automatic document number generation
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

-- 5. Create trigger for automatic updated_at timestamp
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

-- 6. Add comments for documentation
COMMENT ON TABLE writeoff_documents IS 'Main table for writeoff documents containing header information';
COMMENT ON TABLE writeoff_items IS 'Items/positions within writeoff documents';
COMMENT ON COLUMN writeoff_documents.document_number IS 'Auto-generated document number format: WO-YYYYMMDD-NNN';
COMMENT ON COLUMN writeoff_items.batch_date IS 'Optional batch date for FIFO tracking';
COMMENT ON FUNCTION generate_writeoff_document_number(DATE) IS 'Generates unique document numbers in format WO-YYYYMMDD-NNN';

-- 7. Grant necessary permissions (if using RLS)
-- These will be handled by Supabase RLS policies if needed

-- Migration completed successfully
SELECT 'Writeoff documents tables created successfully' as status; 