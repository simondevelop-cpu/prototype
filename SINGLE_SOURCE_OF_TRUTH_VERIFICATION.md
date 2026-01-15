# Single Source of Truth Verification

**Date:** January 14, 2026  
**Purpose:** Verify that analytics and customer data endpoints maintain a single source of truth

---

## ✅ **Principle: Single Source of Truth**

All analytics and customer data endpoints should:
- **READ** from canonical tables: `users`, `transactions`, `user_events`, `l0_pii_users`
- **NOT WRITE** to analytics tables or denormalized views
- Compute metrics on-the-fly from source tables
- Maintain data integrity through foreign keys

---

## 📊 **Analytics Endpoints (READ-only)**

### **1. `/api/admin/customer-data` (GET)**
- **Status:** ✅ READ-only
- **READS from:**
  - `users` table (user data, onboarding columns)
  - `l0_pii_users` table (PII: first_name, last_name, etc.)
- **WRITES:** None (only SELECT queries)
- **Post-migration:** Uses `users` table directly (schema-adaptive)
- **Single Source of Truth:** ✅ Yes - reads from canonical `users` table

### **2. `/api/admin/cohort-analysis` (GET)**
- **Status:** ✅ READ-only
- **READS from:**
  - `users` table (signup week, onboarding completion)
  - `transactions` table (statement uploads)
  - `user_events` table (login tracking - if exists)
- **WRITES:** None (only SELECT queries)
- **Single Source of Truth:** ✅ Yes - reads from canonical tables

### **3. `/api/admin/vanity-metrics` (GET)**
- **Status:** ✅ READ-only
- **READS from:**
  - `users` table (total users, new users per month)
  - `user_events` table (MAU - if exists)
  - `transactions` table (transaction counts, unique banks)
- **WRITES:** None (only SELECT queries)
- **Single Source of Truth:** ✅ Yes - reads from canonical tables

### **4. `/api/admin/users` (GET)**
- **Status:** ⚠️ Needs update after migration
- **READS from:**
  - `users` table (user data)
  - `transactions` table (transaction counts)
  - `onboarding_responses` table (onboarding completion - **needs update**)
- **WRITES:** None (only SELECT queries)
- **Action Required:** Update to use `users.completed_at` instead of `onboarding_responses`
- **Single Source of Truth:** ⚠️ Will be ✅ after update

---

## ✅ **Expected Write Operations (These are OK)**

These endpoints SHOULD write to database:

### **1. Admin Management (Expected Writes)**
- `/api/admin/keywords` (POST/PUT/DELETE) - Manages categorization keywords
- `/api/admin/merchants` (POST/PUT/DELETE) - Manages merchant patterns
- `/api/admin/recategorizations` (PUT) - Marks recategorizations as reviewed

### **2. User Management (Expected Writes)**
- Block/Unblock User - Updates `users.is_active` (expected)
- Login Tracking - Inserts into `user_events` (expected)
- Dashboard Access - Inserts into `user_events` (expected)

### **3. Data Operations (Expected Writes)**
- Transaction Upload - Inserts into `transactions` table (expected)
- PII Storage - Upserts into `l0_pii_users` table (expected)
- Onboarding Completion - Updates `users` table (expected)

### **4. Migration Operations (Expected Writes)**
- `/api/admin/migrate-merge-onboarding` (POST) - Runs migration (expected)
- `/api/admin/migrate-*` endpoints - Schema migrations (expected)

---

## 🔍 **Canonical Tables (Single Source of Truth)**

### **1. `users` Table**
- **Purpose:** Primary user data
- **Contains:** email, password, created_at, onboarding columns (post-migration)
- **Used by:** All analytics endpoints
- **Write Operations:** 
  - ✅ User registration (INSERT)
  - ✅ Onboarding completion (UPDATE)
  - ✅ Block/unblock user (UPDATE is_active)
  - ❌ Analytics endpoints should NOT write

### **2. `transactions` Table**
- **Purpose:** Transaction data
- **Contains:** transaction details, user_id, upload_session_id
- **Used by:** Vanity metrics, cohort analysis
- **Write Operations:**
  - ✅ Transaction upload (INSERT)
  - ✅ User updates transaction (UPDATE)
  - ❌ Analytics endpoints should NOT write

### **3. `user_events` Table**
- **Purpose:** User activity tracking
- **Contains:** login events, dashboard access, etc.
- **Used by:** Vanity metrics (MAU), cohort analysis
- **Write Operations:**
  - ✅ Login tracking (INSERT)
  - ✅ Dashboard access (INSERT)
  - ❌ Analytics endpoints should NOT write

### **4. `l0_pii_users` Table**
- **Purpose:** PII isolation (compliance)
- **Contains:** first_name, last_name, email, etc.
- **Used by:** Customer data endpoint
- **Write Operations:**
  - ✅ PII storage (UPSERT)
  - ✅ Account deletion (soft delete)
  - ❌ Analytics endpoints should NOT write

---

## ⚠️ **Issues Found**

### **Issue 1: `/api/admin/users` still references `onboarding_responses`**
- **Location:** `app/api/admin/users/route.ts` line 63
- **Current:** `LEFT JOIN onboarding_responses o ON u.id = o.user_id`
- **Should be:** Uses `users.completed_at` directly (post-migration)
- **Action:** Update to use `users.completed_at` with schema-adaptive query

---

## 📋 **Verification Checklist**

### **After Migration:**
- [ ] All analytics endpoints READ from canonical tables only
- [ ] No analytics endpoints write to database
- [ ] `/api/admin/users` updated to use `users.completed_at`
- [ ] Customer data pulls from `users` + `l0_pii_users`
- [ ] Cohort analysis pulls from `users` + `transactions` + `user_events`
- [ ] Vanity metrics pulls from `users` + `transactions` + `user_events`
- [ ] No references to `onboarding_responses` in analytics endpoints (except fallback)

---

## ✅ **Summary**

**Analytics Endpoints:**
- ✅ `/api/admin/customer-data` - READ-only, uses `users` + `l0_pii_users`
- ✅ `/api/admin/cohort-analysis` - READ-only, uses canonical tables
- ✅ `/api/admin/vanity-metrics` - READ-only, uses canonical tables
- ⚠️ `/api/admin/users` - Needs update after migration

**Single Source of Truth:** ✅ Maintained (with one fix needed)

**Expected Writes:** ✅ Only on expected operations (admin management, user actions, migrations)

