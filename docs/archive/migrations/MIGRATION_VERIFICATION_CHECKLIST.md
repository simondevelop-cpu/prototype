# Migration Verification Checklist

**Date:** January 14, 2026  
**Migration:** Merge onboarding_responses into users table

---

## ✅ **Pre-Migration**

- [ ] Code is schema-adaptive (works before and after migration)
- [ ] Migration SQL script reviewed
- [ ] Migration UI page created (`/admin/migrate-merge-onboarding`)
- [ ] Migration API endpoint created (`/api/admin/migrate-merge-onboarding`)

---

## 🚀 **Run Migration**

1. **Navigate to Migration Page**
   - Go to `/admin/migrate-merge-onboarding` in admin dashboard
   - Or call API: `POST /api/admin/migrate-merge-onboarding`

2. **Run Migration**
   - Click "Run Migration" button
   - Verify migration completes successfully
   - Check status shows "Migration Completed: ✅ Yes"

3. **Verify Migration Status**
   - Check that columns exist in `users` table
   - Verify data was migrated correctly
   - Check migration count matches expected

---

## ✅ **Post-Migration Verification**

### **1. Schema Verification**

- [ ] Columns exist in `users` table:
  - `emotional_state`, `financial_context`, `motivation`, `motivation_other`
  - `acquisition_source`, `acquisition_other`, `insight_preferences`, `insight_other`
  - `last_step`, `completed_at`, `updated_at`
  - `is_active`, `email_validated`
- [ ] Indexes created on `users` table
- [ ] Data migrated from `onboarding_responses` to `users`

### **2. Single Source of Truth Verification**

Verify that analytics endpoints READ from canonical tables only:

#### **2.1 Customer Data Endpoint (`/api/admin/customer-data`)**
- [ ] **READS from:** `users` table + `l0_pii_users` table
- [ ] **NO WRITES:** Only SELECT queries (no INSERT/UPDATE/DELETE)
- [ ] After migration, uses `users` table directly (schema-adaptive)
- [ ] PII comes from `l0_pii_users` only

#### **2.2 Cohort Analysis Endpoint (`/api/admin/cohort-analysis`)**
- [ ] **READS from:** `users` table (for signup week, onboarding data)
- [ ] **NO WRITES:** Only SELECT queries (no INSERT/UPDATE/DELETE)
- [ ] Uses `users.created_at` for signup week
- [ ] Uses `users.completed_at` for onboarding completion

#### **2.3 Vanity Metrics Endpoint (`/api/admin/vanity-metrics`)**
- [ ] **READS from:** 
  - `users` table (for total users, new users)
  - `user_events` table (for MAU - if exists)
  - `transactions` table (for transaction counts, unique banks)
- [ ] **NO WRITES:** Only SELECT queries (no INSERT/UPDATE/DELETE)

#### **2.4 Admin Users Endpoint (`/api/admin/users`)**
- [ ] **READS from:** `users` table + `transactions` table
- [ ] **WRITES:** None (read-only for listing users)

### **3. Expected Write Operations (These are OK)**

These operations SHOULD write to database:

- [ ] **Block/Unblock User:** Updates `users.is_active` (expected)
- [ ] **Login Tracking:** Inserts into `user_events` table (expected)
- [ ] **Dashboard Access:** Inserts into `user_events` table (expected)
- [ ] **Transaction Upload:** Inserts into `transactions` table (expected)
- [ ] **PII Storage:** Upserts into `l0_pii_users` table (expected)
- [ ] **Onboarding Completion:** Updates `users` table (expected)

### **4. Code Verification**

#### **4.1 All Endpoints Use Merged Schema**

- [ ] `/api/onboarding` (POST/GET) - Uses `users` table (schema-adaptive)
- [ ] `/api/onboarding/progress` (PUT) - Uses `users` table (schema-adaptive)
- [ ] `/api/onboarding/status` (GET) - Uses `users` table (schema-adaptive)
- [ ] `/api/admin/customer-data` (GET) - Uses `users` table (schema-adaptive)
- [ ] `/api/account/export` (GET) - Uses `users` table (schema-adaptive)
- [ ] `lib/auth-middleware.ts` - Uses `users.completed_at` (schema-adaptive)

#### **4.2 Fallback Code (Pre-Migration)**

- [ ] Code still has fallback to `onboarding_responses` table (for safety)
- [ ] Fallback code only executes if `users.completed_at` column doesn't exist
- [ ] After migration, fallback code is never executed

### **5. Functional Testing**

- [ ] **Onboarding Flow:** User can complete onboarding
- [ ] **Customer Data Tab:** Shows data from `users` table
- [ ] **Cohort Analysis:** Displays activation/engagement metrics
- [ ] **Vanity Metrics:** Displays monthly metrics
- [ ] **Export to Excel:** Customer data exports correctly
- [ ] **Accounts Tab:** Shows users with correct data

---

## 📋 **SQL Verification Queries**

Run these queries to verify migration:

```sql
-- Check columns exist in users table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('completed_at', 'motivation', 'is_active', 'email_validated');

-- Check data migration
SELECT 
  COUNT(*) as total_users,
  COUNT(motivation) as users_with_motivation,
  COUNT(completed_at) as users_completed_onboarding
FROM users;

-- Verify analytics endpoints READ from users table (not onboarding_responses)
-- This query shows what Customer Data endpoint should return:
SELECT 
  u.id,
  u.email,
  u.motivation,
  u.completed_at,
  p.first_name,
  p.last_name
FROM users u
LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
WHERE u.email != 'admin@canadianinsights.ca'
LIMIT 5;
```

---

## ⚠️ **Things to Watch For**

1. **Old Schema References:**
   - Code should NOT write to `onboarding_responses` after migration
   - Code should NOT read from `onboarding_responses` after migration (except fallback)

2. **Single Source of Truth:**
   - Analytics endpoints should ONLY READ from canonical tables
   - No materialized views or denormalized tables for analytics
   - All data computed on-the-fly from source tables

3. **Write Operations:**
   - Only expected writes: block user, login tracking, transaction uploads, PII storage
   - Analytics endpoints should be READ-only

---

## 📝 **Next Steps After Verification**

1. **If Migration Successful:**
   - Run full test suite
   - Verify all endpoints work
   - Clean up fallback code (optional - can keep for safety)

2. **If Issues Found:**
   - Check migration logs
   - Verify data integrity
   - Fix any issues
   - Re-run migration if needed

---

**Status:** Ready for migration

