-- 🏗️ Створення таблиці api_audit_log в Supabase
-- Етап 8, Крок 3: Аудит і логування - лог API викликів
-- Залежності: users (створена)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.api_audit_log CASCADE;

-- Створення таблиці api_audit_log
CREATE TABLE public.api_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')),
    path TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status_code INTEGER,
    duration INTEGER, -- в мілісекундах
    success BOOLEAN DEFAULT TRUE,
    request_body JSONB,
    response_body JSONB,
    error_message TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES public.users(id)
);

-- Створення індексів для оптимізації
CREATE INDEX idx_api_audit_log_user_id ON public.api_audit_log(user_id);
CREATE INDEX idx_api_audit_log_method ON public.api_audit_log(method);
CREATE INDEX idx_api_audit_log_path ON public.api_audit_log(path);
CREATE INDEX idx_api_audit_log_status_code ON public.api_audit_log(status_code);
CREATE INDEX idx_api_audit_log_success ON public.api_audit_log(success);
CREATE INDEX idx_api_audit_log_created_at ON public.api_audit_log(created_at);
CREATE INDEX idx_api_audit_log_ip ON public.api_audit_log(ip_address);
CREATE INDEX idx_api_audit_log_session_id ON public.api_audit_log(session_id);
CREATE INDEX idx_api_audit_log_duration ON public.api_audit_log(duration);

-- Створення індексів на JSONB поля для швидкого пошуку
CREATE INDEX idx_api_audit_log_request_body_gin ON public.api_audit_log USING GIN (request_body);
CREATE INDEX idx_api_audit_log_response_body_gin ON public.api_audit_log USING GIN (response_body);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.api_audit_log IS 'Лог API викликів системи';
COMMENT ON COLUMN public.api_audit_log.id IS 'Унікальний ідентифікатор запису логу';
COMMENT ON COLUMN public.api_audit_log.user_id IS 'Користувач який зробив запит';
COMMENT ON COLUMN public.api_audit_log.method IS 'HTTP метод запиту';
COMMENT ON COLUMN public.api_audit_log.path IS 'Шлях API ендпоінту';
COMMENT ON COLUMN public.api_audit_log.ip_address IS 'IP адреса клієнта';
COMMENT ON COLUMN public.api_audit_log.user_agent IS 'User Agent браузера/клієнта';
COMMENT ON COLUMN public.api_audit_log.status_code IS 'HTTP статус код відповіді';
COMMENT ON COLUMN public.api_audit_log.duration IS 'Тривалість обробки запиту в мілісекундах';
COMMENT ON COLUMN public.api_audit_log.success IS 'Чи успішно виконано запит';
COMMENT ON COLUMN public.api_audit_log.request_body IS 'Тіло запиту в JSON форматі';
COMMENT ON COLUMN public.api_audit_log.response_body IS 'Тіло відповіді в JSON форматі';
COMMENT ON COLUMN public.api_audit_log.error_message IS 'Повідомлення про помилку';
COMMENT ON COLUMN public.api_audit_log.session_id IS 'Ідентифікатор сесії користувача';
COMMENT ON COLUMN public.api_audit_log.created_at IS 'Час виконання запиту';
COMMENT ON COLUMN public.api_audit_log.created_by_user_id IS 'Хто створив запис логу';

-- Тестові дані для демонстрації
INSERT INTO public.api_audit_log (
    user_id,
    method,
    path,
    ip_address,
    user_agent,
    status_code,
    duration,
    success,
    request_body,
    response_body,
    session_id,
    created_by_user_id
) VALUES 
    (
        1, -- admin user
        'GET',
        '/api/products',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        200,
        142,
        TRUE,
        NULL,
        '{"status": "success", "count": 25, "data": "..."}'::JSONB,
        'sess_get_' || gen_random_uuid()::text,
        1
    ),
    (
        1, -- admin user
        'POST',
        '/api/products',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        201,
        234,
        TRUE,
        '{"name": "Нова піца", "price": 150, "category": "піца"}'::JSONB,
        '{"status": "success", "id": 26, "created": true}'::JSONB,
        'sess_post_' || gen_random_uuid()::text,
        1
    ),
    (
        1, -- admin user
        'PUT',
        '/api/products/26',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        200,
        189,
        TRUE,
        '{"price": 160}'::JSONB,
        '{"status": "success", "updated": true}'::JSONB,
        'sess_put_' || gen_random_uuid()::text,
        1
    ),
    (
        1, -- admin user
        'DELETE',
        '/api/products/99',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        404,
        67,
        FALSE,
        NULL,
        '{"status": "error", "message": "Product not found"}'::JSONB,
        'sess_del_' || gen_random_uuid()::text,
        1
    ),
    (
        NULL, -- анонімний запит
        'POST',
        '/api/auth/login',
        '45.142.213.99'::INET,
        'curl/7.68.0',
        401,
        423,
        FALSE,
        '{"username": "admin", "password": "wrong_password"}'::JSONB,
        '{"status": "error", "message": "Invalid credentials"}'::JSONB,
        NULL,
        1
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success = TRUE) as successful_requests,
    COUNT(*) FILTER (WHERE success = FALSE) as failed_requests,
    COUNT(DISTINCT method) as unique_methods,
    COUNT(DISTINCT path) as unique_paths,
    COUNT(DISTINCT user_id) as unique_users,
    ROUND(AVG(duration)) as avg_duration_ms
FROM public.api_audit_log;

-- Перевірка тестових даних
SELECT 
    id,
    user_id,
    method,
    path,
    status_code,
    success,
    duration,
    created_at
FROM public.api_audit_log
ORDER BY created_at DESC;