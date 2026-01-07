-- ============================================================================
-- Migration Verification Queries
-- Run these AFTER migration to verify data integrity and check for duplication
-- ============================================================================

-- 1. Count Comparison (should match)
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'l0_user_tokenization', COUNT(*) FROM l0_user_tokenization
UNION ALL
SELECT 'l0_pii_users', COUNT(*) FROM l0_pii_users
UNION ALL
SELECT 'transactions (old)', COUNT(*) FROM transactions
UNION ALL
SELECT 'l1_transaction_facts (new)', COUNT(*) FROM l1_transaction_facts
ORDER BY table_name;

-- 2. Check for orphaned transaction facts (should be 0)
SELECT 
  'Orphaned transaction facts' as check_name,
  COUNT(*) as count
FROM l1_transaction_facts tf
WHERE NOT EXISTS (
  SELECT 1 FROM l0_user_tokenization ut 
  WHERE ut.tokenized_user_id = tf.tokenized_user_id
);

-- 3. Check tokenized users without internal users (should be 0)
SELECT 
  'Tokenized users without internal users' as check_name,
  COUNT(*) as count
FROM l0_user_tokenization ut
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = ut.internal_user_id
);

-- 4. Verify tokenization format (should all be 64-char hex strings)
SELECT 
  'Invalid tokenized user IDs' as check_name,
  COUNT(*) as count
FROM l0_user_tokenization
WHERE tokenized_user_id !~ '^[a-f0-9]{64}$';

-- 5. Check for recent writes in OLD table (should be 0 after migration)
-- Run this AFTER creating a new transaction to verify no dual-write
SELECT 
  'Recent writes in old transactions table (last hour)' as check_name,
  COUNT(*) as count
FROM transactions
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 6. Check for recent writes in NEW table (should have new data)
SELECT 
  'Recent writes in new l1_transaction_facts (last hour)' as check_name,
  COUNT(*) as count
FROM l1_transaction_facts
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 7. Sample tokenized user IDs (verify format)
SELECT 
  u.id as internal_user_id,
  u.email,
  ut.tokenized_user_id,
  LENGTH(ut.tokenized_user_id) as token_length
FROM users u
JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
LIMIT 5;

-- 8. Sample transaction facts (verify tokenized user IDs)
SELECT 
  tf.id,
  tf.tokenized_user_id,
  tf.transaction_date,
  tf.description,
  tf.amount
FROM l1_transaction_facts tf
LIMIT 5;

