# Migration Run Guide

## Overview
This guide helps you run the L0/L1/L2 data architecture migration to create the new tables and migrate existing data.

## Pre-Migration Checklist

### ✅ Code is Ready
- All application code has been updated to use new L0/L1/L2 tables
- Code includes graceful fallbacks (but we want to migrate now)
- Security fixes are in place (bcrypt, rate limiting, CSRF)

### ⚠️ Important: Data Duplication Prevention
After migration, **NEW data will ONLY be written to new tables**:
- `l1_transaction_facts` (not `transactions`)
- `l0_pii_users` (not `onboarding_responses` for PII)

**Old tables remain for backward compatibility**, but:
- New writes go to new tables ✅
- Old tables are READ-ONLY for historical data
- No dual-write (prevents duplication) ✅

## Running the Migration

### Option 1: Local Migration (Recommended for Testing)

**Prerequisites:**
- Node.js installed
- `ts-node` installed (`npm install`)
- Database connection string set in environment

**Steps:**

1. **Set your database URL:**
   ```bash
   export DATABASE_URL="postgresql://user:password@host:port/database"
   # OR
   export POSTGRES_URL="postgresql://user:password@host:port/database"
   ```

2. **Run the migration:**
   ```bash
   npm run migrate
   ```

   This will:
   - ✅ Create all L0/L1/L2 tables
   - ✅ Migrate existing data from old tables to new tables
   - ✅ Set up tokenization for all users
   - ✅ Verify migration integrity

3. **Verify results:**
   The script will output verification counts for:
   - Tokenized users
   - PII records
   - Transaction facts
   - Customer facts
   - Categories

### Option 2: Vercel Production Migration

**Option 2A: Via Vercel CLI**

1. **Get your database connection string from Vercel:**
   ```bash
   vercel env pull .env.local
   ```

2. **Set it and run migration:**
   ```bash
   export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d '=' -f2)
   npm run migrate
   ```

**Option 2B: Direct SQL (via Vercel Postgres Console)**

1. Go to Vercel Dashboard → Your Project → Storage → Postgres
2. Click "Connect" or "Query" to open the database console
3. Copy and run the SQL from `migrations/create-l0-l1-l2-schema.sql`
4. Then copy and run SQL from `migrations/migrate-data-to-l0-l1.sql`

**Option 2C: Create Migration API Endpoint (Future)**

We could create a `/api/admin/run-migration` endpoint, but it's safer to run migrations manually.

## What the Migration Does

### Schema Creation (`create-l0-l1-l2-schema.sql`)

Creates these tables:
- **L0 Tables:**
  - `l0_pii_users` - Isolated PII storage
  - `l0_user_tokenization` - User ID tokenization mapping
  - `l0_category_list` - Category metadata
  - `l0_privacy_metadata` - Privacy/compliance metadata

- **L1 Tables:**
  - `l1_transaction_facts` - Transaction analytics (tokenized user IDs)
  - `l1_customer_facts` - Customer analytics (tokenized user IDs)
  - `l1_file_ingestion` - File upload tracking
  - `l1_event_facts` - Event tracking (future)

- **L2 Views:**
  - `l2_transactions_view` - Backward-compatible view (for gradual migration)

### Data Migration (`migrate-data-to-l0-l1.sql`)

1. **Tokenization:**
   - Creates tokenized user IDs for all existing users
   - Uses deterministic SHA256 hash

2. **PII Migration:**
   - Migrates PII from `onboarding_responses` to `l0_pii_users`
   - Creates PII records for users without onboarding data (email only)

3. **Transaction Migration:**
   - Migrates all transactions to `l1_transaction_facts`
   - Uses tokenized user IDs (not internal IDs)
   - Preserves `legacy_transaction_id` for reference

4. **Customer Facts:**
   - Creates customer fact records from onboarding data

## Testing for Data Duplication

### After Migration, Verify:

1. **Old tables still exist (expected):**
   ```sql
   SELECT COUNT(*) FROM transactions;  -- Should have historical data
   SELECT COUNT(*) FROM onboarding_responses;  -- Should have historical data
   ```

2. **New tables have migrated data:**
   ```sql
   SELECT COUNT(*) FROM l1_transaction_facts;  -- Should match transactions count
   SELECT COUNT(*) FROM l0_pii_users;  -- Should have user PII
   SELECT COUNT(*) FROM l0_user_tokenization;  -- Should match users count
   ```

3. **New writes go ONLY to new tables:**
   - Create a new transaction via API
   - Check: `SELECT COUNT(*) FROM l1_transaction_facts WHERE created_at > NOW() - INTERVAL '1 minute';`
   - Check: `SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '1 minute';`
   - ✅ New transaction should ONLY be in `l1_transaction_facts`
   - ❌ Should NOT be in `transactions` (old table)

4. **No dual-write:**
   - Upload a statement
   - Check both tables
   - ✅ Should ONLY appear in new table

## Verification Queries

### Count Comparison
```sql
-- Users
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'l0_user_tokenization', COUNT(*) FROM l0_user_tokenization
UNION ALL
SELECT 'l0_pii_users', COUNT(*) FROM l0_pii_users;

-- Transactions
SELECT 'transactions (old)' as table_name, COUNT(*) as count FROM transactions
UNION ALL
SELECT 'l1_transaction_facts (new)', COUNT(*) FROM l1_transaction_facts;
```

### Check for Orphaned Data
```sql
-- Transactions without tokenized user IDs
SELECT COUNT(*) 
FROM l1_transaction_facts tf
WHERE NOT EXISTS (
  SELECT 1 FROM l0_user_tokenization ut 
  WHERE ut.tokenized_user_id = tf.tokenized_user_id
);
-- Should be 0

-- Tokenized users without internal users
SELECT COUNT(*) 
FROM l0_user_tokenization ut
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = ut.internal_user_id
);
-- Should be 0
```

## Security Verification

After migration, verify:

1. **Tokenization works:**
   - User IDs in `l1_transaction_facts` are tokenized (64-char hex strings)
   - Cannot reverse-engineer internal user IDs from tokenized IDs

2. **PII isolation:**
   - PII only in `l0_pii_users`
   - Analytics tables (`l1_*`) use tokenized IDs only

3. **API endpoints work:**
   - Login/register works
   - Transaction queries work (using tokenized IDs)
   - Onboarding writes PII to `l0_pii_users`

## Rollback Plan

If something goes wrong:

1. **Schema rollback:**
   - New tables can be dropped (old tables still have data)
   - Code will fall back to old tables (graceful degradation)

2. **Data preservation:**
   - Old tables are NOT modified by migration
   - All historical data remains in old tables
   - Migration only READS from old tables, WRITES to new tables

3. **Code rollback:**
   - Revert code changes if needed
   - Old code will work with old tables

## Next Steps After Migration

1. ✅ Run migration
2. ✅ Verify data counts match
3. ✅ Test creating new transaction (check for duplication)
4. ✅ Test uploading statement (check for duplication)
5. ✅ Verify all API endpoints work
6. ✅ Check security (tokenization, PII isolation)
7. ✅ Monitor for any errors in logs

## Questions to Answer

- [ ] Are transaction counts equal between old and new tables?
- [ ] Are new transactions ONLY in new table?
- [ ] Are user IDs properly tokenized in new tables?
- [ ] Is PII properly isolated in L0 tables?
- [ ] Do all API endpoints work correctly?
- [ ] Is there any data duplication?

