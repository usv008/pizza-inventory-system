-- 🏗️ Створення таблиці security_events в Supabase
-- Етап 8, Крок 2: Аудит і логування - події безпеки 
-- Залежності: users (створена)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.security_events CASCADE;

-- Створення таблиці security_events
CREATE TABLE public.security_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    ip_address INET,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source TEXT,
    user_agent TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by_user_id BIGINT REFERENCES public.users(id),
    created_by_user_id BIGINT REFERENCES public.users(id)
);

-- Створення індексів для оптимізації
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at);
CREATE INDEX idx_security_events_ip ON public.security_events(ip_address);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_resolved ON public.security_events(resolved);
CREATE INDEX idx_security_events_source ON public.security_events(source);

-- Створення індексу на JSONB details для швидкого пошуку
CREATE INDEX idx_security_events_details_gin ON public.security_events USING GIN (details);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.security_events IS 'Події безпеки системи';
COMMENT ON COLUMN public.security_events.id IS 'Унікальний ідентифікатор події';
COMMENT ON COLUMN public.security_events.event_type IS 'Тип події безпеки (login_failed, suspicious_activity, breach_attempt тощо)';
COMMENT ON COLUMN public.security_events.user_id IS 'Користувач пов''язаний з подією (якщо є)';
COMMENT ON COLUMN public.security_events.ip_address IS 'IP адреса джерела події';
COMMENT ON COLUMN public.security_events.details IS 'Детальна інформація про подію в JSON форматі';
COMMENT ON COLUMN public.security_events.created_at IS 'Час виникнення події';
COMMENT ON COLUMN public.security_events.severity IS 'Рівень серйозності події';
COMMENT ON COLUMN public.security_events.source IS 'Джерело події (api, web, system тощо)';
COMMENT ON COLUMN public.security_events.user_agent IS 'User Agent браузера/клієнта';
COMMENT ON COLUMN public.security_events.resolved IS 'Чи розв''язана подія';
COMMENT ON COLUMN public.security_events.resolved_at IS 'Час розв''язання події';
COMMENT ON COLUMN public.security_events.resolved_by_user_id IS 'Хто розв''язав подію';
COMMENT ON COLUMN public.security_events.created_by_user_id IS 'Хто створив запис події';

-- Тестові дані для демонстрації
INSERT INTO public.security_events (
    event_type,
    user_id,
    ip_address,
    details,
    severity,
    source,
    user_agent,
    resolved,
    created_by_user_id
) VALUES 
    (
        'login_failed',
        1, -- admin user
        '192.168.1.100'::INET,
        '{"username": "admin", "attempts": 3, "reason": "invalid_password"}'::JSONB,
        'medium',
        'web',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        FALSE,
        1
    ),
    (
        'suspicious_activity',
        NULL,
        '10.0.0.99'::INET,
        '{"activity": "port_scan", "ports": [22, 80, 443, 3306], "blocked": true}'::JSONB,
        'high',
        'firewall',
        NULL,
        TRUE,
        1
    ),
    (
        'breach_attempt',
        NULL,
        '45.142.213.99'::INET,
        '{"attack_type": "sql_injection", "endpoint": "/api/products", "payload": "UNION SELECT * FROM users"}'::JSONB,
        'critical',
        'api',
        'curl/7.68.0',
        TRUE,
        1
    ),
    (
        'privilege_escalation',
        1, -- admin user
        '192.168.1.100'::INET,
        '{"action": "role_change", "from_role": "user", "to_role": "admin", "target_user": "testuser"}'::JSONB,
        'high',
        'web',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        FALSE,
        1
    ),
    (
        'data_access_violation',
        1, -- admin user
        '192.168.1.101'::INET,
        '{"resource": "sensitive_data", "unauthorized_access": true, "data_type": "customer_info"}'::JSONB,
        'critical',
        'api',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        FALSE,
        1
    );

-- Оновлюємо resolved події
UPDATE public.security_events 
SET resolved = TRUE, resolved_at = NOW(), resolved_by_user_id = 1 
WHERE event_type IN ('suspicious_activity', 'breach_attempt');

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE resolved = TRUE) as resolved_events,
    COUNT(*) FILTER (WHERE resolved = FALSE) as unresolved_events,
    COUNT(DISTINCT event_type) as unique_event_types,
    COUNT(DISTINCT severity) as unique_severities,
    COUNT(DISTINCT ip_address) as unique_ips
FROM public.security_events;

-- Перевірка тестових даних
SELECT 
    id,
    event_type,
    user_id,
    ip_address,
    severity,
    source,
    resolved,
    created_at,
    CASE 
        WHEN details IS NOT NULL THEN jsonb_pretty(details)
        ELSE 'NULL'
    END as details_formatted
FROM public.security_events
ORDER BY created_at DESC;

-- Статистика подій по типах
SELECT 
    event_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE resolved = TRUE) as resolved,
    COUNT(*) FILTER (WHERE resolved = FALSE) as unresolved,
    COUNT(DISTINCT ip_address) as unique_ips
FROM public.security_events
GROUP BY event_type
ORDER BY total DESC;

-- Статистика подій по рівню серйозності
SELECT 
    severity,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE resolved = TRUE) as resolved,
    COUNT(*) FILTER (WHERE resolved = FALSE) as unresolved
FROM public.security_events
GROUP BY severity
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- Перевірка foreign key зв'язків
SELECT 
    se.event_type,
    se.severity,
    se.resolved,
    u.username as user_username,
    u.role as user_role,
    ru.username as resolved_by_username,
    se.created_at
FROM public.security_events se
LEFT JOIN public.users u ON se.user_id = u.id
LEFT JOIN public.users ru ON se.resolved_by_user_id = ru.id
ORDER BY se.created_at DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'security_events' 
    AND schemaname = 'public'
ORDER BY indexname;