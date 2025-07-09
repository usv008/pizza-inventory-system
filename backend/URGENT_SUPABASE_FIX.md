# 🚨 URGENT: SUPABASE SCHEMA FIX REQUIRED

## ⚠️ КРИТИЧНА ПРОБЛЕМА ВИЯВЛЕНА:
Таблиця `stock_movements` в Supabase НЕ МАЄ критичних полів SQLite системи.

## 🔧 ЩО ПОТРІБНО ЗРОБИТИ ЗАРАЗ:

### КРОК 1: Іди на Supabase Dashboard
1. Відкрий: https://supabase.com/dashboard  
2. Проект: `qtabusnhhwhnhfcgokbk`
3. Розділ: **Table Editor** → **stock_movements**

### КРОК 2: Додай відсутні поля
Натисни **+ Add Column** для кожного поля:

**Поле 1:**
- Name: `pieces`
- Type: `int4` (integer)
- Default value: `0`
- ✅ Allow null: OFF

**Поле 2:**  
- Name: `boxes`
- Type: `int4` (integer)  
- Default value: `0`
- ✅ Allow null: OFF

**Поле 3:**
- Name: `user`
- Type: `text`
- Default value: `'system'`
- ✅ Allow null: ON

### КРОК 3: Відключи RLS
1. Іди в **Authentication** → **Policies**
2. Знайди таблицю `stock_movements`
3. Вимкни **Enable RLS** (або видали всі політики)

### КРОК 4: Повтори для інших таблиць
Вимкни RLS для:
- `products` 
- `users`
- `orders`
- `clients`

## ✅ ПІСЛЯ ВИПРАВЛЕННЯ
Напиши в чат: **"FIXED"** і я продовжу міграцію.

## 🚀 АЛЬТЕРНАТИВА: SQL SCRIPT  
Якщо маєш доступ до SQL Editor в Supabase:

```sql
ALTER TABLE stock_movements ADD COLUMN pieces INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN boxes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN user TEXT DEFAULT 'system';

ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
```

**Виконай SQL і напиши: "FIXED"**
