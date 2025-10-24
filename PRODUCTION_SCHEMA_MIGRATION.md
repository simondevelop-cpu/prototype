# Production Schema Migration Guide

## Current Status (Oct 24, 2025)

The production database schema is **out of sync** with the local development schema. This guide documents the differences and provides migration steps.

## Known Schema Differences

### 1. `users` table
- ✅ **Consistent** - Uses `display_name` column (not `name`)
- No migration needed

### 2. `categorization_learning` table
- ⚠️ **INCONSISTENT** - Production may have older schema or missing table entirely

**Expected Schema (from server.js):**
```sql
CREATE TABLE IF NOT EXISTS categorization_learning (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  original_category TEXT,
  original_label TEXT,
  corrected_category TEXT NOT NULL,
  corrected_label TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Production Schema:** Unknown/Incomplete
- Missing: `corrected_category`, `corrected_label` columns
- Table may not exist at all

### 3. `admin_keywords` table
- ⚠️ **INCONSISTENT** - Production has OLD schema with `score` and `language` columns

**Expected Schema (current):**
```sql
CREATE TABLE IF NOT EXISTS admin_keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(keyword, category)
);
```

**Production Schema (old):**
- Has: `score INTEGER` column (removed in current)
- Has: `language TEXT` column (removed in current)

### 4. `admin_merchants` table
- ⚠️ **INCONSISTENT** - Production missing `alternate_patterns` column

**Expected Schema (current):**
```sql
CREATE TABLE IF NOT EXISTS admin_merchants (
  id SERIAL PRIMARY KEY,
  merchant_pattern TEXT NOT NULL UNIQUE,
  alternate_patterns TEXT[],  -- MISSING IN PRODUCTION
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Production Schema (old):**
- Missing: `alternate_patterns TEXT[]` column
- Has: `score INTEGER` column (removed in current)

## Migration Strategy

### Option 1: Use /api/admin/migrate-schema (RECOMMENDED)

1. Visit: `https://your-app.vercel.app/migrate`
2. Click "Check Current Schema" to see what's missing
3. Click "Run Migration" to apply changes
4. Verify with "Check Current Schema" again

This endpoint automatically:
- Adds `alternate_patterns` to `admin_merchants`
- Removes `score` from both tables
- Removes `language` from `admin_keywords`

### Option 2: Manual SQL Migration

If the automated migration fails, run these SQL commands directly in Vercel Postgres:

```sql
-- Fix admin_merchants
ALTER TABLE admin_merchants 
  ADD COLUMN IF NOT EXISTS alternate_patterns TEXT[];

ALTER TABLE admin_merchants 
  DROP COLUMN IF EXISTS score;

-- Fix admin_keywords
ALTER TABLE admin_keywords 
  DROP COLUMN IF EXISTS score,
  DROP COLUMN IF EXISTS language;

-- Fix categorization_learning (if table exists but is incomplete)
-- Check what columns exist first, then add missing ones:
ALTER TABLE categorization_learning
  ADD COLUMN IF NOT EXISTS corrected_category TEXT,
  ADD COLUMN IF NOT EXISTS corrected_label TEXT,
  ADD COLUMN IF NOT EXISTS frequency INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
```

### Option 3: Fresh Schema Rebuild (NUCLEAR OPTION)

If all else fails, you can reinitialize the entire database:

1. Visit: `https://your-app.vercel.app/api/admin/init-db`
2. This will:
   - Create all tables with correct schema
   - Seed initial keywords and merchants
   - **WARNING**: May conflict with existing data

## Code Resilience

The codebase has been updated to handle schema inconsistencies gracefully:

### ✅ Resilient APIs
- `/api/admin/recategorizations` - Dynamically queries schema and adapts
- `/api/admin/users` - Uses correct column names
- `/api/admin/view-keywords` - Orders by correct columns

### ✅ Fallback Behavior
- If columns don't exist, returns empty arrays with warnings
- No crashes or 500 errors
- Degrades gracefully

## Verification Checklist

After migration, verify these endpoints work:

- [ ] `/api/admin/users` - Shows all registered users
- [ ] `/api/admin/view-keywords?type=keywords` - Shows keywords
- [ ] `/api/admin/view-keywords?type=merchants` - Shows merchants
- [ ] `/api/admin/recategorizations` - Shows recategorization log (or empty array)
- [ ] Admin dashboard loads without errors
- [ ] Categorization engine uses database patterns

## Next Steps

Once schema is migrated:
1. Test the admin dashboard thoroughly
2. Upload a statement and verify auto-categorization works
3. Recategorize a transaction and verify it appears in the log
4. Add a new keyword/merchant in admin panel and verify it works

## Notes

- The local `server.js` automatically creates correct schema on startup
- Vercel production requires manual migration or hitting `/api/admin/init-db`
- Future deployments should use database migrations for schema changes

