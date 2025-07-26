-- 🏗️ Створення таблиці production_settings в Supabase
-- Етап 6, Крок 13: Планування виробництва - налаштування
-- Залежності: Немає (singleton таблиця)

-- Видалити таблицю, якщо вона існує (для повторного запуску)
DROP TABLE IF EXISTS public.production_settings CASCADE;

-- Створення таблиці production_settings
CREATE TABLE public.production_settings (
    id BIGSERIAL PRIMARY KEY,
    daily_capacity INTEGER DEFAULT 500,
    working_hours INTEGER DEFAULT 8,
    min_batch_size INTEGER DEFAULT 10,
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    settings_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Коментарі до таблиці та колонок
COMMENT ON TABLE public.production_settings IS 'Налаштування виробництва (singleton таблиця)';
COMMENT ON COLUMN public.production_settings.id IS 'Ідентифікатор (завжди 1)';
COMMENT ON COLUMN public.production_settings.daily_capacity IS 'Денна виробнича потужність (штук)';
COMMENT ON COLUMN public.production_settings.working_hours IS 'Робочих годин на день';
COMMENT ON COLUMN public.production_settings.min_batch_size IS 'Мінімальний розмір партії';
COMMENT ON COLUMN public.production_settings.cost_per_unit IS 'Собівартість за одиницю';
COMMENT ON COLUMN public.production_settings.settings_json IS 'Додаткові налаштування в JSON';

-- Тригер для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_production_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_production_settings_updated_at
    BEFORE UPDATE ON public.production_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_production_settings_updated_at();

-- Вставка дефолтних налаштувань (singleton)
INSERT INTO public.production_settings (
    id, 
    daily_capacity, 
    working_hours, 
    min_batch_size,
    cost_per_unit,
    settings_json
) VALUES (
    1, 
    500, 
    8, 
    10,
    25.50,
    '{"shift_start": "08:00", "shift_end": "16:00", "break_time": 60, "quality_check": true}'::jsonb
);

-- Забезпечити що може бути тільки один запис (constraint)
CREATE UNIQUE INDEX idx_production_settings_singleton 
ON public.production_settings ((id = 1)) 
WHERE id = 1;

-- Перевірка створеної таблиці
SELECT 
    id,
    daily_capacity,
    working_hours,
    min_batch_size,
    cost_per_unit,
    settings_json,
    updated_at
FROM public.production_settings;

-- Перевірка JSONB налаштувань
SELECT 
    id,
    settings_json,
    settings_json->>'shift_start' as shift_start,
    settings_json->>'quality_check' as quality_check,
    jsonb_pretty(settings_json) as formatted_settings
FROM public.production_settings;

-- Тест оновлення (автоматичне оновлення updated_at)
UPDATE public.production_settings 
SET daily_capacity = 600 
WHERE id = 1;

-- Перевірка що updated_at оновився
SELECT id, daily_capacity, updated_at FROM public.production_settings;