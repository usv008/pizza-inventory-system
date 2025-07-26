-- HTTP Sessions table for express-session
-- This replaces SQLite sessions with Supabase sessions
-- Execute this in Supabase Dashboard > SQL Editor

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

-- Comments
COMMENT ON TABLE http_sessions IS 'HTTP sessions for express-session middleware';
COMMENT ON COLUMN http_sessions.session_id IS 'Express session ID';
COMMENT ON COLUMN http_sessions.session_data IS 'Serialized session data (JSON)';
COMMENT ON COLUMN http_sessions.expires_at IS 'Session expiration timestamp';

-- Test insert to verify table structure
INSERT INTO http_sessions (session_id, session_data, expires_at) 
VALUES ('test-session', '{"test": true}', NOW() + INTERVAL '1 hour')
ON CONFLICT (session_id) DO NOTHING;

-- Cleanup test data
DELETE FROM http_sessions WHERE session_id = 'test-session';