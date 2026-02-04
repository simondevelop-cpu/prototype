# Post-Migration Code Updates Required

After running the table consolidation migration, the following code updates are required to use the new table structure.

## Critical Updates (Must be done immediately after migration)

### 1. Authentication (`app/api/auth/login/route.ts`)
**Current:** Queries `users` table for email and password_hash
**Update:** 
- Query `l0_pii_users` for email lookup (join with `l1_user_permissions` on `internal_user_id`)
- Query `l1_user_permissions` for password_hash and account status

### 2. Registration (`app/api/auth/register/route.ts`)
**Current:** Inserts into `users` table
**Update:**
- Insert into `l1_user_permissions` for auth data
- Insert into `l0_pii_users` for email and display_name

### 3. Account Update (`app/api/account/update/route.ts`)
**Current:** Updates `users` table
**Update:**
- Update `l0_pii_users` for PII fields (email, display_name, etc.)
- Update `l1_user_permissions` for account status if needed

### 4. Account Personal Data (`app/api/account/personal-data/route.ts`)
**Current:** Queries `users` and `l0_pii_users`
**Update:**
- Query `l0_pii_users` for all PII
- Query `l1_user_permissions` for account status

### 5. Admin Users (`app/api/admin/users/route.ts`)
**Current:** Queries `users` table
**Update:**
- Join `l1_user_permissions` and `l0_pii_users` on `id = internal_user_id`
- Use `l0_pii_users.email` and `l0_pii_users.display_name`
- Use `l1_user_permissions.is_active`, `l1_user_permissions.email_validated`, etc.

### 6. Admin User Block (`app/api/admin/users/block/route.ts`)
**Current:** Updates `users.is_active`
**Update:**
- Update `l1_user_permissions.is_active`

### 7. Admin Customer Data (`app/api/admin/customer-data/route.ts`)
**Current:** Queries `users` table
**Update:**
- Join `l1_user_permissions` and `l0_pii_users`
- Use `l1_user_permissions.created_at` for signup dates
- Use `l0_pii_users` for PII fields

### 8. Admin Cohort Analysis (`app/api/admin/cohort-analysis/route.ts`)
**Current:** Uses `users.created_at` for signup dates, `users.motivation` for intent
**Update:**
- Use `l1_user_permissions.created_at` for signup dates
- Use `onboarding_responses.motivation` for intent (already correct - no change needed)

### 9. Admin Engagement Chart (`app/api/admin/engagement-chart/route.ts`)
**Current:** Uses `users.created_at` for signup dates
**Update:**
- Use `l1_user_permissions.created_at` for signup dates

### 10. Admin Intent Categories (`app/api/admin/intent-categories/route.ts`)
**Current:** Queries `users.motivation`
**Update:**
- Query `onboarding_responses.motivation` (already correct - no change needed)

### 11. Admin Bookings (`app/api/admin/bookings/route.ts`)
**Current:** Joins `chat_bookings` with `users` for email/display_name
**Update:**
- Join with `l0_pii_users` for email/display_name

### 12. Bookings Create (`app/api/bookings/create/route.ts`)
**Current:** Uses `user_id` referencing `users.id`
**Update:**
- `user_id` now references `l1_user_permissions.id` (same value, just different table)

### 13. Event Logging (`lib/event-logger.ts`)
**Current:** Uses `user_id` in events
**Update:**
- `user_id` now references `l1_user_permissions.id` (same value, just different table name in foreign key)

## Non-Critical Updates (Can be done later)

### 14. Admin Dashboard UI (`app/admin/page.tsx`)
**Current:** Displays user data from `users` table
**Update:**
- Display email/display_name from `l0_pii_users`
- Display account status from `l1_user_permissions`

### 15. Account Export (`app/api/account/export/route.ts`)
**Current:** Queries `users` and `l0_pii_users`
**Update:**
- Query `l0_pii_users` for PII
- Query `l1_user_permissions` for account metadata

## Compatibility Approach

To minimize risk, we can:
1. Create a view `users` that joins `l1_user_permissions` and `l0_pii_users` for backward compatibility
2. Update code gradually to use new tables directly
3. Drop the view after all code is updated

## Testing Checklist

After code updates:
- [ ] Login works
- [ ] Registration works
- [ ] Account update works
- [ ] Admin dashboard loads
- [ ] Admin can view users
- [ ] Admin can block/unblock users
- [ ] Analytics queries work
- [ ] Bookings work
- [ ] Event logging works
- [ ] Onboarding flow works

