-- Investigation: Why 6 users weren't migrated?
-- Run this to understand what's happening with the unmigrated users

-- 1. Check total users vs users with onboarding_responses
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(DISTINCT user_id) FROM onboarding_responses) as users_with_onboarding_responses,
  (SELECT COUNT(*) FROM users WHERE motivation IS NOT NULL) as users_migrated_to_users_table;

-- 2. Find users who have onboarding_responses but weren't migrated
SELECT 
  u.id as user_id,
  u.email,
  o.id as onboarding_response_id,
  o.created_at as onboarding_created_at,
  o.motivation,
  o.completed_at,
  u.motivation as user_table_motivation,
  u.completed_at as user_table_completed_at
FROM users u
INNER JOIN onboarding_responses o ON u.id = o.user_id
LEFT JOIN LATERAL (
  SELECT *
  FROM onboarding_responses o2
  WHERE o2.user_id = u.id
  ORDER BY o2.created_at DESC
  LIMIT 1
) latest ON true
WHERE u.motivation IS NULL
  AND o.motivation IS NOT NULL
ORDER BY u.id;

-- 3. Check if there are any users in onboarding_responses that don't exist in users table
SELECT 
  o.user_id,
  COUNT(*) as onboarding_response_count
FROM onboarding_responses o
LEFT JOIN users u ON u.id = o.user_id
WHERE u.id IS NULL
GROUP BY o.user_id;

-- 4. Check the exact data that should have been migrated
SELECT 
  u.id,
  u.email,
  o.motivation,
  o.completed_at,
  o.emotional_state,
  o.financial_context
FROM users u
INNER JOIN (
  SELECT DISTINCT ON (user_id)
    user_id,
    motivation,
    completed_at,
    emotional_state,
    financial_context,
    created_at
  FROM onboarding_responses
  ORDER BY user_id, created_at DESC
) o ON u.id = o.user_id
WHERE u.motivation IS NULL
ORDER BY u.id;

-- 5. Check migration result: users with onboarding data in both tables
SELECT 
  u.id,
  u.email,
  u.motivation as users_table_motivation,
  u.completed_at as users_table_completed_at,
  o.motivation as onboarding_table_motivation,
  o.completed_at as onboarding_table_completed_at,
  CASE 
    WHEN u.motivation IS NULL AND o.motivation IS NOT NULL THEN 'NOT MIGRATED'
    WHEN u.motivation IS NOT NULL THEN 'MIGRATED'
    ELSE 'NO DATA TO MIGRATE'
  END as migration_status
FROM users u
LEFT JOIN (
  SELECT DISTINCT ON (user_id)
    user_id,
    motivation,
    completed_at,
    created_at
  FROM onboarding_responses
  ORDER BY user_id, created_at DESC
) o ON u.id = o.user_id
WHERE o.user_id IS NOT NULL
ORDER BY u.id;

