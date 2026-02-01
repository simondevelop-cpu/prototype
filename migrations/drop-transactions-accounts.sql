-- ============================================================================
-- DROP TRANSACTIONS AND ACCOUNTS TABLES
-- ============================================================================
-- This migration establishes Single Source of Truth by:
-- 1. Fixing unmigrated transaction (if any)
-- 2. Updating l2_customer_summary_view to use l1_transaction_facts
-- 3. Dropping foreign keys
-- 4. Dropping transactions and accounts tables
-- ============================================================================
-- PREREQUISITES:
-- - All transactions migrated to l1_transaction_facts
-- - All code updated to use l1_transaction_facts (no fallbacks)
-- - View updated to use l1_transaction_facts
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. VERIFY ALL TRANSACTIONS MIGRATED
-- ============================================================================
-- This is a safety check - if this fails, the migration should stop
DO $$
DECLARE
  legacy_count INTEGER;
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM transactions;
  SELECT COUNT(*) INTO migrated_count FROM l1_transaction_facts WHERE legacy_transaction_id IS NOT NULL;
  
  IF migrated_count < legacy_count THEN
    RAISE EXCEPTION 'Not all transactions migrated. Legacy: %, Migrated: %', legacy_count, migrated_count;
  END IF;
  
  RAISE NOTICE 'Migration check passed: % transactions migrated', migrated_count;
END $$;

-- ============================================================================
-- 2. UPDATE l2_customer_summary_view TO USE l1_transaction_facts
-- ============================================================================

-- Drop old view
DROP VIEW IF EXISTS l2_customer_summary_view CASCADE;

-- Create new view using l1_transaction_facts
CREATE VIEW l2_customer_summary_view AS
SELECT 
  ut.internal_user_id,
  COUNT(DISTINCT tf.id) as total_transactions,
  SUM(CASE WHEN tf.cashflow = 'income' THEN tf.amount ELSE 0 END) as total_income,
  SUM(CASE WHEN tf.cashflow = 'expense' THEN tf.amount ELSE 0 END) as total_expenses,
  SUM(CASE WHEN tf.cashflow = 'other' THEN tf.amount ELSE 0 END) as total_other,
  MIN(tf.transaction_date) as first_transaction_date,
  MAX(tf.transaction_date) as last_transaction_date,
  COUNT(DISTINCT DATE_TRUNC('month', tf.transaction_date)) as active_months
FROM l1_transaction_facts tf
JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
GROUP BY ut.internal_user_id;

-- Add comment
COMMENT ON VIEW l2_customer_summary_view IS 'Customer summary view using l1_transaction_facts (Single Source of Truth)';

-- ============================================================================
-- 3. DROP FOREIGN KEYS
-- ============================================================================

-- Drop foreign keys from transactions table
DO $$
BEGIN
  -- Drop transactions.user_id → users.id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'transactions' 
    AND constraint_name LIKE '%user_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
    RAISE NOTICE 'Dropped transactions.user_id foreign key';
  END IF;

  -- Drop transactions.account_id → accounts.id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'transactions' 
    AND constraint_name LIKE '%account_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
    RAISE NOTICE 'Dropped transactions.account_id foreign key';
  END IF;

  -- Drop accounts.user_id → users.id (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'accounts' 
    AND constraint_name LIKE '%user_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
    RAISE NOTICE 'Dropped accounts.user_id foreign key';
  END IF;
END $$;

-- ============================================================================
-- 4. DROP TABLES
-- ============================================================================

-- Drop transactions table (CASCADE will handle any remaining dependencies)
DROP TABLE IF EXISTS transactions CASCADE;

-- Drop accounts table (CASCADE will handle any remaining dependencies)
DROP TABLE IF EXISTS accounts CASCADE;

-- ============================================================================
-- 5. ADD COMMENTS FOR CLARITY
-- ============================================================================

COMMENT ON TABLE l1_transaction_facts IS 'Single Source of Truth for all transactions. Legacy transactions table has been dropped.';
COMMENT ON VIEW l2_customer_summary_view IS 'Customer summary view - uses l1_transaction_facts as Single Source of Truth';

COMMIT;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- After this migration:
-- - All transaction queries MUST use l1_transaction_facts
-- - No fallback to transactions table (it no longer exists)
-- - View l2_customer_summary_view uses l1_transaction_facts
-- - accounts table no longer exists
-- ============================================================================

