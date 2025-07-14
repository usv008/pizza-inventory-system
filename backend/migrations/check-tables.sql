-- Check existing tables and their structure
-- Execute in Supabase Dashboard SQL Editor

-- 1. List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Check if batches table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'batches'
) as batches_exists;

-- 3. Check writeoff_items structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'writeoff_items' 
ORDER BY ordinal_position; 