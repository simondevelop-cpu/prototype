-- ============================================================================
-- DATA MIGRATION: Migrate existing data to L0/L1/L2 structure
-- ============================================================================
-- This script migrates data from existing tables to the new layered architecture.
-- Run this AFTER creating the schema (create-l0-l1-l2-schema.sql)
-- ============================================================================

BEGIN;

-- Step 1: Generate tokenized user IDs for all existing users
INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id)
SELECT 
  id as internal_user_id,
  generate_tokenized_user_id(id) as tokenized_user_id
FROM users
ON CONFLICT (internal_user_id) DO NOTHING;

-- Step 2: Migrate PII from onboarding_responses to l0_pii_users
INSERT INTO l0_pii_users (
  internal_user_id,
  email,
  first_name,
  last_name,
  date_of_birth,
  recovery_phone,
  province_region
)
SELECT DISTINCT ON (u.id)
  u.id as internal_user_id,
  u.email,
  o.first_name,
  o.last_name,
  o.date_of_birth,
  o.recovery_phone,
  o.province_region
FROM users u
LEFT JOIN onboarding_responses o ON u.id = o.user_id
ON CONFLICT (internal_user_id) DO UPDATE
SET
  first_name = COALESCE(EXCLUDED.first_name, l0_pii_users.first_name),
  last_name = COALESCE(EXCLUDED.last_name, l0_pii_users.last_name),
  date_of_birth = COALESCE(EXCLUDED.date_of_birth, l0_pii_users.date_of_birth),
  recovery_phone = COALESCE(EXCLUDED.recovery_phone, l0_pii_users.recovery_phone),
  province_region = COALESCE(EXCLUDED.province_region, l0_pii_users.province_region),
  updated_at = CURRENT_TIMESTAMP;

-- For users without onboarding data, create PII records with email only
INSERT INTO l0_pii_users (
  internal_user_id,
  email
)
SELECT 
  u.id,
  u.email
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM l0_pii_users p WHERE p.internal_user_id = u.id
)
ON CONFLICT (internal_user_id) DO NOTHING;

-- Step 3: Migrate transactions to l1_transaction_facts (with tokenized user IDs)
INSERT INTO l1_transaction_facts (
  tokenized_user_id,
  transaction_date,
  description,
  merchant,
  amount,
  cashflow,
  account,
  category,
  label,
  created_at,
  legacy_transaction_id
)
SELECT 
  ut.tokenized_user_id,
  t.date as transaction_date,
  t.description,
  t.merchant,
  t.amount,
  t.cashflow,
  t.account,
  t.category,
  COALESCE(t.label, ''),
  t.created_at,
  t.id as legacy_transaction_id
FROM transactions t
JOIN l0_user_tokenization ut ON t.user_id = ut.internal_user_id
ON CONFLICT DO NOTHING;

-- Step 4: Populate l1_customer_facts from existing data
INSERT INTO l1_customer_facts (
  tokenized_user_id,
  province_region,
  account_status,
  account_created_at,
  onboarding_completed,
  total_transactions,
  total_imports,
  last_active_at
)
SELECT 
  ut.tokenized_user_id,
  p.province_region,
  'active' as account_status,
  u.created_at as account_created_at,
  CASE WHEN o.id IS NOT NULL AND o.completed_at IS NOT NULL THEN TRUE ELSE FALSE END as onboarding_completed,
  COALESCE(tx_counts.tx_count, 0) as total_transactions,
  0 as total_imports, -- TODO: Count from file_ingestion once migrated
  GREATEST(
    u.created_at,
    COALESCE(MAX(t.created_at), u.created_at),
    COALESCE(o.updated_at, u.created_at)
  ) as last_active_at
FROM l0_user_tokenization ut
JOIN users u ON ut.internal_user_id = u.id
LEFT JOIN l0_pii_users p ON p.internal_user_id = u.id
LEFT JOIN onboarding_responses o ON o.user_id = u.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) as tx_count, MAX(created_at) as last_tx_at
  FROM transactions
  WHERE user_id = u.id
) tx_counts ON true
LEFT JOIN transactions t ON t.user_id = u.id
GROUP BY 
  ut.tokenized_user_id,
  p.province_region,
  u.created_at,
  o.id,
  o.completed_at,
  o.updated_at,
  tx_counts.tx_count
ON CONFLICT (tokenized_user_id) DO UPDATE
SET
  onboarding_completed = EXCLUDED.onboarding_completed,
  total_transactions = EXCLUDED.total_transactions,
  last_active_at = EXCLUDED.last_active_at,
  updated_at = CURRENT_TIMESTAMP;

-- Step 5: Create event_facts records from existing user activity
-- Login events (if we have login timestamps - placeholder)
-- Import events (if tracked - placeholder)
-- Note: This is a placeholder - actual events should be tracked going forward

-- Step 6: Migrate category metadata from admin_keywords to l0_category_list
INSERT INTO l0_category_list (category_key, display_name, is_active)
SELECT DISTINCT
  category as category_key,
  category as display_name,
  TRUE as is_active
FROM admin_keywords
WHERE is_active = TRUE
ON CONFLICT (category_key) DO NOTHING;

-- Step 7: Seed default insights (placeholder)
INSERT INTO l0_insight_list (insight_key, insight_name, description, is_active)
VALUES 
  ('spending_spike', 'Spending Spike Alert', 'Alerts when spending increases significantly', TRUE),
  ('low_balance', 'Low Balance Warning', 'Warns when account balance is low', TRUE),
  ('unusual_transaction', 'Unusual Transaction Detection', 'Flags unusual spending patterns', TRUE)
ON CONFLICT (insight_key) DO NOTHING;

COMMIT;

-- Verification queries (run separately to check migration)
-- SELECT COUNT(*) as total_users FROM l0_user_tokenization;
-- SELECT COUNT(*) as total_transactions FROM l1_transaction_facts;
-- SELECT COUNT(*) as total_customers FROM l1_customer_facts;
-- SELECT COUNT(*) as pii_records FROM l0_pii_users;

