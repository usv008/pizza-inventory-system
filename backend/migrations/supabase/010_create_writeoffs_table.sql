-- 🏗️ Створення таблиці writeoffs в Supabase
-- Етап 5, Крок 10: Управління запасами - списання товарів
-- Залежності: products, users

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.writeoffs CASCADE;

-- Створення таблиці writeoffs
CREATE TABLE public.writeoffs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id),
    writeoff_date DATE NOT NULL,
    total_quantity INTEGER NOT NULL,
    boxes_quantity INTEGER NOT NULL,
    pieces_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    responsible TEXT NOT NULL,
    notes TEXT,
    created_by_user_id BIGINT REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_writeoffs_product ON public.writeoffs(product_id);
CREATE INDEX idx_writeoffs_date ON public.writeoffs(writeoff_date);
CREATE INDEX idx_writeoffs_reason ON public.writeoffs(reason);
CREATE INDEX idx_writeoffs_created_by ON public.writeoffs(created_by_user_id);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.writeoffs IS 'Списання товарів (псування, брак, втрати)';
COMMENT ON COLUMN public.writeoffs.id IS 'Унікальний ідентифікатор списання';
COMMENT ON COLUMN public.writeoffs.product_id IS 'Посилання на товар';
COMMENT ON COLUMN public.writeoffs.writeoff_date IS 'Дата списання';
COMMENT ON COLUMN public.writeoffs.total_quantity IS 'Загальна кількість в штуках';
COMMENT ON COLUMN public.writeoffs.boxes_quantity IS 'Кількість повних коробок';
COMMENT ON COLUMN public.writeoffs.pieces_quantity IS 'Залишок в штуках';
COMMENT ON COLUMN public.writeoffs.reason IS 'Причина списання';
COMMENT ON COLUMN public.writeoffs.responsible IS 'Відповідальна особа (legacy)';
COMMENT ON COLUMN public.writeoffs.created_by_user_id IS 'Користувач що створив запис';

-- Тестові дані списання
INSERT INTO public.writeoffs (
    product_id,
    writeoff_date,
    total_quantity,
    boxes_quantity,
    pieces_quantity,
    reason,
    responsible,
    notes,
    created_by_user_id
) VALUES 
    -- Списання через псування
    (1, '2025-07-22', 12, 1, 0, 'Псування через неправильне зберігання', 'Олег Коваленко', 'Знайдено пошкоджену коробку в холодильнику', 3),
    
    -- Списання через брак
    (2, '2025-07-23', 6, 0, 6, 'Брак виробництва', 'Марія Сидорова', 'Неправильна форма піци', 2),
    
    -- Списання через термін придатності
    (3, '2025-07-21', 20, 2, 0, 'Закінчився термін придатності', 'Іван Петров', 'Старі залишки', 1),
    
    -- Списання через втрату
    (4, '2025-07-24', 8, 1, 0, 'Втрата при транспортуванні', 'Анна Іваненко', 'Випала коробка з вантажівки', 2);

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_writeoffs,
    SUM(total_quantity) as total_writeoff_quantity,
    COUNT(DISTINCT product_id) as products_with_writeoffs,
    COUNT(DISTINCT reason) as unique_reasons
FROM public.writeoffs;

-- Перевірка списань з товарами та користувачами
SELECT 
    w.id,
    p.name as product_name,
    p.code as product_code,
    w.writeoff_date,
    w.total_quantity,
    w.boxes_quantity,
    w.pieces_quantity,
    w.reason,
    w.responsible,
    u.username as created_by_user
FROM public.writeoffs w
JOIN public.products p ON w.product_id = p.id
LEFT JOIN public.users u ON w.created_by_user_id = u.id
ORDER BY w.writeoff_date DESC;

-- Статистика причин списання
SELECT 
    reason,
    COUNT(*) as writeoff_count,
    SUM(total_quantity) as total_quantity_writeoff,
    AVG(total_quantity) as avg_quantity_per_writeoff
FROM public.writeoffs
GROUP BY reason
ORDER BY total_quantity_writeoff DESC;

-- Списання по товарах
SELECT 
    p.name as product_name,
    p.code,
    COUNT(w.id) as writeoff_count,
    SUM(w.total_quantity) as total_writeoff,
    ROUND(
        (SUM(w.total_quantity)::decimal / NULLIF(p.stock_pieces + SUM(w.total_quantity), 0)) * 100, 
        2
    ) as writeoff_percentage
FROM public.writeoffs w
JOIN public.products p ON w.product_id = p.id
GROUP BY p.id, p.name, p.code, p.stock_pieces
ORDER BY total_writeoff DESC;

-- Списання по датах (тренд)
SELECT 
    writeoff_date,
    COUNT(*) as writeoffs_count,
    SUM(total_quantity) as daily_writeoff_quantity
FROM public.writeoffs
GROUP BY writeoff_date
ORDER BY writeoff_date DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'writeoffs' 
    AND schemaname = 'public'
ORDER BY indexname;