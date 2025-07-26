-- 🏗️ Створення таблиці production_batches в Supabase
-- Етап 4, Крок 8: Виробництво - партії продукції
-- Залежності: products, production

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.production_batches CASCADE;

-- Створення таблиці production_batches
CREATE TABLE public.production_batches (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id),
    batch_date DATE NOT NULL,
    production_date DATE NOT NULL,
    total_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    used_quantity INTEGER NOT NULL DEFAULT 0,
    expiry_date DATE NOT NULL,
    production_id BIGINT REFERENCES public.production(id),
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Унікальне обмеження для product_id + batch_date
    UNIQUE(product_id, batch_date)
);

-- Створення індексів для оптимізації
CREATE INDEX idx_production_batches_product_batch ON public.production_batches(product_id, batch_date);
CREATE INDEX idx_production_batches_expiry_status ON public.production_batches(expiry_date, status);
CREATE INDEX idx_production_batches_available ON public.production_batches(available_quantity);
CREATE INDEX idx_production_batches_status ON public.production_batches(status);
CREATE INDEX idx_production_batches_production_id ON public.production_batches(production_id);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.production_batches IS 'Партії виробленої продукції з FIFO логікою';
COMMENT ON COLUMN public.production_batches.id IS 'Унікальний ідентифікатор партії';
COMMENT ON COLUMN public.production_batches.product_id IS 'Посилання на товар';
COMMENT ON COLUMN public.production_batches.batch_date IS 'Дата партії (унікальна для товару)';
COMMENT ON COLUMN public.production_batches.production_date IS 'Дата виробництва';
COMMENT ON COLUMN public.production_batches.total_quantity IS 'Загальна кількість в партії';
COMMENT ON COLUMN public.production_batches.available_quantity IS 'Доступна кількість (не зарезервована)';
COMMENT ON COLUMN public.production_batches.reserved_quantity IS 'Зарезервована кількість для замовлень';
COMMENT ON COLUMN public.production_batches.used_quantity IS 'Використана кількість';
COMMENT ON COLUMN public.production_batches.expiry_date IS 'Термін придатності';
COMMENT ON COLUMN public.production_batches.production_id IS 'Посилання на запис виробництва';
COMMENT ON COLUMN public.production_batches.status IS 'Статус партії: ACTIVE, EXPIRED, USED';

-- Тригер для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_production_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_production_batches_updated_at
    BEFORE UPDATE ON public.production_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_production_batches_updated_at();

-- Тестові дані (партії для існуючих товарів)
INSERT INTO public.production_batches (
    product_id,
    batch_date,
    production_date,
    total_quantity,
    available_quantity,
    reserved_quantity,
    expiry_date,
    status,
    notes
) VALUES 
    -- Партія Піца Маргарита
    (1, '2025-07-20', '2025-07-20', 144, 144, 0, '2026-07-20', 'ACTIVE', 'Початкова партія Маргарити'),
    
    -- Партія Піца Пепероні
    (2, '2025-07-21', '2025-07-21', 96, 96, 0, '2026-07-21', 'ACTIVE', 'Початкова партія Пепероні'),
    
    -- Партія Піца Гавайська
    (3, '2025-07-22', '2025-07-22', 50, 50, 0, '2026-07-22', 'ACTIVE', 'Початкова партія Гавайської'),
    
    -- Партія Піца Чотири Сири
    (4, '2025-07-23', '2025-07-23', 32, 32, 0, '2026-07-23', 'ACTIVE', 'Початкова партія Чотири Сири'),
    
    -- Старша партія для тестування FIFO
    (1, '2025-07-15', '2025-07-15', 72, 24, 48, '2026-07-15', 'ACTIVE', 'Стара партія Маргарити (частково зарезервована)');

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_batches,
    SUM(total_quantity) as total_produced,
    SUM(available_quantity) as total_available,
    SUM(reserved_quantity) as total_reserved
FROM public.production_batches;

-- Перевірка FIFO логіки (найстаріші партії спочатку)
SELECT 
    pb.id,
    p.name as product_name,
    pb.batch_date,
    pb.total_quantity,
    pb.available_quantity,
    pb.reserved_quantity,
    pb.status
FROM public.production_batches pb
JOIN public.products p ON pb.product_id = p.id
ORDER BY pb.product_id, pb.batch_date ASC;

-- Перевірка унікального обмеження
SELECT 
    product_id,
    batch_date,
    COUNT(*) as count
FROM public.production_batches
GROUP BY product_id, batch_date
HAVING COUNT(*) > 1;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'production_batches' 
    AND schemaname = 'public'
ORDER BY indexname;