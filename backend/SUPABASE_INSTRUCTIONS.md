# 📋 Інструкції для створення таблиць в Supabase Dashboard

## 🎯 Мета
Створити 6 основних таблиць Pizza System в Supabase PostgreSQL базі даних.

## 📍 Загальна інформація
- **Проект**: wncukuajzygzyasofyoe  
- **URL Dashboard**: https://supabase.com/dashboard/project/wncukuajzygzyasofyoe
- **SQL Editor**: https://supabase.com/dashboard/project/wncukuajzygzyasofyoe/sql/new

## 🔄 Послідовність виконання

### ⚠️ КРИТИЧНО ВАЖЛИВО: Виконувати в точному порядку!

Після аналізу залежностей виявлено, що **users** має бути ПЕРШОЮ таблицею!

**ПРАВИЛЬНИЙ ПОРЯДОК:**

```
1. users (ПЕРША! self-referencing FK)
2. products (базова таблиця)
3. clients (базова таблиця) 
4. production_settings (налаштування)
5. production (залежить від products + users)
6. production_batches (залежить від products + production)
7. stock_movements (залежить від products + production_batches + users)
8. orders (залежить від clients + users)
9. order_items (залежить від orders + products)
10. writeoffs (залежить від products + users)
```

## 📝 Покрокова інструкція

### Крок 1: Відкрити Supabase Dashboard
1. Перейти на https://supabase.com/dashboard/project/wncukuajzygzyasofyoe
2. Логін в аккаунт (якщо потрібно)
3. Натиснути "SQL Editor" в лівому меню

### Крок 2: 🚨ПЕРША ТАБЛИЦЯ - Створити таблицю users
1. В SQL Editor натиснути "New query"
2. Скопіювати весь вміст файлу `migrations/supabase/001_create_users_table.sql`
3. Вставити в редактор
4. Натиснути "Run" або Ctrl+Enter
5. ✅ Повинно з'явитися повідомлення про успішне виконання
6. ✅ Перевірити адміністратора (username: admin, ID: 1)
7. ✅ Перевірити self-referencing FK (created_by)

### Крок 3: Створити таблицю products
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/002_create_products_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити тестові дані (5 товарів)

### Крок 4: Створити таблицю clients  
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/003_create_clients_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити тестові дані (5 клієнтів)

### Крок 5: Створити таблицю production_settings
1. Нова query: "New query"  
2. Скопіювати `migrations/supabase/004_create_production_settings_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити singleton налаштування

### Крок 6: Створити таблицю production
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/005_create_production_table.sql` 
3. Вставити і запустити "Run"
4. ✅ Перевірити записи виробництва

### Крок 7: Створити таблицю production_batches
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/006_create_production_batches_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити FIFO партії

### Крок 8: Створити таблицю stock_movements
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/007_create_stock_movements_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити журнал рухів

### Крок 9: Створити таблицю orders
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/008_create_orders_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити тестові замовлення

### Крок 10: Створити таблицю order_items  
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/009_create_order_items_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити позиції з JSONB allocated_batches

### Крок 11: Створити таблицю writeoffs
1. Нова query: "New query"
2. Скопіювати `migrations/supabase/010_create_writeoffs_table.sql`
3. Вставити і запустити "Run"
4. ✅ Перевірити списання товарів

## 🧪 Перевірка результату

Після створення всіх таблиць запустити тести:

```bash
# Перевірка окремих таблиць
node tests/supabase/test-products-table.js
node tests/supabase/test-clients-table.js  
node tests/supabase/test-stock-movements-table.js

# Запустити всі тести разом
node tests/supabase/run-all-tests.js

# Показати поточний статус
node migration-status.js
```

## ✅ Критерії успіху

Після виконання всіх кроків повинно бути:
- ✅ 6 таблиць створено без помилок
- ✅ Всі тестові дані вставлені
- ✅ Foreign key constraints працюють
- ✅ Тести показують 100% успішність
- ✅ JSONB поля працюють коректно
- ✅ Унікальні обмеження діють

## 🚨 Можливі помилки

**Помилка Foreign Key**: Якщо з'являється помилка про відсутність посилання
- ✅ Перевірте чи створені таблиці в правильному порядку
- ✅ Перевірте чи немає друкарських помилок в назвах таблиць

**Помилка Unique Constraint**: Якщо товар/клієнт вже існує
- ✅ Це нормально при повторному запуску (DROP TABLE IF EXISTS спрацював)

**JSONB помилки**: Перевірити правильність JSON синтаксису
- ✅ Всі JSON поля мають правильний формат

## 📞 Підтримка

Якщо виникають проблеми:
1. Перевірити чи правильно скопійований весь SQL код
2. Запустити тести для діагностики
3. Перевірити логи в Supabase Dashboard

**Готово! Після успішного створення можна переходити до наступних таблиць (users, production, writeoffs тощо)** 🎉