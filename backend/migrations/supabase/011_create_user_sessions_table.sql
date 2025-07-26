-- 🏗️ Створення таблиці user_sessions в Supabase
-- Етап 2, Крок 1: Система користувачів - сесії
-- Залежності: users (створена)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- Створення таблиці user_sessions
CREATE TABLE public.user_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    active BOOLEAN DEFAULT TRUE,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES public.users(id)
);

-- Створення індексів для оптимізації
CREATE INDEX idx_user_sessions_session_id ON public.user_sessions(session_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(active);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX idx_user_sessions_created_at ON public.user_sessions(created_at);
CREATE INDEX idx_user_sessions_ip ON public.user_sessions(ip_address);

-- Створення тригера для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_sessions_updated_at
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_sessions_updated_at();

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.user_sessions IS 'Сесії користувачів для аутентифікації';
COMMENT ON COLUMN public.user_sessions.id IS 'Унікальний ідентифікатор сесії';
COMMENT ON COLUMN public.user_sessions.session_id IS 'Унікальний ідентифікатор сесії (UUID)';
COMMENT ON COLUMN public.user_sessions.user_id IS 'Посилання на користувача';
COMMENT ON COLUMN public.user_sessions.created_at IS 'Час створення сесії';
COMMENT ON COLUMN public.user_sessions.expires_at IS 'Час закінчення сесії';
COMMENT ON COLUMN public.user_sessions.ip_address IS 'IP адреса користувача';
COMMENT ON COLUMN public.user_sessions.user_agent IS 'User Agent браузера';
COMMENT ON COLUMN public.user_sessions.active IS 'Активна сесія';
COMMENT ON COLUMN public.user_sessions.last_accessed_at IS 'Час останнього доступу';
COMMENT ON COLUMN public.user_sessions.created_by_user_id IS 'Хто створив сесію (для аудиту)';

-- Тестові дані для демонстрації
INSERT INTO public.user_sessions (
    session_id,
    user_id,
    expires_at,
    ip_address,
    user_agent,
    active,
    created_by_user_id
) VALUES 
    (
        'sess_' || gen_random_uuid()::text,
        1, -- admin user
        NOW() + INTERVAL '7 days',
        '192.168.1.100'::INET,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        TRUE,
        1
    ),
    (
        'sess_' || gen_random_uuid()::text,
        1, -- admin user  
        NOW() + INTERVAL '1 day',
        '192.168.1.101'::INET,
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        TRUE,
        1
    ),
    (
        'sess_' || gen_random_uuid()::text,
        1, -- admin user
        NOW() - INTERVAL '1 hour', -- expired session
        '192.168.1.102'::INET,
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        FALSE,
        1
    );

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE active = TRUE) as active_sessions,
    COUNT(*) FILTER (WHERE active = FALSE) as inactive_sessions,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_sessions,
    COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_sessions
FROM public.user_sessions;

-- Перевірка тестових даних
SELECT 
    id,
    session_id,
    user_id,
    created_at,
    expires_at,
    ip_address,
    active,
    CASE 
        WHEN expires_at > NOW() THEN 'Valid'
        ELSE 'Expired'
    END as status
FROM public.user_sessions
ORDER BY created_at DESC;

-- Перевірка foreign key зв'язків
SELECT 
    s.session_id,
    s.user_id,
    u.username,
    u.role,
    s.active,
    s.expires_at
FROM public.user_sessions s
JOIN public.users u ON s.user_id = u.id
ORDER BY s.created_at DESC;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'user_sessions' 
    AND schemaname = 'public'
ORDER BY indexname;