-- Verification Script: Merge Onboarding Migration & Single Source of Truth
-- Run this AFTER the migration to verify everything is correct

-- ============================================================================
-- PART 1: Verify Migration Completed Successfully
-- ============================================================================

-- 1.1 Check that columns exist in users table
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN (
    'emotional_state', 'financial_context', 'motivation', 'motivation_other',
    'acquisition_source', 'acquisition_other', 'insight_preferences', 'insight_other',
    'last_step', 'completed_at', 'updated_at', 'is_active', 'email_validated'
  )
ORDER BY column_name;

-- 1.2 Check that data was migrated (compare counts)
SELECT 
  (SELECT COUNT(*) FROM users WHERE motivation IS NOT NULL) as users_with_motivation,
  (SELECT COUNT(DISTINCT user_id) FROM onboarding_responses) as onboarding_responses_count,
  (SELECT COUNT(*) FROM users WHERE completed_at IS NOT NULL) as users_completed_onboarding;

-- 1.3 Verify indexes were created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'users'
  AND indexname LIKE 'idx_users_%'
ORDER BY indexname;

-- ============================================================================
-- PART 2: Verify Single Source of Truth (READ-only analytics)
-- ============================================================================

-- 2.1 Verify users table is the canonical source for user data
-- This query should return users with onboarding data
SELECT 
  u.id,
  u.email,
  u.motivation,
  u.completed_at,
  u.is_active,
  u.email_validated
FROM users u
WHERE u.motivation IS NOT NULL
ORDER BY u.id
LIMIT 10;

-- 2.2 Verify transactions table structure (for analytics)
-- Check if upload_session_id exists (for statement upload tracking)
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'transactions'
  AND column_name IN ('user_id', 'upload_session_id', 'created_at')
ORDER BY column_name;

-- 2.3 Verify user_events table exists (for login/dashboard tracking)
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'user_events'
ORDER BY ordinal_position;

-- ============================================================================
-- PART 3: Verify Analytics Endpoints Are READ-only
-- ============================================================================
-- Note: This is verified in code (no INSERT/UPDATE/DELETE in analytics endpoints)
-- These queries show what data the endpoints should READ from:

-- 3.1 Customer Data endpoint should read from: users + l0_pii_users
SELECT 
  u.id,
  u.email,
  u.motivation,
  u.completed_at,
  p.first_name,
  p.last_name
FROM users u
LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
WHERE u.email != 'admin@canadianinsights.ca'
ORDER BY u.created_at DESC
LIMIT 5;

-- 3.2 Cohort Analysis should read from: users (for signup week, onboarding)
SELECT 
  DATE_TRUNC('week', u.created_at) as signup_week,
  COUNT(*) as total_users,
  COUNT(u.completed_at) as completed_onboarding
FROM users u
WHERE u.email != 'admin@canadianinsights.ca'
GROUP BY DATE_TRUNC('week', u.created_at)
ORDER BY signup_week DESC
LIMIT 12;

-- 3.3 Vanity Metrics should read from: users + transactions + user_events
SELECT 
  DATE_TRUNC('month', u.created_at) as month,
  COUNT(*) as new_users
FROM users u
WHERE u.email != 'admin@canadianinsights.ca'
GROUP BY DATE_TRUNC('month', u.created_at)
ORDER BY month DESC
LIMIT 12;

-- ============================================================================
-- PART 4: Expected Write Operations (These are OK)
-- ============================================================================
-- These tables/operations SHOULD have write operations:
-- - users.is_active (when admin blocks/unblocks user)
-- - user_events (when logging login/dashboard access)
-- - transactions (when user uploads statements)
-- - l0_pii_users (when storing/updating PII)

-- Verify write operations are only on these tables (not on analytics views)

