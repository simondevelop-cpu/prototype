# Transactions and Accounts Tables Migration Plan

**Date:** January 31, 2026  
**Goal:** Establish Single Source of Truth by migrating from `transactions` and `accounts` to `l1_transaction_facts`

---

## Current State

### `transactions` Table
- **Status:** 599 rows, 598 migrated to `l1_transaction_facts`
- **Blockers:**
  1. 1 unmigrated transaction (ID 479) - "No tokenization record"
  2. Foreign keys: `transactions.user_id → users.id`, `transactions.account_id → accounts.id`
  3. View dependency: `l2_customer_summary_view` uses `transactions` table
  4. Code fallbacks: Some APIs still have fallback logic to `transactions` table

### `accounts` Table
- **Status:** Empty (0 rows)
- **Blockers:**
  1. Referenced by foreign key: `transactions.account_id → accounts.id`
  2. Has foreign key: `accounts.user_id → users.id`

---

## Migration Strategy

### Phase 1: Fix Unmigrated Transaction ✅
**Goal:** Migrate the 1 remaining transaction

**Steps:**
1. Investigate transaction ID 479 - why no tokenization record?
2. Create tokenization record for the user if missing
3. Migrate the transaction to `l1_transaction_facts`
4. Verify all 599 transactions are migrated

**API:** `/api/admin/migration/fix-unmigrated` (already exists)

---

### Phase 2: Update View Dependency ✅
**Goal:** Update `l2_customer_summary_view` to use `l1_transaction_facts`

**Steps:**
1. Find view definition
2. Create new view using `l1_transaction_facts` instead of `transactions`
3. Drop old view
4. Create new view with same name
5. Verify view works correctly

**SQL:**
```sql
-- Drop old view
DROP VIEW IF EXISTS l2_customer_summary_view CASCADE;

-- Create new view using l1_transaction_facts
CREATE VIEW l2_customer_summary_view AS
SELECT 
  ut.internal_user_id,
  COUNT(DISTINCT tf.id) as total_transactions,
  SUM(CASE WHEN tf.cashflow = 'income' THEN tf.amount ELSE 0 END) as total_income,
  SUM(CASE WHEN tf.cashflow = 'expense' THEN tf.amount ELSE 0 END) as total_expenses,
  MIN(tf.transaction_date) as first_transaction_date,
  MAX(tf.transaction_date) as last_transaction_date
FROM l1_transaction_facts tf
JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
GROUP BY ut.internal_user_id;
```

---

### Phase 3: Remove Code Fallbacks ✅
**Goal:** Update all APIs to use `l1_transaction_facts` only (no fallback to `transactions`)

**Files to Update:**
1. `app/api/account/export/route.ts` - Remove fallback to `transactions`
2. `app/api/admin/users/route.ts` - Remove fallback to `transactions`
3. `app/api/admin/customer-data/route.ts` - Remove fallback to `transactions`
4. `app/api/admin/cohort-analysis/route.ts` - Remove fallback to `transactions`
5. `app/api/admin/vanity-metrics/route.ts` - Remove fallback to `transactions`
6. `app/api/admin/engagement-chart/route.ts` - Remove fallback to `transactions`
7. Any other files with `transactions` fallbacks

**Pattern to Remove:**
```typescript
// OLD (with fallback)
if (hasL0 && tokenizedUserId) {
  // Use l1_transaction_facts
} else {
  // Fallback to transactions
}

// NEW (single source of truth)
// Always use l1_transaction_facts
// If no tokenization, create it first
```

---

### Phase 4: Drop Foreign Keys ✅
**Goal:** Remove foreign key constraints from `transactions` table

**Steps:**
1. Drop `transactions.user_id → users.id` foreign key
2. Drop `transactions.account_id → accounts.id` foreign key
3. Drop `accounts.user_id → users.id` foreign key (if exists)

**SQL:**
```sql
-- Find and drop foreign keys
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
```

---

### Phase 5: Drop Tables ✅
**Goal:** Drop `transactions` and `accounts` tables

**Steps:**
1. Verify all data migrated (599/599 transactions)
2. Verify view updated
3. Verify no code references `transactions` or `accounts`
4. Drop `transactions` table
5. Drop `accounts` table

**SQL:**
```sql
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
```

---

### Phase 6: Comprehensive Testing ✅
**Goal:** Verify everything works after migration

**Test Categories:**
1. **Transaction Queries:**
   - User transaction list
   - Transaction export
   - Transaction statistics

2. **Admin Queries:**
   - Customer data
   - Cohort analysis
   - Vanity metrics
   - Engagement charts

3. **View Queries:**
   - `l2_customer_summary_view` returns correct data
   - View performance is acceptable

4. **Integration Tests:**
   - Transaction upload still works
   - Transaction editing still works
   - Transaction deletion still works
   - All APIs return correct data

---

## Migration Script

See `migrations/drop-transactions-accounts.sql` for complete migration script.

---

## Rollback Plan

If issues arise:
1. Keep `transactions` table as backup (don't drop immediately)
2. Add feature flag to toggle between old/new tables
3. Monitor for errors after migration
4. If critical issues, can restore from backup

---

## Success Criteria

✅ All 599 transactions migrated to `l1_transaction_facts`  
✅ `l2_customer_summary_view` updated and working  
✅ All APIs use `l1_transaction_facts` only (no fallbacks)  
✅ All foreign keys dropped  
✅ `transactions` and `accounts` tables dropped  
✅ All tests passing  
✅ No errors in production  

---

## Timeline

1. **Phase 1:** Fix unmigrated transaction (5 min)
2. **Phase 2:** Update view (10 min)
3. **Phase 3:** Remove code fallbacks (30 min)
4. **Phase 4:** Drop foreign keys (5 min)
5. **Phase 5:** Drop tables (5 min)
6. **Phase 6:** Testing (1 hour)

**Total Estimated Time:** ~2 hours

---

## Next Steps

1. ✅ Create migration script
2. ✅ Update view definition
3. ✅ Remove code fallbacks
4. ✅ Create comprehensive tests
5. ⏳ Execute migration
6. ⏳ Verify everything works

