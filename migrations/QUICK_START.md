# Quick Start: Run Migration & Verify

## Step 1: Get Your Database URL

### Option A: From Vercel Dashboard
1. Go to Vercel Dashboard → Your Project → Storage → Postgres
2. Click on the database
3. Copy the connection string (starts with `postgresql://`)

### Option B: Using Vercel CLI
```bash
vercel env pull .env.local
export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d '=' -f2-)
```

## Step 2: Run Migration

### Option A: Using the Script (Easiest)
```bash
export DATABASE_URL="your-postgresql-connection-string-here"
bash migrations/run-and-verify.sh
```

### Option B: Using npm
```bash
export DATABASE_URL="your-postgresql-connection-string-here"
npm install  # If not already done
npm run migrate
```

### Option C: Direct SQL (Vercel Console)
1. Go to Vercel Dashboard → Your Project → Storage → Postgres → Query
2. Copy/paste contents of `migrations/create-l0-l1-l2-schema.sql`
3. Run it
4. Copy/paste contents of `migrations/migrate-data-to-l0-l1.sql`
5. Run it

## Step 3: Verify Migration

After migration completes, you'll see output like:
```
[Verification] ✅ Tokenized users: X
[Verification] ✅ PII records: X
[Verification] ✅ Transaction facts: X
[Verification] ✅ Customer facts: X
```

## Step 4: Check for Data Duplication

Run these queries in your database console:

```sql
-- 1. Compare counts (should match)
SELECT 'transactions (old)' as table_name, COUNT(*) as count FROM transactions
UNION ALL
SELECT 'l1_transaction_facts (new)', COUNT(*) FROM l1_transaction_facts;

-- 2. Create a test transaction via the app, then check:
-- New transaction should ONLY be in new table
SELECT COUNT(*) FROM l1_transaction_facts WHERE created_at > NOW() - INTERVAL '1 hour';
SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour';
-- First query should have new data, second should be 0 (or only old data)
```

## Step 5: Test in Application

1. **Login** - Should work
2. **Upload a statement** - Should parse and import
3. **Create a transaction manually** - Should work
4. **Check dashboard** - Should show data

## Troubleshooting

### "ts-node not found"
```bash
npm install
```

### "Database connection failed"
- Check DATABASE_URL is correct
- Check database is accessible
- Check SSL settings (Vercel requires SSL)

### "Table already exists"
- This is OK - migration uses `CREATE TABLE IF NOT EXISTS`
- Migration is idempotent (safe to run multiple times)

