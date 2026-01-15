# Migration Instructions - Vercel Database Console

## ✅ Safest & Easiest Method

This guide walks you through running the migration directly in Vercel's database console.

## Step 1: Open Vercel Database Console

1. Go to **Vercel Dashboard** → Your Project
2. Click on **Storage** tab
3. Click on your **Postgres** database
4. Click **"Query"** or **"Connect"** button (opens SQL console)

## Step 2: Run Schema Creation

1. **Copy the entire contents** of `migrations/create-l0-l1-l2-schema.sql`
2. **Paste** into the SQL console
3. **Click "Run"** or press Execute
4. **Wait for completion** (may take 10-30 seconds)
5. You should see: "Query executed successfully" or similar

**Expected result:** All L0/L1/L2 tables created

## Step 3: Run Data Migration

1. **Copy the entire contents** of `migrations/migrate-data-to-l0-l1.sql`
2. **Paste** into the SQL console
3. **Click "Run"** or press Execute
4. **Wait for completion** (may take 30-60 seconds depending on data size)
5. You should see: "Query executed successfully" or similar

**Expected result:** All existing data migrated to new tables

## Step 4: Verify Migration

Run these queries one by one in the console:

### 4a. Check Table Counts
```sql
SELECT 
  'users' as table_name, 
  COUNT(*) as count 
FROM users
UNION ALL
SELECT 'l0_user_tokenization', COUNT(*) FROM l0_user_tokenization
UNION ALL
SELECT 'l0_pii_users', COUNT(*) FROM l0_pii_users
UNION ALL
SELECT 'transactions (old)', COUNT(*) FROM transactions
UNION ALL
SELECT 'l1_transaction_facts (new)', COUNT(*) FROM l1_transaction_facts;
```

**Expected:** 
- `l0_user_tokenization` count = `users` count
- `l1_transaction_facts` count = `transactions` count (or close)

### 4b. Check Tokenization Format
```sql
SELECT 
  u.id as internal_user_id,
  u.email,
  ut.tokenized_user_id,
  LENGTH(ut.tokenized_user_id) as token_length
FROM users u
JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
LIMIT 5;
```

**Expected:** All `token_length` values should be `64` (hex string)

### 4c. Check for Orphaned Data
```sql
SELECT COUNT(*) as orphaned_count
FROM l1_transaction_facts tf
WHERE NOT EXISTS (
  SELECT 1 FROM l0_user_tokenization ut 
  WHERE ut.tokenized_user_id = tf.tokenized_user_id
);
```

**Expected:** `orphaned_count` should be `0`

## Step 5: Test Application

1. **Refresh your app** in the browser
2. **Try logging in** - should work now
3. **Check dashboard** - should load data
4. **Try uploading a statement** - should parse and import

## Step 6: Test for Data Duplication

### Create a Test Transaction

1. **In your app**, create a new transaction manually
2. **Note the time** you created it

### Check New Tables Only

Run this query:
```sql
SELECT COUNT(*) as new_transactions
FROM l1_transaction_facts
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

**Expected:** Should show `1` (or more if you created multiple)

### Verify NO Data in Old Table

Run this query:
```sql
SELECT COUNT(*) as old_table_new_data
FROM transactions
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

**Expected:** Should show `0` (or only count from before migration)

**✅ SUCCESS:** If new transaction only appears in new table, no duplication!

## Troubleshooting

### "Table already exists" errors
- **OK!** This means tables were already created
- Migration is idempotent (safe to run multiple times)
- Continue to data migration step

### "Function already exists" errors
- **OK!** Functions were already created
- Continue to data migration step

### Data migration fails partway
- Check error message
- Old tables still have all data (safe)
- Can re-run data migration (uses ON CONFLICT, safe)

### "Permission denied" errors
- Check you're using the correct database
- Verify you have write permissions

## What Gets Created

### L0 Tables (Privacy/Config)
- `l0_pii_users` - Isolated PII storage
- `l0_user_tokenization` - User ID tokenization
- `l0_category_list` - Category metadata
- `l0_privacy_metadata` - Privacy/compliance metadata

### L1 Tables (Facts/Analytics)
- `l1_transaction_facts` - Transaction data (tokenized user IDs)
- `l1_customer_facts` - Customer analytics (tokenized user IDs)
- `l1_file_ingestion` - File upload tracking
- `l1_event_facts` - Event tracking

### L2 Views (Derived)
- `l2_transactions_view` - Backward-compatible view

## After Migration

✅ **New data writes go ONLY to new tables**
✅ **Old tables remain for historical data (read-only)**
✅ **No data duplication**
✅ **PII isolated in L0**
✅ **Analytics use tokenized IDs**

## Next Steps

1. ✅ Migration complete
2. ✅ Test application functionality
3. ✅ Verify no data duplication
4. ✅ Monitor for any errors
5. ⏭️ (Future) Consider cleaning up old table writes

