-- 🏗️ Створення таблиці products в Supabase
-- Етап 1, Крок 1: Базова довідникова таблиця товарів
-- Залежності: Немає (база для всіх інших таблиць)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.products CASCADE;

-- Створення таблиці products
CREATE TABLE public.products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    weight REAL NOT NULL,
    barcode TEXT UNIQUE,
    pieces_per_box INTEGER NOT NULL DEFAULT 1,
    stock_pieces INTEGER DEFAULT 0,
    stock_boxes INTEGER DEFAULT 0,
    min_stock_pieces INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_products_code ON public.products(code);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_name ON public.products(name);
CREATE INDEX idx_products_stock ON public.products(stock_pieces, stock_boxes);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.products IS 'Каталог товарів з обліком запасів';
COMMENT ON COLUMN public.products.id IS 'Унікальний ідентифікатор товару';
COMMENT ON COLUMN public.products.name IS 'Назва товару';
COMMENT ON COLUMN public.products.code IS 'Унікальний код товару (артикул)';
COMMENT ON COLUMN public.products.weight IS 'Вага в грамах';
COMMENT ON COLUMN public.products.barcode IS 'Штрих-код товару';
COMMENT ON COLUMN public.products.pieces_per_box IS 'Кількість штук в коробці';
COMMENT ON COLUMN public.products.stock_pieces IS 'Залишки в штуках';
COMMENT ON COLUMN public.products.stock_boxes IS 'Залишки в коробках';
COMMENT ON COLUMN public.products.min_stock_pieces IS 'Мінімальний запас в штуках';

-- Тестові дані
INSERT INTO public.products (
    name, 
    code, 
    weight, 
    barcode, 
    pieces_per_box, 
    stock_pieces, 
    stock_boxes, 
    min_stock_pieces
) VALUES 
    ('Піца Маргарита', 'PM001', 350.00, '4820000001234', 12, 144, 12, 24),
    ('Піца Пепероні', 'PP002', 380.00, '4820000001241', 12, 96, 8, 36),
    ('Піца Гавайська', 'PH003', 400.00, '4820000001258', 10, 50, 5, 20),
    ('Піца Чотири Сири', 'PC004', 420.00, '4820000001265', 8, 32, 4, 16),
    ('Піца М''ясна', 'PM005', 450.00, '4820000001272', 10, 80, 8, 30);

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_products,
    SUM(stock_pieces) as total_stock_pieces,
    SUM(stock_boxes) as total_stock_boxes
FROM public.products;

-- Перевірка тестових даних
SELECT 
    id,
    name,
    code,
    stock_pieces,
    stock_boxes,
    created_at
FROM public.products
ORDER BY created_at;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'products' 
    AND schemaname = 'public'
ORDER BY indexname;