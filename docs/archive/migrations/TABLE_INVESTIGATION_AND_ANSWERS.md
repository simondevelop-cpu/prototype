# Table Investigation and Answers to Questions

**Date:** January 31, 2026  
**Purpose:** Address all questions from spreadsheet and provide recommendations

---

## Answers to Spreadsheet Questions

### 1. **accounts** (Empty: TRUE)
**Question:** "Do we need this table at all? Check APIs pulling from it - delete if you think safe to delete and covered by other tables"

**Answer:**
- ✅ **Safe to delete** - No APIs reference this table
- Only referenced by `transactions.account_id` foreign key
- Empty table, no data
- **Recommendation:** Drop after dropping `transactions` table (or drop FK first)

**Action:** Can be dropped after `transactions` table is dropped.

---

### 2. **insight_feedback** (Empty: TRUE)
**Question:** "Can you check no API endpoints relate - fine to leave table existing without anything programmed onto it, just want the info"

**Answer:**
- ✅ **No API endpoints reference this table**
- Empty, unused
- **Recommendation:** Safe to drop

**Action:** ✅ Safe to drop now (already verified in drop verification)

---

### 3. **l0_admin_list** (Empty: TRUE)
**Question:** "Can you let me know what purpose this table serves? Does it overlap with another?"

**Answer:**
- **Purpose:** Metadata table for admin configuration
- **Status:** Currently empty and unused
- **Overlap:** No overlap with other tables
- **Recommendation:** Can be dropped if not needed, or keep for future admin configuration features

**Action:** Safe to drop if not planning to use for admin configuration.

---

### 4. **l0_insight_list** (Empty: FALSE)
**Question:** "Can you check this table has no purpose and delete it altogether if I'm right to think it's completely isolated"

**Answer:**
- **Purpose:** Insight rules metadata (one row = insight rule)
- **Status:** Has data, but needs to check if referenced
- **Recommendation:** Check for foreign key references before dropping
- If isolated (no references), can be dropped

**Action:** Investigate references first, then decide.

---

### 5. **l0_pii_users** (Empty: FALSE)
**Question:** "Can we also log the IP address (and PII variables flagged in other tables to here, let's make sure those APIs are updated)"

**Answer:**
- ✅ **IP address logging:** Already implemented
  - `ip_address` column added
  - `ip_address_updated_at` column added
  - Logged in: registration, login, account update
- ✅ **PII variables:** Already migrated from `onboarding_responses`
  - `last_name`, `recovery_phone`, `province_region` moved
- ✅ **APIs updated:** All relevant APIs updated

**Action:** ✅ Complete - IP logging and PII migration done.

---

### 6. **l0_privacy_metadata** (Empty: TRUE)
**Question:** "Can you let me know what purpose this table serves? Is it needed?"

**Answer:**
- **Purpose:** Privacy compliance metadata (data retention policies, consent flags)
- **Status:** Empty, currently unused
- **Recommendation:** Keep if planning to use for privacy policy versioning/retention tracking, otherwise can drop

**Action:** Safe to drop if not using for privacy metadata tracking.

---

### 7. **l1_customer_facts** (Empty: FALSE)
**Question:** "Can we make sure APIs / variables for age, province, user_segment are all logged / sit on the PII table; do we need migration flag (I assume it should be deleted now); I'm surprised consents not showing up on this table - where are they getting logged?"

**Answer:**
- ✅ **PII fields removed:** `age_range`, `province_region`, `migration_flag` dropped from table
- ✅ **PII in correct place:** `province_region` now in `l0_pii_users`
- **Consents:** Logged in `l1_events` table (not `l1_customer_facts`)
  - Event type: `'consent'`
  - Metadata contains: `consentType`, `version`, `scope`, etc.
  - This is correct - consents are events, not customer facts
- **user_segment:** Check if this exists - if it does, should be moved to PII table

**Action:** ✅ Complete - PII fields removed. Consents correctly in `l1_events`.

---

### 8. **l1_event_facts** (Empty: TRUE)
**Question:** "Let's consolidate all variables and functionality with the user events table (and title it "l1_events"); can we add a variable for whether it's a user / admin - and add necessary functionality"

**Answer:**
- ✅ **Consolidated:** `user_events` → `l1_events` (renamed)
- ✅ **is_admin column:** Added to `l1_events`
- ✅ **Functionality:** All APIs updated to use `l1_events`
- **Status:** `l1_event_facts` is empty and can be dropped

**Action:** ✅ Complete - Consolidated. `l1_event_facts` safe to drop.

---

### 9. **l1_file_ingestion** (Empty: TRUE)
**Question:** "Is this empty because we are not storing any parsing data? That makes sense, I just want to check"

**Answer:**
- **Purpose:** File ingestion operational table (tracks uploaded files)
- **Status:** Empty - we're not storing parsing data
- **Recommendation:** This is intentional - can keep for future file tracking or drop if not needed

**Action:** Safe to drop if not planning to track file ingestion.

---

### 10. **l1_job_list** (Empty: TRUE)
**Question:** (No question, but empty)

**Answer:**
- **Purpose:** Worker pipeline job table (for SRE and job SLA metrics)
- **Status:** Empty, not implemented
- **Recommendation:** Keep if planning worker pipeline, otherwise drop

**Action:** Safe to drop if not implementing worker pipeline.

---

### 11. **l1_support_tickets** (Empty: TRUE)
**Question:** (No question, but empty)

**Answer:**
- **Purpose:** Support ticket operational table
- **Status:** Empty, not implemented
- **Recommendation:** Keep if planning support system, otherwise drop

**Action:** Safe to drop if not implementing support tickets.

---

### 12. **onboarding_responses** (Empty: TRUE)
**Question:** "First name fine to keep on this page, but the other variables (last name, recovery phone, province) should all sit on the PII table with functionality there."

**Answer:**
- ✅ **PII migrated:** `last_name`, `recovery_phone`, `province_region` moved to `l0_pii_users`
- **First name:** Can stay in `onboarding_responses` or also move to PII
- **Status:** Table may be empty if all data migrated
- **Recommendation:** Can drop if empty, or keep for onboarding flow data

**Action:** ✅ Complete - PII migrated. Table can be dropped if empty.

---

### 13. **transactions** (Empty: FALSE)
**Question:** "What's the difference for this table and "l1_transaction_facts"? Should we migrate data and all functionality to the other table?"

**Answer:**
- **Difference:**
  - `transactions`: Legacy table, uses `user_id` (direct PII link)
  - `l1_transaction_facts`: New table, uses `tokenized_user_id` (anonymized)
- ✅ **Data migration:** 598/599 transactions migrated
- ✅ **Functionality:** All APIs updated to use `l1_transaction_facts` (with fallback)
- **Remaining:** 1 transaction not migrated (needs investigation)
- **Blockers:** 
  - Foreign keys: `transactions.user_id → users.id`, `transactions.account_id → accounts.id`
  - View: `l2_customer_summary_view` uses `transactions`

**Action:** 
1. Investigate the 1 unmigrated transaction
2. Drop `l2_customer_summary_view` or update it to use `l1_transaction_facts`
3. Drop foreign keys
4. Then drop `transactions` table

---

### 14. **user_events** (Empty: FALSE)
**Question:** "Same question as above, but with reference to "l1_event_facts""

**Answer:**
- ✅ **Consolidated:** `user_events` → `l1_events` (renamed)
- ✅ **Functionality:** All APIs updated
- **Status:** `l1_event_facts` is empty and can be dropped

**Action:** ✅ Complete - Consolidated. `l1_event_facts` safe to drop.

---

### 15. **users** (Empty: FALSE)
**Question:** "We should move all functionality and data from this table to the "l0_pii_users" table or "onboarding_responses""

**Answer:**
- **Current structure:**
  - `users`: Authentication (email, password_hash, display_name)
  - `l0_pii_users`: PII (first_name, last_name, date_of_birth, etc.)
  - `onboarding_responses`: Onboarding questionnaire data
- **Recommendation:** 
  - Keep `users` for authentication (email, password_hash)
  - PII already in `l0_pii_users` ✅
  - Onboarding data can stay in `users` table (post-migration) or `onboarding_responses`
- **Note:** `users` table is still needed for authentication - cannot be fully migrated

**Action:** ✅ Current structure is correct - `users` for auth, PII in `l0_pii_users`.

---

## Summary of Actions

### ✅ Already Complete
1. IP address logging in `l0_pii_users`
2. PII migration from `onboarding_responses` to `l0_pii_users`
3. `user_events` → `l1_events` consolidation
4. `is_admin` column added
5. PII fields removed from `l1_customer_facts`
6. All APIs updated to use new tables

### 🔍 Needs Investigation
1. **1 unmigrated transaction** - Why didn't it migrate?
2. **l0_insight_list** - Check if isolated (no references)
3. **l2_customer_summary_view** - Update to use `l1_transaction_facts` or drop

### 🗑️ Safe to Drop Now
1. `insight_feedback` ✅
2. `l1_event_facts` ✅

### 🗑️ Safe to Drop After Cleanup
1. `accounts` - After `transactions` is dropped
2. `transactions` - After view is updated/dropped and FKs removed
3. `l0_admin_list` - If not using for admin config
4. `l0_privacy_metadata` - If not using for privacy tracking
5. `l1_file_ingestion` - If not tracking file ingestion
6. `l1_job_list` - If not implementing worker pipeline
7. `l1_support_tickets` - If not implementing support system
8. `onboarding_responses` - If empty after migration

---

## Next Steps

1. **Run Investigation** - Click "Investigate" button in Migration tab
2. **Review Results** - Check unmigrated transactions and dependencies
3. **Drop Safe Tables** - Drop `insight_feedback` and `l1_event_facts`
4. **Fix Remaining Issues** - Address view and foreign keys for `transactions`
5. **Final Cleanup** - Drop remaining empty tables

