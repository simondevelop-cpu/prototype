# Section 3: Data Overview

## Context of the App

**Mission and Summary:** Canadian Insights is a financial personalization platform that helps Canadian consumers understand and optimize their spending by analyzing their bank transaction data. Users upload PDF bank statements, and the platform automatically categorizes transactions, identifies spending patterns, and generates personalized insights to support better financial decision-making. The application uses machine learning to improve categorization accuracy over time based on user corrections, and provides customizable insights based on user-stated preferences and goals.

**MVP vs Ambition:** The current MVP focuses on manual PDF upload functionality for Canadian bank statements (RBC, TD, Scotiabank, BMO, CIBC, Tangerine) with automated categorization and basic spending analytics. The platform is currently limited to Canada-first operations and upload-first data acquisition (no direct bank API integrations). Future iterations may include direct bank API connections, expanded geographic coverage, advanced budgeting tools, savings goal tracking, and more sophisticated AI-driven financial recommendations, but these features are not currently implemented.

## What Data?

We collect and process three categories of personal information:

**1. Account and Onboarding Data (`users` table):**
- Email address (hashed password for authentication)
- Onboarding responses: emotional state, financial context, primary motivation/intent category, acquisition source, insight preferences (all stored as arrays or text fields)
- Account status: creation timestamp, onboarding completion status, last step reached, email validation status, account active status
- Security data: login attempts counter

**2. Transaction Data (`transactions` table):**
- Bank transaction records uploaded by users via PDF statements
- Extracted fields: transaction date, description, merchant name, amount, bank/account name
- Derived data: cashflow type (income/expense/other), category, sub-category label
- Upload metadata: upload session identifier (groups transactions from same PDF upload), import timestamp

**3. Event Tracking Data (`user_events` table):**
- User activity events: event type (e.g., login, dashboard_view, transaction_uploaded), event timestamp
- Optional metadata: JSONB object containing additional event-specific contextual data

**4. PII Isolation (`l0_pii_users` table):**
- Additional personally identifiable information stored separately: first name, last name, date of birth, recovery phone number, province/region

**5. User Corrections (`categorization_learning` table):**
- User-corrected transaction categorizations: description pattern, original category, corrected category/label, frequency of corrections

## Why?

**Primary Purpose:** Provide users with personalized financial insights by analyzing their bank transaction data to generate spending pattern analysis, budgeting assistance, and categorized expense tracking.

**Specific Uses:**
- Service delivery: categorize transactions, generate spending insights, provide personalized recommendations based on user preferences
- User experience: track onboarding progress, customize interface based on stated preferences, improve categorization accuracy through machine learning from user corrections
- Security and operations: authenticate users, prevent unauthorized access, monitor service health, debug technical issues

## What Are We Going to Do With It?

### Hosting

**Primary Host:** Vercel (serverless hosting platform)
- **Location:** United States (Oregon region for serverless functions)
- **Data Processing:** Next.js serverless API routes execute in Vercel's edge network; database queries routed through Vercel to Neon/PostgreSQL

**Database Host:** Neon (serverless PostgreSQL) OR Vercel Postgres (depending on deployment configuration)
- **Location:** Cloud-hosted PostgreSQL (specific region depends on Neon/Vercel configuration)
- **Connection:** Encrypted SSL/TLS connections required for all database access

### Processors

**Third-Party Service Providers:**
1. **Vercel Inc.** – Application hosting, serverless function execution, CDN, edge network routing
2. **Neon Technologies Inc. OR Vercel** – Database hosting and management (PostgreSQL)
3. **PDF Parsing Library (`pdf-parse`)** – Client-side transaction extraction from uploaded bank statements (no data sent to third-party services)

**Processing Activities:**
- **Data Storage:** All personal information stored in PostgreSQL database with row-level isolation by `user_id` foreign key
- **Data Processing:** Transaction categorization, spending analysis, insight generation performed server-side within our application code
- **Data Display:** User-specific dashboards and analytics generated on-demand, filtered by authenticated user's `user_id` (all queries include `WHERE user_id = ?`)

### Deletion & Storage

**Data Retention:**
- **Active Users:** Data retained for duration of account activity; accounts remain active unless user requests deletion or account is marked inactive
- **Inactive Accounts:** No automatic deletion policy currently implemented; accounts persist until manual deletion
- **User-Requested Deletion:** Full deletion available upon request (requires implementation of deletion API endpoint)

**Deletion Mechanism:**
- **Hard Delete:** Direct database row deletion (when implemented)
- **Soft Delete:** `l0_pii_users` table includes `deleted_at` timestamp for soft-delete capability on PII records
- **Cascade Deletion:** Database foreign key constraints configured with `ON DELETE CASCADE` for `user_events` table (events deleted when user deleted)

**Storage Security:**
- Passwords: Hashed using bcryptjs before storage (never stored in plaintext)
- Database Access: Restricted to application server via environment variable credentials
- Connection Security: All database connections require SSL/TLS encryption

### Admin Tools

**Internal Admin Dashboard Access:**
- **Authentication:** Separate admin authentication system (JWT tokens, separate from user authentication)
- **Access Level:** Full read access to all user data for service administration, user support, and analytics
- **Data Display:** Admin dashboard shows aggregated analytics and individual user records (email addresses and last names excluded from certain views per PII handling requirements)
- **Access Control:** Admin access restricted to designated email addresses, requires explicit authentication token

**Admin Use Cases:**
- User support: access user account data to resolve issues
- Analytics: cohort analysis, vanity metrics, engagement tracking across user base
- Service monitoring: health checks, compliance verification (PIPEDA requirements)

## Sharing?

**No Third-Party Sharing:** We do not share personal information with third parties for marketing, advertising, or commercial purposes.

**Internal Access:**
- **Authorized Personnel:** Designated administrators with authenticated access to admin dashboard
- **Technical Processing:** Vercel and Neon/Vercel act as data processors under our instructions (hosting and database services only; no independent use of data)

**Legal Disclosures:** May be required to disclose data in response to valid legal process (subpoena, court order) or to protect rights and safety.

**Data Aggregation:** Analytics and metrics may use aggregated, anonymized data (no individual user identification) for internal business intelligence.

## Plan for SDK / Cookies

**Current State:**
- **No Third-Party SDKs:** Application does not currently integrate third-party analytics SDKs (Google Analytics, Facebook Pixel, etc.)
- **No Tracking Cookies:** No third-party cookies for advertising or cross-site tracking
- **Authentication Cookies:** JWT tokens stored in browser localStorage (not cookies) for session management

**Future Considerations:**
- **No Plans for Advertising SDKs:** No current plans to integrate advertising or marketing tracking SDKs
- **Analytics:** If implemented, will prioritize privacy-preserving analytics (server-side only, aggregated data, no cross-site tracking)
- **Cookies:** If cookie-based session management is implemented, will comply with cookie consent requirements (GDPR, PIPEDA)

## Guidelines and Procedures on Personal Information

**Data Isolation:**
- All database queries include user-specific filtering (`WHERE user_id = ?`) to prevent cross-user data access
- PII stored in separate `l0_pii_users` table with soft-delete capability (`deleted_at` column)
- Admin dashboard explicitly excludes email and last name from certain views per PII handling requirements

**Access Controls:**
- User authentication required for all personal data access
- Admin access requires separate authentication with designated admin credentials
- Database credentials stored as environment variables, not in code repository

**Data Minimization:**
- Collect only data necessary for service delivery (onboarding preferences, transaction data, basic account information)
- Optional PII fields (first name, date of birth, recovery phone, province) collected only if user provides during onboarding

**Security Measures:**
- Password hashing (bcryptjs) before storage
- SSL/TLS encryption for all database connections
- JWT token-based authentication with expiration
- CSRF protection on state-changing API routes

**Compliance Considerations:**
- PIPEDA compliance measures implemented in admin dashboard (compliance checks, documentation tracking)
- User consent obtained during onboarding for data collection and processing
- Privacy policy accessible to users (location to be confirmed)

---

*This overview reflects the current implementation as of the date of this document. Technical architecture may evolve; significant changes will be documented and assessed for privacy impact.*

