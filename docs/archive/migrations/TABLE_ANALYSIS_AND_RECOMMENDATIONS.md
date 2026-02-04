# Table Analysis and Recommendations

**Date:** January 31, 2026  
**Purpose:** Comprehensive analysis of all database tables based on export data and user questions

---

## Summary of Findings

### Empty Tables (Safe to Delete/Review)
- `accounts` - Not used by any APIs, safe to delete
- `insight_feedback` - Not used by any APIs, safe to delete  
- `l0_admin_list` - Metadata table, currently unused
- `l0_privacy_metadata` - Privacy compliance tracking, currently unused
- `l1_event_facts` - Empty, should be consolidated with `user_events`
- `l1_file_ingestion` - Empty, not storing parsing data (intentional)
- `l1_job_list` - Empty, worker pipeline table (not implemented)
- `l1_support_tickets` - Empty, support system (not implemented)
- `onboarding_responses` - Empty, data migrated to `users` table

### Tables Requiring Migration/Consolidation
- `transactions` vs `l1_transaction_facts` - Need to migrate and consolidate
- `user_events` vs `l1_event_facts` - Need to consolidate (rename `user_events` to `l1_events`)
- `users` - Need to migrate functionality to `l0_pii_users` and `onboarding_responses`

### PII Concerns
- `l0_pii_users` - Needs IP address logging
- `l1_customer_facts` - Contains `age_range`, `province_region`, `user_segment` that should be in PII table
- `onboarding_responses` - Contains `last_name`, `recovery_phone`, `province` that should be in PII table

---

## Detailed Analysis by Table

### 1. `accounts` (Empty)
**Status:** ✅ Safe to delete

**Analysis:**
- No API endpoints reference this table
- No queries found using `FROM accounts`, `JOIN accounts`, `INSERT INTO accounts`, or `UPDATE accounts`
- Appears to be a legacy table that was never used

**Recommendation:** 
- Delete the table after confirming no external systems reference it
- No migration needed

---

### 2. `insight_feedback` (Empty)
**Status:** ✅ Safe to delete

**Analysis:**
- No API endpoints reference this table
- No queries found using this table
- Appears to be a planned feature that was never implemented

**Recommendation:**
- Delete the table
- If insights/feedback functionality is needed in the future, it can be added to `user_feedback` or `user_events`

---

### 3. `l0_admin_list` (Empty)
**Status:** ⚠️ Review purpose

**Analysis:**
- Created as part of L0/L1/L2 architecture migration
- Purpose: Admin configuration metadata (one row per admin config)
- Currently unused - no APIs reference it
- Overlaps with: Potentially `admin_keywords` and `admin_merchants` for admin-defined patterns

**Recommendation:**
- **Keep the table** for future admin configuration needs (it's part of the architecture)
- **Document its purpose** clearly
- Consider if admin configurations should be stored here vs. environment variables

---

### 4. `l0_insight_list` (Not Empty)
**Status:** ⚠️ Check if isolated

**Analysis:**
- Created as part of L0/L1/L2 architecture migration
- Purpose: Insight rules metadata (one row per insight rule)
- Contains data (not empty)
- No APIs currently reference it

**Recommendation:**
- **Check if this table is completely isolated** - if no code references it, it may be safe to delete
- If insights functionality is planned, keep it
- If not, delete it

---

### 5. `l0_privacy_metadata` (Empty)
**Status:** ⚠️ Review if needed

**Analysis:**
- Created as part of L0/L1/L2 architecture migration
- Purpose: Privacy compliance tracking (data retention policies, deletion schedules, consent flags)
- Currently empty - no data being stored
- **Important:** Consent is currently logged in `user_events` table, not here

**Recommendation:**
- **Keep the table** for future privacy compliance features (retention policies, scheduled deletions)
- **Migrate consent flags** from `user_events` metadata to this table for better organization
- This table should track:
  - Data retention policies per user
  - Scheduled deletion dates
  - Consent preferences (currently in `user_events.metadata`)

---

### 6. `l0_pii_users` (Not Empty)
**Status:** ✅ Active, needs enhancement

**Current PII Fields:**
- `email`
- `first_name`
- `last_name`
- `date_of_birth`
- `recovery_phone`
- `province_region`

**Missing:**
- ❌ IP address logging

**PII Variables in Other Tables to Move Here:**
- `l1_customer_facts.province_region` → Should be removed (PII)
- `l1_customer_facts.age_range` → Should be removed (derived from PII)
- `onboarding_responses.last_name` → Should be in PII table
- `onboarding_responses.recovery_phone` → Should be in PII table
- `onboarding_responses.province_region` → Should be in PII table

**Recommendation:**
1. **Add IP address column** to `l0_pii_users`:
   ```sql
   ALTER TABLE l0_pii_users ADD COLUMN IF NOT EXISTS ip_address TEXT;
   ALTER TABLE l0_pii_users ADD COLUMN IF NOT EXISTS ip_address_updated_at TIMESTAMP WITH TIME ZONE;
   ```

2. **Update APIs** to log IP addresses:
   - `/api/auth/register` - Log IP on account creation
   - `/api/auth/login` - Log IP on login
   - `/api/account/update` - Log IP when PII is updated

3. **Migrate PII from other tables:**
   - Move `last_name`, `recovery_phone`, `province_region` from `onboarding_responses` to `l0_pii_users`
   - Remove `province_region` and `age_range` from `l1_customer_facts` (these are PII)

---

### 7. `l1_customer_facts` (Not Empty)
**Status:** ⚠️ Needs PII cleanup

**Current Fields:**
- `age_range` - **PII (derived from date_of_birth)** - Should be removed
- `province_region` - **PII** - Should be removed
- `user_segment` - OK (analytics classification)
- `migration_flag` - Should be removed (migration complete)

**Recommendation:**
1. **Remove PII fields:**
   ```sql
   ALTER TABLE l1_customer_facts DROP COLUMN IF EXISTS age_range;
   ALTER TABLE l1_customer_facts DROP COLUMN IF EXISTS province_region;
   ```

2. **Remove migration flag:**
   ```sql
   ALTER TABLE l1_customer_facts DROP COLUMN IF EXISTS migration_flag;
   ```

3. **Update APIs** that reference these fields:
   - Check `/api/admin/cohort-analysis` - Remove references to `age_range` and `province_region`
   - Check `/api/admin/vanity-metrics` - Remove references to these fields

4. **Consent logging:** Consents are currently logged in `user_events` table with `event_type = 'consent'`. This is correct - no change needed.

---

### 8. `l1_event_facts` (Empty)
**Status:** ⚠️ Consolidate with `user_events`

**Analysis:**
- Created as part of L0/L1/L2 architecture migration
- Purpose: Time-stamped events for analytics (uses `tokenized_user_id`)
- Currently empty - all events are in `user_events` table
- `user_events` uses `user_id` (not tokenized), which is better for current implementation

**Recommendation:**
1. **Consolidate functionality:**
   - Rename `user_events` → `l1_events` (to match architecture naming)
   - Add `is_admin` boolean column to distinguish user vs admin events
   - Keep using `user_id` (internal) - tokenization can happen at query time if needed

2. **Migration:**
   ```sql
   -- Rename table
   ALTER TABLE user_events RENAME TO l1_events;
   
   -- Add is_admin column
   ALTER TABLE l1_events ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
   
   -- Update existing admin events
   UPDATE l1_events SET is_admin = TRUE WHERE event_type IN ('admin_login', 'admin_tab_access');
   
   -- Drop empty l1_event_facts table
   DROP TABLE IF EXISTS l1_event_facts;
   ```

3. **Update all API references:**
   - Search and replace `user_events` → `l1_events` in all API files
   - Update `lib/event-logger.ts` to use `l1_events`

---

### 9. `l1_file_ingestion` (Empty)
**Status:** ✅ Intentional - not storing parsing data

**Analysis:**
- Created as part of L0/L1/L2 architecture migration
- Purpose: File ingestion operational table (one row per upload session)
- Currently empty - parsing data is not being stored

**Recommendation:**
- **Keep the table** for future file tracking needs
- **Confirm this is intentional** - if you want to track file uploads, implement logging
- If not needed, can be deleted

---

### 10. `l1_job_list` (Empty)
**Status:** ✅ Worker pipeline not implemented

**Analysis:**
- Created as part of L0/L1/L2 architecture migration
- Purpose: Worker pipeline job table for SRE and job SLA metrics
- Currently empty - worker pipeline not implemented

**Recommendation:**
- **Keep the table** if worker pipeline is planned
- **Delete if not needed** - can be recreated if needed later

---

### 11. `l1_support_tickets` (Empty)
**Status:** ✅ Support system not implemented

**Analysis:**
- Created as part of L0/L1/L2 architecture migration
- Purpose: Support ticket operational table
- Currently empty - support system not implemented

**Recommendation:**
- **Keep the table** if support system is planned
- **Delete if not needed** - can be recreated if needed later

---

### 12. `onboarding_responses` (Empty)
**Status:** ⚠️ Data migrated, but PII needs to be moved

**Analysis:**
- Data has been migrated to `users` table (non-PII columns)
- **PII fields still in schema:** `last_name`, `recovery_phone`, `province_region`
- These should be moved to `l0_pii_users`

**Recommendation:**
1. **Migrate remaining PII:**
   - Move `last_name`, `recovery_phone`, `province_region` from `onboarding_responses` to `l0_pii_users`
   - Keep `first_name` in `onboarding_responses` if needed for display (or move to PII)

2. **Update APIs:**
   - `/api/onboarding` - Update to write PII fields to `l0_pii_users`
   - `/api/account/update` - Ensure PII updates go to `l0_pii_users`

3. **After migration, can drop the table** or keep it for historical reference

---

### 13. `transactions` vs `l1_transaction_facts`
**Status:** ⚠️ Need to migrate and consolidate

**Analysis:**
- **`transactions` table:**
  - Uses `user_id` (internal, not tokenized)
  - Still being used by some APIs (legacy queries)
  - Used in: `/api/admin/users`, `/api/admin/cohort-analysis`, `/api/admin/vanity-metrics`, `/api/admin/customer-data`, `/api/admin/health`, `/api/auth/register`

- **`l1_transaction_facts` table:**
  - Uses `tokenized_user_id` (anonymized)
  - Used by: `/api/transactions/*`, `/api/summary`, `/api/categories`, `/api/statements/import`

**Recommendation:**
1. **Migrate all data from `transactions` to `l1_transaction_facts`:**
   ```sql
   -- Migrate transactions to l1_transaction_facts
   INSERT INTO l1_transaction_facts (
     tokenized_user_id,
     transaction_date,
     description,
     merchant,
     amount,
     cashflow,
     account,
     category,
     label,
     created_at,
     legacy_transaction_id
   )
   SELECT 
     lut.tokenized_user_id,
     t.date,
     t.description,
     t.merchant,
     t.amount,
     t.cashflow,
     t.account,
     t.category,
     t.label,
     t.created_at,
     t.id
   FROM transactions t
   JOIN l0_user_tokenization lut ON lut.internal_user_id = t.user_id
   WHERE NOT EXISTS (
     SELECT 1 FROM l1_transaction_facts ltf 
     WHERE ltf.legacy_transaction_id = t.id
   );
   ```

2. **Update all APIs to use `l1_transaction_facts`:**
   - Update `/api/admin/users` - Use `l1_transaction_facts` instead of `transactions`
   - Update `/api/admin/cohort-analysis` - Use `l1_transaction_facts`
   - Update `/api/admin/vanity-metrics` - Use `l1_transaction_facts`
   - Update `/api/admin/customer-data` - Use `l1_transaction_facts`
   - Update `/api/admin/health` - Use `l1_transaction_facts`
   - Update `/api/auth/register` - Use `l1_transaction_facts`

3. **After migration, drop `transactions` table:**
   ```sql
   DROP TABLE IF EXISTS transactions;
   ```

---

### 14. `user_events` vs `l1_event_facts`
**Status:** ⚠️ Consolidate (see #8 above)

**Analysis:**
- **`user_events`:** Active, contains all event data (consents, logins, edits, etc.)
- **`l1_event_facts`:** Empty, duplicate purpose

**Recommendation:**
- See recommendation #8 above - rename `user_events` to `l1_events` and drop `l1_event_facts`

---

### 15. `users` table
**Status:** ⚠️ Needs migration to `l0_pii_users` and `onboarding_responses`

**Current Fields:**
- `id` - Keep (primary key)
- `email` - **PII** - Should move to `l0_pii_users`
- `password_hash` - Keep (authentication)
- `display_name` - Keep (non-PII)
- `login_attempts` - Keep (security)
- `is_active` - Keep (account status)
- `email_validated` - Keep (account status)
- `created_at` - Keep (account metadata)
- Onboarding fields (migrated from `onboarding_responses`):
  - `emotional_state`, `financial_context`, `motivation`, etc. - Keep (non-PII analytics)

**Recommendation:**
1. **Move `email` to `l0_pii_users`:**
   - `email` is already in `l0_pii_users` (duplicate)
   - Ensure all email updates go to `l0_pii_users`
   - Keep `email` in `users` for backward compatibility OR remove it

2. **Keep `users` table for:**
   - Authentication (`password_hash`, `login_attempts`)
   - Account status (`is_active`, `email_validated`)
   - Non-PII onboarding data (for analytics)

3. **Update APIs:**
   - Ensure email updates go to both `users` and `l0_pii_users` (or just `l0_pii_users` if removing from `users`)
   - All PII operations should use `l0_pii_users`

---

## Implementation Priority

### High Priority (PII Compliance)
1. ✅ Add IP address logging to `l0_pii_users`
2. ✅ Remove PII fields from `l1_customer_facts` (age_range, province_region)
3. ✅ Migrate PII from `onboarding_responses` to `l0_pii_users`
4. ✅ Update APIs to use PII table for all PII operations

### Medium Priority (Data Consolidation)
5. ✅ Migrate `transactions` → `l1_transaction_facts`
6. ✅ Consolidate `user_events` → `l1_events` (rename)
7. ✅ Remove migration flags from `l1_customer_facts`

### Low Priority (Cleanup)
8. ✅ Delete empty unused tables: `accounts`, `insight_feedback`
9. ✅ Review and potentially delete: `l0_insight_list` (if isolated)
10. ✅ Keep for future: `l0_admin_list`, `l0_privacy_metadata`, `l1_file_ingestion`, `l1_job_list`, `l1_support_tickets`

---

## Next Steps

1. **Review this document** and confirm priorities
2. **Create migration scripts** for high-priority items
3. **Update API endpoints** to use correct tables
4. **Test migrations** in development environment
5. **Execute migrations** in production

