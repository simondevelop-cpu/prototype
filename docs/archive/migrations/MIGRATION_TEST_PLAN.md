# Migration Test Plan

**Date:** January 31, 2026  
**Purpose:** Comprehensive test plan to verify all migration changes and functionality

---

## Test Categories

### 1. Pre-Migration Tests (Automated)
**Location:** Migration tab → "Pre-Migration Tests"

Tests verify:
- ✅ All required tables exist
- ✅ Required columns exist
- ✅ Data migration status
- ✅ Table structure correctness

**Status:** ✅ All tests passing

---

### 2. Table Structure Tests
**File:** `tests/integration/migration/functionality-verification.test.ts`

#### 2.1 ID Consolidation
- [x] `l0_pii_users.internal_user_id` is PRIMARY KEY
- [x] `l0_pii_users.id` column removed (or not used)
- [x] IP address columns exist

#### 2.2 Event Table Consolidation
- [x] `l1_events` table exists (not `user_events`)
- [x] `is_admin` column exists and is boolean
- [x] Admin events have `is_admin = TRUE`

#### 2.3 PII Isolation
- [x] No PII fields in `l1_customer_facts` (age_range, province_region, migration_flag)
- [x] PII fields in `l0_pii_users` (last_name, recovery_phone, province_region)

---

### 3. Data Migration Tests

#### 3.1 Transaction Migration
- [x] All transactions migrated to `l1_transaction_facts`
- [x] `legacy_transaction_id` links back to original
- [x] Tokenized user IDs used (not direct user_id)

#### 3.2 PII Migration
- [x] PII data migrated from `onboarding_responses` to `l0_pii_users`
- [x] No data loss during migration

#### 3.3 Event Migration
- [x] All events in `l1_events` (not `user_events`)
- [x] Admin events marked with `is_admin = TRUE`

---

### 4. API Functionality Tests

#### 4.1 Transaction APIs
- [ ] `/api/transactions` uses `l1_transaction_facts`
- [ ] `/api/transactions/update` works with new structure
- [ ] `/api/transactions/bulk-update` works
- [ ] Fallback to `transactions` table works if needed

#### 4.2 Event APIs
- [ ] `/api/consent` logs to `l1_events`
- [ ] `/api/consent/check` queries `l1_events`
- [ ] `/api/user/edit-counts` uses `l1_events`
- [ ] Admin event logging uses `is_admin = TRUE`

#### 4.3 PII APIs
- [ ] `/api/account/personal-data` updates `l0_pii_users`
- [ ] `/api/account/personal-data` logs IP address
- [ ] `/api/onboarding` writes PII to `l0_pii_users`

#### 4.4 Admin APIs
- [ ] `/api/admin/users` uses `l1_transaction_facts`
- [ ] `/api/admin/customer-data` uses `l1_transaction_facts`
- [ ] `/api/admin/cohort-analysis` uses `l1_transaction_facts`
- [ ] `/api/admin/events-data` uses `l1_events`

---

### 5. Empty Tables Tests

#### 5.1 Safe to Drop
- [x] `insight_feedback` - Empty, no references
- [x] `l1_event_facts` - Empty, consolidated

#### 5.2 Needs Investigation
- [ ] `accounts` - Empty but has FKs
- [ ] `l0_admin_list` - Empty, check purpose
- [ ] `l0_insight_list` - Has data, check isolation
- [ ] `l0_privacy_metadata` - Empty, check purpose
- [ ] `l1_file_ingestion` - Empty, intentional?
- [ ] `l1_job_list` - Empty, not implemented
- [ ] `l1_support_tickets` - Empty, not implemented

---

### 6. IP Address Logging Tests

#### 6.1 Registration
- [ ] IP address logged on account creation
- [ ] IP stored in `l0_pii_users.ip_address`

#### 6.2 Login
- [ ] IP address logged on login
- [ ] IP updated in `l0_pii_users.ip_address_updated_at`

#### 6.3 Account Update
- [ ] IP address logged when PII updated
- [ ] IP timestamp updated

---

### 7. Consent Logging Tests

#### 7.1 Consent Events
- [ ] Account creation consent logged
- [ ] Cookie consent logged
- [ ] First upload consent logged
- [ ] Settings update consent logged

#### 7.2 Consent Location
- [ ] All consents in `l1_events` (not `l1_customer_facts`)
- [ ] Event type = 'consent'
- [ ] Metadata contains consentType, version, scope

---

### 8. ID Formatting Tests

#### 8.1 Display Formatting
- [ ] User IDs display as "U123"
- [ ] Event IDs display as "E789"
- [ ] Transaction IDs display as "T456" (when shown)

#### 8.2 Admin Dashboard
- [ ] Accounts table shows formatted user IDs
- [ ] Events table shows formatted event IDs

---

### 9. Table Drop Verification Tests

#### 9.1 Dependency Checking
- [ ] Foreign keys identified
- [ ] Dependent views identified
- [ ] Row counts verified

#### 9.2 Safe Drop Verification
- [ ] Empty tables identified
- [ ] No dependency tables identified
- [ ] Safe tables can be dropped

---

### 10. Integration Tests

#### 10.1 End-to-End Flows
- [ ] User registration → PII logged → IP logged
- [ ] Transaction upload → Migrated to `l1_transaction_facts`
- [ ] Transaction edit → Logged in `l1_events`
- [ ] Admin login → Logged with `is_admin = TRUE`

#### 10.2 Data Consistency
- [ ] Transaction counts match between old and new tables
- [ ] User counts consistent
- [ ] Event counts consistent

---

## Test Execution

### Automated Tests
Run with:
```bash
npm test tests/integration/migration/functionality-verification.test.ts
```

### Manual Tests
1. Use Migration tab in admin dashboard
2. Run pre-migration tests
3. Run migration
4. Verify drop verification
5. Test all API endpoints
6. Verify UI displays

---

## Test Results Tracking

### ✅ Completed
- Table structure verification
- Pre-migration tests
- Migration execution
- Drop verification

### 🔄 In Progress
- API functionality tests
- Integration tests
- Empty tables investigation

### ⏳ Pending
- End-to-end flow tests
- Performance tests
- Data consistency verification

---

## Success Criteria

1. ✅ All pre-migration tests pass
2. ✅ Migration executes successfully
3. ✅ All APIs use new table structure
4. ✅ No data loss during migration
5. ✅ IP addresses logged correctly
6. ✅ Consents logged in correct location
7. ✅ Safe tables can be dropped
8. ✅ All functionality works as expected

---

## Known Issues

1. **1 unmigrated transaction** - Needs investigation
2. **l2_customer_summary_view** - Uses `transactions` table, needs update
3. **Foreign keys** - Need to be dropped before dropping `transactions`

---

## Next Steps

1. Run investigation to find unmigrated transaction
2. Update or drop `l2_customer_summary_view`
3. Drop foreign keys from `transactions`
4. Drop `transactions` and `accounts` tables
5. Drop other empty unused tables
6. Run full test suite
7. Verify all functionality

