# Table Consolidation Implementation Progress

**Date:** January 31, 2026  
**Status:** In Progress

---

## ✅ Completed

### 1. Migration Script Created
- ✅ `migrations/comprehensive-table-consolidation.sql` - Complete migration script
- ✅ Handles table renames, PII migration, column additions/removals

### 2. ID Formatting Utilities
- ✅ `lib/id-formatter.ts` - Created ID formatting functions (U, T, E prefixes)
- ✅ Functions: `formatUserId()`, `formatTransactionId()`, `formatEventId()`, `parseFormattedId()`

### 3. IP Address Logging
- ✅ `lib/ip-address.ts` - Created IP address extraction and logging utilities
- ✅ `getClientIpAddress()` - Extracts IP from Next.js request
- ✅ `updateUserIpAddress()` - Updates IP in l0_pii_users table
- ✅ Added IP logging to `/api/auth/register`
- ✅ Added IP logging to `/api/auth/login`
- ✅ Added IP logging to `/api/account/personal-data` (when PII updated)

### 4. Event Logger Updates
- ✅ Updated `lib/event-logger.ts` - All functions now use `l1_events` instead of `user_events`
- ✅ Added `is_admin` column to all INSERT statements
- ✅ Admin events set `is_admin = TRUE`, user events set `is_admin = FALSE`

### 5. Database Init Updates
- ✅ Updated `app/api/admin/init-db/route.ts` - Creates `l1_events` table with `is_admin` column
- ✅ Updated indexes to use `l1_events` naming

### 6. API Endpoint Updates (user_events → l1_events)
- ✅ `app/api/admin/logins/route.ts`
- ✅ `app/api/user/edit-counts/route.ts`
- ✅ `app/api/admin/editing-events/route.ts`
- ✅ `app/api/consent/check/route.ts`
- ✅ `app/api/admin/users/route.ts`
- ✅ `app/api/admin/privacy-policy-check/route.ts`
- ✅ `app/api/admin/health/route.ts`
- ✅ `app/api/admin/events-data/route.ts`
- ✅ `app/api/admin/user-feedback/route.ts`
- ✅ `app/api/admin/cohort-analysis/route.ts`
- ✅ `app/api/admin/vanity-metrics/route.ts`
- ✅ `app/api/admin/engagement-chart/route.ts`
- ✅ `app/api/admin/export/all-data/route.ts` (documentation only)
- ✅ `app/api/admin/export/api-docs/route.ts` (documentation only)

### 7. Transaction References (Partial)
- ✅ `app/api/admin/users/route.ts` - Updated to use both `l1_transaction_facts` and `transactions` (fallback)
- ✅ `app/api/auth/register/route.ts` - Updated to check `l1_transaction_facts` first

---

## 🚧 In Progress / Remaining

### 1. Transaction References (Still Need Updates)
- ⚠️ `app/api/admin/customer-data/route.ts` - Multiple transaction references
- ⚠️ `app/api/admin/cohort-analysis/route.ts` - Transaction references
- ⚠️ `app/api/admin/vanity-metrics/route.ts` - Transaction references
- ⚠️ `app/api/admin/engagement-chart/route.ts` - Transaction references
- ⚠️ `app/api/admin/health/route.ts` - Transaction references
- ⚠️ `app/api/admin/privacy-policy-check/route.ts` - Transaction references
- ⚠️ `app/api/account/export/route.ts` - Already has fallback logic (good)
- ⚠️ `app/api/statements/parse/route.ts` - May reference transactions
- ⚠️ `app/api/admin/migrate-l0-l1-l2/route.ts` - Migration script references

### 2. PII Migration from onboarding_responses
- ⚠️ Update `/api/onboarding` to write PII fields to `l0_pii_users` instead of `onboarding_responses`
- ⚠️ Ensure `last_name`, `recovery_phone`, `province_region` go to PII table

### 3. Remove PII from l1_customer_facts
- ⚠️ Update any APIs that reference `age_range` or `province_region` in `l1_customer_facts`
- ⚠️ Remove `migration_flag` references

### 4. ID Consolidation (l0_pii_users.id vs internal_user_id)
- ⚠️ Review all code that uses `l0_pii_users.id` and update to use `internal_user_id`
- ⚠️ Consider making `internal_user_id` the primary key (requires migration)

### 5. ID Prefix Display
- ⚠️ Update admin dashboard to display formatted IDs (U123, T456, E789)
- ⚠️ Update user-facing displays if needed

### 6. Table Deletions
- ⚠️ After migration confirmed, drop `transactions` table
- ⚠️ Drop `accounts` table (empty, unused)
- ⚠️ Drop `insight_feedback` table (empty, unused)
- ⚠️ Drop `l1_event_facts` table (empty, consolidated)

### 7. Testing
- ⚠️ Update integration tests to use `l1_events` instead of `user_events`
- ⚠️ Update E2E tests if they reference old table names
- ⚠️ Test IP address logging
- ⚠️ Test transaction migration and queries

---

## 📝 Notes

### ID Consolidation Strategy
- **Current:** `l0_pii_users` has both `id` (SERIAL PK) and `internal_user_id` (UNIQUE, links to users.id)
- **Recommendation:** Use `internal_user_id` as the primary identifier everywhere
- **Display:** Add prefixes (U, T, E) in UI formatting, not in database

### Transaction Migration Pattern
To query transactions for a user, use this pattern:
```sql
-- Preferred: Use l1_transaction_facts via tokenization
SELECT tf.*
FROM l1_transaction_facts tf
JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
WHERE ut.internal_user_id = $userId

-- Fallback: Use legacy transactions table (until migration complete)
SELECT * FROM transactions WHERE user_id = $userId
```

### Event Query Pattern
All event queries should use `l1_events`:
```sql
-- User events
SELECT * FROM l1_events WHERE user_id = $userId AND is_admin = FALSE

-- Admin events
SELECT * FROM l1_events WHERE is_admin = TRUE

-- All events
SELECT * FROM l1_events WHERE user_id = $userId
```

---

## 🔄 Next Steps

1. Continue updating transaction references in remaining API files
2. Update onboarding API to write PII to correct table
3. Remove PII field references from l1_customer_facts queries
4. Add ID prefix formatting to admin dashboard displays
5. Run migration script in development environment
6. Test all functionality
7. Update tests
8. Execute in production

