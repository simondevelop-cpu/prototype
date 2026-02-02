# Excel Export Explanation

## Database Type Detection

The Excel export automatically detects which database provider you're using by checking the connection string:

- **Neon**: Detected if connection string contains `neon.tech` or `neon`
- **Vercel Postgres**: Detected if connection string contains `vercel` or `vercel-storage`
- **Other**: Shows as "PostgreSQL (Unknown Provider)" if connection string exists but doesn't match above
- **Not Configured**: Shows if no connection string is found

You can check your database type by:
1. Looking at the "Database" column in the "API Documentation" sheet
2. Checking your environment variables: `POSTGRES_URL` or `DATABASE_URL`
3. The connection string format will indicate the provider

## Foreign Keys Sheet - "On Delete" Column Explanation

The highlighted "On Delete" column in the Foreign Keys sheet shows what happens when a parent record is deleted:

### **CASCADE**
- When a parent record is deleted, all child records are **automatically deleted**
- Example: If a user is deleted (`users.id`), all their transactions (`l1_transaction_facts`) are also deleted
- Used for: Direct user data that should be removed when the user is deleted

### **NO ACTION**
- Prevents deletion of a parent record if child records exist
- Example: Cannot delete a category (`l0_category_list`) if transactions are using it
- Used for: Reference data that should be protected from accidental deletion

### Why This Matters
- **CASCADE** ensures data consistency and compliance (deleting a user removes all their data)
- **NO ACTION** protects critical reference data from being accidentally deleted
- The database enforces these rules automatically

## PII Detection

The Excel export now correctly flags tables containing PII (Personally Identifiable Information):

- **Email** is now included in PII detection (it shouldn't exist outside `l0_pii_users`)
- Only checks for **structured PII columns** (not unstructured free text like `notes`)
- The `users` table will be flagged as having PII because it contains `email` (kept for backward compatibility with auth, but should ideally only be in `l0_pii_users`)

## New Export: Cohort & Vanity Metrics

A new export endpoint has been created at `/api/admin/export/cohort-vanity` that includes:

1. **Cohort Analysis - Data Details** sheet: All KPIs, formulas, and data sources for cohort analysis
2. **Vanity Metrics - Data Details** sheet: All metrics, formulas, and data sources for vanity metrics
3. **Cohort Analysis Data** sheet: Actual cohort analysis data
4. **Vanity Metrics Data** sheet: Actual vanity metrics data

This export is available from the "Download" tab in the Analytics section of the admin dashboard.

