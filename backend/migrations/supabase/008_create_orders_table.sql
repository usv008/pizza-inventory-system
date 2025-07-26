-- 🏗️ Створення таблиці orders в Supabase
-- Етап 3, Крок 5: Основні операції - замовлення
-- Залежності: clients, users

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.orders CASCADE;

-- Створення таблиці orders
CREATE TABLE public.orders (
    id BIGSERIAL PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    client_id BIGINT REFERENCES public.clients(id),
    client_name TEXT NOT NULL,
    client_contact TEXT,
    order_date DATE NOT NULL,
    delivery_date DATE,
    status TEXT DEFAULT 'NEW',
    total_quantity INTEGER DEFAULT 0,
    total_boxes INTEGER DEFAULT 0,
    notes TEXT,
    created_by TEXT DEFAULT 'system',
    created_by_user_id BIGINT REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_orders_order_date ON public.orders(order_date);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_client_id ON public.orders(client_id);
CREATE INDEX idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX idx_orders_created_by_user_id ON public.orders(created_by_user_id);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.orders IS 'Замовлення клієнтів';
COMMENT ON COLUMN public.orders.id IS 'Унікальний ідентифікатор замовлення';
COMMENT ON COLUMN public.orders.order_number IS 'Номер замовлення (унікальний)';
COMMENT ON COLUMN public.orders.client_id IS 'Посилання на клієнта';
COMMENT ON COLUMN public.orders.client_name IS 'Назва клієнта (копія для історії)';
COMMENT ON COLUMN public.orders.client_contact IS 'Контактна особа клієнта';
COMMENT ON COLUMN public.orders.order_date IS 'Дата замовлення';
COMMENT ON COLUMN public.orders.delivery_date IS 'Дата доставки';
COMMENT ON COLUMN public.orders.status IS 'Статус: NEW, IN_PROGRESS, COMPLETED, CANCELLED';
COMMENT ON COLUMN public.orders.total_quantity IS 'Загальна кількість товарів в штуках';
COMMENT ON COLUMN public.orders.total_boxes IS 'Загальна кількість в коробках';
COMMENT ON COLUMN public.orders.created_by IS 'Хто створив (legacy поле)';
COMMENT ON COLUMN public.orders.created_by_user_id IS 'Користувач, що створив замовлення';

-- Тригер для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Тестові дані
INSERT INTO public.orders (
    order_number,
    client_id,
    client_name,
    client_contact,
    order_date,
    delivery_date,
    status,
    total_quantity,
    total_boxes,
    notes,
    created_by
) VALUES 
    ('20250724-001', 1, 'ТОВ "Смачні піци"', 'Іван Петренко', '2025-07-24', '2025-07-26', 'NEW', 100, 10, 'Тестове замовлення для Маргарити', 'system'),
    ('20250724-002', 2, 'Ресторан "Італьяно"', 'Марія Іваненко', '2025-07-24', '2025-07-27', 'NEW', 80, 8, 'Замовлення на вихідні', 'system'),
    ('20250723-001', 3, 'Кафе "Corner"', 'Олег Сидоренко', '2025-07-23', '2025-07-25', 'COMPLETED', 50, 5, 'Виконане замовлення', 'system');

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'NEW') as new_orders,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_orders,
    SUM(total_quantity) as total_quantity_ordered
FROM public.orders;

-- Перевірка тестових даних
SELECT 
    id,
    order_number,
    client_name,
    order_date,
    delivery_date,
    status,
    total_quantity,
    created_at
FROM public.orders
ORDER BY order_date DESC, created_at DESC;

-- Перевірка foreign key з клієнтами
SELECT 
    o.order_number,
    o.client_name,
    c.name as actual_client_name,
    c.contact_person,
    o.status
FROM public.orders o
LEFT JOIN public.clients c ON o.client_id = c.id
ORDER BY o.order_date DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'orders' 
    AND schemaname = 'public'
ORDER BY indexname;