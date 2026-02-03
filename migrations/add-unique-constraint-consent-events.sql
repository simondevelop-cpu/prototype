-- ============================================================================
-- ADD UNIQUE CONSTRAINT TO PREVENT DUPLICATE CONSENT EVENTS
-- ============================================================================
-- This migration adds a unique constraint to prevent duplicate consent entries
-- for the same user and consent type, fixing the race condition issue.
-- ============================================================================

BEGIN;

-- Create a unique index on (user_id, event_type, metadata->>'consentType')
-- This prevents duplicate consent events for the same user and consent type
CREATE UNIQUE INDEX IF NOT EXISTS idx_l1_events_unique_consent 
ON l1_events (user_id, event_type, ((metadata->>'consentType')))
WHERE event_type = 'consent';

COMMIT;

