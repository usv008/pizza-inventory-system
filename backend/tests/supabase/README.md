# 🧪 Supabase Tests

Ця папка містить тестові скрипти для перевірки міграції на Supabase.

## 📋 Структура тестів

### Базові тести
- `test-connection.js` - Тест базового з'єднання з Supabase
- `test-client.js` - Тест Supabase JS клієнта

### Тести таблиць
- `test-products-table.js` - Тест таблиці products
- `test-clients-table.js` - Тест таблиці clients
- `test-users-table.js` - Тест таблиці users
- `test-orders-table.js` - Тест таблиці orders
- ... (інші таблиці)

## 🚀 Як запускати тести

### Окремі тести
```bash
# Тест з'єднання
node tests/supabase/test-connection.js

# Тест клієнта
node tests/supabase/test-client.js

# Тест конкретної таблиці
node tests/supabase/test-products-table.js
```

### Всі тести (коли буде створено)
```bash
node tests/supabase/run-all-tests.js
```

## 📊 Що тестують скрипти

Кожен тест таблиці перевіряє:
1. ✅ Існування таблиці
2. ✅ Правильність структури
3. ✅ Наявність тестових даних
4. ✅ Унікальні обмеження
5. ✅ CRUD операції

## 🔧 Налаштування

Всі тести використовують:
- `SUPABASE_URL`: https://wncukuajzygzyasofyoe.supabase.co
- `SUPABASE_SERVICE_KEY` для повного доступу
- Автоматичне підключення без сесій

## 📝 Результати тестів

Тести повертають:
- ✅ Успішний результат (exit code 0) 
- ❌ Помилка (exit code 1)
- Детальний вивід з діагностикою