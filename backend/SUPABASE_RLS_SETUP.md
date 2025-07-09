# 🔐 НАЛАШТУВАННЯ SUPABASE RLS POLICIES

## 🚨 ПРОБЛЕМА
```
❌ new row violates row-level security policy for table "stock_movements"
```

## 🔧 РІШЕННЯ: Налаштувати RLS політики в Supabase Dashboard

### **КРОК 1: Відкрити Supabase Dashboard**
1. Перейти на https://supabase.com/dashboard
2. Відкрити проект: `qtabusnhhwhnhfcgokbk`
3. Перейти у розділ **Authentication** → **Policies**

### **КРОК 2: Налаштувати політики для stock_movements**

**Варіант A: Тимчасово вимкнути RLS (для розробки)**
```sql
-- У SQL Editor виконати:
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
```

**Варіант B: Створити політики (рекомендовано)**
```sql
-- Політика для читання (SELECT)
CREATE POLICY "Enable read access for all users" ON stock_movements
    FOR SELECT USING (true);

-- Політика для вставки (INSERT)  
CREATE POLICY "Enable insert for authenticated users" ON stock_movements
    FOR INSERT WITH CHECK (true);

-- Політика для оновлення (UPDATE)
CREATE POLICY "Enable update for authenticated users" ON stock_movements
    FOR UPDATE USING (true);

-- Політика для видалення (DELETE)
CREATE POLICY "Enable delete for authenticated users" ON stock_movements
    FOR DELETE USING (true);
```

### **КРОК 3: Налаштувати для інших таблиць**

**Для products:**
```sql
-- Якщо RLS увімкнено
CREATE POLICY "Enable all operations for products" ON products
    FOR ALL USING (true);
```

**Для users:**
```sql
CREATE POLICY "Enable all operations for users" ON users
    FOR ALL USING (true);
```

**Для orders:**
```sql
CREATE POLICY "Enable all operations for orders" ON orders
    FOR ALL USING (true);
```

**Для clients:**
```sql
CREATE POLICY "Enable all operations for clients" ON clients
    FOR ALL USING (true);
```

### **КРОК 4: Перевірити результат**

Після налаштування запустити тест:
```bash
cd /var/www/pizza-system/backend
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      product_id: 1,
      movement_type: 'IN',
      quantity: 5,
      reason: 'Тест після налаштування RLS'
    })
    .select()
    .single();
    
  if (error) {
    console.log('❌ Все ще помилка:', error.message);
  } else {
    console.log('✅ RLS налаштовано! ID:', data.id);
  }
}

testInsert().catch(console.error);
"
```

### **КРОК 5: Альтернативне рішення (якщо проблеми з RLS)**

**Використовувати service_role key замість anon key:**
```bash
# У .env змінити:
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# (service_role key обходить RLS)
```

## �� РЕЗУЛЬТАТ
Після налаштування RLS:
- ✅ Вставки в Supabase працюватимуть
- ✅ MovementService буде повністю функціональний
- ✅ Можна переходити до PLAN mode

## 📞 ЯКЩО ПРОБЛЕМИ
1. Перевірити чи service_role key правильний
2. Перевірити чи таблиці існують
3. Тимчасово вимкнути RLS для розробки
4. Звернутися до Supabase документації: https://supabase.com/docs/guides/auth/row-level-security
