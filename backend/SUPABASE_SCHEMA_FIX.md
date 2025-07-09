# ІНСТРУКЦІЯ: Виправлення схеми Supabase

## Проблема
Supabase таблиці не мають всіх полів, які є в SQLite. Потрібно додати відсутні колонки.

## Кроки виправлення

### 1. Відкрийте Supabase Dashboard
- Перейдіть до: https://app.supabase.com/
- Оберіть ваш проект
- Перейдіть до **SQL Editor**

### 2. Виконайте наступні SQL команди:

```sql
-- ===================================
-- PRODUCTS TABLE - додавання колонок
-- ===================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight REAL DEFAULT 400.0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pieces_per_box INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_pieces INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_boxes INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_pieces INTEGER DEFAULT 0;

-- Заповнюємо code для існуючих записів
UPDATE products 
SET code = 'PROD' || LPAD(id::text, 3, '0')
WHERE code IS NULL;

-- Заповнюємо дані
UPDATE products 
SET stock_pieces = COALESCE(current_stock, 0),
    min_stock_pieces = COALESCE(min_stock_level, 0)
WHERE stock_pieces = 0;

-- ===================================
-- WRITEOFFS TABLE - додавання колонок
-- ===================================

ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS total_quantity INTEGER;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS boxes_quantity INTEGER DEFAULT 0;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS pieces_quantity INTEGER DEFAULT 0;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS responsible TEXT;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

-- Заповнюємо дані
UPDATE writeoffs 
SET total_quantity = quantity
WHERE total_quantity IS NULL;

UPDATE writeoffs 
SET responsible = COALESCE(approved_by, 'system')
WHERE responsible IS NULL;

-- Обчислюємо boxes та pieces
UPDATE writeoffs 
SET 
    pieces_quantity = COALESCE(total_quantity, quantity) % COALESCE((SELECT pieces_per_box FROM products WHERE products.id = writeoffs.product_id), 1),
    boxes_quantity = COALESCE(total_quantity, quantity) / COALESCE((SELECT pieces_per_box FROM products WHERE products.id = writeoffs.product_id), 1)
WHERE boxes_quantity = 0;
```

### 3. Перевірте результат:

```sql
-- Перевірка products
SELECT id, name, code, weight, pieces_per_box, stock_pieces FROM products LIMIT 3;

-- Перевірка writeoffs
SELECT id, product_id, quantity, total_quantity, boxes_quantity, pieces_quantity, responsible FROM writeoffs LIMIT 3;
```

### 4. Після виконання SQL
Запустіть тест знову:
```bash
node testWriteoffMigration.js
```

## Альтернативний підхід

Якщо SQL Editor не працює, можна адаптувати сервіси для роботи з поточною схемою:

1. Видалити посилання на `products.code` 
2. Використовувати `quantity` замість `total_quantity`
3. Ігнорувати `boxes_quantity` та `pieces_quantity`

## Поточний стан

❌ **Відсутні поля в products:**
- code
- weight  
- barcode
- pieces_per_box
- stock_pieces
- stock_boxes
- min_stock_pieces

❌ **Відсутні поля в writeoffs:**
- total_quantity
- boxes_quantity
- pieces_quantity
- responsible
- created_by_user_id

✅ **Існуючі поля можна використовувати:**
- products: id, name, category, current_stock, min_stock_level
- writeoffs: id, product_id, quantity, reason, notes, writeoff_date 