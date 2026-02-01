# Migration Interface Guide

**Date:** January 31, 2026  
**Status:** Ready to Use

---

## Overview

A complete admin interface has been created to run database migrations and verify table drops safely. The interface includes pre-migration tests, migration execution, and post-migration verification.

---

## Features

### 1. Pre-Migration Tests
- **Location:** Migration tab → "Pre-Migration Tests" section
- **Purpose:** Verify database state before running migration
- **Tests Include:**
  - Table existence checks (l0_pii_users, l1_events, l1_transaction_facts)
  - Column existence checks (internal_user_id, ip_address, is_admin)
  - Data migration status (transactions, l1_transaction_facts)
- **Action:** Click "Run Tests" button

### 2. Migration Execution
- **Location:** Migration tab → "Run Migration" section
- **Purpose:** Execute the comprehensive table consolidation migration
- **Features:**
  - Confirmation dialog before execution
  - Single transaction execution (all-or-nothing)
  - Detailed results display
  - Error reporting
- **Action:** Click "Run Migration" button (red, requires confirmation)

### 3. Table Drop Verification
- **Location:** Migration tab → "Table Drop Verification" section
- **Purpose:** Verify if empty/unused tables can be safely dropped
- **Checks:**
  - Row counts
  - Foreign key dependencies
  - Dependent objects (views, etc.)
  - Data migration status
- **Tables Checked:**
  - `transactions` (legacy - should be migrated to l1_transaction_facts)
  - `accounts` (empty, unused)
  - `insight_feedback` (empty, unused)
  - `l1_event_facts` (empty, consolidated into l1_events)
- **Action:** Click "Verify Drops" button

---

## Migration Script Changes

### Version 2 Updates
- **File:** `migrations/comprehensive-table-consolidation-v2.sql`
- **Key Change:** Makes `internal_user_id` the PRIMARY KEY for `l0_pii_users`
- **Process:**
  1. Checks for foreign key references to `l0_pii_users.id`
  2. Drops old PRIMARY KEY constraint
  3. Drops redundant `id` column (if no FKs reference it)
  4. Makes `internal_user_id` the PRIMARY KEY
  5. Adds comments for clarity

---

## API Endpoints

### 1. GET `/api/admin/migration/run`
- **Purpose:** Run pre-migration tests
- **Returns:** Array of test results with pass/fail status
- **Authentication:** Admin token required

### 2. POST `/api/admin/migration/run`
- **Purpose:** Execute migration script
- **Method:** POST
- **Returns:** Migration execution results
- **Authentication:** Admin token required
- **Note:** Executes entire script as single transaction

### 3. GET `/api/admin/migration/verify-drop`
- **Purpose:** Verify if tables can be safely dropped
- **Returns:** Detailed analysis for each table
- **Authentication:** Admin token required

---

## Usage Instructions

### Step 1: Run Pre-Migration Tests
1. Navigate to Admin Dashboard → Migration tab
2. Click "Run Tests" button
3. Review test results:
   - ✓ Green = Pass
   - ✗ Red = Fail (check details)
4. Ensure all critical tests pass before proceeding

### Step 2: Run Migration
1. Review pre-migration test results
2. Click "Run Migration" button
3. Confirm the action in the dialog
4. Wait for execution (may take a few seconds)
5. Review results:
   - Success = All changes applied
   - Errors = Check error details

### Step 3: Verify Table Drops
1. After successful migration, click "Verify Drops"
2. Review each table's status:
   - **Safe to Drop:** Green badge, can be deleted
   - **Not Safe:** Red badge, check reasons
3. Review reasons for each table:
   - Row counts
   - Foreign key dependencies
   - Data migration status

### Step 4: Drop Tables (Manual)
After verification confirms tables are safe to drop, you can manually drop them:
```sql
-- Only drop if verification confirms it's safe!
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS insight_feedback CASCADE;
DROP TABLE IF EXISTS l1_event_facts CASCADE;
```

---

## Safety Features

### 1. Transaction Safety
- Migration runs in a single transaction
- If any error occurs, all changes are rolled back
- Database remains in consistent state

### 2. Pre-Flight Checks
- Tests verify database state before migration
- Identifies potential issues early
- Prevents running migration on incompatible databases

### 3. Dependency Checking
- Verifies foreign key relationships
- Checks for dependent objects (views, etc.)
- Prevents accidental data loss

### 4. Data Migration Verification
- Checks if data has been migrated before dropping tables
- Verifies row counts match between old and new tables
- Prevents dropping tables with unmigrated data

---

## What the Migration Does

1. **Adds IP Address Logging**
   - Adds `ip_address` and `ip_address_updated_at` columns to `l0_pii_users`

2. **Consolidates ID Structure**
   - Makes `internal_user_id` the PRIMARY KEY for `l0_pii_users`
   - Drops redundant `id` column (if safe)

3. **Migrates PII Data**
   - Copies `last_name`, `recovery_phone`, `province_region` from `onboarding_responses` to `l0_pii_users`

4. **Removes PII from Analytics**
   - Drops `age_range`, `province_region`, `migration_flag` from `l1_customer_facts`

5. **Renames Events Table**
   - Renames `user_events` → `l1_events`
   - Adds `is_admin` column
   - Updates existing admin events

6. **Migrates Transactions**
   - Copies remaining transactions from `transactions` to `l1_transaction_facts`
   - Links via tokenization

---

## Troubleshooting

### Migration Fails
- Check error message in results
- Verify all pre-migration tests pass
- Check database connection
- Review migration script for syntax errors

### Tables Not Safe to Drop
- Check row counts - tables may still have data
- Review foreign key dependencies
- Verify data migration completed
- Check for dependent views or functions

### Pre-Migration Tests Fail
- Verify required tables exist
- Check column existence
- Ensure database schema is up to date
- Some tests may fail if migration already ran (that's okay)

---

## Next Steps After Migration

1. **Verify Functionality**
   - Test all admin dashboard features
   - Verify transaction queries work
   - Check event logging
   - Test IP address logging

2. **Drop Verified Tables**
   - Only after confirming everything works
   - Use verification results as guide
   - Drop tables one at a time
   - Test after each drop

3. **Update Documentation**
   - Document new table structure
   - Update API documentation
   - Note any breaking changes

---

## Notes

- Migration is **idempotent** - safe to run multiple times
- Uses `IF EXISTS` and `IF NOT EXISTS` checks
- All changes are logged in results
- Migration runs in a transaction (all-or-nothing)

**Ready to use!** 🚀

