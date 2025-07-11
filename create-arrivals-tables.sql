-- Створення таблиць arrivals та arrivals_items для Supabase PostgreSQL

-- Таблиця arrivals (документи приходу)
CREATE TABLE IF NOT EXISTS arrivals (
    id BIGSERIAL PRIMARY KEY,
    arrival_number TEXT UNIQUE NOT NULL,
    arrival_date DATE NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблиця arrivals_items (позиції документів приходу)
CREATE TABLE IF NOT EXISTS arrivals_items (
    id BIGSERIAL PRIMARY KEY,
    arrival_id BIGINT NOT NULL REFERENCES arrivals(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    batch_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Створення індексів для оптимізації
CREATE INDEX IF NOT EXISTS idx_arrivals_date ON arrivals(arrival_date);
CREATE INDEX IF NOT EXISTS idx_arrivals_created_by ON arrivals(created_by);
CREATE INDEX IF NOT EXISTS idx_arrivals_items_arrival_id ON arrivals_items(arrival_id);
CREATE INDEX IF NOT EXISTS idx_arrivals_items_product_id ON arrivals_items(product_id);
CREATE INDEX IF NOT EXISTS idx_arrivals_items_batch_date ON arrivals_items(batch_date);

-- Коментарі до таблиць
COMMENT ON TABLE arrivals IS 'Документи приходу товарів на склад';
COMMENT ON TABLE arrivals_items IS 'Позиції в документах приходу товарів';

-- Перевірка створених таблиць
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('arrivals', 'arrivals_items')
ORDER BY table_name, ordinal_position; 