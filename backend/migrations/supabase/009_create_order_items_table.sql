-- 🏗️ Створення таблиці order_items в Supabase
-- Етап 3, Крок 6: Основні операції - позиції замовлень
-- Залежності: orders, products

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.order_items CASCADE;

-- Створення таблиці order_items
CREATE TABLE public.order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    boxes INTEGER NOT NULL,
    pieces INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    produced_quantity INTEGER DEFAULT 0,
    notes TEXT,
    allocated_batches JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_order_items_reserved ON public.order_items(reserved_quantity);
CREATE INDEX idx_order_items_produced ON public.order_items(produced_quantity);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.order_items IS 'Позиції замовлень з резервуванням партій';
COMMENT ON COLUMN public.order_items.id IS 'Унікальний ідентифікатор позиції';
COMMENT ON COLUMN public.order_items.order_id IS 'Посилання на замовлення';
COMMENT ON COLUMN public.order_items.product_id IS 'Посилання на товар';
COMMENT ON COLUMN public.order_items.quantity IS 'Загальна кількість в штуках';
COMMENT ON COLUMN public.order_items.boxes IS 'Кількість в коробках';
COMMENT ON COLUMN public.order_items.pieces IS 'Кількість в штуках (залишок від коробок)';
COMMENT ON COLUMN public.order_items.reserved_quantity IS 'Зарезервована кількість';
COMMENT ON COLUMN public.order_items.produced_quantity IS 'Вироблена кількість';
COMMENT ON COLUMN public.order_items.allocated_batches IS 'JSON з розподіленими партіями';

-- Тестові дані (позиції для існуючих замовлень)
INSERT INTO public.order_items (
    order_id,
    product_id,
    quantity,
    boxes,
    pieces,
    reserved_quantity,
    notes,
    allocated_batches
) VALUES 
    -- Позиції для замовлення 20250724-001
    (1, 1, 60, 5, 0, 60, 'Піца Маргарита для ТОВ "Смачні піци"',
     '[{"batch_id": 1, "batch_date": "2025-07-20", "quantity": 60}]'::jsonb),
    
    (1, 2, 40, 3, 4, 40, 'Піца Пепероні для ТОВ "Смачні піци"',
     '[{"batch_id": 2, "batch_date": "2025-07-21", "quantity": 40}]'::jsonb),
    
    -- Позиції для замовлення 20250724-002
    (2, 1, 48, 4, 0, 48, 'Піца Маргарита для Ресторан "Італьяно"',
     '[{"batch_id": 5, "batch_date": "2025-07-15", "quantity": 48}]'::jsonb),
    
    (2, 3, 32, 3, 2, 32, 'Піца Гавайська для Ресторан "Італьяно"',
     '[{"batch_id": 3, "batch_date": "2025-07-22", "quantity": 32}]'::jsonb),
    
    -- Позиції для виконаного замовлення 20250723-001
    (3, 4, 32, 4, 0, 0, 'Піца Чотири Сири для Кафе "Corner" (виконано)',
     '[{"batch_id": 4, "batch_date": "2025-07-23", "quantity": 32}]'::jsonb),
    
    (3, 2, 18, 1, 6, 0, 'Піца Пепероні для Кафе "Corner" (виконано)',
     '[{"batch_id": 2, "batch_date": "2025-07-21", "quantity": 18}]'::jsonb);

-- Оновлення загальної кількості в замовленнях
UPDATE public.orders 
SET total_quantity = (
    SELECT COALESCE(SUM(quantity), 0) 
    FROM public.order_items 
    WHERE order_id = orders.id
),
total_boxes = (
    SELECT COALESCE(SUM(boxes), 0) 
    FROM public.order_items 
    WHERE order_id = orders.id
);

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_items,
    SUM(quantity) as total_quantity,
    SUM(reserved_quantity) as total_reserved,
    COUNT(DISTINCT order_id) as orders_with_items
FROM public.order_items;

-- Перевірка позицій з товарами та замовленнями
SELECT 
    o.order_number,
    p.name as product_name,
    oi.quantity,
    oi.boxes,
    oi.pieces,
    oi.reserved_quantity,
    oi.allocated_batches
FROM public.order_items oi
JOIN public.orders o ON oi.order_id = o.id
JOIN public.products p ON oi.product_id = p.id
ORDER BY o.order_date DESC, oi.id;

-- Перевірка CASCADE DELETE
SELECT 
    'CASCADE DELETE test: If you delete order, all items should be deleted too' as info;

-- Перевірка JSONB allocated_batches
SELECT 
    id,
    product_id,
    quantity,
    jsonb_array_length(allocated_batches) as batches_count,
    allocated_batches
FROM public.order_items
WHERE allocated_batches IS NOT NULL
ORDER BY id;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'order_items' 
    AND schemaname = 'public'
ORDER BY indexname;