# Verification Test Plan - Post Migration

**Migration Status:** ✅ Completed (10/16 users migrated - 63%)

---

## 🔍 **Step 1: Investigate Unmigrated Users**

### **Check: Why 6 users weren't migrated?**

The migration API endpoint now includes an investigation query that will show:
- Users with onboarding_responses entries
- But NULL values in users table (not migrated)
- This will help identify if:
  - They have NULL values in onboarding_responses (nothing to migrate)
  - They should have been migrated but weren't
  - There's a data mismatch

**Action:** Refresh the migration status page to see the investigation results.

---

## ✅ **Step 2: Verify Schema Migration**

### **2.1 Check Columns Exist**
- [ ] Navigate to Admin Dashboard → App Health
- [ ] Check that schema shows `completed_at`, `motivation`, `is_active`, `email_validated` columns exist

### **2.2 Verify Data Migration**
- [ ] Go to Analytics → Customer Data tab
- [ ] Click "Refresh Data"
- [ ] Verify users show onboarding data (motivation, emotional_state, etc.)
- [ ] Check that data is coming from `users` table (not `onboarding_responses`)

---

## ✅ **Step 3: Verify Analytics Dashboard**

### **3.1 Cohort Analysis**
- [ ] Navigate to Analytics → Dashboard tab
- [ ] Check Cohort Analysis - Activation table loads
- [ ] Verify data shows in the table (signup weeks, counts)
- [ ] Test filters (Total Accounts, Validated Emails)
- [ ] Check Cohort Analysis - Engagement table loads
- [ ] Verify engagement metrics display correctly

### **3.2 Vanity Metrics**
- [ ] Check Vanity Metrics table loads
- [ ] Verify monthly metrics display (Total Users, MAU, New Users, Transactions, Banks)
- [ ] Test filters work correctly
- [ ] Verify data is computed correctly

---

## ✅ **Step 4: Verify Single Source of Truth**

### **4.1 Customer Data Endpoint** (`/api/admin/customer-data`)
- [ ] READ-only: Only SELECT queries (no INSERT/UPDATE/DELETE)
- [ ] Reads from: `users` table + `l0_pii_users` table
- [ ] Verify PII comes from `l0_pii_users` only
- [ ] Test Export to Excel functionality

### **4.2 Cohort Analysis Endpoint** (`/api/admin/cohort-analysis`)
- [ ] READ-only: Only SELECT queries
- [ ] Reads from: `users` table (signup week, onboarding)
- [ ] Reads from: `transactions` table (statement uploads)
- [ ] No writes to database

### **4.3 Vanity Metrics Endpoint** (`/api/admin/vanity-metrics`)
- [ ] READ-only: Only SELECT queries
- [ ] Reads from: `users`, `transactions`, `user_events` (if exists)
- [ ] No writes to database

### **4.4 Admin Users Endpoint** (`/api/admin/users`)
- [ ] Uses `users.completed_at` (not `onboarding_responses`)
- [ ] READ-only for listing users
- [ ] Schema-adaptive (works before/after migration)

---

## ✅ **Step 5: Verify Endpoints Use Merged Schema**

### **5.1 Onboarding Endpoints**
- [ ] `/api/onboarding` (POST/GET) - Writes to `users` table
- [ ] `/api/onboarding/progress` (PUT) - Updates `users` table
- [ ] `/api/onboarding/status` (GET) - Reads from `users.completed_at`
- [ ] All use schema-adaptive queries (work before/after migration)

**Test:**
1. Create a test user account
2. Complete onboarding flow
3. Verify data saves to `users` table (not `onboarding_responses`)
4. Check onboarding status reads from `users.completed_at`

---

## ✅ **Step 6: Functional Testing**

### **6.1 User Onboarding Flow**
- [ ] New user can register
- [ ] User can complete onboarding
- [ ] Onboarding data saves to `users` table
- [ ] PII saves to `l0_pii_users` table
- [ ] User can access dashboard after onboarding

### **6.2 Admin Dashboard**
- [ ] Customer Data tab shows all user data
- [ ] Accounts tab shows users with correct status
- [ ] Analytics Dashboard shows cohort and vanity metrics
- [ ] All tabs load without errors

### **6.3 Data Integrity**
- [ ] No duplicate data
- [ ] Data matches between tables (users vs onboarding_responses before migration)
- [ ] All relationships maintained (user_id foreign keys)

---

## 🐛 **Step 7: Investigate Unmigrated Users**

If the investigation shows users that should have been migrated:

1. **Check the data:**
   - Do they have non-NULL values in `onboarding_responses`?
   - Are user_ids matching correctly?
   - Is there a data type mismatch?

2. **Re-run migration (if needed):**
   - The migration is safe to run multiple times
   - It uses `IF NOT EXISTS` and `DISTINCT ON` to prevent duplicates
   - Re-running will update users that were missed

3. **Manual fix (if needed):**
   - If specific users need manual migration, we can create a targeted fix

---

## 📋 **Expected Results**

✅ **Schema:** All columns exist in `users` table  
✅ **Data:** All users with onboarding data migrated  
✅ **Analytics:** All endpoints READ from canonical tables  
✅ **Functionality:** All features work correctly  
✅ **Single Source:** Analytics compute on-the-fly from source tables  

---

**Next Steps After Verification:**
1. If everything works: ✅ Migration complete!
2. If unmigrated users found: Investigate and fix
3. If issues found: Fix and re-test

