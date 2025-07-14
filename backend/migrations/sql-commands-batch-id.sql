-- Add batch_id column to writeoff_items table
-- Execute these commands in Supabase Dashboard SQL Editor

-- 1. Add batch_id column with foreign key reference
ALTER TABLE writeoff_items 
ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES batches(id);

-- 2. Add index for batch_id for better performance
CREATE INDEX IF NOT EXISTS idx_writeoff_items_batch_id ON writeoff_items(batch_id);

-- 3. Verify the column was added (optional check)
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'writeoff_items' 
AND column_name = 'batch_id'; 