-- 🏗️ Створення таблиці user_audit в Supabase
-- Етап 8, Крок 1: Аудит і логування - аудит користувачів
-- Залежності: users (створена)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.user_audit CASCADE;

-- Створення таблиці user_audit
CREATE TABLE public.user_audit (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id BIGINT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_by_user_id BIGINT REFERENCES public.users(id)
);

-- Створення індексів для оптимізації
CREATE INDEX idx_user_audit_user_id ON public.user_audit(user_id);
CREATE INDEX idx_user_audit_action ON public.user_audit(action);
CREATE INDEX idx_user_audit_resource_type ON public.user_audit(resource_type);
CREATE INDEX idx_user_audit_resource_id ON public.user_audit(resource_id);
CREATE INDEX idx_user_audit_created_at ON public.user_audit(created_at);
CREATE INDEX idx_user_audit_ip ON public.user_audit(ip_address);
CREATE INDEX idx_user_audit_session_id ON public.user_audit(session_id);
CREATE INDEX idx_user_audit_success ON public.user_audit(success);

-- Створення індексу на JSONB details для швидкого пошуку
CREATE INDEX idx_user_audit_details_gin ON public.user_audit USING GIN (details);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.user_audit IS 'Аудит дій користувачів системи';
COMMENT ON COLUMN public.user_audit.id IS 'Унікальний ідентифікатор запису аудиту';
COMMENT ON COLUMN public.user_audit.user_id IS 'Користувач який виконав дію';
COMMENT ON COLUMN public.user_audit.action IS 'Тип дії (CREATE, UPDATE, DELETE, LOGIN, LOGOUT)';
COMMENT ON COLUMN public.user_audit.resource_type IS 'Тип ресурсу (users, products, orders тощо)';
COMMENT ON COLUMN public.user_audit.resource_id IS 'ID ресурсу над яким виконана дія';
COMMENT ON COLUMN public.user_audit.details IS 'Детальна інформація про дію в JSON форматі';
COMMENT ON COLUMN public.user_audit.ip_address IS 'IP адреса з якої виконана дія';
COMMENT ON COLUMN public.user_audit.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN public.user_audit.created_at IS 'Час виконання дії';
COMMENT ON COLUMN public.user_audit.session_id IS 'Ідентифікатор сесії';
COMMENT ON COLUMN public.user_audit.success IS 'Чи успішно виконана дія';
COMMENT ON COLUMN public.user_audit.error_message IS 'Повідомлення про помилку якщо дія не успішна';
COMMENT ON COLUMN public.user_audit.created_by_user_id IS 'Хто створив запис аудиту';

-- Тестові дані для демонстрації
INSERT INTO public.user_audit (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent,
    session_id,
    success,
    created_by_user_id
) VALUES 
    (
        1, -- admin user
        'LOGIN',
        'auth',
        NULL,
        '{"login_method": "username", "two_factor": false}'::JSONB,
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_login_' || gen_random_uuid()::text,
        TRUE,
        1
    ),
    (
        1, -- admin user
        'CREATE',
        'products',
        1,
        '{"product_name": "Маргарита", "category": "піца", "price": 120}'::JSONB,
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_create_' || gen_random_uuid()::text,
        TRUE,
        1
    ),
    (
        1, -- admin user
        'UPDATE',
        'products',
        1,
        '{"old_price": 120, "new_price": 130, "field": "price"}'::JSONB,
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_update_' || gen_random_uuid()::text,
        TRUE,
        1
    ),
    (
        1, -- admin user
        'DELETE',
        'clients',
        99,
        '{"client_name": "Тестовий клієнт", "reason": "test_cleanup"}'::JSONB,
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'sess_delete_' || gen_random_uuid()::text,
        TRUE,
        1
    ),
    (
        1, -- admin user
        'LOGIN',
        'auth',
        NULL,
        '{"login_method": "username", "error": "invalid_password"}'::JSONB,
        '192.168.1.199'::INET,
        'curl/7.68.0',
        'sess_failed_' || gen_random_uuid()::text,
        FALSE,
        1
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE success = TRUE) as successful_actions,
    COUNT(*) FILTER (WHERE success = FALSE) as failed_actions,
    COUNT(DISTINCT action) as unique_actions,
    COUNT(DISTINCT resource_type) as unique_resources,
    COUNT(DISTINCT user_id) as unique_users
FROM public.user_audit;

-- Перевірка тестових даних
SELECT 
    id,
    user_id,
    action,
    resource_type,
    resource_id,
    success,
    created_at,
    CASE 
        WHEN details IS NOT NULL THEN jsonb_pretty(details)
        ELSE 'NULL'
    END as details_formatted
FROM public.user_audit
ORDER BY created_at DESC;

-- Перевірка foreign key зв'язків
SELECT 
    a.action,
    a.resource_type,
    a.success,
    u.username,
    u.role,
    a.created_at
FROM public.user_audit a
LEFT JOIN public.users u ON a.user_id = u.id
ORDER BY a.created_at DESC;

-- Статистика дій по користувачах
SELECT 
    u.username,
    u.role,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE a.success = TRUE) as successful_actions,
    COUNT(*) FILTER (WHERE a.success = FALSE) as failed_actions,
    COUNT(DISTINCT a.action) as unique_actions
FROM public.user_audit a
LEFT JOIN public.users u ON a.user_id = u.id
GROUP BY u.id, u.username, u.role
ORDER BY total_actions DESC;

-- Статистика дій по типах
SELECT 
    action,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE success = TRUE) as successful,
    COUNT(*) FILTER (WHERE success = FALSE) as failed,
    COUNT(DISTINCT user_id) as unique_users
FROM public.user_audit
GROUP BY action
ORDER BY total DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'user_audit' 
    AND schemaname = 'public'
ORDER BY indexname;