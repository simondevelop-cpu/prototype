# Migration Cleanup Checklist

## ✅ Completed

### Code Updates
- ✅ All endpoints updated to use only new table names (no fallback logic)
- ✅ Event logger uses `l1_event_facts` directly
- ✅ All API endpoints query new tables only
- ✅ Excel export updated with new table names
- ✅ Health checks updated to check new tables only
- ✅ Init-db creates `l1_event_facts` instead of `l1_events`

### Table Name Mappings
- ✅ `l1_events` → `l1_event_facts`
- ✅ `onboarding_responses` → `l1_onboarding_responses`
- ✅ `survey_responses` → `l1_survey_responses`
- ✅ `categorization_learning` / `admin_categorization_learning` → `l2_user_categorization_learning`
- ✅ `admin_keywords` → `l1_admin_keywords`
- ✅ `admin_merchants` → `l1_admin_merchants`
- ✅ `admin_available_slots` → `l1_admin_available_slots`
- ✅ `admin_chat_bookings` → `l1_admin_chat_bookings`

## 🔄 Testing & Verification Required

### 1. Migration Execution
- [ ] Verify all 4 migration phases have been executed successfully
- [ ] Check migration tab in admin dashboard for completion status
- [ ] Run pre-migration tests to verify data integrity
- [ ] Run post-migration tests to verify schema alignment

### 2. Database Verification
- [ ] Confirm old tables no longer exist (or are empty and ready to drop):
  - [ ] `l1_events` (should be renamed to `l1_event_facts`)
  - [ ] `onboarding_responses` (should be renamed to `l1_onboarding_responses`)
  - [ ] `survey_responses` (should be renamed to `l1_survey_responses`)
  - [ ] `categorization_learning` (should be renamed to `l2_user_categorization_learning`)
  - [ ] `admin_categorization_learning` (should be renamed to `l2_user_categorization_learning`)
  - [ ] `admin_keywords` (should be renamed to `l1_admin_keywords`)
  - [ ] `admin_merchants` (should be renamed to `l1_admin_merchants`)
  - [ ] `admin_available_slots` (should be renamed to `l1_admin_available_slots`)
  - [ ] `admin_chat_bookings` (should be renamed to `l1_admin_chat_bookings`)
  - [ ] `chat_bookings` (should be renamed to `l1_admin_chat_bookings`)
  - [ ] `available_slots` (should be renamed to `l1_admin_available_slots`)

### 3. Functionality Testing

#### User-Facing Features
- [ ] User login and registration
- [ ] Transaction viewing and editing
- [ ] Statement upload
- [ ] Category management
- [ ] User tracker dashboard (monthly activity)
- [ ] Consent banner (should not appear repeatedly)
- [ ] Survey submission
- [ ] Feedback submission

#### Admin Features
- [ ] Admin login
- [ ] Beta accounts management (add, remove, backfill)
- [ ] Analytics tabs (Cohort Analysis, Vanity Metrics, Engagement Chart)
- [ ] Customer data export
- [ ] Excel export (all database data)
- [ ] Health checks
- [ ] Event logging (admin actions, user events)

### 4. Data Integrity Checks

#### Events Table (`l1_event_facts`)
- [ ] Verify all event types are logging correctly:
  - [ ] `login` events
  - [ ] `consent` events
  - [ ] `transaction_edit` events
  - [ ] `bulk_edit` events
  - [ ] `statement_upload` events
  - [ ] `feedback` events
  - [ ] `admin_login` events
  - [ ] `admin_tab_access` events
- [ ] Verify `session_id` column exists and is populated
- [ ] Verify `tokenized_user_id` is populated for analytics queries

#### Transaction Table (`l1_transaction_facts`)
- [ ] Verify all transactions are accessible
- [ ] Verify `tokenized_user_id` is used for user queries
- [ ] Verify transaction counts match expectations

#### Onboarding Table (`l1_onboarding_responses`)
- [ ] Verify onboarding data is accessible
- [ ] Verify cohort analysis can read onboarding completion

#### Survey Table (`l1_survey_responses`)
- [ ] Verify survey responses are accessible
- [ ] Verify admin dashboard can display survey data

#### Categorization Learning (`l2_user_categorization_learning`)
- [ ] Verify categorization learning is working
- [ ] Verify recategorization log displays correctly

### 5. Excel Export Verification

#### Completeness
- [ ] All tables are exported (check Table of Contents)
- [ ] All columns are included for each table
- [ ] No old table names appear in export
- [ ] `beta_emails` table is included

#### Table of Contents Mapping
- [ ] Sheet names in Table of Contents match actual sheet names
- [ ] All tables have descriptions
- [ ] PII flags are accurate
- [ ] Empty table indicators are correct

#### Sheet Organization
- [ ] Sheets are in logical order (documentation first, then data)
- [ ] Foreign Keys sheet is accurate
- [ ] API Documentation sheet is up to date

### 6. Performance & Error Handling
- [ ] No console errors in browser
- [ ] No 500 errors in API logs
- [ ] Query performance is acceptable
- [ ] No missing data in dashboards

## 🧹 Cleanup Tasks

### After Verification
1. **Analyze Old Tables** (Use cleanup API):
   - Call `GET /api/admin/migration/cleanup` to see which tables are safe to drop
   - Review row counts, dependencies, and recommendations
   - Verify all data has been migrated to new tables

2. **Drop Old Tables** (ONLY after confirming everything works):
   - Use `POST /api/admin/migration/cleanup` with confirmation
   - Or manually via SQL (only if cleanup API confirms safety):
   ```sql
   -- Run these only after full verification
   DROP TABLE IF EXISTS l1_events CASCADE;
   DROP TABLE IF EXISTS onboarding_responses CASCADE;
   DROP TABLE IF EXISTS survey_responses CASCADE;
   DROP TABLE IF EXISTS categorization_learning CASCADE;
   DROP TABLE IF EXISTS admin_categorization_learning CASCADE;
   DROP TABLE IF EXISTS admin_keywords CASCADE;
   DROP TABLE IF EXISTS admin_merchants CASCADE;
   DROP TABLE IF EXISTS admin_available_slots CASCADE;
   DROP TABLE IF EXISTS admin_chat_bookings CASCADE;
   DROP TABLE IF EXISTS chat_bookings CASCADE;
   DROP TABLE IF EXISTS available_slots CASCADE;
   DROP TABLE IF EXISTS transactions CASCADE;
   DROP TABLE IF EXISTS accounts CASCADE;
   DROP TABLE IF EXISTS insight_feedback CASCADE;
   DROP TABLE IF EXISTS user_events CASCADE;
   ```

2. **Update Excel Export Validation**:
   - Remove old table name checks once tables are dropped
   - Update validation to only check for new table names

3. **Documentation**:
   - Update any remaining documentation references
   - Archive migration-related files
   - Update README if needed

## 🐛 Known Issues to Verify

1. **Beta Accounts Backfill**: Fixed - now checks if row was actually inserted
2. **Engagement Chart**: Should work once data is in `l1_event_facts`
3. **Excel Validation Warnings**: Should clear after migration is complete and old tables are dropped
4. **Cookie Consent Banner**: Should not appear repeatedly (fixed with migration-safe queries)

## 📝 Notes

- The migration uses `ALTER TABLE ... RENAME TO`, so tables are renamed, not duplicated
- If old tables still exist, the migration may not have been run yet
- All code now uses only new table names - no fallback logic remains
- Excel export automatically queries whatever tables exist in the database
- Table of Contents uses `getSheetName()` mapping which should match actual sheet names

