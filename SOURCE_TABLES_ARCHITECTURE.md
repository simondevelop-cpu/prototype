# Source Tables Architecture - Confirmation

**Date:** January 7, 2026  
**Purpose:** Confirm source table organization for analytics

---

## ✅ **Source Tables Architecture (Confirmed)**

Based on your confirmation, here's how the source tables are organized:

### **1. Users Table** (one row per user)
**Primary Key:** `id`  
**Table:** `users`

**Current Columns:**
- `id` (PRIMARY KEY)
- `email` (UNIQUE)
- `password_hash`
- `display_name`
- `login_attempts`
- `created_at`

**To Add:**
- `is_active` (BOOLEAN DEFAULT TRUE)

**Used for:**
- User identification
- Account status (is_active)
- Signup date (for cohort grouping)

---

### **2. Events Table** (one row per event) - **TO BE CREATED**
**Primary Key:** `id`  
**Foreign Key:** `user_id` → `users.id`

**Proposed Schema:**
```sql
CREATE TABLE user_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'login', 'dashboard_access', 'feedback', etc.
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB, -- Flexible JSON for additional event data
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Event Types:**
- `'login'` - User login events
- `'dashboard_access'` - User accessed dashboard
- `'feedback'` - User submitted feedback (TBC)

**Used for:**
- Login tracking (event_type = 'login')
- Dashboard access tracking (event_type = 'dashboard_access')
- All event-based analytics (unique days logged in, unique months, etc.)

---

### **3. Transactions Table** (one row per transaction)
**Primary Key:** `id`  
**Foreign Key:** `user_id` → `users.id` (or `tokenized_user_id` → `l0_user_tokenization`)

**Tables:**
- `transactions` (legacy, FK: `user_id` → `users.id`)
- `l1_transaction_facts` (analytics, FK: `tokenized_user_id` → `l0_user_tokenization`)

**Current Columns:**
- `id` (PRIMARY KEY)
- `user_id` or `tokenized_user_id` (FK)
- `date` / `transaction_date`
- `description`, `merchant`, `amount`, `cashflow`, `account`, `category`, `label`
- `created_at`

**To Add:**
- `upload_session_id` (TEXT) - Groups transactions from same upload session

**Used for:**
- Transaction data
- Statement upload tracking (via `upload_session_id`)
- Transaction counts per user
- Unique banks (via `account` field)

---

### **4. Onboarding Responses Table** (one row per user)
**Primary Key:** `id`  
**Foreign Key:** `user_id` → `users.id`

**Table:** `onboarding_responses`

**Columns:**
- `id` (PRIMARY KEY)
- `user_id` (FK → `users.id`)
- `motivation` (TEXT) - **Used for Intent categories filter**
- `emotional_state`, `financial_context`, etc.
- `completed_at`, `created_at`, etc.

**Used for:**
- Onboarding data
- Intent categories (via `motivation` field)
- Activation metrics (onboarding steps, completion)

---

## 📊 **Customer Data API - Source Tables**

**Current Implementation:**
- `users` table (user info)
- `l0_pii_users` table (PII - first_name, last_name, etc.) - FK: `internal_user_id` → `users.id`
- `onboarding_responses` table (onboarding data) - FK: `user_id` → `users.id`

**Enhanced Implementation:**
- `users` table (user info, is_active, email_validated)
- `l0_pii_users` table (PII)
- `onboarding_responses` table (onboarding data, motivation for intent categories)
- `user_events` table (login/dashboard tracking) - **NEW**
- `transactions` / `l1_transaction_facts` table (statement uploads via `upload_session_id`) - **ENHANCED**

---

## 🔄 **Analytics Data Flow**

### **Cohort Analysis:**
- **Cohort grouping:** `users.created_at` (signup week)
- **Activation metrics:** `onboarding_responses` (steps, completion, drop-offs)
- **Engagement metrics:** 
  - `user_events` (logins, dashboard access)
  - `transactions` (statement uploads via `upload_session_id`)

### **Vanity Metrics:**
- **Total users:** `users` table
- **MAU:** `user_events` table (login events in month)
- **New users:** `users` table (created_at in month)
- **Transactions:** `transactions` / `l1_transaction_facts` table
- **Unique banks:** `transactions.account` field

### **Filters:**
- **Total accounts:** Filter `users` table (all users)
- **Validated emails:** Filter `users` table (email_validated = true)
- **Intent categories:** Filter `onboarding_responses.motivation` field

**Important:** Filters are applied in SQL queries (WHERE clauses), NOT modifying source tables.

---

## ✅ **Confirmed Architecture Summary**

**Source Tables for Analytics:**
1. ✅ **Users table** (one row per user, PK: id)
2. ✅ **Events table** (one row per event, PK: id, FK: user_id → users.id) - **TO BE CREATED**
3. ✅ **Transactions table** (one row per transaction, PK: id, FK: user_id → users.id)
4. ✅ **Onboarding_responses table** (one row per user, FK: user_id → users.id)

**Key Principle:**
- All analytics pull from these source tables
- Filters don't change source tables (filter in SQL queries)
- Customer Data API computes metrics on-the-fly from source tables

---

## 🚀 **Next Steps**

1. ✅ Create `user_events` table
2. ✅ Add `is_active` to `users` table
3. ✅ Add `upload_session_id` to transactions tables
4. ✅ Update login endpoint to check `is_active` and log to `user_events`
5. ✅ Update statement import to set `upload_session_id`
6. ✅ Enhance Customer Data API to use all source tables
7. ✅ Build Cohort Analysis (using source tables)
8. ✅ Build Vanity Metrics (using source tables)

---

**Status:** Architecture confirmed, ready to proceed with implementation.

