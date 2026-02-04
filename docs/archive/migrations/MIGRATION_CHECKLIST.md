# Migration Checklist: Merge onboarding_responses into users table

**Date:** January 14, 2026  
**Branch:** `admin-dashboard-cohort-analytics`

---

## ✅ **Pre-Migration Checks (Optional but Recommended)**

1. **Backup Database**
   - Create a database backup before running migration
   - Verify backup is complete and accessible

2. **Verify Data Exists**
   - Check that `onboarding_responses` table has data to migrate
   - Verify users exist that have onboarding data

3. **Code is Schema-Adaptive**
   - ✅ All code uses schema-adaptive queries
   - ✅ Code works with both `onboarding_responses` (pre-migration) and `users` (post-migration)
   - ✅ No breaking changes to API contracts

4. **Test Before Migration (Optional)**
   - Run tests to verify code works with `onboarding_responses` table
   - All endpoints should function normally

---

## 🚀 **Migration Steps**

1. **Run Migration SQL**
   ```bash
   psql $DATABASE_URL -f migrations/merge-onboarding-into-users.sql
   ```
   OR via API endpoint (if created)

2. **Verify Migration**
   - Check that columns were added to `users` table
   - Verify data was migrated correctly
   - Check for any errors in migration

---

## ✅ **Post-Migration Checks (Required)**

1. **Verify Data Integrity**
   - Check that all onboarding data was migrated
   - Verify no data loss occurred
   - Check that `users` table has onboarding columns populated

2. **Test All Endpoints**
   - ✅ `/api/onboarding` (POST/GET) - Onboarding completion/retrieval
   - ✅ `/api/onboarding/progress` (PUT) - Onboarding progress updates
   - ✅ `/api/onboarding/status` (GET) - Onboarding status check
   - ✅ `/api/admin/customer-data` (GET) - Admin customer data
   - ✅ `/api/account/export` (GET) - Account data export
   - ✅ Auth middleware - Onboarding completion checks

3. **Verify Code Uses New Schema**
   - Code should now use `users` table (schema-adaptive queries detect columns exist)
   - No errors in logs
   - All functionality works as expected

4. **Run Full Test Suite**
   - Run integration tests
   - Run E2E tests
   - Verify all tests pass

---

## ⚠️ **Rollback Plan (If Needed)**

If migration fails or causes issues:

1. **Restore from Backup**
   - Restore database from pre-migration backup

2. **Code Will Auto-Fallback**
   - Code uses schema-adaptive queries
   - Will automatically use `onboarding_responses` table if `users` columns don't exist
   - No code changes needed for rollback

3. **Investigate Issues**
   - Review migration logs
   - Check for data integrity issues
   - Fix migration SQL if needed
   - Re-run migration after fixes

---

## 📝 **Notes**

- **Schema-adaptive queries:** Code checks if columns exist in `users` table first, then falls back to `onboarding_responses`
- **Safe migration:** Code works both before and after migration
- **No downtime:** Migration can be run anytime, code continues to work
- **Rollback-friendly:** Code automatically falls back if migration fails

---

**Status:** Ready for migration (after code updates are complete)

