# Users Table vs l1_customer_facts Analysis

## Summary

**Recommendation: DO NOT consolidate** - These tables serve different purposes and should remain separate.

## Table Purposes

### `users` Table (Operational/Auth)
- **Purpose**: User authentication, account management, operational queries
- **Contains**: 
  - User account info (email for auth, signup date, account status)
  - Onboarding metadata (motivation, completed_at, last_step)
  - Account flags (is_active, email_validated)
- **ID**: `id` (INTEGER, PRIMARY KEY)
- **Used for**: 
  - Authentication and authorization
  - Operational queries (who signed up when, account status)
  - Cohort grouping (signup week from `created_at`)
  - Intent filtering (from `motivation`)

### `l1_customer_facts` Table (Analytics)
- **Purpose**: Anonymized customer analytics and metrics
- **Contains**:
  - Anonymized demographics (age_range, province_region - generalized)
  - Account state (account_status, user_segment)
  - Engagement metrics (last_active_at, total_transactions, total_imports)
  - Import quality metrics (import_success_rate, avg_transactions_per_import)
  - Reengagement scores
- **ID**: `tokenized_user_id` (TEXT, PRIMARY KEY) - anonymized hash
- **Used for**:
  - Analytics queries (no PII exposure)
  - User segmentation
  - Engagement analysis
  - Import quality metrics

## Key Differences

1. **ID System**:
   - `users`: Uses `id` (internal, operational)
   - `l1_customer_facts`: Uses `tokenized_user_id` (anonymized, analytics)

2. **Data Type**:
   - `users`: Operational data (signup dates, auth info, onboarding steps)
   - `l1_customer_facts`: Aggregated metrics and anonymized attributes

3. **Access Pattern**:
   - `users`: Direct queries for operational needs (auth, account management)
   - `l1_customer_facts`: Analytics queries with PII isolation

4. **PII Handling**:
   - `users`: Contains email (for auth) and operational metadata
   - `l1_customer_facts`: No PII, only anonymized/generalized data

## Current Usage in Analytics

### What's Correct ✅
- **Cohort Analysis**: Uses `users.created_at` for signup week grouping (correct - operational data)
- **Intent Categories**: Uses `users.motivation` for filtering (correct - operational data)
- **Transaction Data**: Uses `l1_transaction_facts` with `tokenized_user_id` (correct - analytics)
- **Event Data**: Uses `l1_event_facts` with `user_id` for operational queries (correct)

### What Should Stay Separate ✅
- **Signup dates**: Stay in `users` table (operational, needed for auth/account management)
- **Onboarding metadata**: Stay in `users` table (operational, needed for account state)
- **Anonymized metrics**: Stay in `l1_customer_facts` (analytics, PII isolation)

## Conclusion

The `users` table and `l1_customer_facts` serve complementary but distinct purposes:
- `users` = Operational/Auth layer (who, when, account state)
- `l1_customer_facts` = Analytics layer (anonymized metrics, segments)

**They should NOT be consolidated** because:
1. Different ID systems (internal vs tokenized)
2. Different access patterns (operational vs analytics)
3. Different PII handling requirements
4. Different update frequencies (operational vs aggregated)

The current architecture is correct - `users` is the single source of truth for operational user data, and `l1_customer_facts` is the single source of truth for anonymized analytics metrics.

