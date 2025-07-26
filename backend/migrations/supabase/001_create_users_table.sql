-- 🏗️ Створення таблиці users в Supabase
-- Етап 2, Крок 3: Система користувачів - базова таблиця
-- Залежності: Немає (self-referencing, має бути ПЕРШОЮ!)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.users CASCADE;

-- Створення таблиці users
CREATE TABLE public.users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'ПАКУВАЛЬНИК',
    permissions JSONB DEFAULT '{}'::jsonb,
    first_login BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_by BIGINT REFERENCES public.users(id), -- Self-referencing FK
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_active ON public.users(active);
CREATE INDEX idx_users_created_by ON public.users(created_by);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.users IS 'Користувачі системи з ролями та дозволами';
COMMENT ON COLUMN public.users.id IS 'Унікальний ідентифікатор користувача';
COMMENT ON COLUMN public.users.username IS 'Унікальне імя користувача';
COMMENT ON COLUMN public.users.email IS 'Електронна пошта (унікальна)';
COMMENT ON COLUMN public.users.phone IS 'Номер телефону';
COMMENT ON COLUMN public.users.password_hash IS 'Хеш пароля (bcrypt)';
COMMENT ON COLUMN public.users.role IS 'Роль: ДИРЕКТОР, МЕНЕДЖЕР, ПАКУВАЛЬНИК, тощо';
COMMENT ON COLUMN public.users.permissions IS 'JSON з додатковими дозволами';
COMMENT ON COLUMN public.users.first_login IS 'Чи перший раз логіниться (для зміни пароля)';
COMMENT ON COLUMN public.users.active IS 'Активний користувач (soft delete)';
COMMENT ON COLUMN public.users.created_by IS 'Хто створив цього користувача';

-- Тригер для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Створення адміністратора (ID=1, без created_by для вирішення self-reference)
INSERT INTO public.users (
    id, 
    username, 
    password_hash, 
    role, 
    permissions, 
    first_login, 
    active,
    created_by  -- NULL для першого користувача
) VALUES (
    1, 
    'admin', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: "password"
    'ДИРЕКТОР', 
    '{"all": true}'::jsonb, 
    FALSE, 
    TRUE,
    NULL
);

-- Тестові користувачі (створені адміністратором)
INSERT INTO public.users (
    username,
    email,
    phone,
    password_hash,
    role,
    permissions,
    first_login,
    active,
    created_by
) VALUES 
    ('manager1', 'manager@pizza.com', '+380501111111', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'МЕНЕДЖЕР', '{"orders": true, "clients": true}'::jsonb, TRUE, TRUE, 1),
    ('packer1', 'packer1@pizza.com', '+380502222222', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ПАКУВАЛЬНИК', '{"products": "read"}'::jsonb, TRUE, TRUE, 1),
    ('packer2', 'packer2@pizza.com', '+380503333333', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ПАКУВАЛЬНИК', '{"products": "read"}'::jsonb, TRUE, TRUE, 1),
    ('inactive_user', 'inactive@pizza.com', NULL, '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ПАКУВАЛЬНИК', '{}'::jsonb, FALSE, FALSE, 1);

-- Забезпечити що sequence почне з правильного значення
SELECT setval('public.users_id_seq', (SELECT MAX(id) FROM public.users));

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE active = TRUE) as active_users,
    COUNT(*) FILTER (WHERE active = FALSE) as inactive_users,
    COUNT(*) FILTER (WHERE first_login = TRUE) as need_password_change
FROM public.users;

-- Перевірка ролей та користувачів
SELECT 
    id,
    username,
    email,
    role,
    permissions,
    first_login,
    active,
    created_by,
    created_at
FROM public.users
ORDER BY id;

-- Перевірка self-referencing FK
SELECT 
    u.username as user,
    creator.username as created_by_user,
    u.role,
    u.active
FROM public.users u
LEFT JOIN public.users creator ON u.created_by = creator.id
ORDER BY u.id;

-- Перевірка JSONB permissions
SELECT 
    username,
    role,
    permissions,
    jsonb_pretty(permissions) as permissions_formatted
FROM public.users
WHERE permissions != '{}'::jsonb
ORDER BY id;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users' 
    AND schemaname = 'public'
ORDER BY indexname;