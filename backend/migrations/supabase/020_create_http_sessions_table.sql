-- HTTP Sessions table for express-session middleware
-- Replaces SQLite sessions with Supabase PostgreSQL storage
-- Created: 2025-07-26

CREATE TABLE IF NOT EXISTS http_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    session_data TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_http_sessions_session_id ON http_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_http_sessions_expires_at ON http_sessions(expires_at);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_http_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_http_sessions_updated_at 
    BEFORE UPDATE ON http_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_http_sessions_updated_at();

-- RLS (Row Level Security) - Allow all operations for now
ALTER TABLE http_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (sessions are managed by backend)
CREATE POLICY "Allow all operations on http_sessions" ON http_sessions
    FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE http_sessions IS 'Express.js HTTP sessions storage for Pizza System';
COMMENT ON COLUMN http_sessions.id IS 'Auto-increment primary key';
COMMENT ON COLUMN http_sessions.session_id IS 'Express session ID (unique)';
COMMENT ON COLUMN http_sessions.session_data IS 'Serialized session data (JSON string)';
COMMENT ON COLUMN http_sessions.expires_at IS 'Session expiration timestamp';
COMMENT ON COLUMN http_sessions.created_at IS 'Session creation timestamp';
COMMENT ON COLUMN http_sessions.updated_at IS 'Last session update timestamp';

-- Test insert to verify table structure
INSERT INTO http_sessions (session_id, session_data, expires_at) 
VALUES ('test-migration-session', '{"test": true, "migration": "supabase"}', NOW() + INTERVAL '1 hour')
ON CONFLICT (session_id) DO NOTHING;

-- Cleanup test data
DELETE FROM http_sessions WHERE session_id = 'test-migration-session';