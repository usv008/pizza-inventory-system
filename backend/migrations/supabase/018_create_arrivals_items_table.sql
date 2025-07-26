-- 🏗️ Створення таблиці arrivals_items в Supabase
-- Етап 7, Крок 2: Надходження - позиції надходжень товарів
-- Залежності: arrivals, products, users (створені)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.arrivals_items CASCADE;

-- Створення таблиці arrivals_items
CREATE TABLE public.arrivals_items (
    id BIGSERIAL PRIMARY KEY,
    arrival_id BIGINT NOT NULL REFERENCES public.arrivals(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    batch_date DATE NOT NULL,
    expiry_date DATE,
    quality_grade TEXT DEFAULT 'A' CHECK (quality_grade IN ('A', 'B', 'C', 'REJECT')),
    storage_location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES public.users(id)
);

-- Створення індексів для оптимізації
CREATE INDEX idx_arrivals_items_arrival_id ON public.arrivals_items(arrival_id);
CREATE INDEX idx_arrivals_items_product_id ON public.arrivals_items(product_id);
CREATE INDEX idx_arrivals_items_batch_date ON public.arrivals_items(batch_date);
CREATE INDEX idx_arrivals_items_expiry_date ON public.arrivals_items(expiry_date);
CREATE INDEX idx_arrivals_items_quality_grade ON public.arrivals_items(quality_grade);
CREATE INDEX idx_arrivals_items_storage_location ON public.arrivals_items(storage_location);
CREATE INDEX idx_arrivals_items_created_at ON public.arrivals_items(created_at);
CREATE INDEX idx_arrivals_items_created_by ON public.arrivals_items(created_by_user_id);

-- Композитний індекс для швидкого пошуку по надходженню та продукту
CREATE INDEX idx_arrivals_items_arrival_product ON public.arrivals_items(arrival_id, product_id);

-- Створення тригера для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_arrivals_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_arrivals_items_updated_at
    BEFORE UPDATE ON public.arrivals_items
    FOR EACH ROW
    EXECUTE FUNCTION update_arrivals_items_updated_at();

-- Тригер для автоматичного розрахунку total_price
CREATE OR REPLACE FUNCTION calculate_arrivals_items_total_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Автоматично рахуємо загальну ціну якщо є unit_price
    IF NEW.unit_price IS NOT NULL AND NEW.quantity IS NOT NULL THEN
        NEW.total_price = NEW.unit_price * NEW.quantity;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_arrivals_items_calculate_total
    BEFORE INSERT OR UPDATE ON public.arrivals_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_arrivals_items_total_price();

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.arrivals_items IS 'Позиції надходжень товарів на склад';
COMMENT ON COLUMN public.arrivals_items.id IS 'Унікальний ідентифікатор позиції надходження';
COMMENT ON COLUMN public.arrivals_items.arrival_id IS 'Посилання на надходження';
COMMENT ON COLUMN public.arrivals_items.product_id IS 'Продукт який надійшов';
COMMENT ON COLUMN public.arrivals_items.quantity IS 'Кількість продукту';
COMMENT ON COLUMN public.arrivals_items.unit_price IS 'Ціна за одиницю';
COMMENT ON COLUMN public.arrivals_items.total_price IS 'Загальна ціна (автоматично розраховується)';
COMMENT ON COLUMN public.arrivals_items.batch_date IS 'Дата виробництва партії';
COMMENT ON COLUMN public.arrivals_items.expiry_date IS 'Дата закінчення терміну придатності';
COMMENT ON COLUMN public.arrivals_items.quality_grade IS 'Категорія якості (A, B, C, REJECT)';
COMMENT ON COLUMN public.arrivals_items.storage_location IS 'Місце зберігання на складі';
COMMENT ON COLUMN public.arrivals_items.notes IS 'Додаткові примітки';
COMMENT ON COLUMN public.arrivals_items.created_at IS 'Час створення позиції';
COMMENT ON COLUMN public.arrivals_items.updated_at IS 'Час останнього оновлення';
COMMENT ON COLUMN public.arrivals_items.created_by_user_id IS 'Хто створив позицію';

-- Тестові дані для демонстрації
INSERT INTO public.arrivals_items (
    arrival_id,
    product_id,
    quantity,
    unit_price,
    batch_date,
    expiry_date,
    quality_grade,
    storage_location,
    notes,
    created_by_user_id
) VALUES 
    (
        1, -- ARR000001 (ТОВ "Борошно і Ко")
        1, -- Піца Маргарита
        50,
        12.50,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '7 days',
        'A',
        'Стелаж-А1',
        'Свіжа партія, відмінна якість',
        1
    ),
    (
        1, -- той же arrival
        2, -- Піца Пепероні
        30,
        15.00,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '7 days',
        'A',
        'Стелаж-А2',
        'Преміум інгредієнти',
        1
    ),
    (
        1, -- той же arrival
        3, -- Піца Гавайська
        20,
        13.75,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '7 days',
        'B',
        'Стелаж-А3',
        'Трохи перестиглий ананас, але прийнятно',
        1
    ),
    (
        2, -- ARR000002 (Власне виробництво)
        1, -- Піца Маргарита
        100,
        NULL, -- власне виробництво - без ціни
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '3 days',
        'A',
        'Стелаж-Б1',
        'Вироблено сьогодні вранці',
        1
    ),
    (
        2, -- той же arrival
        4, -- Піца Чотири Сири
        75,
        NULL,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '3 days',
        'A',
        'Стелаж-Б2',
        'Новий рецепт - пробна партія',
        1
    ),
    (
        3, -- ARR000003 (Молочний комбінат) - PENDING
        2, -- Піца Пепероні
        60,
        14.20,
        CURRENT_DATE + INTERVAL '1 day',
        CURRENT_DATE + INTERVAL '8 days',
        'A',
        'Стелаж-В1',
        'Заплановане надходження',
        1
    ),
    (
        4, -- ARR000004 (Повернення)
        3, -- Піца Гавайська
        5,
        NULL, -- повернення - без ціни
        CURRENT_DATE - INTERVAL '2 days',
        CURRENT_DATE + INTERVAL '1 day',
        'C',
        'Карантин-1',
        'Повернено клієнтом - термін майже закінчується',
        1
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_items,
    COUNT(DISTINCT arrival_id) as unique_arrivals,
    COUNT(DISTINCT product_id) as unique_products,
    SUM(quantity) as total_quantity,
    ROUND(AVG(unit_price), 2) as avg_unit_price,
    ROUND(SUM(total_price), 2) as total_value
FROM public.arrivals_items;

-- Перевірка тестових даних
SELECT 
    ai.id,
    a.arrival_number,
    p.name as product_name,
    ai.quantity,
    ai.unit_price,
    ai.total_price,
    ai.batch_date,
    ai.expiry_date,
    ai.quality_grade,
    ai.storage_location,
    ai.notes
FROM public.arrivals_items ai
JOIN public.arrivals a ON ai.arrival_id = a.id
JOIN public.products p ON ai.product_id = p.id
ORDER BY a.arrival_number, p.name;

-- Статистика по надходженнях
SELECT 
    a.arrival_number,
    a.reason,
    a.status,
    COUNT(ai.id) as items_count,
    SUM(ai.quantity) as total_quantity,
    ROUND(COALESCE(SUM(ai.total_price), 0), 2) as total_value
FROM public.arrivals a
LEFT JOIN public.arrivals_items ai ON a.id = ai.arrival_id
GROUP BY a.id, a.arrival_number, a.reason, a.status
ORDER BY a.arrival_number;

-- Статистика по продуктах
SELECT 
    p.name as product_name,
    COUNT(ai.id) as arrivals_count,
    SUM(ai.quantity) as total_quantity,
    ROUND(AVG(ai.unit_price), 2) as avg_unit_price,
    ROUND(COALESCE(SUM(ai.total_price), 0), 2) as total_value
FROM public.products p
LEFT JOIN public.arrivals_items ai ON p.id = ai.product_id
GROUP BY p.id, p.name
HAVING COUNT(ai.id) > 0
ORDER BY total_quantity DESC;

-- Статистика по категоріях якості
SELECT 
    quality_grade,
    COUNT(*) as items_count,
    SUM(quantity) as total_quantity,
    ROUND(AVG(unit_price), 2) as avg_unit_price,
    COUNT(DISTINCT arrival_id) as unique_arrivals
FROM public.arrivals_items
GROUP BY quality_grade
ORDER BY 
    CASE quality_grade 
        WHEN 'A' THEN 1
        WHEN 'B' THEN 2 
        WHEN 'C' THEN 3
        WHEN 'REJECT' THEN 4
    END;

-- Аналіз термінів придатності
SELECT 
    CASE 
        WHEN expiry_date < CURRENT_DATE THEN 'Прострочено'
        WHEN expiry_date <= CURRENT_DATE + INTERVAL '2 days' THEN 'Закінчується (≤2 дні)'
        WHEN expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Скоро закінчується (≤7 днів)'
        ELSE 'Свіжий (>7 днів)'
    END as expiry_status,
    COUNT(*) as items_count,
    SUM(quantity) as total_quantity
FROM public.arrivals_items
WHERE expiry_date IS NOT NULL
GROUP BY 
    CASE 
        WHEN expiry_date < CURRENT_DATE THEN 'Прострочено'
        WHEN expiry_date <= CURRENT_DATE + INTERVAL '2 days' THEN 'Закінчується (≤2 дні)'
        WHEN expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Скоро закінчується (≤7 днів)'
        ELSE 'Свіжий (>7 днів)'
    END
ORDER BY 
    CASE expiry_status
        WHEN 'Прострочено' THEN 1
        WHEN 'Закінчується (≤2 дні)' THEN 2
        WHEN 'Скоро закінчується (≤7 днів)' THEN 3
        ELSE 4
    END;

-- Перевірка foreign key зв'язків
SELECT 
    ai.id,
    a.arrival_number,
    a.reason as arrival_reason,
    p.name as product_name,
    p.code as product_code,
    u.username as created_by,
    ai.quantity,
    ai.quality_grade,
    ai.storage_location
FROM public.arrivals_items ai
JOIN public.arrivals a ON ai.arrival_id = a.id
JOIN public.products p ON ai.product_id = p.id
LEFT JOIN public.users u ON ai.created_by_user_id = u.id
ORDER BY a.arrival_number, p.name;

-- Перевірка автоматичного розрахунку total_price
SELECT 
    id,
    quantity,
    unit_price,
    total_price,
    CASE 
        WHEN unit_price IS NOT NULL AND total_price = (unit_price * quantity) THEN 'Правильно'
        WHEN unit_price IS NULL AND total_price IS NULL THEN 'OK (немає ціни)'
        ELSE 'Помилка розрахунку'
    END as price_calculation_check
FROM public.arrivals_items
ORDER BY id;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'arrivals_items' 
    AND schemaname = 'public'
ORDER BY indexname;