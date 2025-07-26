# 📁 Supabase Migrations

Ця папка містить SQL скрипти для міграції з SQLite на Supabase (PostgreSQL).

## 📋 Структура файлів

Файли міграції іменуються за шаблоном: `XXX_description.sql`
- `XXX` - порядковий номер (001, 002, ...)
- `description` - короткий опис міграції

## 🗂️ Список міграцій

### ЕТАП 0: Підготовка (завершено)
- Тестування та налаштування підключення

### ЕТАП 1: Базові довідники
- `001_create_products_table.sql` - Таблиця товарів
- `002_create_clients_table.sql` - Таблиця клієнтів

### ЕТАП 2: Система користувачів
- `003_create_users_table.sql` - Таблиця користувачів
- `004_create_user_sessions_table.sql` - Таблиця сесій

### ЕТАП 3: Основні операції
- `005_create_orders_table.sql` - Таблиця замовлень
- `006_create_order_items_table.sql` - Позиції замовлень

### ЕТАП 4: Виробництво
- `007_create_production_table.sql` - Таблиця виробництва
- `008_create_production_batches_table.sql` - Партії виробництва

### ЕТАП 5: Управління запасами
- `009_create_stock_movements_table.sql` - Рухи запасів
- `010_create_writeoffs_table.sql` - Списання

### ЕТАП 6: Планування виробництва
- `011_create_production_plans_table.sql` - Плани виробництва
- `012_create_production_plan_items_table.sql` - Позиції планів
- `013_create_production_settings_table.sql` - Налаштування

### ЕТАП 7: Надходження
- `014_create_arrivals_table.sql` - Nadходження
- `015_create_arrivals_items_table.sql` - Позиції надходжень

### ЕТАП 8: Аудит і логування
- `016_create_user_audit_table.sql` - Аудит користувачів
- `017_create_security_events_table.sql` - Події безпеки
- `018_create_api_audit_log_table.sql` - Лог API
- `019_create_operations_log_table.sql` - Операційний лог

## 🚀 Як використовувати

1. Відкрити Supabase Dashboard
2. Перейти в SQL Editor
3. Виконати файли міграції по порядку
4. Запустити відповідні тести з папки `/tests/supabase/`

## 📝 Примітки

- Всі скрипти мають `DROP TABLE IF EXISTS` для повторного запуску
- Включені тестові дані для перевірки
- Додані коментарі до таблиць та колонок
- Створені необхідні індекси для продуктивності