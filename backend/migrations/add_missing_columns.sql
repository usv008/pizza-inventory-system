-- Додавання відсутніх колонок до Supabase таблиць
-- Виконати це в Supabase SQL Editor

-- ===================================
-- 1. ДОДАВАННЯ КОЛОНОК ДО PRODUCTS
-- ===================================

-- Додаємо code column до products
ALTER TABLE products ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight REAL DEFAULT 400.0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pieces_per_box INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_pieces INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_boxes INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_pieces INTEGER DEFAULT 0;

-- Створюємо унікальні індекси
CREATE UNIQUE INDEX IF NOT EXISTS products_code_unique ON products(code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON products(barcode) WHERE barcode IS NOT NULL;

-- Заповнюємо code для існуючих записів
UPDATE products 
SET code = 'PROD' || LPAD(id::text, 3, '0')
WHERE code IS NULL;

-- Заповнюємо stock_pieces з current_stock
UPDATE products 
SET stock_pieces = COALESCE(current_stock, 0),
    min_stock_pieces = COALESCE(min_stock_level, 0)
WHERE stock_pieces = 0;

-- ===================================
-- 2. ДОДАВАННЯ КОЛОНОК ДО WRITEOFFS
-- ===================================

-- Додаємо відсутні колонки до writeoffs
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS total_quantity INTEGER;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS boxes_quantity INTEGER DEFAULT 0;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS pieces_quantity INTEGER DEFAULT 0;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS responsible TEXT;
ALTER TABLE writeoffs ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;

-- Заповнюємо total_quantity з quantity
UPDATE writeoffs 
SET total_quantity = quantity
WHERE total_quantity IS NULL;

-- Обчислюємо boxes_quantity та pieces_quantity
UPDATE writeoffs 
SET 
    pieces_quantity = COALESCE(total_quantity, quantity) % COALESCE((SELECT pieces_per_box FROM products WHERE products.id = writeoffs.product_id), 1),
    boxes_quantity = COALESCE(total_quantity, quantity) / COALESCE((SELECT pieces_per_box FROM products WHERE products.id = writeoffs.product_id), 1)
WHERE boxes_quantity = 0;

-- Заповнюємо responsible
UPDATE writeoffs 
SET responsible = COALESCE(approved_by, 'system')
WHERE responsible IS NULL;

-- Створюємо індекс
CREATE INDEX IF NOT EXISTS idx_writeoffs_created_by_user_id ON writeoffs(created_by_user_id);

-- ===================================
-- 3. ПЕРЕВІРКА РЕЗУЛЬТАТІВ
-- ===================================

-- Перевіряємо products
SELECT 'products' as table_name, 
       COUNT(*) as total_records,
       COUNT(code) as code_filled,
       COUNT(weight) as weight_filled,
       AVG(stock_pieces) as avg_stock
FROM products;

-- Перевіряємо writeoffs  
SELECT 'writeoffs' as table_name,
       COUNT(*) as total_records,
       COUNT(total_quantity) as total_quantity_filled,
       COUNT(responsible) as responsible_filled,
       AVG(boxes_quantity) as avg_boxes
FROM writeoffs;

-- Показуємо sample
SELECT 'Sample products:' as info;
SELECT id, name, code, weight, pieces_per_box, stock_pieces FROM products LIMIT 3;

SELECT 'Sample writeoffs:' as info;
SELECT id, product_id, quantity, total_quantity, boxes_quantity, pieces_quantity, responsible FROM writeoffs LIMIT 3; 