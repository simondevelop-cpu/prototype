-- ============================================================================
-- ADD SESSION_ID TO l1_events TABLE
-- ============================================================================
-- This migration adds session_id column to l1_events for tracking user sessions
-- A session is defined as a period of user activity, typically from login to logout
-- or a 30-minute inactivity timeout

BEGIN;

-- Add session_id column to l1_events
ALTER TABLE l1_events 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Create index for session queries
CREATE INDEX IF NOT EXISTS idx_l1_events_session_id 
ON l1_events(session_id) 
WHERE session_id IS NOT NULL;

COMMIT;

