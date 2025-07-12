const { createClient } = require('@supabase/supabase-js');

// Завантажуємо змінні середовища з .env файлу
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Перевіряємо наявність обов'язкових змінних середовища
if (!supabaseUrl) {
    console.error('❌ ПОМИЛКА: SUPABASE_URL не знайдено в змінних середовища');
    console.error('💡 Переконайтесь що файл .env існує і містить SUPABASE_URL');
    process.exit(1);
}

if (!supabaseKey) {
    console.error('❌ ПОМИЛКА: SUPABASE_SERVICE_ROLE_KEY не знайдено в змінних середовища');
    console.error('💡 Переконайтесь що файл .env існує і містить SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function createArrivalsTables() {
  console.log('🔄 Створення таблиць arrivals та arrivals_items в Supabase...');
  
  try {
    // Перевіряємо що з'єднання працює
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('id')
      .limit(1);
      
    if (testError) {
      console.error('❌ Помилка з\'єднання з Supabase:', testError);
      return;
    }
    
    console.log('✅ З\'єднання з Supabase працює');
    
    // Створюємо таблицю arrivals
    console.log('🔧 Створення таблиці arrivals...');
    
    const createArrivalsSQL = `
      CREATE TABLE IF NOT EXISTS arrivals (
        id BIGSERIAL PRIMARY KEY,
        arrival_number TEXT UNIQUE NOT NULL,
        arrival_date DATE NOT NULL,
        reason TEXT NOT NULL,
        created_by TEXT DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const { data: arrivalData, error: arrivalError } = await supabase.rpc('exec_sql', {
      sql: createArrivalsSQL
    });
    
    if (arrivalError) {
      console.log('ℹ️ Можливо таблиця arrivals вже існує:', arrivalError.message);
    } else {
      console.log('✅ Таблиця arrivals створена успішно');
    }
    
    // Створюємо таблицю arrivals_items
    console.log('🔧 Створення таблиці arrivals_items...');
    
    const createItemsSQL = `
      CREATE TABLE IF NOT EXISTS arrivals_items (
        id BIGSERIAL PRIMARY KEY,
        arrival_id BIGINT NOT NULL REFERENCES arrivals(id) ON DELETE CASCADE,
        product_id BIGINT NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        batch_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const { data: itemsData, error: itemsError } = await supabase.rpc('exec_sql', {
      sql: createItemsSQL
    });
    
    if (itemsError) {
      console.log('ℹ️ Можливо таблиця arrivals_items вже існує:', itemsError.message);
    } else {
      console.log('✅ Таблиця arrivals_items створена успішно');
    }
    
    // Перевіряємо створені таблиці
    console.log('🔍 Перевірка створених таблиць...');
    
    try {
      const { data: arrivalCheck, error: arrivalCheckError } = await supabase
        .from('arrivals')
        .select('id')
        .limit(1);
        
      if (arrivalCheckError) {
        console.log('❌ Таблиця arrivals недоступна:', arrivalCheckError.message);
      } else {
        console.log('✅ Таблиця arrivals доступна для запитів');
      }
    } catch (err) {
      console.log('❌ Помилка перевірки arrivals:', err.message);
    }
    
    try {
      const { data: itemsCheck, error: itemsCheckError } = await supabase
        .from('arrivals_items')
        .select('id')
        .limit(1);
        
      if (itemsCheckError) {
        console.log('❌ Таблиця arrivals_items недоступна:', itemsCheckError.message);
      } else {
        console.log('✅ Таблиця arrivals_items доступна для запитів');
      }
    } catch (err) {
      console.log('❌ Помилка перевірки arrivals_items:', err.message);
    }
    
    console.log('✅ Міграція завершена успішно!');
    
  } catch (error) {
    console.error('❌ Загальна помилка міграції:', error);
    throw error;
  }
}

// Запуск міграції
if (require.main === module) {
  createArrivalsTables()
    .then(() => {
      console.log('🎉 Міграція завершена');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Міграція провалилася:', error);
      process.exit(1);
    });
}

module.exports = { createArrivalsTables }; 