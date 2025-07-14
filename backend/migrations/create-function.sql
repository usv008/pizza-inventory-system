-- Create function for document number generation
-- Execute in Supabase Dashboard SQL Editor

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
    WHERE writeoff_documents.writeoff_date = generate_writeoff_document_number.writeoff_date;
    
    -- Generate new document number: WO-YYYYMMDD-NNN
    new_number := 'WO-' || date_str || '-' || LPAD((existing_count + 1)::TEXT, 3, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT generate_writeoff_document_number(CURRENT_DATE) as test_document_number; 