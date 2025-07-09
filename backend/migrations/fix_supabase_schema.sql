-- Міграція для приведення Supabase схеми у відповідність з SQLite
-- Виконати цей скрипт в Supabase SQL Editor

-- ===================================
-- 1. ВИПРАВЛЕННЯ PRODUCTS TABLE
-- ===================================

-- Додаємо відсутні поля в products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS weight REAL,
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS pieces_per_box INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS stock_pieces INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_boxes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock_pieces INTEGER DEFAULT 0;

-- Створюємо унікальні індекси для code та barcode (якщо не існують)
CREATE UNIQUE INDEX IF NOT EXISTS products_code_unique ON products(code);
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON products(barcode);

-- Заповнюємо code з description або генеруємо
UPDATE products 
SET code = CASE 
    WHEN description LIKE '%Product code:%' THEN 
        TRIM(SUBSTRING(description FROM 'Product code: ([^,]+)'))
    ELSE 
        'PROD' || LPAD(id::text, 3, '0')
    END
WHERE code IS NULL;

-- Заповнюємо weight з description або встановлюємо default
UPDATE products 
SET weight = CASE 
    WHEN description LIKE '%Weight:%' THEN 
        CAST(TRIM(SUBSTRING(description FROM 'Weight: ([0-9.]+)')) AS REAL)
    ELSE 
        400.0
    END
WHERE weight IS NULL;

-- Встановлюємо stock_pieces з current_stock
UPDATE products 
SET stock_pieces = COALESCE(current_stock, 0)
WHERE stock_pieces = 0;

-- Встановлюємо min_stock_pieces з min_stock_level
UPDATE products 
SET min_stock_pieces = COALESCE(min_stock_level, 0)
WHERE min_stock_pieces = 0;

-- ===================================
-- 2. ВИПРАВЛЕННЯ WRITEOFFS TABLE
-- ===================================

-- Додаємо відсутні поля в writeoffs table
ALTER TABLE writeoffs 
ADD COLUMN IF NOT EXISTS total_quantity INTEGER,
ADD COLUMN IF NOT EXISTS boxes_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pieces_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS responsible TEXT,
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

-- Заповнюємо total_quantity з quantity
UPDATE writeoffs 
SET total_quantity = quantity
WHERE total_quantity IS NULL;

-- Обчислюємо boxes_quantity та pieces_quantity
UPDATE writeoffs 
SET 
    pieces_quantity = total_quantity % (SELECT COALESCE(pieces_per_box, 1) FROM products WHERE products.id = writeoffs.product_id),
    boxes_quantity = total_quantity / (SELECT COALESCE(pieces_per_box, 1) FROM products WHERE products.id = writeoffs.product_id)
WHERE boxes_quantity = 0 OR pieces_quantity = 0;

-- Встановлюємо responsible з approved_by або 'system'
UPDATE writeoffs 
SET responsible = COALESCE(approved_by, 'system')
WHERE responsible IS NULL;

-- Створюємо індекс для created_by_user_id
CREATE INDEX IF NOT EXISTS idx_writeoffs_created_by_user_id ON writeoffs(created_by_user_id);

-- ===================================
-- 3. ДОДАЄМО CONSTRAINTS (OPTIONAL)
-- ===================================

-- Робимо поля NOT NULL (тільки для нових записів)
-- Це можна зробити пізніше, коли всі дані будуть заповнені

-- ===================================
-- 4. ПЕРЕВІРКА РЕЗУЛЬТАТІВ
-- ===================================

-- Перевіряємо products table
SELECT 
    'products' as table_name,
    COUNT(*) as total_records,
    COUNT(code) as code_filled,
    COUNT(weight) as weight_filled,
    COUNT(pieces_per_box) as pieces_per_box_filled
FROM products;

-- Перевіряємо writeoffs table  
SELECT 
    'writeoffs' as table_name,
    COUNT(*) as total_records,
    COUNT(total_quantity) as total_quantity_filled,
    COUNT(responsible) as responsible_filled,
    COUNT(boxes_quantity) as boxes_quantity_filled
FROM writeoffs;

-- Показуємо зразок даних products
SELECT id, name, code, weight, pieces_per_box, stock_pieces 
FROM products 
LIMIT 3;

-- Показуємо зразок даних writeoffs
SELECT id, product_id, total_quantity, boxes_quantity, pieces_quantity, responsible
FROM writeoffs 
LIMIT 3; 