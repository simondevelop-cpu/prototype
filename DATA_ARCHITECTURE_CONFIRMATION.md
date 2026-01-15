# Data Architecture Confirmation

**Date:** January 7, 2026  
**Purpose:** Confirm source table architecture before implementation

---

## ✅ **Current Source Tables Architecture**

Based on your confirmation, here's how the source tables are organized:

### **1. Users Table** (one row per user)
**Primary Key:** `id`  
**Location:** `users` table

**Columns:**
- `id` (PRIMARY KEY)
- `email` (UNIQUE)
- `password_hash`
- `display_name`
- `login_attempts`
- `created_at`
- `is_active` (to be added)

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

**Used for:**
- Login tracking (event_type = 'login')
- Dashboard access tracking (event_type = 'dashboard_access')
- Feedback tracking (event_type = 'feedback') - TBC
- All event-based analytics

---

### **3. Transactions Table** (one row per transaction)
**Primary Key:** `id`  
**Foreign Key:** `user_id` → `users.id` (or `tokenized_user_id` → `l0_user_tokenization`)

**Tables:**
- `transactions` (legacy)
- `l1_transaction_facts` (analytics - uses `tokenized_user_id`)

**Current Columns:**
- `id` (PRIMARY KEY)
- `user_id` or `tokenized_user_id` (FK)
- `date` / `transaction_date`
- `description`, `merchant`, `amount`, `cashflow`, `account`, `category`, `label`
- `created_at`
- `upload_session_id` (to be added)

**Used for:**
- Transaction data
- Statement upload tracking (via `upload_session_id`)
- Transaction counts per user

---

## 📊 **Customer Data API - Source Tables**

The Customer Data API currently pulls from:
- `users` table (user info)
- `l0_pii_users` table (PII - first_name, last_name, etc.) - FK: `internal_user_id` → `users.id`
- `onboarding_responses` table (onboarding data) - FK: `user_id` → `users.id`

**Question:** Should we include `onboarding_responses` in the "three tables" architecture, or keep it separate?

**Current Understanding:**
- **Users table:** User accounts
- **Events table:** Login/dashboard/feedback events (to be created)
- **Transactions table:** Transaction data
- **Onboarding_responses table:** Onboarding questionnaire data (separate?)

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

---

## ✅ **Confirmed Architecture**

**Source Tables for Analytics:**
1. ✅ **Users table** (one row per user, PK: id)
2. ✅ **Events table** (one row per event, PK: id, FK: user_id → users.id) - TO BE CREATED
3. ✅ **Transactions table** (one row per transaction, PK: id, FK: user_id → users.id)
4. ⚠️ **Onboarding_responses table** (one row per user, FK: user_id → users.id) - Keep separate?

**Key Principle:**
- All analytics pull from these source tables
- Filters don't change source tables (filter in SQL queries)
- Customer Data API computes metrics on-the-fly from source tables

---

## ❓ **Question to Confirm**

**Onboarding_responses table:**
- Should this be considered part of the "three tables" architecture?
- Or kept separate as a supporting table?
- **Recommendation:** Keep separate (it's questionnaire data, not event/transaction data)

---

**Status:** Ready to proceed with implementation once architecture is confirmed.

