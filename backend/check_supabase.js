require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  console.log('🔍 Перевіряю таблиці в Supabase...\n');
  
  const testTables = ['products', 'stock_movements', 'users', 'orders', 'clients', 'writeoffs', 'production'];
  
  for (const table of testTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table.padEnd(15)} - існує, записів: ${count}`);
        
        // Отримаємо структуру таблиці
        const { data: sample } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (sample && sample[0]) {
          console.log(`   Поля: ${Object.keys(sample[0]).join(', ')}`);
        }
      } else {
        console.log(`❌ ${table.padEnd(15)} - не існує (${error.message})`);
      }
    } catch (err) {
      console.log(`❌ ${table.padEnd(15)} - помилка: ${err.message}`);
    }
  }
}

checkTables().then(() => process.exit(0));
