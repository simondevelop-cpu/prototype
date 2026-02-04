# API Endpoint Review Checklist - Post Migration

This document tracks which endpoints have been updated for the new data architecture and which still need review.

## Migration Status

**Phase 1 (Simple Renames):** ✅ Complete
- `admin_keywords` → `l1_admin_keywords`
- `admin_merchants` → `l1_admin_merchants`
- `admin_available_slots` → `l1_admin_available_slots`
- `admin_chat_bookings` → `l1_admin_chat_bookings`
- `onboarding_responses` → `l1_onboarding_responses`
- `survey_responses` → `l1_survey_responses`
- `l1_events` → `l1_event_facts`

**Phase 2 (Schema Changes):** ✅ Complete
- `l0_category_list` renamed
- `l0_insight_list` renamed
- `categorization_learning` → `l2_user_categorization_learning`

**Phase 3 (Consolidations):** ✅ Complete
- `l1_users` + `l2_customer_summary_view` → `l1_customer_facts`

**Phase 4 (Cleanup):** ✅ Complete
- Dropped unused tables/views

## Endpoints Requiring Review

### ✅ Already Updated
- `/api/transactions/*` - All transaction endpoints use `l1_transaction_facts`
- `/api/user/edit-counts` - Uses `l1_events` / `l1_event_facts`
- `/api/admin/editing-events` - Uses `l1_events` / `l1_event_facts`
- `/api/admin/vanity-metrics` - Uses `l1_transaction_facts`
- `/api/admin/export/all-data` - Updated sheet names and table mappings

### ⚠️ Needs Review
1. **`/api/auth/register`** - ✅ Updated (removed legacy transactions fallback, added l1_onboarding_responses)
2. **`/api/onboarding/*`** - Check if uses `l1_onboarding_responses`
3. **`/api/admin/users`** - Check if uses `l1_onboarding_responses`
4. **`/api/admin/customer-data`** - Check if uses `l1_onboarding_responses`
5. **`/api/account/export`** - Check if uses `l1_onboarding_responses`
6. **Admin dashboard keyword/merchant endpoints** - Check if uses `l1_admin_keywords` / `l1_admin_merchants`
7. **Survey endpoints** - Check if uses `l1_survey_responses`
8. **Categorization learning endpoints** - Check if uses `l2_user_categorization_learning`

## Table Name Mapping

| Old Name | New Name | Status |
|----------|----------|--------|
| `transactions` | `l1_transaction_facts` | ✅ Complete |
| `user_events` | `l1_event_facts` | ✅ Complete |
| `admin_keywords` | `l1_admin_keywords` | ✅ Complete |
| `admin_merchants` | `l1_admin_merchants` | ✅ Complete |
| `admin_available_slots` | `l1_admin_available_slots` | ✅ Complete |
| `admin_chat_bookings` | `l1_admin_chat_bookings` | ✅ Complete |
| `onboarding_responses` | `l1_onboarding_responses` | ✅ Complete |
| `survey_responses` | `l1_survey_responses` | ✅ Complete |
| `categorization_learning` | `l2_user_categorization_learning` | ✅ Complete |
| `l1_events` | `l1_event_facts` | ✅ Complete |

## Excel Export Validation

✅ **Excel Validation Endpoint Created:** `/api/admin/export/validate`
- Checks table name accuracy
- Checks schema alignment
- Validates completeness
- Provides recommendations

✅ **UI Added to App Health Tab:**
- "Validate Excel Export" button
- Shows accuracy, completeness, and schema alignment results
- Provides actionable recommendations

## Beta Email Check

✅ **Fixed Issues:**
- Skip button now properly blocks non-beta emails
- Beta check happens automatically when email is loaded
- Re-checks when returning to verification step
- Beta emails API improved to handle NULL emails and case-insensitive matching

## Next Steps

1. ✅ Run Excel validation to check current state
2. ⚠️ Review all endpoints listed above
3. ⚠️ Update any remaining references to old table names
4. ⚠️ Test all endpoints after updates
5. ⚠️ Run post-migration tests

