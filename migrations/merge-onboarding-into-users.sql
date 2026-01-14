-- Migration: Merge onboarding_responses into users table
-- Date: January 14, 2026
-- Purpose: Merge non-PII onboarding columns from onboarding_responses into users table
--          Maintaining PII isolation in l0_pii_users

-- ============================================================================
-- STEP 1: Add onboarding columns to users table
-- ============================================================================

-- Add onboarding questionnaire columns (non-PII)
ALTER TABLE users ADD COLUMN IF NOT EXISTS emotional_state TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS financial_context TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation_other TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_other TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS insight_preferences TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS insight_other TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add additional columns needed for Admin Dashboard
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_validated BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- STEP 2: Create indexes for filtering/analytics
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_motivation ON users(motivation);
CREATE INDEX IF NOT EXISTS idx_users_completed_at ON users(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_validated ON users(email_validated);
CREATE INDEX IF NOT EXISTS idx_users_last_step ON users(last_step);

-- ============================================================================
-- STEP 3: Migrate data from onboarding_responses to users
-- ============================================================================

-- Migrate data from onboarding_responses to users
-- Use the most recent onboarding response per user (if multiple exist)
UPDATE users u
SET 
  emotional_state = o.emotional_state,
  financial_context = o.financial_context,
  motivation = o.motivation,
  motivation_other = o.motivation_other,
  acquisition_source = o.acquisition_source,
  acquisition_other = o.acquisition_other,
  insight_preferences = o.insight_preferences,
  insight_other = o.insight_other,
  last_step = COALESCE(o.last_step, 0),
  completed_at = o.completed_at,
  updated_at = COALESCE(o.updated_at, o.created_at, NOW())
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    emotional_state,
    financial_context,
    motivation,
    motivation_other,
    acquisition_source,
    acquisition_other,
    insight_preferences,
    insight_other,
    last_step,
    completed_at,
    updated_at,
    created_at
  FROM onboarding_responses
  ORDER BY user_id, created_at DESC
) o
WHERE u.id = o.user_id
  AND EXISTS (
    SELECT 1 FROM onboarding_responses o2 
    WHERE o2.user_id = u.id
  );

-- ============================================================================
-- STEP 4: Verification queries (run these to verify migration)
-- ============================================================================

-- Check that all users with onboarding_responses have been migrated
-- SELECT 
--   u.id,
--   u.email,
--   u.motivation,
--   u.completed_at,
--   COUNT(o.id) as onboarding_response_count
-- FROM users u
-- LEFT JOIN onboarding_responses o ON u.id = o.user_id
-- GROUP BY u.id, u.email, u.motivation, u.completed_at
-- ORDER BY u.id;

-- Check data integrity
-- SELECT 
--   COUNT(*) as total_users,
--   COUNT(motivation) as users_with_motivation,
--   COUNT(completed_at) as users_with_completed_at,
--   COUNT(last_step) as users_with_last_step
-- FROM users;

