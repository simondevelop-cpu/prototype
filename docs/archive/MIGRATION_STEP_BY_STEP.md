# Step-by-Step Migration Guide

## Current Status Check

First, let's check if migration has already been run:

1. **Via API (after deployment):**
   ```
   GET /api/admin/migration-status
   ```
   This will show which tables exist and their row counts.

2. **Via Database Console:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'l0_%' OR table_name LIKE 'l1_%';
   ```

## Migration Options

### Option 1: Run Locally (Recommended)

**Step 1: Get Database URL**
```bash
# From Vercel Dashboard → Storage → Postgres → Copy connection string
# OR
vercel env pull .env.local
export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d '=' -f2-)
```

**Step 2: Install Dependencies (if needed)**
```bash
npm install
```

**Step 3: Run Migration**
```bash
npm run migrate
```

**Step 4: Verify Results**
The migration script will automatically verify and show:
- ✅ Tokenized users count
- ✅ PII records count
- ✅ Transaction facts count
- ✅ Customer facts count

### Option 2: Vercel Database Console

**Step 1: Open Console**
1. Go to Vercel Dashboard
2. Your Project → Storage → Postgres
3. Click "Query" or "Connect"

**Step 2: Run Schema Creation**
1. Open `migrations/create-l0-l1-l2-schema.sql`
2. Copy entire file
3. Paste into console
4. Run

**Step 3: Run Data Migration**
1. Open `migrations/migrate-data-to-l0-l1.sql`
2. Copy entire file
3. Paste into console
4. Run

**Step 4: Verify**
Run queries from `migrations/verify-migration.sql`

## Verification Tests

After migration, run these tests:

### Test 1: Data Counts Match
```sql
-- Should show matching counts
SELECT 'Old transactions' as source, COUNT(*) FROM transactions
UNION ALL
SELECT 'New transactions', COUNT(*) FROM l1_transaction_facts;
```

### Test 2: No Duplication (Create New Data)
1. Create a new transaction via the app
2. Run:
```sql
-- Should be 1 (new transaction)
SELECT COUNT(*) FROM l1_transaction_facts 
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Should be 0 (no new data in old table)
SELECT COUNT(*) FROM transactions 
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

### Test 3: Tokenization Works
```sql
-- Should all be 64-char hex strings
SELECT 
  tokenized_user_id,
  LENGTH(tokenized_user_id) as length
FROM l0_user_tokenization
LIMIT 5;
-- All lengths should be 64
```

### Test 4: PII Isolation
```sql
-- PII should only be in l0_pii_users
SELECT COUNT(*) FROM l0_pii_users;

-- Analytics should use tokenized IDs (not internal IDs)
SELECT tokenized_user_id FROM l1_transaction_facts LIMIT 1;
-- Should be a 64-char hex string, NOT a number
```

## Testing Checklist

After migration, test:

- [ ] Login works
- [ ] Dashboard loads data
- [ ] Upload statement works
- [ ] Create transaction works
- [ ] Edit transaction works
- [ ] Delete transaction works
- [ ] Summary/categories endpoints work
- [ ] No errors in console
- [ ] No data duplication (new data only in new tables)

## Next Steps After Migration

1. ✅ Verify all data migrated correctly
2. ✅ Test creating new data (verify no duplication)
3. ✅ Test all application features
4. ✅ Monitor logs for any errors
5. ✅ Consider removing old table writes (optional - for cleanup)

