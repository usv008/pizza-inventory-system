-- 🏗️ Створення таблиці production в Supabase
-- Етап 4, Крок 7: Виробництво - записи виробництва
-- Залежності: products, users

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.production CASCADE;

-- Створення таблиці production
CREATE TABLE public.production (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id),
    production_date DATE NOT NULL,
    production_time TIME,
    total_quantity INTEGER NOT NULL,
    boxes_quantity INTEGER NOT NULL,
    pieces_quantity INTEGER NOT NULL,
    expiry_date DATE NOT NULL,
    responsible TEXT DEFAULT 'system',
    notes TEXT,
    created_by_user_id BIGINT REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_production_product_id ON public.production(product_id);
CREATE INDEX idx_production_date ON public.production(production_date);
CREATE INDEX idx_production_expiry ON public.production(expiry_date);
CREATE INDEX idx_production_created_by ON public.production(created_by_user_id);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.production IS 'Записи виробництва продукції';
COMMENT ON COLUMN public.production.id IS 'Унікальний ідентифікатор виробництва';
COMMENT ON COLUMN public.production.product_id IS 'Посилання на товар';
COMMENT ON COLUMN public.production.production_date IS 'Дата виробництва';
COMMENT ON COLUMN public.production.production_time IS 'Час виробництва';
COMMENT ON COLUMN public.production.total_quantity IS 'Загальна кількість в штуках';
COMMENT ON COLUMN public.production.boxes_quantity IS 'Кількість повних коробок';
COMMENT ON COLUMN public.production.pieces_quantity IS 'Залишок в штуках';
COMMENT ON COLUMN public.production.expiry_date IS 'Термін придатності';
COMMENT ON COLUMN public.production.responsible IS 'Відповідальна особа (legacy)';
COMMENT ON COLUMN public.production.created_by_user_id IS 'Користувач що створив запис';

-- Тестові дані виробництва
INSERT INTO public.production (
    product_id,
    production_date,
    production_time,
    total_quantity,
    boxes_quantity,
    pieces_quantity,
    expiry_date,
    responsible,
    notes,
    created_by_user_id
) VALUES 
    -- Виробництво Піца Маргарита
    (1, '2025-07-20', '10:30:00', 144, 12, 0, '2026-07-20', 'Іван Петров', 'Виробництво партії №1', 1),
    (1, '2025-07-15', '09:15:00', 72, 6, 0, '2026-07-15', 'Марія Сидорова', 'Стара партія для тестування FIFO', 1),
    
    -- Виробництво Піца Пепероні
    (2, '2025-07-21', '11:45:00', 96, 8, 0, '2026-07-21', 'Олег Коваленко', 'Виробництво партії №2', 2),
    
    -- Виробництво Піца Гавайська
    (3, '2025-07-22', '14:20:00', 50, 5, 0, '2026-07-22', 'Анна Іваненко', 'Виробництво партії №3', 2),
    
    -- Виробництво Піца Чотири Сири
    (4, '2025-07-23', '08:00:00', 32, 4, 0, '2026-07-23', 'Петро Михайлов', 'Виробництво партії №4', 3);

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_productions,
    SUM(total_quantity) as total_produced,
    COUNT(DISTINCT product_id) as products_produced,
    MIN(production_date) as first_production,
    MAX(production_date) as last_production
FROM public.production;

-- Перевірка виробництва з товарами та користувачами
SELECT 
    p.id,
    prod.name as product_name,
    prod.code as product_code,
    p.production_date,
    p.production_time,
    p.total_quantity,
    p.boxes_quantity,
    p.pieces_quantity,
    p.responsible,
    u.username as created_by_user
FROM public.production p
JOIN public.products prod ON p.product_id = prod.id
LEFT JOIN public.users u ON p.created_by_user_id = u.id
ORDER BY p.production_date DESC, p.production_time DESC;

-- Перевірка термінів придатності
SELECT 
    prod.name as product_name,
    p.production_date,
    p.expiry_date,
    (p.expiry_date - CURRENT_DATE) as days_until_expiry,
    CASE 
        WHEN p.expiry_date < CURRENT_DATE THEN 'EXPIRED'
        WHEN p.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
        ELSE 'GOOD'
    END as expiry_status
FROM public.production p
JOIN public.products prod ON p.product_id = prod.id
ORDER BY p.expiry_date;

-- Статистика виробництва по товарах
SELECT 
    prod.name as product_name,
    COUNT(*) as production_count,
    SUM(p.total_quantity) as total_produced,
    AVG(p.total_quantity) as avg_batch_size,
    MIN(p.production_date) as first_produced,
    MAX(p.production_date) as last_produced
FROM public.production p
JOIN public.products prod ON p.product_id = prod.id
GROUP BY prod.id, prod.name
ORDER BY total_produced DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'production' 
    AND schemaname = 'public'
ORDER BY indexname;