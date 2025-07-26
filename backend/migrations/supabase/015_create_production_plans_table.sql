-- 🏗️ Створення таблиці production_plans в Supabase
-- Етап 6, Крок 1: Планування виробництва - плани виробництва
-- Залежності: users (створена)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.production_plans CASCADE;

-- Створення таблиці production_plans
CREATE TABLE public.production_plans (
    id BIGSERIAL PRIMARY KEY,
    plan_date DATE NOT NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    total_planned INTEGER DEFAULT 0,
    total_produced INTEGER DEFAULT 0,
    created_by_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    approved_by_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_production_plans_plan_date ON public.production_plans(plan_date);
CREATE INDEX idx_production_plans_status ON public.production_plans(status);
CREATE INDEX idx_production_plans_created_by ON public.production_plans(created_by_user_id);
CREATE INDEX idx_production_plans_approved_by ON public.production_plans(approved_by_user_id);
CREATE INDEX idx_production_plans_created_at ON public.production_plans(created_at);
CREATE INDEX idx_production_plans_updated_at ON public.production_plans(updated_at);

-- Унікальний індекс для запобігання дублюванню планів на одну дату
CREATE UNIQUE INDEX idx_production_plans_unique_date ON public.production_plans(plan_date) 
WHERE status != 'CANCELLED';

-- Створення тригера для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_production_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_production_plans_updated_at
    BEFORE UPDATE ON public.production_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_production_plans_updated_at();

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.production_plans IS 'Плани виробництва по датах';
COMMENT ON COLUMN public.production_plans.id IS 'Унікальний ідентифікатор плану';
COMMENT ON COLUMN public.production_plans.plan_date IS 'Дата для якої створений план';
COMMENT ON COLUMN public.production_plans.status IS 'Статус плану (DRAFT, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED)';
COMMENT ON COLUMN public.production_plans.total_planned IS 'Загальна кількість запланованої продукції';
COMMENT ON COLUMN public.production_plans.total_produced IS 'Загальна кількість виготовленої продукції';
COMMENT ON COLUMN public.production_plans.created_by_user_id IS 'Користувач який створив план';
COMMENT ON COLUMN public.production_plans.approved_by_user_id IS 'Користувач який затвердив план';
COMMENT ON COLUMN public.production_plans.approved_at IS 'Час затвердження плану';
COMMENT ON COLUMN public.production_plans.notes IS 'Додаткові примітки до плану';
COMMENT ON COLUMN public.production_plans.created_at IS 'Час створення плану';
COMMENT ON COLUMN public.production_plans.updated_at IS 'Час останнього оновлення';

-- Тестові дані для демонстрації
INSERT INTO public.production_plans (
    plan_date,
    status,
    total_planned,
    total_produced,
    created_by_user_id,
    approved_by_user_id,
    approved_at,
    notes
) VALUES 
    (
        CURRENT_DATE,
        'APPROVED',
        150,
        120,
        1, -- admin user
        1, -- admin user
        NOW() - INTERVAL '2 hours',
        'План на сьогодні - основне меню'
    ),
    (
        CURRENT_DATE + INTERVAL '1 day',
        'DRAFT',
        200,
        0,
        1, -- admin user
        NULL,
        NULL,
        'План на завтра - додати нові позиції меню'
    ),
    (
        CURRENT_DATE + INTERVAL '2 days',
        'DRAFT',
        180,
        0,
        1, -- admin user
        NULL,
        NULL,
        'Плануємо на вихідні - менший обсяг'
    ),
    (
        CURRENT_DATE - INTERVAL '1 day',
        'COMPLETED',
        100,
        98,
        1, -- admin user
        1, -- admin user
        NOW() - INTERVAL '1 day 3 hours',
        'Вчорашній план - виконано майже повністю'
    ),
    (
        CURRENT_DATE - INTERVAL '2 days',
        'CANCELLED',
        120,
        0,
        1, -- admin user
        NULL,
        NULL,
        'Скасований через відсутність сировини'
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_plans,
    COUNT(*) FILTER (WHERE status = 'DRAFT') as draft_plans,
    COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_plans,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_plans,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_plans,
    SUM(total_planned) as total_planned_items,
    SUM(total_produced) as total_produced_items
FROM public.production_plans;

-- Перевірка тестових даних
SELECT 
    id,
    plan_date,
    status,
    total_planned,
    total_produced,
    CASE 
        WHEN total_planned > 0 THEN ROUND((total_produced::NUMERIC / total_planned) * 100, 1)
        ELSE 0
    END as completion_percentage,
    notes,
    created_at
FROM public.production_plans
ORDER BY plan_date DESC;

-- Статистика планів по статусах
SELECT 
    status,
    COUNT(*) as count,
    SUM(total_planned) as total_planned,
    SUM(total_produced) as total_produced,
    CASE 
        WHEN SUM(total_planned) > 0 THEN ROUND((SUM(total_produced)::NUMERIC / SUM(total_planned)) * 100, 1)
        ELSE 0
    END as avg_completion_rate
FROM public.production_plans
GROUP BY status
ORDER BY count DESC;

-- Перевірка foreign key зв'язків
SELECT 
    pp.id,
    pp.plan_date,
    pp.status,
    creator.username as created_by,
    creator.role as creator_role,
    approver.username as approved_by,
    approver.role as approver_role,
    pp.approved_at
FROM public.production_plans pp
LEFT JOIN public.users creator ON pp.created_by_user_id = creator.id
LEFT JOIN public.users approver ON pp.approved_by_user_id = approver.id
ORDER BY pp.plan_date DESC;

-- Перевірка унікального індексу
SELECT 
    plan_date,
    COUNT(*) as plans_count,
    STRING_AGG(status, ', ') as statuses
FROM public.production_plans
WHERE status != 'CANCELLED'
GROUP BY plan_date
HAVING COUNT(*) > 1;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'production_plans' 
    AND schemaname = 'public'
ORDER BY indexname;