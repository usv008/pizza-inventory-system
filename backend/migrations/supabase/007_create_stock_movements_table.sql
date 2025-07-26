-- 🏗️ Створення таблиці stock_movements в Supabase
-- Етап 5, Крок 9: Управління запасами - рухи запасів
-- Залежності: products, production_batches, users

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.stock_movements CASCADE;

-- Створення таблиці stock_movements
CREATE TABLE public.stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id),
    movement_type TEXT NOT NULL,
    pieces INTEGER NOT NULL,
    boxes INTEGER NOT NULL,
    reason TEXT,
    user_name TEXT DEFAULT 'system',
    batch_id BIGINT REFERENCES public.production_batches(id),
    batch_date DATE,
    created_by_user_id BIGINT REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON public.stock_movements(movement_type);
CREATE INDEX idx_stock_movements_date ON public.stock_movements(created_at);
CREATE INDEX idx_stock_movements_batch ON public.stock_movements(batch_id);
CREATE INDEX idx_stock_movements_user ON public.stock_movements(created_by_user_id);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.stock_movements IS 'Журнал рухів запасів (надходження, списання, виробництво)';
COMMENT ON COLUMN public.stock_movements.id IS 'Унікальний ідентифікатор руху';
COMMENT ON COLUMN public.stock_movements.product_id IS 'Посилання на товар';
COMMENT ON COLUMN public.stock_movements.movement_type IS 'Тип руху: IN, OUT, PRODUCTION, WRITEOFF, ADJUSTMENT';
COMMENT ON COLUMN public.stock_movements.pieces IS 'Кількість в штуках (може бути негативною для списання)';
COMMENT ON COLUMN public.stock_movements.boxes IS 'Кількість в коробках (може бути негативною)';
COMMENT ON COLUMN public.stock_movements.reason IS 'Причина руху запасів';
COMMENT ON COLUMN public.stock_movements.user_name IS 'Імя користувача (legacy поле)';
COMMENT ON COLUMN public.stock_movements.batch_id IS 'Посилання на партію (якщо є)';
COMMENT ON COLUMN public.stock_movements.batch_date IS 'Дата партії';
COMMENT ON COLUMN public.stock_movements.created_by_user_id IS 'Користувач, що створив запис';

-- Тригер для оновлення stock_pieces в products при вставці руху
CREATE OR REPLACE FUNCTION update_product_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Оновлюємо загальні залишки товару
    UPDATE public.products 
    SET stock_pieces = stock_pieces + NEW.pieces,
        stock_boxes = FLOOR((stock_pieces + NEW.pieces) / pieces_per_box),
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Створення тригеру (поки відключений, увімкнемо після тестування)
-- CREATE TRIGGER trigger_update_product_stock 
--     AFTER INSERT ON public.stock_movements
--     FOR EACH ROW 
--     EXECUTE FUNCTION update_product_stock_on_movement();

-- Тестові дані (відповідають створенню товарів)
INSERT INTO public.stock_movements (
    product_id, 
    movement_type, 
    pieces, 
    boxes, 
    reason,
    user_name
) VALUES 
    (1, 'IN', 144, 12, 'Початковий залишок Піца Маргарита', 'system'),
    (2, 'IN', 96, 8, 'Початковий залишок Піца Пепероні', 'system'),
    (3, 'IN', 50, 5, 'Початковий залишок Піца Гавайська', 'system'),
    (4, 'IN', 32, 4, 'Початковий залишок Піца Чотири Сири', 'system'),
    (5, 'IN', 80, 8, 'Початковий залишок Піца М''ясна', 'system');

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_movements,
    SUM(CASE WHEN pieces > 0 THEN pieces ELSE 0 END) as total_in,
    SUM(CASE WHEN pieces < 0 THEN ABS(pieces) ELSE 0 END) as total_out
FROM public.stock_movements;

-- Перевірка рухів по товарах
SELECT 
    p.name as product_name,
    p.code,
    sm.movement_type,
    sm.pieces,
    sm.reason,
    sm.created_at
FROM public.stock_movements sm
JOIN public.products p ON sm.product_id = p.id
ORDER BY sm.created_at DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'stock_movements' 
    AND schemaname = 'public'
ORDER BY indexname;