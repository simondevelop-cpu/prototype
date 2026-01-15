# L0/L1/L2 Architecture Implementation Summary

## What Was Created

I've implemented the data architecture migration to align with your architecture slide. Here's what's been set up:

### 📁 Files Created

1. **`migrations/create-l0-l1-l2-schema.sql`**
   - Complete SQL schema for L0/L1/L2 layers
   - Creates all tables, indexes, functions, and views
   - Includes documentation comments

2. **`migrations/migrate-data-to-l0-l1.sql`**
   - Data migration script
   - Migrates existing data from old tables to new structure
   - Preserves all existing data

3. **`migrations/run-migration.ts`**
   - Node.js migration runner
   - Executes schema creation and data migration
   - Includes verification checks

4. **`lib/tokenization.ts`**
   - Helper functions for tokenized user IDs
   - Ensures PII isolation
   - Provides utilities for analytics queries

5. **`DATA_ARCHITECTURE_MIGRATION.md`**
   - Detailed migration plan
   - Architecture explanation
   - Backup & deletion schedule

6. **`CODE_CHANGES_REQUIRED.md`**
   - Step-by-step guide for updating application code
   - Before/after examples for each query pattern
   - Testing checklist

## Architecture Layers Implemented

### L0: Auth / Privacy / Config (Isolated PII Zone)

✅ **l0_pii_users** - Isolated PII table
- Stores email, first_name, last_name, date_of_birth, recovery_phone, province_region
- Links to internal user_id only (not exposed to analytics)
- Supports soft delete for 30-day retention compliance

✅ **l0_user_tokenization** - Tokenized user ID mapping
- Maps internal user IDs to anonymized hash IDs
- Deterministic SHA256 hash (cannot be reversed)
- Used for all analytics queries

✅ **l0_category_list** - Category metadata
- One row per category keyword
- Maps from existing admin_keywords

✅ **l0_insight_list** - Insight rules metadata
- One row per insight rule
- JSONB for flexible rule definitions

✅ **l0_admin_list** - Admin configuration metadata
- One row per admin config

✅ **l0_privacy_metadata** - Privacy compliance tracking
- Tracks data retention policies
- Deletion scheduling for PIPEDA/Law 25 compliance

### L1: Canonical Fact Tables

✅ **l1_transaction_facts** - Transaction facts (user anonymized)
- All transaction data with tokenized_user_id
- Links to legacy transactions via legacy_transaction_id
- Fully indexed for analytics

✅ **l1_customer_facts** - Customer facts (one row per tokenized user)
- Demographics (anonymized aggregates)
- Account state, segments, engagement metrics
- Import quality metrics

✅ **l1_event_facts** - Event tracking
- Time-stamped events for activation, engagement, friction
- Supports: user_events, import_events, parsing_events, insight_events, app_health_events
- JSONB for flexible event properties

### L1: Operational Fact Tables

✅ **l1_file_ingestion** - File upload tracking
- One row per upload session
- Tracks: bank, file size/type, parse timestamps, results
- Supports success/fallback OCR/failure status

✅ **l1_support_tickets** - Support ticket tracking
- Ticket status, category, resolution time
- For SRE, security & admin dashboards

✅ **l1_job_list** - Worker pipeline jobs
- Job type, status, retries, worker utilization
- Powers job SLA metrics, queue depth monitoring

### L2: Derived Views

✅ **l2_transactions_view** - Backward compatibility view
- Maps L1 transaction facts back to legacy structure
- Allows gradual code migration

✅ **l2_customer_summary_view** - Customer analytics view
- Aggregated customer metrics

## Key Principles Implemented

1. ✅ **One authoritative base** - L1 facts feed all analytics
2. ✅ **Clean separation** - PII isolated in L0; analytics use obfuscated IDs
3. ✅ **Schema-safe evolution** - New metrics = new views, not schema changes
4. ✅ **Regional compliance** - All data in-region, encrypted (handled by database)

## Recommended Migration Approach (Direct - No Duplication)

**Best Practice:** Update code first, then migrate data to avoid duplication.

### Step 1: Create Schema Only (Empty Tables)
```bash
npm run migrate -- --schema-only
# OR manually:
psql $DATABASE_URL -f migrations/create-l0-l1-l2-schema.sql
```

### Step 2: Update ALL Application Code
Update all code to use new tables (see `CODE_CHANGES_REQUIRED.md`):
- Transaction writes → `l1_transaction_facts`
- Transaction reads → `l1_transaction_facts`  
- Use tokenized user IDs for analytics
- Use `l0_pii_users` for PII queries

### Step 3: Test Thoroughly
Verify all functionality works with new schema.

### Step 4: Migrate Historical Data
```bash
psql $DATABASE_URL -f migrations/migrate-data-to-l0-l1.sql
# OR:
npm run migrate  # (without --schema-only flag)
```

**Result:** No duplicate data - all new writes go to new tables, historical data is copied once.

### Alternative: Schema + Data Together
If you prefer to migrate data first, then update code:
```bash
npm run migrate  # Creates schema and migrates data
# Then update code to use new tables
# Note: During code update period, new data goes to old tables
# After code update, old tables can be deprecated
```

## What Happens During Migration

1. **Schema Creation**: Creates all new L0/L1/L2 tables
2. **Tokenization**: Generates tokenized user IDs for all existing users
3. **PII Migration**: Moves PII from onboarding_responses to l0_pii_users
4. **Transaction Migration**: Copies transactions to l1_transaction_facts with tokenized IDs
5. **Customer Facts**: Creates l1_customer_facts records with aggregated data
6. **Category Migration**: Populates l0_category_list from admin_keywords
7. **Verification**: Checks data integrity and orphaned records

## Next Steps

### 1. Run the Migration
Execute the migration scripts on your database (local or production).

### 2. Update Application Code
Follow the guide in `CODE_CHANGES_REQUIRED.md` to update:
- Transaction queries → use tokenized user IDs
- Analytics endpoints → use L1 tables
- File upload tracking → create l1_file_ingestion records
- Event tracking → log to l1_event_facts

### 3. Testing
- Verify all queries work with new schema
- Test PII isolation (no real IDs in analytics)
- Verify tokenization works correctly

### 4. Gradual Rollout (Recommended)
- Use dual-write pattern initially
- Compare old vs new data
- Switch reads to new tables
- Eventually remove old tables

## Important Notes

⚠️ **Recommended Approach: Direct Migration**
- Update code FIRST, then migrate data (avoids duplication)
- Or migrate data first, then update code immediately
- Dual-write pattern not recommended (creates duplicate data)

⚠️ **Non-Breaking Migration**
- Old tables remain intact as backup
- New tables created alongside
- Can rollback if needed during transition

⚠️ **Tokenization Salt**
- Default salt is `'default_salt_change_in_production'`
- **IMPORTANT**: Set `TOKENIZATION_SALT` environment variable in production
- Changing salt will invalidate existing tokenized IDs

⚠️ **Backward Compatibility**
- `l2_transactions_view` allows existing code to work temporarily
- Eventually remove view once all code migrated

## Files Modified

- `package.json` - Added `migrate` script

## Files Not Changed (Yet)

All application code files remain unchanged. They will need to be updated according to `CODE_CHANGES_REQUIRED.md`.

## ⚠️ IMPORTANT: Read These Before Migrating

**CRITICAL:** Review these documents before starting migration:

1. **`MIGRATION_SAFETY_REVIEW.md`** ⚠️ **READ FIRST**
   - Safety assessment
   - Compliance gaps (PIPEDA/Law 25)
   - Security issues that must be fixed first
   - Functionality preservation analysis

2. **`MIGRATION_ACTION_PLAN.md`** ⚠️ **ACTION ITEMS**
   - Quick reference checklist
   - Critical fixes required before migration
   - Step-by-step migration guide
   - Timeline recommendations

3. **`DATA_ARCHITECTURE_MIGRATION.md`** - Architecture details
4. **`CODE_CHANGES_REQUIRED.md`** - Code update examples
5. **`DIRECT_MIGRATION_APPROACH.md`** - Migration strategy
6. SQL files for schema reference

## 🚨 Critical Issues to Fix BEFORE Migration

1. **Password Hashing** 🔴 - Replace SHA-256 with bcrypt
2. **Rate Limiting** 🔴 - Add to auth endpoints  
3. **CSRF Protection** 🔴 - Add CSRF tokens
4. **Compliance Features** 🔴 - Account deletion, PII cleanup, consent management

