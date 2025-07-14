/**
 * Add batch_id column to existing writeoff_items table
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://wncukuajzygzyasofyoe.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY3VrdWFqenlnenlhc29meW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNTg5NjksImV4cCI6MjA0ODczNDk2OX0.4K1KJhUBhONM4KFpWQQZLEJhB5vfJHKVcLqrOZhKZQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addBatchIdColumn() {
    try {
        console.log('🔧 Adding batch_id column to writeoff_items table...');
        
        // Add batch_id column
        const addColumnQuery = `
            ALTER TABLE writeoff_items 
            ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES batches(id);
        `;
        
        console.log('📄 SQL for adding batch_id column:');
        console.log(addColumnQuery);
        
        // Add index for batch_id
        const addIndexQuery = `
            CREATE INDEX IF NOT EXISTS idx_writeoff_items_batch_id ON writeoff_items(batch_id);
        `;
        
        console.log('📄 SQL for adding batch_id index:');
        console.log(addIndexQuery);
        
        console.log('\n🚨 ВАЖЛИВО: Виконайте ці SQL команди в Supabase Dashboard:');
        console.log('1. Перейдіть до SQL Editor в Supabase Dashboard');
        console.log('2. Виконайте команди вище');
        console.log('3. Перевірте що колонка додалася успішно');
        
        // Test if column already exists
        const { data, error } = await supabase
            .from('writeoff_items')
            .select('batch_id')
            .limit(1);
            
        if (error && error.code === '42703') {
            console.log('❌ Колонка batch_id ще не існує - потрібно виконати SQL команди');
        } else if (error) {
            console.log('❌ Помилка перевірки колонки:', error);
        } else {
            console.log('✅ Колонка batch_id вже існує!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the function
addBatchIdColumn(); 