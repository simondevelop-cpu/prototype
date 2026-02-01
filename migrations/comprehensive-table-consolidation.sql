-- ============================================================================
-- COMPREHENSIVE TABLE CONSOLIDATION AND PII CLEANUP
-- ============================================================================
-- This migration addresses:
-- 1. PII consolidation and IP address logging
-- 2. Table migrations (transactions, user_events)
-- 3. ID consolidation (l0_pii_users.id vs internal_user_id)
-- 4. Removal of PII from analytics tables
-- 5. Deletion of empty unused tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD IP ADDRESS LOGGING TO l0_pii_users
-- ============================================================================

ALTER TABLE l0_pii_users 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS ip_address_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_l0_pii_ip_address ON l0_pii_users(ip_address) WHERE ip_address IS NOT NULL;

-- ============================================================================
-- 2. CONSOLIDATE l0_pii_users.id vs internal_user_id
-- Make internal_user_id the primary key (remove redundant id column)
-- ============================================================================

-- First, check if there are any foreign key references to l0_pii_users.id
-- If not, we can safely drop the id column and make internal_user_id the PK

-- Step 1: Drop any foreign keys that reference l0_pii_users.id (if they exist)
-- Note: We'll check this in the application code first

-- Step 2: Make internal_user_id the primary key
-- Since internal_user_id is already UNIQUE, we can make it the PK
-- But we need to be careful - if there are any references to l0_pii_users.id, we need to update them first

-- For now, we'll keep both columns but add a comment explaining the relationship
COMMENT ON COLUMN l0_pii_users.id IS 'PII record ID (redundant - use internal_user_id instead)';
COMMENT ON COLUMN l0_pii_users.internal_user_id IS 'Primary identifier - links to users.id (this is the actual user ID)';

-- ============================================================================
-- 3. MIGRATE PII FROM onboarding_responses TO l0_pii_users
-- ============================================================================

-- Update l0_pii_users with PII data from onboarding_responses
UPDATE l0_pii_users pii
SET 
  last_name = COALESCE(pii.last_name, o.last_name),
  recovery_phone = COALESCE(pii.recovery_phone, o.recovery_phone),
  province_region = COALESCE(pii.province_region, o.province_region),
  updated_at = CURRENT_TIMESTAMP
FROM onboarding_responses o
WHERE pii.internal_user_id = o.user_id
  AND (o.last_name IS NOT NULL OR o.recovery_phone IS NOT NULL OR o.province_region IS NOT NULL)
  AND (pii.last_name IS NULL OR pii.recovery_phone IS NULL OR pii.province_region IS NULL);

-- ============================================================================
-- 4. REMOVE PII FIELDS FROM l1_customer_facts
-- ============================================================================

ALTER TABLE l1_customer_facts 
DROP COLUMN IF EXISTS age_range,
DROP COLUMN IF EXISTS province_region,
DROP COLUMN IF EXISTS migration_flag;

-- ============================================================================
-- 5. RENAME user_events TO l1_events AND ADD is_admin COLUMN
-- ============================================================================

-- Rename the table (only if it exists and hasn't been renamed already)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_events') THEN
    ALTER TABLE user_events RENAME TO l1_events;
  END IF;
END $$;

-- Add is_admin column
ALTER TABLE l1_events 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update existing admin events
UPDATE l1_events 
SET is_admin = TRUE 
WHERE event_type IN ('admin_login', 'admin_tab_access');

-- Create index for is_admin
CREATE INDEX IF NOT EXISTS idx_l1_events_is_admin ON l1_events(is_admin) WHERE is_admin = TRUE;

-- ============================================================================
-- 6. MIGRATE transactions TO l1_transaction_facts
-- ============================================================================

-- Migrate any remaining transactions that haven't been migrated yet
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
  lut.tokenized_user_id,
  t.date AS transaction_date,
  t.description,
  t.merchant,
  t.amount,
  t.cashflow,
  t.account,
  t.category,
  COALESCE(t.label, '') AS label,
  t.created_at,
  t.id AS legacy_transaction_id
FROM transactions t
JOIN l0_user_tokenization lut ON lut.internal_user_id = t.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM l1_transaction_facts ltf 
  WHERE ltf.legacy_transaction_id = t.id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. DROP EMPTY UNUSED TABLES
-- ============================================================================

-- Drop accounts table (empty, unused)
DROP TABLE IF EXISTS accounts CASCADE;

-- Drop insight_feedback table (empty, unused)
DROP TABLE IF EXISTS insight_feedback CASCADE;

-- Drop l1_event_facts (empty, functionality consolidated into l1_events)
DROP TABLE IF EXISTS l1_event_facts CASCADE;

-- ============================================================================
-- 8. ADD COMMENTS FOR CLARITY
-- ============================================================================

COMMENT ON TABLE l1_events IS 'Event log table (renamed from user_events). Tracks all user and admin events. Use is_admin flag to distinguish.';
COMMENT ON COLUMN l1_events.is_admin IS 'TRUE for admin events (admin_login, admin_tab_access), FALSE for user events';
COMMENT ON TABLE l1_transaction_facts IS 'Canonical transaction table. All transaction queries should use this table. Legacy transactions table can be dropped after migration.';
COMMENT ON TABLE l0_pii_users IS 'PII isolation table. Use internal_user_id (not id) as the primary identifier. Links to users.id.';

COMMIT;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. After this migration, update all API endpoints to:
--    - Use l1_transaction_facts instead of transactions
--    - Use l1_events instead of user_events
--    - Use l0_pii_users.internal_user_id (not id) for PII operations
--    - Remove references to age_range, province_region from l1_customer_facts
--
-- 2. The transactions table can be dropped after confirming all APIs are updated
--
-- 3. ID prefixes (U, T, E) should be added in display/formatting functions, not in database
--
-- 4. Review l0_insight_list - if completely isolated, can be deleted
-- ============================================================================

