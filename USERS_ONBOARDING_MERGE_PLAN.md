# Users + Onboarding Merge Plan

**Date:** January 14, 2026  
**Branch:** `admin-dashboard-cohort-analytics`  
**Purpose:** Merge `onboarding_responses` table into `users` table (non-PII columns only), maintaining PII isolation in `l0_pii_users`

---

## 📋 **Requirements Analysis**

### **From Admin Dashboard Vision:**

1. **Customer Data Table** (Master source for all analytics)
   - Should include: user ID, email, names (from l0_pii_users), onboarding data, validated email, intent shorthand
   - Filters: Total accounts, Validated emails, Intent categories (motivation)
   - Export to Excel functionality

2. **Cohort Analysis:**
   - **Activation Table:** Onboarding steps (last_step), completion (completed_at), drop-offs
   - **Engagement Table:** Login events, dashboard access, statement uploads, feedback
   - **Chart:** Days logged in per week
   - Filters: Total accounts, Validated emails, Intent categories (motivation)

3. **Vanity Metrics:**
   - Total users, MAU, New users/month, Total transactions, Unique banks
   - Filters: Total accounts, Validated emails, Intent categories (motivation)

### **Key Data Dependencies:**

✅ **For Cohort/Vanity Analytics:**
- `users.created_at` - Signup date (for cohort grouping)
- `users.motivation` - Intent categories filter (TEXT field, used for filtering)
- `users.last_step` - Onboarding step tracking (INTEGER)
- `users.completed_at` - Onboarding completion (TIMESTAMP)
- `user_events` - Login/dashboard tracking (to be created)
- `transactions.upload_session_id` - Statement upload tracking (to be added)

❌ **NOT needed in users table (stays in l0_pii_users):**
- `first_name`, `last_name`, `date_of_birth`, `recovery_phone`, `province_region` - PII, stays isolated

✅ **Text fields are OK:**
- `motivation` (TEXT) - Used for filtering/grouping, not for aggregations
- `motivation_other`, `acquisition_source`, `acquisition_other` - Support fields, no complex analytics
- Arrays (`emotional_state`, `financial_context`, `insight_preferences`) - Can be filtered/grouped

---

## 🎯 **Migration Strategy**

### **Goal:**
Merge non-PII onboarding columns from `onboarding_responses` into `users` table, keeping PII isolated in `l0_pii_users`.

### **Final Architecture:**
1. **`users` table** - Core user + onboarding questionnaire data (non-PII)
2. **`l0_pii_users` table** - PII isolated (connected via `internal_user_id` only)
3. **`user_events` table** - Events (logins, dashboard access) - TO BE CREATED
4. **`transactions` table** - Transaction data

---

## 📊 **Schema Changes**

### **1. Add Onboarding Columns to `users` Table**

```sql
-- Add onboarding columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS emotional_state TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS financial_context TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation_other TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_other TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS insight_preferences TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS insight_other TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Also add is_active (for Accounts tab)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_validated BOOLEAN DEFAULT FALSE;

-- Indexes for filtering/analytics
CREATE INDEX IF NOT EXISTS idx_users_motivation ON users(motivation);
CREATE INDEX IF NOT EXISTS idx_users_completed_at ON users(completed_at);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_validated ON users(email_validated);
```

### **2. Migrate Data from `onboarding_responses` to `users`**

```sql
-- Migrate data from onboarding_responses to users
-- Use the most recent onboarding response per user (if multiple exist)
UPDATE users u
SET 
  emotional_state = o.emotional_state,
  financial_context = o.financial_context,
  motivation = o.motivation,
  motivation_other = o.motivation_other,
  acquisition_source = o.acquisition_source,
  acquisition_other = o.acquisition_other,
  insight_preferences = o.insight_preferences,
  insight_other = o.insight_other,
  last_step = COALESCE(o.last_step, 0),
  completed_at = o.completed_at,
  updated_at = COALESCE(o.updated_at, o.created_at, NOW())
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    emotional_state,
    financial_context,
    motivation,
    motivation_other,
    acquisition_source,
    acquisition_other,
    insight_preferences,
    insight_other,
    last_step,
    completed_at,
    updated_at,
    created_at
  FROM onboarding_responses
  ORDER BY user_id, created_at DESC
) o
WHERE u.id = o.user_id;
```

### **3. Deprecate `onboarding_responses` Table**

After migration is complete and verified:
- Mark table as deprecated (keep for rollback, remove after verification)
- Update all code to use `users` table instead

---

## 🔄 **Code Changes Required**

### **1. API Endpoints to Update:**

#### **Onboarding Endpoints:**
- `app/api/onboarding/route.ts` - Write to `users` table instead of `onboarding_responses`
- `app/api/onboarding/progress/route.ts` - Update `users` table instead of `onboarding_responses`
- `app/api/onboarding/status/route.ts` - Read from `users` table instead of `onboarding_responses`

#### **Admin Endpoints:**
- `app/api/admin/customer-data/route.ts` - Read from `users` table instead of `onboarding_responses`
- `app/api/admin/users/route.ts` - Already uses `users`, but may need to check onboarding columns
- `app/api/account/export/route.ts` - Read from `users` table instead of `onboarding_responses`

#### **Auth/Onboarding Middleware:**
- `lib/auth-middleware.ts` - Check `users.completed_at` instead of `onboarding_responses`
- Any other code that checks onboarding completion

### **2. Migration Strategy (Code Updates):**

Use **schema-adaptive queries** (check if columns exist) for backward compatibility during migration:
- Check if onboarding columns exist in `users` table
- If yes, use `users` table
- If no, fall back to `onboarding_responses` (pre-migration)

### **3. Files to Update:**

**Primary:**
- `app/api/onboarding/route.ts`
- `app/api/onboarding/progress/route.ts`
- `app/api/onboarding/status/route.ts`
- `app/api/admin/customer-data/route.ts`
- `app/api/account/export/route.ts`
- `lib/auth-middleware.ts`

**Secondary (may reference onboarding_responses):**
- `server.js` (init-db logic)
- `app/api/admin/init-db/route.ts`
- Test files

---

## ✅ **Migration Steps**

### **Phase 1: Schema Migration**
1. ✅ Add onboarding columns to `users` table (schema-only, nullable)
2. ✅ Migrate data from `onboarding_responses` to `users`
3. ✅ Verify data integrity

### **Phase 2: Code Updates (Schema-Adaptive)**
1. ✅ Update onboarding endpoints to write to `users` table
2. ✅ Update onboarding endpoints to read from `users` table (with fallback)
3. ✅ Update admin/customer-data endpoint to read from `users` table
4. ✅ Update account/export endpoint to read from `users` table
5. ✅ Update auth middleware to check `users.completed_at`

### **Phase 3: Verification**
1. ✅ Test onboarding flow (create/update/complete)
2. ✅ Test customer data API
3. ✅ Test account export
4. ✅ Test admin dashboard

### **Phase 4: Cleanup**
1. ✅ Remove fallback logic (assume migration complete)
2. ✅ Mark `onboarding_responses` as deprecated (keep for rollback)
3. ✅ Update documentation

---

## 🔍 **Data Dependencies for Analytics - Comprehensive Verification**

### **Cohort Analysis - Activation Table:**

**Metrics Required:**
- Count starting onboarding
- Count drop off step 1, step 2, etc.
- Count completed onboarding
- Time to onboard

**Source Columns:**
- ✅ `users.created_at` - Signup date (cohort grouping: signup week)
- ✅ `users.last_step` - Onboarding step (INTEGER, 0-7) - Track drop-offs
- ✅ `users.completed_at` - Completion timestamp - Calculate time to onboard
- ✅ `users.motivation` - Intent categories filter (TEXT)
- ✅ `users.email_validated` - Validated emails filter (BOOLEAN)
- ✅ `users.is_active` - Total accounts filter (BOOLEAN)

**Calculation Logic:**
- Starting onboarding: `users.created_at` (signup date)
- Drop-off step N: `users.last_step = N AND users.completed_at IS NULL`
- Completed: `users.completed_at IS NOT NULL`
- Time to onboard: `users.completed_at - users.created_at` (for completed users)

---

### **Cohort Analysis - Engagement Table:**

**Metrics Required:**
- Onboarding completed count
- Uploaded first statement successfully
- Uploaded two statements successfully
- Uploaded three or more statements successfully
- Opened cashflow dashboard with data
- Submitted feedback (TBC)
- Time to onboard
- Time to first upload
- Time to first dashboard
- Time to first insight (TBC)
- Count of transactions uploaded per user
- Count of users logged in on 2+ unique days
- Average days per month logged in

**Source Columns:**
- ✅ `users.completed_at` - Onboarding completion
- ✅ `users.created_at` - Signup date (cohort grouping)
- ✅ `transactions.upload_session_id` - Statement upload tracking (TO BE ADDED)
- ✅ `transactions.created_at` - Upload timestamp (for time to first upload)
- ✅ `user_events` (event_type='dashboard_access') - Dashboard access tracking (TO BE CREATED)
- ✅ `user_events` (event_type='login') - Login tracking (TO BE CREATED)
- ✅ `user_events.event_timestamp` - Event timestamps (for time calculations)
- ✅ `users.motivation` - Intent categories filter
- ✅ `users.email_validated` - Validated emails filter
- ✅ `users.is_active` - Total accounts filter

**Calculation Logic:**
- First upload: `MIN(transactions.created_at)` grouped by `upload_session_id`
- Upload count: `COUNT(DISTINCT upload_session_id)` per user
- Dashboard access: `user_events.event_type = 'dashboard_access'`
- Login days: `COUNT(DISTINCT DATE(user_events.event_timestamp))` where `event_type = 'login'`
- Time calculations: Event timestamp - `users.created_at`

---

### **Vanity Metrics:**

**Metrics Required:**
- Total users
- Monthly active users (MAU)
- New users per month
- Total transactions uploaded
- Total unique banks uploaded

**Source Columns:**
- ✅ `users.created_at` - New users per month (group by month)
- ✅ `users` table - Total users (COUNT)
- ✅ `user_events` (event_type='login') - MAU (COUNT DISTINCT user_id per month)
- ✅ `user_events.event_timestamp` - Month grouping for MAU
- ✅ `transactions` - Total transactions (COUNT)
- ✅ `transactions.account` - Unique banks (COUNT DISTINCT account)
- ✅ `users.motivation` - Intent categories filter
- ✅ `users.email_validated` - Validated emails filter
- ✅ `users.is_active` - Total accounts filter

**Calculation Logic:**
- Total users: `COUNT(*) FROM users`
- MAU: `COUNT(DISTINCT user_id) FROM user_events WHERE event_type = 'login' AND DATE_TRUNC('month', event_timestamp) = <month>`
- New users: `COUNT(*) FROM users WHERE DATE_TRUNC('month', created_at) = <month>`
- Total transactions: `COUNT(*) FROM transactions`
- Unique banks: `COUNT(DISTINCT account) FROM transactions`

---

### **Filters:**

**Filter Options:**
- ✅ **Total accounts:** All users (`users.is_active IS NOT NULL` - no filter, or all users)
- ✅ **Validated emails:** `users.email_validated = true`
- ✅ **Intent categories:** `users.motivation IN (...)` (TEXT field, works for filtering)

**Filter Implementation:**
- Filters applied in SQL WHERE clauses
- Multiple filters combined with AND
- Filters don't modify source tables (computed on-the-fly)

---

## ✅ **Verification Summary**

**All Required Variables Captured:**
- ✅ Onboarding data: `last_step`, `completed_at`, `created_at` → `users` table (after merge)
- ✅ Intent filter: `motivation` → `users` table (after merge)
- ✅ Signup date: `created_at` → `users` table (existing)
- ✅ Login tracking: `user_events` table (TO BE CREATED)
- ✅ Dashboard access: `user_events` table (TO BE CREATED)
- ✅ Statement uploads: `transactions.upload_session_id` (TO BE ADDED)
- ✅ Transaction counts: `transactions` table (existing)
- ✅ Unique banks: `transactions.account` (existing)
- ✅ Filters: `is_active`, `email_validated`, `motivation` → `users` table (after merge)

**Missing Dependencies (To Be Created):**
- ⚠️ `user_events` table - For login/dashboard tracking
- ⚠️ `transactions.upload_session_id` column - For statement upload tracking
- ⚠️ `users.email_validated` column - For validated emails filter (already in plan)

**Conclusion:** All required variables will be available after migration + additional schema changes (user_events table, upload_session_id column).

---

## ⚠️ **Risks & Considerations**

1. **Multiple onboarding_responses per user:**
   - Current code uses `DISTINCT ON (user_id) ORDER BY created_at DESC` to get latest
   - Migration uses same approach (most recent response)

2. **PII fields in onboarding_responses:**
   - `first_name`, `last_name`, `date_of_birth`, `recovery_phone`, `province_region` should NOT be migrated
   - These should already be in `l0_pii_users` (if L0 migration completed)
   - If not, migrate to `l0_pii_users` first, then migrate non-PII to `users`

3. **Schema-adaptive queries:**
   - Use during migration for backward compatibility
   - Remove after migration verified

4. **Text fields for filtering:**
   - `motivation` is TEXT, but works fine for filtering (`WHERE motivation IN (...)`)
   - No need to normalize into separate categories table

---

## 📝 **Next Steps**

1. ✅ Create migration SQL script
2. ✅ Update onboarding API endpoints
3. ✅ Update admin/customer-data endpoint
4. ✅ Update auth middleware
5. ✅ Test thoroughly
6. ✅ Document changes

---

**Status:** Ready for implementation

