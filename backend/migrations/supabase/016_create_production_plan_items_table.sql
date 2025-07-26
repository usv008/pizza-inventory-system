-- 🏗️ Створення таблиці production_plan_items в Supabase
-- Етап 6, Крок 2: Планування виробництва - позиції планів виробництва
-- Залежності: production_plans, products, orders, users (створені)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.production_plan_items CASCADE;

-- Створення таблиці production_plan_items
CREATE TABLE public.production_plan_items (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES public.production_plans(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_needed INTEGER NOT NULL CHECK (quantity_needed > 0),
    quantity_planned INTEGER NOT NULL CHECK (quantity_planned >= 0),
    quantity_produced INTEGER DEFAULT 0 CHECK (quantity_produced >= 0),
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    reason TEXT default 'OTHER' CHECK (reason IN ('ORDER', 'STOCK', 'SEASONAL', 'PROMO', 'OTHER')),
    order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES public.users(id)
);

-- Створення індексів для оптимізації
CREATE INDEX idx_production_plan_items_plan_id ON public.production_plan_items(plan_id);
CREATE INDEX idx_production_plan_items_product_id ON public.production_plan_items(product_id);
CREATE INDEX idx_production_plan_items_order_id ON public.production_plan_items(order_id);
CREATE INDEX idx_production_plan_items_priority ON public.production_plan_items(priority);
CREATE INDEX idx_production_plan_items_reason ON public.production_plan_items(reason);
CREATE INDEX idx_production_plan_items_created_at ON public.production_plan_items(created_at);
CREATE INDEX idx_production_plan_items_created_by ON public.production_plan_items(created_by_user_id);

-- Композитний індекс для швидкого пошуку по плану та продукту
CREATE INDEX idx_production_plan_items_plan_product ON public.production_plan_items(plan_id, product_id);

-- Створення тригера для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_production_plan_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_production_plan_items_updated_at
    BEFORE UPDATE ON public.production_plan_items
    FOR EACH ROW
    EXECUTE FUNCTION update_production_plan_items_updated_at();

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.production_plan_items IS 'Позиції планів виробництва';
COMMENT ON COLUMN public.production_plan_items.id IS 'Унікальний ідентифікатор позиції плану';
COMMENT ON COLUMN public.production_plan_items.plan_id IS 'Посилання на план виробництва';
COMMENT ON COLUMN public.production_plan_items.product_id IS 'Продукт для виробництва';
COMMENT ON COLUMN public.production_plan_items.quantity_needed IS 'Необхідна кількість (на основі замовлень/потреб)';
COMMENT ON COLUMN public.production_plan_items.quantity_planned IS 'Заплановано до виробництва';
COMMENT ON COLUMN public.production_plan_items.quantity_produced IS 'Фактично вироблено';
COMMENT ON COLUMN public.production_plan_items.priority IS 'Пріоритет виробництва (LOW, MEDIUM, HIGH, URGENT)';
COMMENT ON COLUMN public.production_plan_items.reason IS 'Причина виробництва (ORDER, STOCK, SEASONAL, PROMO, OTHER)';
COMMENT ON COLUMN public.production_plan_items.order_id IS 'Конкретне замовлення (якщо виробництво під замовлення)';
COMMENT ON COLUMN public.production_plan_items.notes IS 'Додаткові примітки';
COMMENT ON COLUMN public.production_plan_items.created_at IS 'Час створення позиції';
COMMENT ON COLUMN public.production_plan_items.updated_at IS 'Час останнього оновлення';
COMMENT ON COLUMN public.production_plan_items.created_by_user_id IS 'Хто створив позицію';

-- Тестові дані для демонстрації
INSERT INTO public.production_plan_items (
    plan_id,
    product_id,
    quantity_needed,
    quantity_planned,
    quantity_produced,
    priority,
    reason,
    order_id,
    notes,
    created_by_user_id
) VALUES 
    (
        1, -- посилання на перший план (сьогодні)
        1, -- Маргарита
        50,
        50,
        45,
        'HIGH',
        'ORDER',
        1, -- конкретне замовлення
        'Популярна піца - виробляємо з ранку',
        1
    ),
    (
        1, -- той же план
        2, -- Пепероні
        30,
        35,
        25,
        'MEDIUM',
        'STOCK',
        NULL,
        'Додатково для запасу',
        1
    ),
    (
        1, -- той же план
        3, -- Чотири сира
        20,
        25,
        20,
        'MEDIUM',
        'ORDER',
        2, -- інше замовлення
        'Замовлення для корпоративного клієнта',
        1
    ),
    (
        2, -- план на завтра
        1, -- Маргарита
        80,
        80,
        0,
        'HIGH',
        'ORDER',
        NULL,
        'Збільшуємо обсяг на завтра',
        1
    ),
    (
        2, -- план на завтра
        4, -- Гавайська
        25,
        30,
        0,
        'LOW',
        'SEASONAL',
        NULL,
        'Літній сезон - популярна з ананасом',
        1
    ),
    (
        3, -- план на післязавтра
        2, -- Пепероні
        40,
        40,
        0,
        'URGENT',
        'PROMO',
        NULL,
        'Акція на вихідні - очікуємо високий попит',
        1
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_items,
    COUNT(DISTINCT plan_id) as unique_plans,
    COUNT(DISTINCT product_id) as unique_products,
    SUM(quantity_needed) as total_needed,
    SUM(quantity_planned) as total_planned,
    SUM(quantity_produced) as total_produced
FROM public.production_plan_items;

-- Перевірка тестових даних
SELECT 
    ppi.id,
    pp.plan_date,
    p.name as product_name,
    ppi.quantity_needed,
    ppi.quantity_planned,
    ppi.quantity_produced,
    ppi.priority,
    ppi.reason,
    CASE 
        WHEN ppi.quantity_planned > 0 THEN ROUND((ppi.quantity_produced::NUMERIC / ppi.quantity_planned) * 100, 1)
        ELSE 0
    END as completion_percentage,
    ppi.notes
FROM public.production_plan_items ppi
JOIN public.production_plans pp ON ppi.plan_id = pp.id
JOIN public.products p ON ppi.product_id = p.id
ORDER BY pp.plan_date, ppi.priority DESC, p.name;

-- Статистика по пріоритетах
SELECT 
    priority,
    COUNT(*) as items_count,
    SUM(quantity_needed) as total_needed,
    SUM(quantity_planned) as total_planned,
    SUM(quantity_produced) as total_produced,
    CASE 
        WHEN SUM(quantity_planned) > 0 THEN ROUND((SUM(quantity_produced)::NUMERIC / SUM(quantity_planned)) * 100, 1)
        ELSE 0
    END as completion_rate
FROM public.production_plan_items
GROUP BY priority
ORDER BY 
    CASE priority 
        WHEN 'URGENT' THEN 1
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
    END;

-- Статистика по причинах виробництва
SELECT 
    reason,
    COUNT(*) as items_count,
    SUM(quantity_needed) as total_needed,
    SUM(quantity_planned) as total_planned,
    SUM(quantity_produced) as total_produced
FROM public.production_plan_items
GROUP BY reason
ORDER BY items_count DESC;

-- Перевірка foreign key зв'язків
SELECT 
    ppi.id,
    pp.plan_date,
    pp.status as plan_status,
    p.name as product_name,
    p.code as product_code,
    o.client_name as order_client,
    u.username as created_by,
    ppi.quantity_planned,
    ppi.quantity_produced,
    ppi.priority
FROM public.production_plan_items ppi
JOIN public.production_plans pp ON ppi.plan_id = pp.id
JOIN public.products p ON ppi.product_id = p.id
LEFT JOIN public.orders o ON ppi.order_id = o.id
LEFT JOIN public.users u ON ppi.created_by_user_id = u.id
ORDER BY pp.plan_date, ppi.priority DESC;

-- Агрегація по планах (для перевірки цілісності)
SELECT 
    pp.id as plan_id,
    pp.plan_date,
    pp.total_planned as plan_total_planned,
    SUM(ppi.quantity_planned) as items_total_planned,
    pp.total_produced as plan_total_produced,
    SUM(ppi.quantity_produced) as items_total_produced,
    COUNT(ppi.id) as items_count
FROM public.production_plans pp
LEFT JOIN public.production_plan_items ppi ON pp.id = ppi.plan_id
GROUP BY pp.id, pp.plan_date, pp.total_planned, pp.total_produced
ORDER BY pp.plan_date;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'production_plan_items' 
    AND schemaname = 'public'
ORDER BY indexname;