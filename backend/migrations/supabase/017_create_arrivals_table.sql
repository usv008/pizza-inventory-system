-- 🏗️ Створення таблиці arrivals в Supabase
-- Етап 7, Крок 1: Надходження - таблиця надходжень товарів
-- Залежності: users (створена)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.arrivals CASCADE;

-- Створення таблиці arrivals
CREATE TABLE public.arrivals (
    id BIGSERIAL PRIMARY KEY,
    arrival_number TEXT UNIQUE NOT NULL,
    arrival_date DATE NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('PURCHASE', 'PRODUCTION', 'RETURN', 'CORRECTION', 'TRANSFER', 'OTHER')),
    supplier_name TEXT,
    invoice_number TEXT,
    total_items INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_by_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    processed_by_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_arrivals_arrival_number ON public.arrivals(arrival_number);
CREATE INDEX idx_arrivals_arrival_date ON public.arrivals(arrival_date);
CREATE INDEX idx_arrivals_reason ON public.arrivals(reason);
CREATE INDEX idx_arrivals_status ON public.arrivals(status);
CREATE INDEX idx_arrivals_supplier ON public.arrivals(supplier_name);
CREATE INDEX idx_arrivals_invoice ON public.arrivals(invoice_number);
CREATE INDEX idx_arrivals_created_by ON public.arrivals(created_by_user_id);
CREATE INDEX idx_arrivals_processed_by ON public.arrivals(processed_by_user_id);
CREATE INDEX idx_arrivals_created_at ON public.arrivals(created_at);
CREATE INDEX idx_arrivals_processed_at ON public.arrivals(processed_at);

-- Створення тригера для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_arrivals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_arrivals_updated_at
    BEFORE UPDATE ON public.arrivals
    FOR EACH ROW
    EXECUTE FUNCTION update_arrivals_updated_at();

-- Функція для автоматичної генерації номеру надходження
CREATE OR REPLACE FUNCTION generate_arrival_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    formatted_number TEXT;
BEGIN
    -- Знаходимо наступний номер на основі існуючих записів
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(arrival_number FROM 'ARR(\d+)') AS INTEGER)) + 1, 
        1
    ) INTO next_number
    FROM public.arrivals 
    WHERE arrival_number ~ '^ARR\d+$';
    
    -- Форматуємо номер з провідними нулями
    formatted_number := 'ARR' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN formatted_number;
END;
$$ LANGUAGE plpgsql;

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.arrivals IS 'Надходження товарів на склад';
COMMENT ON COLUMN public.arrivals.id IS 'Унікальний ідентифікатор надходження';
COMMENT ON COLUMN public.arrivals.arrival_number IS 'Унікальний номер надходження';
COMMENT ON COLUMN public.arrivals.arrival_date IS 'Дата надходження';
COMMENT ON COLUMN public.arrivals.reason IS 'Причина надходження (PURCHASE, PRODUCTION, RETURN, CORRECTION, TRANSFER, OTHER)';
COMMENT ON COLUMN public.arrivals.supplier_name IS 'Назва постачальника';
COMMENT ON COLUMN public.arrivals.invoice_number IS 'Номер накладної/рахунку';
COMMENT ON COLUMN public.arrivals.total_items IS 'Загальна кількість позицій';
COMMENT ON COLUMN public.arrivals.status IS 'Статус надходження (PENDING, PROCESSING, COMPLETED, CANCELLED)';
COMMENT ON COLUMN public.arrivals.notes IS 'Додаткові примітки';
COMMENT ON COLUMN public.arrivals.created_by_user_id IS 'Хто створив надходження';
COMMENT ON COLUMN public.arrivals.processed_by_user_id IS 'Хто обробив надходження';
COMMENT ON COLUMN public.arrivals.processed_at IS 'Час обробки';
COMMENT ON COLUMN public.arrivals.created_at IS 'Час створення';
COMMENT ON COLUMN public.arrivals.updated_at IS 'Час останнього оновлення';

-- Тестові дані для демонстрації
INSERT INTO public.arrivals (
    arrival_number,
    arrival_date,
    reason,
    supplier_name,
    invoice_number,
    total_items,
    status,
    notes,
    created_by_user_id,
    processed_by_user_id,
    processed_at
) VALUES 
    (
        generate_arrival_number(),
        CURRENT_DATE,
        'PURCHASE',
        'ТОВ "Борошно і Ко"',
        'INV-2025-001',
        3,
        'COMPLETED',
        'Щотижнева поставка борошна та інгредієнтів',
        1, -- admin user
        1, -- admin user
        NOW() - INTERVAL '2 hours'
    ),
    (
        generate_arrival_number(),
        CURRENT_DATE,
        'PRODUCTION',
        NULL,
        NULL,
        5,
        'COMPLETED',
        'Надходження з власного виробництва',
        1, -- admin user
        1, -- admin user
        NOW() - INTERVAL '1 hour'
    ),
    (
        generate_arrival_number(),
        CURRENT_DATE + INTERVAL '1 day',
        'PURCHASE',
        'Молочний комбінат',
        'INV-2025-002',
        2,
        'PENDING',
        'Заплановане надходження сиру',
        1, -- admin user
        NULL,
        NULL
    ),
    (
        generate_arrival_number(),
        CURRENT_DATE - INTERVAL '1 day',
        'RETURN',
        'Ресторан "Італьяно"',
        'RET-001',
        1,
        'PROCESSING',
        'Повернення невикористаної продукції',
        1, -- admin user
        NULL,
        NULL
    ),
    (
        generate_arrival_number(),
        CURRENT_DATE - INTERVAL '2 days',
        'CORRECTION',
        NULL,
        'CORR-001',
        4,
        'CANCELLED',
        'Корекція залишків - скасована через помилку',
        1, -- admin user
        NULL,
        NULL
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_arrivals,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_arrivals,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing_arrivals,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_arrivals,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_arrivals,
    SUM(total_items) as total_items_sum
FROM public.arrivals;

-- Перевірка тестових даних
SELECT 
    id,
    arrival_number,
    arrival_date,
    reason,
    supplier_name,
    invoice_number,
    total_items,
    status,
    notes,
    created_at
FROM public.arrivals
ORDER BY arrival_date DESC, created_at DESC;

-- Статистика надходжень по причинах
SELECT 
    reason,
    COUNT(*) as arrivals_count,
    SUM(total_items) as total_items,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count
FROM public.arrivals
GROUP BY reason
ORDER BY arrivals_count DESC;

-- Статистика надходжень по статусах
SELECT 
    status,
    COUNT(*) as arrivals_count,
    SUM(total_items) as total_items,
    COUNT(DISTINCT supplier_name) as unique_suppliers
FROM public.arrivals
GROUP BY status
ORDER BY arrivals_count DESC;

-- Статистика по постачальниках
SELECT 
    supplier_name,
    COUNT(*) as arrivals_count,
    SUM(total_items) as total_items,
    COUNT(DISTINCT reason) as unique_reasons,
    MIN(arrival_date) as first_arrival,
    MAX(arrival_date) as last_arrival
FROM public.arrivals
WHERE supplier_name IS NOT NULL
GROUP BY supplier_name
ORDER BY arrivals_count DESC;

-- Перевірка foreign key зв'язків
SELECT 
    a.id,
    a.arrival_number,
    a.arrival_date,
    a.reason,
    a.status,
    creator.username as created_by,
    creator.role as creator_role,
    processor.username as processed_by,
    processor.role as processor_role,
    a.processed_at
FROM public.arrivals a
LEFT JOIN public.users creator ON a.created_by_user_id = creator.id
LEFT JOIN public.users processor ON a.processed_by_user_id = processor.id
ORDER BY a.arrival_date DESC;

-- Перевірка функції генерації номерів
SELECT 
    generate_arrival_number() as next_arrival_number;

-- Перевірка унікальності номерів
SELECT 
    arrival_number,
    COUNT(*) as count
FROM public.arrivals
GROUP BY arrival_number
HAVING COUNT(*) > 1;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'arrivals' 
    AND schemaname = 'public'
ORDER BY indexname;