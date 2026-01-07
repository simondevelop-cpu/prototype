# Run Migration Now - Step by Step

## ✅ Good News: Nothing to Undo!

From your screenshots:
- ✅ Schema tables were created (good!)
- ❌ Data migration failed and was rolled back (no partial data)
- ✅ Safe to run migration again

## 🚀 Run Migration

### Step 1: Get Your DATABASE_URL

You need your database connection string. Get it from:

**Vercel Dashboard:**
1. Go to your project
2. Storage tab
3. Click your Postgres database
4. Copy the connection string (usually starts with `postgresql://...`)

**OR from Neon Console:**
1. Go to your project
2. Click "Connection Details"
3. Copy the connection string

### Step 2: Set DATABASE_URL

**Option A: Export in terminal (temporary)**
```bash
export DATABASE_URL="your_connection_string_here"
```

**Option B: Add to .env.local (persistent)**
Create/edit `.env.local` file:
```
DATABASE_URL=your_connection_string_here
```

### Step 3: Run Migration

```bash
npm run migrate
```

This will:
1. ✅ Check database connection
2. ✅ Create tables (will skip if they exist - safe!)
3. ✅ Migrate all data from old tables to new tables
4. ✅ Verify migration success
5. ✅ Show you the results

### Step 4: Expected Output

You should see something like:

```
============================================================
Data Architecture Migration: L0/L1/L2 Schema
============================================================
[Migration] ✅ Database connection established
[Migration] Running create-l0-l1-l2-schema.sql...
[Migration] ✅ Completed create-l0-l1-l2-schema.sql
[Migration] Running migrate-data-to-l0-l1.sql...
[Migration] ✅ Completed migrate-data-to-l0-l1.sql

[Verification] Checking migration results...
[Verification] ✅ Tokenized users: 15
[Verification] ✅ PII records: 15
[Verification] ✅ Transaction facts: 599
[Verification] ✅ Customer facts: 15
[Verification] ✅ Categories: 25
[Verification] ✅ All transaction facts have valid tokenized user IDs

============================================================
✅ Migration completed successfully!
============================================================
```

## 🐛 Troubleshooting

### "Cannot find module 'ts-node'"
```bash
npm install
```

### "DATABASE_URL is not set"
Make sure you exported it or added it to `.env.local`

### "Connection refused" or "timeout"
- Check your connection string is correct
- Make sure database is accessible (not paused/sleeping)
- For Neon: database wakes up on first connection (may take a few seconds)

### Migration fails partway
- The new migration script runs without a transaction block
- Each step commits independently
- Previous steps remain committed (safe to re-run)

## ✅ After Migration

Once migration succeeds:
1. ✅ Test your app - should work with new architecture
2. ✅ Check that data appears correctly
3. ✅ Verify no duplication (new data goes to new tables only)

