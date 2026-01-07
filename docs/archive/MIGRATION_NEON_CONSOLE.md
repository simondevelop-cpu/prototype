# Migration Instructions - Neon Console

## Finding the SQL Editor

You're using **Neon** (Vercel's Postgres provider). Here's where to find the SQL console:

### Steps:
1. **Left Sidebar** → Look under the **"BRANCH"** section
2. You should see a dropdown showing **"main"**
3. Below that, look for **"SQL Editor"** 
4. **Click "SQL Editor"**

### Navigation Path:
```
Left Sidebar
  └── BRANCH
       └── main (dropdown)
            ├── Overview
            ├── Monitoring
            ├── SQL Editor  ← CLICK HERE
            ├── Tables
            └── ...
```

## Running the Migration

### Step 1: Open SQL Editor
- Click "SQL Editor" from the left sidebar
- You'll see a text area for SQL queries

### Step 2: Run Schema Creation
1. Open `migrations/create-l0-l1-l2-schema.sql` in your code editor
2. **Copy ALL contents** (Ctrl+A, Ctrl+C / Cmd+A, Cmd+C)
3. **Paste** into the SQL Editor text area
4. Click **"Run"** button (usually at top right or bottom)
5. Wait for success message

### Step 3: Run Data Migration
1. Open `migrations/migrate-data-to-l0-l1.sql` in your code editor
2. **Copy ALL contents**
3. **Paste** into the SQL Editor (you can clear the previous query first, or run in new tab)
4. Click **"Run"**
5. Wait for success message

### Step 4: Verify
Run this query in SQL Editor:
```sql
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'l0_user_tokenization', COUNT(*) FROM l0_user_tokenization
UNION ALL
SELECT 'l0_pii_users', COUNT(*) FROM l0_pii_users
UNION ALL
SELECT 'transactions (old)', COUNT(*) FROM transactions
UNION ALL
SELECT 'l1_transaction_facts (new)', COUNT(*) FROM l1_transaction_facts;
```

**Expected:** Matching counts between old and new tables.

## Alternative: Using Tables View

If you can't find SQL Editor, you can also:
1. Click **"Tables"** in the left sidebar
2. Look for a **"Query"** or **"SQL"** button/tab
3. Or look for a button to run SQL queries

## Need Help?

If you still can't find it:
- Look for any button labeled "Query", "SQL", "Run SQL", or "Execute"
- The SQL Editor might be in a different location - check all menu items
- You might need to click on the branch name first to expand options

