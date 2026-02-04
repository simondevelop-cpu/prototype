# Table Consolidation Migration Plan
## Users → l1_user_permissions + l0_pii_users

**Date:** January 2026  
**Purpose:** Consolidate users table into permissions table and move PII to l0_pii_users for single source of truth

---

## Current State

### `users` Table (to be renamed/migrated)
**Current Columns:**
- `id` (PRIMARY KEY, INTEGER)
- `email` (UNIQUE, TEXT) → **MOVE TO l0_pii_users**
- `password_hash` (TEXT) → **STAY IN l1_user_permissions**
- `display_name` (TEXT) → **MOVE TO l0_pii_users**
- `login_attempts` (INTEGER) → **STAY IN l1_user_permissions**
- `is_active` (BOOLEAN) → **STAY IN l1_user_permissions**
- `email_validated` (BOOLEAN) → **STAY IN l1_user_permissions**
- `created_at` (TIMESTAMP) → **STAY IN l1_user_permissions**
- `updated_at` (TIMESTAMP) → **STAY IN l1_user_permissions**
- `last_step` (INTEGER) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `completed_at` (TIMESTAMP) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `motivation` (TEXT) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `motivation_other` (TEXT) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `emotional_state` (TEXT[]) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `financial_context` (TEXT[]) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `acquisition_source` (TEXT) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `acquisition_other` (TEXT) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `insight_preferences` (TEXT[]) → **STAY IN onboarding_responses (NO DUPLICATION)**
- `insight_other` (TEXT) → **STAY IN onboarding_responses (NO DUPLICATION)**
- Consent fields (if any) → **STAY IN l1_user_permissions**

### `l0_pii_users` Table (to be updated)
**Current Columns:**
- `id` (PRIMARY KEY, SERIAL) - **REMOVE (use internal_user_id as PK)**
- `internal_user_id` (INTEGER, UNIQUE) → **BECOMES PRIMARY KEY**
- `first_name` (TEXT)
- `last_name` (TEXT)
- `date_of_birth` (DATE)
- `recovery_phone` (TEXT)
- `province_region` (TEXT)
- `email` (TEXT) → **ADD IF NOT EXISTS (from users table)**
- `display_name` (TEXT) → **ADD IF NOT EXISTS (from users table)**

### `onboarding_responses` Table (NO CHANGES)
**Stays as-is** - contains all onboarding questionnaire data. No duplication needed.

---

## Target State

### `l1_user_permissions` Table (NEW - renamed from users)
**Columns:**
- `id` (PRIMARY KEY, INTEGER) - **SAME AS users.id**
- `password_hash` (TEXT)
- `login_attempts` (INTEGER DEFAULT 0)
- `is_active` (BOOLEAN DEFAULT TRUE)
- `email_validated` (BOOLEAN DEFAULT FALSE)
- `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)
- `account_creation_consent_at` (TIMESTAMP WITH TIME ZONE) - if exists
- `cookie_consent_at` (TIMESTAMP WITH TIME ZONE) - if exists
- `cookie_consent_choice` (TEXT) - if exists
- `first_upload_consent_at` (TIMESTAMP WITH TIME ZONE) - if exists

**Purpose:** Authentication, authorization, account status, consent tracking

### `l0_pii_users` Table (UPDATED)
**Columns:**
- `internal_user_id` (PRIMARY KEY, INTEGER) - **REFERENCES l1_user_permissions(id)**
- `email` (TEXT, UNIQUE) - **MOVED FROM users**
- `display_name` (TEXT) - **MOVED FROM users**
- `first_name` (TEXT)
- `last_name` (TEXT)
- `date_of_birth` (DATE)
- `recovery_phone` (TEXT)
- `province_region` (TEXT)
- `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)
- `deleted_at` (TIMESTAMP WITH TIME ZONE) - soft delete

**Purpose:** All PII data in one place

### `onboarding_responses` Table (NO CHANGES)
**Stays exactly as-is** - single source of truth for onboarding data

---

## Migration Steps

### Phase 1: Preparation
1. Create `l1_user_permissions` table with correct schema
2. Update `l0_pii_users` to add email and display_name columns (if not exist)
3. Make `internal_user_id` the PRIMARY KEY in `l0_pii_users` (remove redundant `id` column)

### Phase 2: Data Migration
1. Copy permissions data from `users` to `l1_user_permissions`
2. Copy email and display_name from `users` to `l0_pii_users`
3. Verify data integrity (row counts, foreign keys)

### Phase 3: Foreign Key Updates
1. Update all foreign key references from `users(id)` to `l1_user_permissions(id)`
2. Update all foreign key references from `users(id)` to `l0_pii_users(internal_user_id)` where PII is needed

### Phase 4: Code Updates
1. Update all API endpoints that query `users` table
2. Update authentication logic to use `l1_user_permissions` for auth, `l0_pii_users` for email lookup
3. Update admin dashboard queries
4. Update analytics queries (should already use tokenized_user_id)

### Phase 5: Cleanup
1. Rename `users` table to `users_old` (backup)
2. Create view `users` that joins `l1_user_permissions` and `l0_pii_users` for backward compatibility (optional)
3. Drop `users_old` after verification period

---

## Affected Endpoints

### Authentication
- `/api/auth/login` - Query `l1_user_permissions` for password, `l0_pii_users` for email lookup
- `/api/auth/register` - Insert into both `l1_user_permissions` and `l0_pii_users`
- `/api/auth/refresh` - No changes (uses JWT)

### User Account
- `/api/account/personal-data` - Query `l0_pii_users` for PII
- `/api/account/update` - Update `l0_pii_users`
- `/api/account/export` - Query `l0_pii_users` for PII export
- `/api/account` (DELETE) - Soft delete in `l0_pii_users`, hard delete in `l1_user_permissions`

### Admin
- `/api/admin/users` - Join `l1_user_permissions` and `l0_pii_users`
- `/api/admin/users/block` - Update `l1_user_permissions.is_active`
- `/api/admin/customer-data` - Join `l1_user_permissions` and `l0_pii_users`
- `/api/admin/cohort-analysis` - Use `l1_user_permissions.created_at` for signup dates
- `/api/admin/engagement-chart` - Use `l1_user_permissions.created_at` for signup dates
- `/api/admin/intent-categories` - Query `onboarding_responses.motivation` (no change)

### Onboarding
- `/api/onboarding` - Insert/update `onboarding_responses` (no change)
- `/api/onboarding/status` - Query `onboarding_responses` (no change)
- `/api/onboarding/progress` - Query `onboarding_responses` (no change)

### Events
- `/api/admin/events-data` - Join `l1_event_facts` with `l1_user_permissions` and `l0_pii_users`
- All event logging - Use `l1_user_permissions.id` as `user_id`

### Bookings
- `/api/bookings/*` - Use `l1_user_permissions.id` as `user_id`
- `/api/admin/bookings` - Join with `l0_pii_users` for email/display_name

---

## Testing Checklist

### Pre-Migration Tests
- [ ] Verify all users have corresponding l0_pii_users records
- [ ] Verify all users have corresponding onboarding_responses (if completed onboarding)
- [ ] Count rows in users table
- [ ] Verify no duplicate emails

### Migration Tests
- [ ] Row count matches: users → l1_user_permissions
- [ ] Row count matches: users.email → l0_pii_users.email
- [ ] All foreign keys valid
- [ ] No orphaned records

### Post-Migration Tests
- [ ] Login works
- [ ] Registration works
- [ ] Account update works
- [ ] Admin dashboard loads
- [ ] Analytics queries work
- [ ] Onboarding flow works
- [ ] Bookings work
- [ ] Event logging works

---

## Rollback Plan

1. Keep `users` table as `users_old` for 30 days
2. If issues found, revert foreign keys to point to `users_old`
3. Update code to use `users_old` instead of `l1_user_permissions`
4. Drop `l1_user_permissions` if rollback needed

---

## Notes

- **Onboarding data stays in onboarding_responses** - no duplication needed
- **Email is PII** - must be in l0_pii_users
- **Display name is PII** - must be in l0_pii_users
- **Authentication uses l1_user_permissions** - password_hash stays there
- **All analytics use tokenized_user_id** - no changes needed
- **Foreign keys reference l1_user_permissions.id** - same as users.id (no change to ID values)

