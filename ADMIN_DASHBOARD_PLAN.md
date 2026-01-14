# Admin Dashboard Enhancement Plan

**Branch:** `admin-dashboard-cohort-analytics`  
**Date:** January 7, 2026  
**Status:** Planning Phase

---

## 🎯 Overview

Comprehensive enhancement of the Admin Dashboard to support:
- Accounts management with enable/disable
- Enhanced Customer Data table (master source for all analytics)
- Cohort Analysis (Activation + Engagement tables + chart)
- Vanity Metrics
- Export functionality

---

## 📋 Requirements Summary

### **1. Accounts Tab**
- ✅ Show emails and names (only place where PII is shown)
- ✅ Include user ID (everywhere else should show user ID only)
- ✅ Add enable/disable toggle button per account
- ✅ Block login if account is disabled (`is_active = false`)

### **2. Customer Data Table (Master Source)**
- ✅ Make this the **master table** for all cohort/vanity/charts analytics
- ✅ Add all required columns to support analytics
- ✅ Export to Excel functionality
- ✅ Filters: Total accounts, Validated emails, Intent categories (motivation)

### **3. Cohort Analysis**
- **Table 1:** Activation (onboarding steps completion by signup week)
- **Table 2:** Engagement (activities completed by signup week)
- **Chart A:** Engagement - number of days logged in
- **Filters:** Total accounts, Validated emails, Intent categories
- **Cohorts:** 12 weeks (w/c Jan 5, 2025 → w/c Feb 9, 2025)

### **4. Vanity Metrics**
- Monthly metrics table (Jan 2026 → Dec 2026)
- Filters: Total accounts, Validated emails, Intent categories
- Metrics: Total users, MAU, New users/month, Total transactions, Total unique banks

---

## 🗄️ Database Schema Changes

### **1. Users Table**
```sql
-- Add is_active column (default true)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
```

### **2. Customer Data Enhancements**

**Decision:** Add tracking columns to existing tables using unique IDs (user_id), NOT separate tracking tables.

**Questions to resolve:**
1. What table should be the "Customer Data" master table?
   - Currently: `customer-data` API pulls from `l0_pii_users` + `onboarding_responses` + `users`
   - Should we create a materialized view? Or enhance the API to compute all metrics?
   - **Option A:** Keep current approach (API computes from multiple tables)
   - **Option B:** Create a `customer_analytics` table with denormalized data
   - **RECOMMENDATION:** Option A (computed via API) - easier to maintain, single source of truth

2. What columns need to be tracked/added?
   - **Statement uploads:** Need to track count + dates
   - **Login history:** Need to track login dates (for "days logged in", "unique months")
   - **Dashboard access:** Need to track when user accessed dashboard
   - **Feedback:** TBC (not built yet)

**Proposed Tracking Approach:**
- Add `user_activity_log` table (generic activity tracking)
- OR add columns to existing tables where appropriate
- OR derive from existing data where possible

**Recommendation:** 
- **Statement uploads:** Derive from transaction timestamps (group by upload session)
- **Login history:** Add `user_sessions` table (track login events)
- **Dashboard access:** Track in `user_sessions` table (session type = 'dashboard')
- **Feedback:** TBC (add when feedback feature is built)

---

## 📊 Data Requirements Analysis

### **Cohort Analysis - Table 1: Activation**

**Rows needed:**
- Count starting onboarding
- Count drop off step 1 (Intent)
- Count drop off step 2
- ...
- Count completed onboarding
- Time to onboard

**Data sources:**
- `onboarding_responses.created_at` (start time)
- `onboarding_responses.last_step` (drop-off point)
- `onboarding_responses.completed_at` (completion time)
- `users.created_at` (signup date - for cohort grouping)

### **Cohort Analysis - Table 2: Engagement**

**Rows needed:**
- Onboarding completed count
- Uploaded first statement successfully
- Uploaded two statements successfully
- Uploaded three or more statements successfully
- Opened cashflow dashboard with data
- Submitted feedback
- Time to onboard
- Time to first upload
- Time to first dashboard
- Time to first insight
- Count of transactions uploaded per user
- Count of users logged in on 2+ unique days
- Average days per month logged in
- Count of users logged in >1 unique month
- Average unique months logged in

**Data sources:**
- Statement uploads: Need to derive from transactions (group by upload session)
- Dashboard access: Need tracking
- Logins: Need tracking
- Feedback: TBC

### **Vanity Metrics**

**Metrics needed:**
- Total users
- Monthly active users
- New users per month
- Total transactions uploaded
- Total unique banks uploaded

**Data sources:**
- Users count: `users` table
- Transactions: `l1_transaction_facts` or `transactions` table
- Unique banks: Derive from transaction `account` field

---

## 🔧 Implementation Plan

### **Phase 1: Database Schema Updates**
1. Add `is_active` column to `users` table
2. Create `user_sessions` table for login/dashboard tracking
3. Update login endpoint to check `is_active`
4. Update login endpoint to log sessions

### **Phase 2: Customer Data API Enhancement**
1. Enhance `/api/admin/customer-data` to include all required metrics
2. Compute metrics on-the-fly from source tables
3. Add filters support (Total accounts, Validated emails, Intent categories)
4. Add export to Excel endpoint

### **Phase 3: Accounts Tab UI**
1. Update Accounts tab to show enable/disable toggle
2. Add API endpoint to toggle `is_active`
3. Update login to reject inactive users

### **Phase 4: Cohort Analysis Implementation**
1. Create `/api/admin/cohort-analysis` endpoint
2. Build Activation table component
3. Build Engagement table component
4. Build Engagement chart component
5. Add filters UI

### **Phase 5: Vanity Metrics Implementation**
1. Create `/api/admin/vanity-metrics` endpoint
2. Build Vanity Metrics table component
3. Add filters UI

### **Phase 6: Integration & Testing**
1. Integrate all components into Analytics tab
2. Test all filters and exports
3. Verify data accuracy

---

## ❓ Open Questions

1. **Tracking Table Structure:**
   - Should we use a single `user_activity_log` table with `activity_type` column?
   - OR separate tables (`user_sessions`, `statement_uploads`, etc.)?
   - **RECOMMENDATION:** Single `user_sessions` table with session type

2. **Statement Upload Tracking:**
   - How do we identify "upload sessions"? (transactions imported together)
   - Should we add `upload_session_id` to transactions?
   - OR derive from transaction `created_at` clustering?
   - **RECOMMENDATION:** Add `upload_session_id` column (nullable, populated on import)

3. **Dashboard Access Tracking:**
   - Should this be part of session tracking?
   - OR separate endpoint call?
   - **RECOMMENDATION:** Part of session tracking (session type = 'dashboard')

4. **Feedback Tracking:**
   - TBC (not built yet)
   - Add when feedback feature is implemented

5. **Customer Data Table Structure:**
   - Should we create a materialized view?
   - OR compute on-the-fly in API?
   - **RECOMMENDATION:** Compute on-the-fly (single source of truth, easier to maintain)

---

## 🚀 Next Steps

1. ✅ Create branch (`admin-dashboard-cohort-analytics`)
2. ⏳ Create this planning document
3. ⏳ Get approval on tracking approach
4. ⏳ Implement database schema changes
5. ⏳ Implement API endpoints
6. ⏳ Implement UI components
7. ⏳ Test and verify

---

**Status:** Ready for implementation after approval of tracking approach.

