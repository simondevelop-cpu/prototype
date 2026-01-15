# Admin Dashboard Implementation Plan

**Branch:** `admin-dashboard-cohort-analytics`  
**Date:** January 7, 2026  
**Status:** Implementation Phase

---

## ✅ **Confirmed Architecture**

Based on user feedback:

### **Three-Table Architecture:**
1. **Users Table** (one row per user)
   - Primary key: `id`
   - Contains: email, password, created_at, etc.

2. **Events Table** (one row per event)
   - Primary key: `id`
   - Foreign key: `user_id` → `users.id`
   - Contains: login events, dashboard access, etc.

3. **Transactions Table** (one row per transaction)
   - Primary key: `id`
   - Foreign key: `user_id` → `users.id` (or `tokenized_user_id` → `l0_user_tokenization`)
   - Contains: transaction data

**Key Principle:** All analytics pull from these three tables. Filters don't change source tables.

---

## 📊 **Database Schema Changes**

### **1. Users Table - Add `is_active`**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
```

### **2. Create Events Table**
```sql
CREATE TABLE IF NOT EXISTS user_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'login', 'dashboard_access', 'feedback', etc.
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB, -- Flexible JSON for additional event data
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_timestamp ON user_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_user_events_user_type ON user_events(user_id, event_type);
```

### **3. Transactions Table - Add `upload_session_id`**
```sql
-- For legacy transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upload_session_id TEXT;

-- For l1_transaction_facts table
ALTER TABLE l1_transaction_facts ADD COLUMN IF NOT EXISTS upload_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_upload_session ON transactions(upload_session_id);
CREATE INDEX IF NOT EXISTS idx_l1_trans_upload_session ON l1_transaction_facts(upload_session_id);
```

---

## 🎯 **Implementation Phases**

### **Phase 1: Database Schema**
1. ✅ Add `is_active` to `users` table
2. ✅ Create `user_events` table
3. ✅ Add `upload_session_id` to transactions tables
4. ✅ Update login endpoint to check `is_active`
5. ✅ Update login endpoint to log to `user_events`
6. ✅ Update statement import to set `upload_session_id`

### **Phase 2: Accounts Tab**
1. ✅ Update `/api/admin/users` to include `is_active`
2. ✅ Create `/api/admin/users/[id]/toggle-active` endpoint
3. ✅ Update Accounts UI with enable/disable toggle
4. ✅ Update login to reject inactive users

### **Phase 3: Customer Data API Enhancement**
1. ✅ Enhance `/api/admin/customer-data` to compute all metrics from:
   - `users` table (user info)
   - `user_events` table (login/dashboard tracking)
   - `transactions` table (statement uploads, transaction counts)
   - `onboarding_responses` table (onboarding data)
2. ✅ Add filters: Total accounts, Validated emails, Intent categories (motivation)
3. ✅ Add export to Excel functionality

### **Phase 4: Cohort Analysis**
1. ✅ Create `/api/admin/cohort-analysis` endpoint
2. ✅ Build Activation table component
3. ✅ Build Engagement table component
4. ✅ Build Engagement chart component
5. ✅ Add filters UI

### **Phase 5: Vanity Metrics**
1. ✅ Create `/api/admin/vanity-metrics` endpoint
2. ✅ Build Vanity Metrics table component
3. ✅ Add filters UI

---

## 📋 **Data Sources for Analytics**

### **Customer Data (Master Source)**
Computed from:
- `users` table → user ID, email, created_at, is_active, email_validated
- `onboarding_responses` table → motivation, onboarding data
- `l0_pii_users` table → PII (first_name, last_name, etc.)
- `user_events` table → login history, dashboard access
- `transactions` table (via upload_session_id) → statement upload counts

### **Cohort Analysis**
- **Cohort grouping:** `users.created_at` (signup week)
- **Activation metrics:** `onboarding_responses` (steps, completion)
- **Engagement metrics:** `user_events` (logins, dashboard), `transactions` (uploads)

### **Vanity Metrics**
- **Total users:** `users` table
- **MAU:** `user_events` table (login events in month)
- **New users:** `users` table (created_at in month)
- **Transactions:** `transactions` table
- **Unique banks:** `transactions.account` field

---

## 🔄 **Tracking Implementation**

### **Login Tracking**
When user logs in:
1. Check `users.is_active` (reject if false)
2. Log event to `user_events`:
   ```sql
   INSERT INTO user_events (user_id, event_type, event_timestamp)
   VALUES ($1, 'login', NOW())
   ```

### **Dashboard Access Tracking**
When user accesses dashboard (frontend):
- Call API endpoint to log event:
  ```sql
  INSERT INTO user_events (user_id, event_type, event_timestamp)
  VALUES ($1, 'dashboard_access', NOW())
  ```

### **Statement Upload Tracking**
When importing transactions:
1. Generate `upload_session_id` (UUID or timestamp-based)
2. Set `upload_session_id` on all transactions in that import
3. Count distinct `upload_session_id` per user = statement upload count

---

## ✅ **Next Steps**

1. ✅ Create database migration script
2. ✅ Implement schema changes
3. ✅ Update login endpoint
4. ✅ Update statement import endpoint
5. ✅ Update Accounts tab
6. ✅ Enhance Customer Data API
7. ✅ Build Cohort Analysis
8. ✅ Build Vanity Metrics

---

**Status:** Ready to implement database schema changes.

