#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

async function checkUsersSchema() {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Спробуємо отримати один запис для перевірки структури
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    console.log('📋 Supabase users table structure:');
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      columns.forEach(col => console.log(`   ${col}`));
    } else {
      console.log('   No data to show structure, trying to insert test...');
      
      // Спробуємо тестову вставку з мінімальними даними
      const { error: insertError } = await supabase
        .from('users')
        .insert({ username: 'test_schema_check' })
        .select();
        
      if (insertError) {
        console.log('   Insert error (shows required columns):');
        console.log('   ', insertError.message);
      }
    }

  } catch (error) {
    console.error('Failed to check schema:', error.message);
  }
}

checkUsersSchema(); 