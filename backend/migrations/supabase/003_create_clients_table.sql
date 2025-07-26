-- 🏗️ Створення таблиці clients в Supabase
-- Етап 1, Крок 2: Базова довідникова таблиця клієнтів
-- Залежності: Немає

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.clients CASCADE;

-- Створення таблиці clients
CREATE TABLE public.clients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX idx_clients_name ON public.clients(name);
CREATE INDEX idx_clients_active ON public.clients(is_active);
CREATE INDEX idx_clients_contact ON public.clients(contact_person);
CREATE INDEX idx_clients_phone ON public.clients(phone);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.clients IS 'Каталог клієнтів та замовників';
COMMENT ON COLUMN public.clients.id IS 'Унікальний ідентифікатор клієнта';
COMMENT ON COLUMN public.clients.name IS 'Назва клієнта/організації';
COMMENT ON COLUMN public.clients.contact_person IS 'Контактна особа';
COMMENT ON COLUMN public.clients.phone IS 'Телефон для звязку';
COMMENT ON COLUMN public.clients.email IS 'Електронна пошта';
COMMENT ON COLUMN public.clients.address IS 'Адреса клієнта';
COMMENT ON COLUMN public.clients.notes IS 'Додаткові примітки';
COMMENT ON COLUMN public.clients.is_active IS 'Активний клієнт (soft delete)';

-- Тестові дані
INSERT INTO public.clients (
    name, 
    contact_person, 
    phone, 
    email, 
    address, 
    notes,
    is_active
) VALUES 
    ('ТОВ "Смачні піци"', 'Іван Петренко', '+380501234567', 'ivan@smachni-pici.ua', 'м. Київ, вул. Хрещатик, 1', 'Постійний клієнт', TRUE),
    ('Ресторан "Італьяно"', 'Марія Іваненко', '+380671234567', 'maria@italiano.com.ua', 'м. Львів, вул. Ринок, 15', 'Замовлення по вихідних', TRUE),
    ('Кафе "Corner"', 'Олег Сидоренко', '+380931234567', 'oleg@corner-cafe.ua', 'м. Одеса, вул. Дерибасівська, 20', NULL, TRUE),
    ('Піцерія "Napoli"', 'Анна Коваленко', '+380501234568', 'anna@napoli.ua', 'м. Харків, пр. Науки, 45', 'Великі замовлення', TRUE),
    ('Тестовий клієнт (неактивний)', 'Тест Тестович', '+380000000000', 'test@test.ua', 'Тестова адреса', 'Тестовий запис', FALSE);

-- Перевірка створеної таблиці
SELECT 
    COUNT(*) as total_clients,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_clients,
    COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_clients
FROM public.clients;

-- Перевірка тестових даних
SELECT 
    id,
    name,
    contact_person,
    phone,
    is_active,
    created_at
FROM public.clients
ORDER BY created_at;

-- Перевірка індексів
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'clients' 
    AND schemaname = 'public'
ORDER BY indexname;