# Analytics Tabs - Table Usage Review

## Summary

All analytics tabs are correctly using fact tables where appropriate. The `users` table is used for operational data (signup dates, account state) which is correct and necessary.

## Analytics Tab Review

### 1. Cohort Analysis (`/api/admin/cohort-analysis`)
**Tables Used:**
- ✅ `users` - For signup week grouping (`users.created_at`) and onboarding metadata
- ✅ `l1_transaction_facts` - For transaction data (via `tokenized_user_id`)
- ✅ `l1_event_facts` - For engagement metrics (login events, statement uploads)
- ✅ `l0_user_tokenization` - For mapping internal_user_id to tokenized_user_id
- ✅ `l1_onboarding_responses` - Fallback for onboarding data if not in users table

**Assessment**: ✅ **CORRECT** - Uses fact tables for analytics data, users table for operational metadata (signup dates, cohorts)

### 2. Customer Data (`/api/admin/customer-data`)
**Tables Used:**
- ✅ `users` - For user account info and onboarding metadata
- ✅ `l0_pii_users` - For PII (first_name, last_name) - properly isolated
- ✅ `l1_transaction_facts` - For transaction counts (via `tokenized_user_id`)
- ✅ `l0_user_tokenization` - For mapping

**Assessment**: ✅ **CORRECT** - Uses fact tables for transaction data, users table for account info

### 3. Events Data (`/api/admin/events-data`)
**Tables Used:**
- ✅ `l1_event_facts` - Primary source for all events
- ✅ `users` - For user info (email filtering, first_name from l0_pii_users)

**Assessment**: ✅ **CORRECT** - Uses fact table (l1_event_facts) for events

### 4. Editing Events Data (`/api/admin/editing-events`)
**Tables Used:**
- ✅ `l1_event_facts` - For transaction_edit and bulk_edit events
- ✅ `users` - For user info (email, first_name)

**Assessment**: ✅ **CORRECT** - Uses fact table (l1_event_facts) for editing events

### 5. Vanity Metrics (`/api/admin/vanity-metrics`)
**Tables Used:**
- ✅ `users` - For user counts and signup dates
- ✅ `l1_transaction_facts` - For transaction counts (via `tokenized_user_id`)
- ✅ `l1_event_facts` - For login events, statement uploads, transaction edits
- ✅ `l0_user_tokenization` - For mapping

**Assessment**: ✅ **CORRECT** - Uses fact tables for all metrics

### 6. Engagement Chart (`/api/admin/engagement-chart`)
**Tables Used:**
- ✅ `users` - For signup dates and intent categories (operational data)
- ✅ `l1_event_facts` - For login days and uploads per week (analytics data)
- ✅ `l1_transaction_facts` - For upload counts (via `tokenized_user_id`)
- ✅ `l0_user_tokenization` - For mapping

**Assessment**: ✅ **CORRECT** - Uses fact table (l1_event_facts) for engagement metrics

### 7. Sessions (`/api/admin/sessions`)
**Tables Used:**
- ✅ `l1_event_facts` - For session data and event counts

**Assessment**: ✅ **CORRECT** - Uses fact table (l1_event_facts)

## Key Findings

### ✅ What's Working Correctly

1. **Fact Tables for Analytics**: All analytics data (transactions, events, metrics) comes from fact tables:
   - `l1_transaction_facts` for transaction data
   - `l1_event_facts` for event data
   - Both use `tokenized_user_id` for PII isolation

2. **Users Table for Operational Data**: The `users` table is correctly used for:
   - Signup dates (`users.created_at`) - needed for cohort grouping
   - Account state (is_active, email_validated)
   - Onboarding metadata (motivation, completed_at, last_step)
   - These are operational data, not analytics data

3. **Proper PII Isolation**: PII is properly isolated in `l0_pii_users`, and analytics use `tokenized_user_id`

### 📝 Notes

1. **Users Table is NOT a Fact Table**: The `users` table is an operational/auth table, not a fact table. It's correct to use it for:
   - Signup dates (needed for cohorts)
   - Account metadata (needed for filtering)
   - Onboarding state (needed for activation metrics)

2. **Single Source of Truth**: 
   - Transaction data: `l1_transaction_facts` ✅
   - Event data: `l1_event_facts` ✅
   - User account data: `users` ✅
   - User PII: `l0_pii_users` ✅

3. **No Changes Needed**: All analytics tabs are correctly structured and using the right tables for their purposes.

## Conclusion

**All analytics tabs are correctly using fact tables for analytics data and the users table for operational metadata. No changes are needed.**

The architecture is sound:
- Fact tables (`l1_transaction_facts`, `l1_event_facts`) for analytics
- Operational table (`users`) for account/auth data
- PII table (`l0_pii_users`) for sensitive data
- Tokenization table (`l0_user_tokenization`) for ID mapping

