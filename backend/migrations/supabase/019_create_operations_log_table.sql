-- 🏗️ Створення таблиці operations_log в Supabase
-- Етап 8, Крок 4: Аудит і логування - операційний лог системи
-- Залежності: users (створена)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.operations_log CASCADE;

-- Створення таблиці operations_log
CREATE TABLE public.operations_log (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL,
    operation_id BIGINT,
    entity_type TEXT NOT NULL,
    entity_id BIGINT,
    old_data JSONB,
    new_data JSONB,
    description TEXT NOT NULL,
    user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_operations_log_operation_type ON public.operations_log(operation_type);
CREATE INDEX idx_operations_log_entity_type ON public.operations_log(entity_type);
CREATE INDEX idx_operations_log_entity_id ON public.operations_log(entity_id);
CREATE INDEX idx_operations_log_operation_id ON public.operations_log(operation_id);
CREATE INDEX idx_operations_log_user_id ON public.operations_log(user_id);
CREATE INDEX idx_operations_log_user_name ON public.operations_log(user_name);
CREATE INDEX idx_operations_log_created_at ON public.operations_log(created_at);
CREATE INDEX idx_operations_log_ip ON public.operations_log(ip_address);
CREATE INDEX idx_operations_log_success ON public.operations_log(success);
CREATE INDEX idx_operations_log_session_id ON public.operations_log(session_id);

-- Композитні індекси для частих запитів
CREATE INDEX idx_operations_log_entity_operation ON public.operations_log(entity_type, entity_id);
CREATE INDEX idx_operations_log_user_time ON public.operations_log(user_id, created_at);
CREATE INDEX idx_operations_log_type_time ON public.operations_log(operation_type, created_at);

-- Створення індексів на JSONB поля для швидкого пошуку
CREATE INDEX idx_operations_log_old_data_gin ON public.operations_log USING GIN (old_data);
CREATE INDEX idx_operations_log_new_data_gin ON public.operations_log USING GIN (new_data);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.operations_log IS 'Операційний лог всіх дій у системі';
COMMENT ON COLUMN public.operations_log.id IS 'Унікальний ідентифікатор запису логу';
COMMENT ON COLUMN public.operations_log.operation_type IS 'Тип операції (CREATE_ORDER, UPDATE_PRODUCT, PRODUCTION, WRITEOFF тощо)';
COMMENT ON COLUMN public.operations_log.operation_id IS 'ID відповідної операції (order_id, production_id тощо)';
COMMENT ON COLUMN public.operations_log.entity_type IS 'Тип сутності (order, product, production, writeoff, arrival тощо)';
COMMENT ON COLUMN public.operations_log.entity_id IS 'ID сутності на яку впливає операція';
COMMENT ON COLUMN public.operations_log.old_data IS 'Старі дані (для UPDATE операцій) у JSON форматі';
COMMENT ON COLUMN public.operations_log.new_data IS 'Нові дані у JSON форматі';
COMMENT ON COLUMN public.operations_log.description IS 'Опис операції для відображення';
COMMENT ON COLUMN public.operations_log.user_id IS 'Користувач який виконав операцію';
COMMENT ON COLUMN public.operations_log.user_name IS 'Імя користувача (дублювання для історії)';
COMMENT ON COLUMN public.operations_log.ip_address IS 'IP адреса користувача';
COMMENT ON COLUMN public.operations_log.user_agent IS 'Браузер/клієнт користувача';
COMMENT ON COLUMN public.operations_log.session_id IS 'Ідентифікатор сесії';
COMMENT ON COLUMN public.operations_log.success IS 'Чи успішно виконана операція';
COMMENT ON COLUMN public.operations_log.error_message IS 'Повідомлення про помилку';
COMMENT ON COLUMN public.operations_log.execution_time_ms IS 'Час виконання операції в мілісекундах';
COMMENT ON COLUMN public.operations_log.created_at IS 'Час виконання операції';

-- Тестові дані для демонстрації
INSERT INTO public.operations_log (
    operation_type,
    operation_id,
    entity_type,
    entity_id,
    old_data,
    new_data,
    description,
    user_id,
    user_name,
    ip_address,
    user_agent,
    session_id,
    success,
    execution_time_ms
) VALUES 
    (
        'CREATE_ORDER',
        1,
        'order',
        1,
        NULL,
        '{"client_name": "ТОВ \"Смачні піци\"", "total_amount": 1250, "items_count": 3}'::JSONB,
        'Створено нове замовлення для клієнта ТОВ "Смачні піци"',
        1, -- admin user
        'admin',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_create_' || gen_random_uuid()::text,
        TRUE,
        234
    ),
    (
        'UPDATE_ORDER',
        1,
        'order',
        1,
        '{"status": "DRAFT", "total_amount": 1250}'::JSONB,
        '{"status": "CONFIRMED", "total_amount": 1250, "confirmed_at": "2025-07-25T10:30:00Z"}'::JSONB,
        'Підтверджено замовлення №1',
        1, -- admin user
        'admin',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_update_' || gen_random_uuid()::text,
        TRUE,
        89
    ),
    (
        'PRODUCTION',
        1,
        'production',
        1,
        NULL,
        '{"product_id": 1, "quantity": 50, "batch_date": "2025-07-25"}'::JSONB,
        'Виробництво 50 одиниць Піца Маргарита',
        1, -- admin user
        'admin',
        '192.168.1.101'::INET,
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'sess_prod_' || gen_random_uuid()::text,
        TRUE,
        1245
    ),
    (
        'WRITEOFF',
        1,
        'writeoff',
        1,
        NULL,
        '{"product_id": 3, "quantity": 5, "reason": "EXPIRED", "notes": "Прострочена продукція"}'::JSONB,
        'Списано 5 одиниць Піца Гавайська через закінчення терміну придатності',
        1, -- admin user
        'admin',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_writeoff_' || gen_random_uuid()::text,
        TRUE,
        156
    ),
    (
        'ARRIVAL',
        1,
        'arrival',
        1,
        NULL,
        '{"arrival_number": "ARR000001", "supplier": "ТОВ \"Борошно і Ко\"", "items_count": 3}'::JSONB,
        'Оброблено надходження ARR000001 від постачальника',
        1, -- admin user
        'admin',
        '192.168.1.102'::INET,
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'sess_arrival_' || gen_random_uuid()::text,
        TRUE,
        567
    ),
    (
        'UPDATE_PRODUCT',
        2,
        'product',
        2,
        '{"stock_pieces": 100, "min_stock_pieces": 20}'::JSONB,
        '{"stock_pieces": 120, "min_stock_pieces": 25}'::JSONB,
        'Оновлено запаси Піца Пепероні: 100→120 шт, мін. запас: 20→25 шт',
        1, -- admin user
        'admin',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_update_' || gen_random_uuid()::text,
        TRUE,
        67
    ),
    (
        'DELETE_ORDER',
        99,
        'order',
        99,
        '{"client_name": "Тестовий клієнт", "total_amount": 500}'::JSONB,
        NULL,
        'Помилка видалення замовлення - замовлення не знайдено',
        1, -- admin user
        'admin',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_delete_' || gen_random_uuid()::text,
        FALSE,
        23
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_operations,
    COUNT(*) FILTER (WHERE success = TRUE) as successful_operations,
    COUNT(*) FILTER (WHERE success = FALSE) as failed_operations,
    COUNT(DISTINCT operation_type) as unique_operation_types,
    COUNT(DISTINCT entity_type) as unique_entity_types,
    COUNT(DISTINCT user_id) as unique_users,
    ROUND(AVG(execution_time_ms)) as avg_execution_time_ms
FROM public.operations_log;

-- Перевірка тестових даних
SELECT 
    id,
    operation_type,
    entity_type,
    entity_id,
    description,
    user_name,
    success,
    execution_time_ms,
    created_at
FROM public.operations_log
ORDER BY created_at DESC;

-- Статистика операцій по типах
SELECT 
    operation_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE success = TRUE) as successful,
    COUNT(*) FILTER (WHERE success = FALSE) as failed,
    ROUND(AVG(execution_time_ms)) as avg_time_ms,
    COUNT(DISTINCT user_id) as unique_users
FROM public.operations_log
GROUP BY operation_type
ORDER BY total DESC;

-- Статистика операцій по сутностях
SELECT 
    entity_type,
    COUNT(*) as total_operations,
    COUNT(DISTINCT entity_id) as unique_entities,
    COUNT(DISTINCT operation_type) as unique_operations,
    ROUND(AVG(execution_time_ms)) as avg_time_ms
FROM public.operations_log
GROUP BY entity_type
ORDER BY total_operations DESC;

-- Статистика операцій по користувачах
SELECT 
    user_name,
    COUNT(*) as total_operations,
    COUNT(*) FILTER (WHERE success = TRUE) as successful,
    COUNT(*) FILTER (WHERE success = FALSE) as failed,
    COUNT(DISTINCT operation_type) as unique_operations,
    COUNT(DISTINCT entity_type) as unique_entities,
    ROUND(AVG(execution_time_ms)) as avg_time_ms
FROM public.operations_log
GROUP BY user_name, user_id
ORDER BY total_operations DESC;

-- Аналіз продуктивності операцій
SELECT 
    operation_type,
    entity_type,
    COUNT(*) as operations_count,
    MIN(execution_time_ms) as min_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    ROUND(AVG(execution_time_ms)) as avg_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as median_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_time_ms
FROM public.operations_log
WHERE execution_time_ms IS NOT NULL
GROUP BY operation_type, entity_type
ORDER BY avg_time_ms DESC;

-- Останні операції з деталями
SELECT 
    ol.operation_type,
    ol.entity_type,
    ol.description,
    ol.user_name,
    u.role as user_role,
    ol.success,
    ol.execution_time_ms,
    ol.created_at,
    CASE 
        WHEN ol.new_data IS NOT NULL THEN jsonb_pretty(ol.new_data)
        ELSE 'NULL'
    END as new_data_preview
FROM public.operations_log ol
LEFT JOIN public.users u ON ol.user_id = u.id
ORDER BY ol.created_at DESC
LIMIT 5;

-- Перевірка foreign key зв'язків
SELECT 
    ol.operation_type,
    ol.entity_type,
    ol.description,
    ol.success,
    u.username,
    u.role,
    ol.created_at
FROM public.operations_log ol
LEFT JOIN public.users u ON ol.user_id = u.id
ORDER BY ol.created_at DESC;

-- Операції з помилками
SELECT 
    operation_type,
    entity_type,
    description,
    error_message,
    user_name,
    created_at
FROM public.operations_log
WHERE success = FALSE
ORDER BY created_at DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'operations_log' 
    AND schemaname = 'public'
ORDER BY indexname;