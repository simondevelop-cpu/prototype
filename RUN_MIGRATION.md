# Run Migration - The Easy Way! 🚀

## Option 1: Run Locally (Recommended)

You can run the migration directly from your terminal using Node.js:

```bash
# Make sure you have DATABASE_URL set (Vercel sets this automatically)
npm run migrate
```

That's it! The script will:
1. ✅ Create all L0/L1/L2 tables
2. ✅ Migrate all existing data
3. ✅ Verify the migration worked
4. ✅ Show you the results

## Option 2: Check if DATABASE_URL is Set

If you're running locally, make sure your `.env.local` file has:

```bash
DATABASE_URL=your_postgres_connection_string
```

Or export it:
```bash
export DATABASE_URL="your_postgres_connection_string"
```

## What the Script Does

1. **Connects to your database** using `DATABASE_URL`
2. **Creates the schema** (all L0/L1/L2 tables)
3. **Migrates data** from old tables to new tables
4. **Verifies** everything worked correctly

## Expected Output

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

## Troubleshooting

### "Cannot find module 'ts-node'"
```bash
npm install
```

### "DATABASE_URL is not set"
Make sure your `.env.local` file has the connection string, or export it in your terminal.

### "Connection refused"
Check that your DATABASE_URL is correct and the database is accessible.

