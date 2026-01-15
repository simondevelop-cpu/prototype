# Admin Dashboard Metrics Documentation

This document lists all metrics calculated and displayed in the Admin Dashboard, ensuring every variable is accounted for and tested.

## Vanity Metrics (`/api/admin/vanity-metrics`)

### Weekly Metrics (per week):
1. **totalUsers** - Cumulative count of users up to end of week
2. **weeklyActiveUsers (WAU)** - Users who logged in during the week (from `user_events` table)
3. **newUsers** - Users who signed up during the week
4. **monthlyActiveUsers (MAU)** - Users who logged in during the month containing this week
5. **newUsersPerMonth** - Users who signed up in the month containing this week
6. **totalTransactionsUploaded** - Cumulative count of transactions up to end of week
7. **newTransactionsUploaded** - Transactions uploaded during the week
8. **totalTransactionsRecategorised** - Transactions recategorised during the week (from `categorization_learning` table)
9. **totalUniqueBanksUploaded** - Unique bank accounts uploaded during the week

### Filters Applied:
- `totalAccounts` - Show all accounts (no filter)
- `validatedEmails` - Only show validated emails
- `intentCategories` - Filter by motivation/intent categories
- `cohorts` - Filter which week columns to display (does NOT filter users in WHERE clause)
- `dataCoverage` - Filter by upload count (1 upload, 2 uploads, 3+ uploads)

## Cohort Analysis (`/api/admin/cohort-analysis`)

### Activation Metrics (per signup week):
1. **countStartingOnboarding** - Users who started onboarding
2. **countDropOffStep1** - Users who dropped off at step 1 (Emotional Calibration)
3. **countDropOffStep2** - Users who dropped off at step 2 (Financial Context)
4. **countDropOffStep3** - Users who dropped off at step 3 (Motivation)
5. **countDropOffStep4** - Users who dropped off at step 4 (Acquisition Source)
6. **countDropOffStep5** - Users who dropped off at step 5 (Insight Preferences)
7. **countDropOffStep6** - Users who dropped off at step 6 (Email Verification)
8. **countDropOffStep7** - Users who dropped off at step 7 (Account Profile)
9. **countCompletedOnboarding** - Users who completed onboarding
10. **countStartedButNotCompleted** - Users who started but didn't complete and weren't caught by drop-off tracking (calculated: starting - completed - dropOffs)
11. **avgTimeToOnboardMinutes** - Average time to complete onboarding in minutes

### Engagement Metrics (per signup week):
1. **onboardingCompleted** - Users who completed onboarding
2. **uploadedFirstStatement** - Users who uploaded at least one statement
3. **uploadedTwoStatements** - Users who uploaded 2 statements
4. **uploadedThreePlusStatements** - Users who uploaded 3+ statements
5. **avgTimeToOnboardMinutes** - Average time to complete onboarding in minutes
6. **usersUploadedFirstDay** - Users who uploaded on their first day (same calendar day as signup)
7. **avgTimeToFirstUploadFirstDayMinutes** - Average time to first upload for users who uploaded on first day (in minutes)
8. **usersUploadedAfterFirstDay** - Users who uploaded after their first day
9. **avgTimeToFirstUploadAfterFirstDayDays** - Average time to first upload for users who uploaded after first day (in days)
10. **avgTransactionsPerUser** - Average number of transactions per user (of those with transactions)
11. **usersWithTransactions** - Users who have at least one transaction

### Filters Applied:
- `totalAccounts` - Show all accounts (no filter)
- `validatedEmails` - Only show validated emails
- `intentCategories` - Filter by motivation/intent categories
- `cohorts` - Filter by signup weeks
- `dataCoverage` - Filter by upload count (1 upload, 2 uploads, 3+ uploads)

## Engagement Chart (`/api/admin/engagement-chart`)

### Per User Metrics:
1. **userId** - User ID
2. **cohortWeek** - Signup week label (e.g., "w/c 5 Jan 2025")
3. **intentType** - User's motivation/intent category
4. **dataCoverage** - Upload count label (No uploads, 1 upload, 2 uploads, 3+ uploads)
5. **weeks** - Array of 12 weeks from signup, each containing:
   - **week** - Week number (0-11)
   - **loginDays** - Number of unique days logged in during that week

### Filters Applied:
- `totalAccounts` - Show all accounts (no filter)
- `validatedEmails` - Only show validated emails
- `intentCategories` - Filter by motivation/intent categories
- `cohorts` - Filter by signup weeks
- `dataCoverage` - Filter by upload count (1 upload, 2 uploads, 3+ uploads)
- `userIds` - Filter by specific user IDs

## Engagement Signals (calculated in cohort analysis)

1. **avgTransactionsPerUser** - Average transactions per user (of those with transactions)
2. **usersWithTransactions** - Count of users with at least one transaction
3. **avgUniqueMonthsLoggedIn** - Average number of unique months users have logged in, of those who have logged in more than one unique month
4. **loggedInTwoOrMoreDays** - Users who logged in 2 or more unique days
5. **loggedInTwoOrMoreMonths** - Users who logged in 2 or more unique months
6. **avgDaysLoggedInPerMonth** - Average days logged in per month (of those who logged in 2 or more days)

## Data Sources

### Primary Tables:
- `users` - User accounts and onboarding data (post-migration)
- `transactions` - Transaction data
- `user_events` - Login and activity events
- `categorization_learning` - Recategorization data
- `onboarding_responses` - Legacy onboarding data (pre-migration)

### Schema-Adaptive Queries:
All queries check for column/table existence before using them, allowing graceful degradation when schema changes.

