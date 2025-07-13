-- Додавання поля sess до таблиці user_sessions для Express Sessions
-- Виконати через Supabase Dashboard -> SQL Editor

-- 1. Додати поле sess для зберігання session data
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sess JSONB;

-- 2. Створити індекси для оптимізації
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- 3. Додати коментарі для документації
COMMENT ON COLUMN user_sessions.sess IS 'Express session data stored as JSONB';
COMMENT ON INDEX idx_user_sessions_expires IS 'Index for efficient session cleanup by expiration date';
COMMENT ON INDEX idx_user_sessions_active IS 'Index for filtering active sessions';
COMMENT ON INDEX idx_user_sessions_user_id IS 'Index for user-specific session queries';

-- 4. Перевірка структури таблиці
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_sessions' 
ORDER BY ordinal_position; 