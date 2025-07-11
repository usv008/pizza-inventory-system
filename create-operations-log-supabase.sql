-- create-operations-log-supabase.sql
-- Міграція для створення таблиці логування операцій в Supabase PostgreSQL

-- Створюємо таблицю для логування всіх операцій
CREATE TABLE IF NOT EXISTS public.operations_log (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL,         -- 'CREATE_ORDER', 'UPDATE_ORDER', 'PRODUCTION', 'WRITEOFF', 'ARRIVAL', etc.
    entity_type TEXT NOT NULL,            -- 'PRODUCT', 'ORDER', 'BATCH', 'WRITEOFF', etc.
    entity_id BIGINT,                     -- ID сутності на яку впливає операція
    user_id BIGINT NULL,                  -- ID користувача (якщо є система авторизації)
    details JSONB,                        -- Деталі операції у JSON форматі
    ip_address INET,                      -- IP адреса користувача
    user_agent TEXT,                      -- Browser info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Зовнішні ключі
    CONSTRAINT fk_operations_log_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Створюємо індекси для оптимізації пошуку
CREATE INDEX IF NOT EXISTS idx_operations_log_type ON public.operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_log_entity ON public.operations_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_operations_log_date ON public.operations_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_log_user ON public.operations_log(user_id);

-- Налаштовуємо Row Level Security (якщо потрібно)
ALTER TABLE public.operations_log ENABLE ROW LEVEL SECURITY;

-- Політика доступу: всі можуть читати, тільки авторизовані можуть писати
CREATE POLICY "operations_log_read" ON public.operations_log FOR SELECT USING (true);
CREATE POLICY "operations_log_insert" ON public.operations_log FOR INSERT WITH CHECK (true);

-- Додаємо коментарі для документації
COMMENT ON TABLE public.operations_log IS 'Лог всіх операцій в системі для аудиту та відстеження змін';
COMMENT ON COLUMN public.operations_log.operation_type IS 'Тип операції: WRITEOFF, PRODUCTION, CREATE_ORDER, etc.';
COMMENT ON COLUMN public.operations_log.entity_type IS 'Тип сутності: PRODUCT, ORDER, BATCH, etc.';
COMMENT ON COLUMN public.operations_log.entity_id IS 'ID сутності на яку впливає операція';
COMMENT ON COLUMN public.operations_log.details IS 'Деталі операції у JSON форматі';

-- Додаємо тестові записи
INSERT INTO public.operations_log (operation_type, entity_type, entity_id, details, created_at)
VALUES 
    ('WRITEOFF', 'PRODUCT', 39, '{"quantity": 5, "reason": "Тестове списання", "batch_id": 10}', NOW() - INTERVAL '5 minutes'),
    ('PRODUCTION', 'PRODUCT', 39, '{"quantity": 100, "batch_date": "2025-01-19", "batch_id": 10}', NOW() - INTERVAL '1 hour'),
    ('SYSTEM_TEST', 'SYSTEM', NULL, '{"message": "Тестування системи логування"}', NOW());

SELECT 'operations_log table created successfully' as result; 