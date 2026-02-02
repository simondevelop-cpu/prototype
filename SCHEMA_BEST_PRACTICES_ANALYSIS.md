# Schema Best Practices Analysis

**Date:** February 2026  
**Purpose:** Analyze current database schema for best practices, ID consistency, and consolidation opportunities

---

## 🔍 Current Issues Identified

### 1. **ID Inconsistency - Events Table**

**Problem:**
- `l1_events` uses `user_id` (INTEGER, references `users.id`) - **Operational approach**
- `l1_event_facts` uses `tokenized_user_id` (TEXT, references `l0_user_tokenization`) - **Analytics approach**
- `l1_event_facts` is **empty and unused**
- `l1_events` is **actively used** but violates the analytics pattern

**Current State:**
```
l1_events:
  - user_id → users.id (operational, NOT anonymized)
  - Used for: consent, login, admin actions, transaction edits

l1_transaction_facts:
  - tokenized_user_id → l0_user_tokenization.tokenized_user_id (analytics, anonymized)
  - Used for: all transaction data
```

**Issue:** Events should follow the same pattern as transactions for consistency.

---

### 2. **Table Duplication**

**Problem:**
- `l1_events` (operational, uses `user_id`)
- `l1_event_facts` (analytics, uses `tokenized_user_id`, **EMPTY**)

**Recommendation:** 
- **Option A:** Consolidate into `l1_events` but add `tokenized_user_id` column
- **Option B:** Migrate `l1_events` → `l1_event_facts` and drop `l1_events`
- **Option C:** Keep both but clarify purpose (operational vs analytics)

---

### 3. **ID Field Naming Inconsistency**

**Current State:**
| Table | User ID Field | Type | References | Purpose |
|-------|--------------|------|------------|---------|
| `users` | `id` | INTEGER | - | Primary key |
| `l0_pii_users` | `internal_user_id` | INTEGER | `users.id` | PII link |
| `l0_user_tokenization` | `internal_user_id` | INTEGER | `users.id` | Tokenization |
| `l0_user_tokenization` | `tokenized_user_id` | TEXT | Hash | Analytics ID |
| `l1_transaction_facts` | `tokenized_user_id` | TEXT | `l0_user_tokenization` | Analytics |
| `l1_events` | `user_id` | INTEGER | `users.id` | **Operational** |
| `l1_event_facts` | `tokenized_user_id` | TEXT | `l0_user_tokenization` | Analytics (unused) |
| `chat_bookings` | `user_id` | INTEGER | `users.id` | Operational |
| `onboarding_responses` | `user_id` | INTEGER | `users.id` | Operational |
| `categorization_learning` | `user_id` | INTEGER | `users.id` | Operational |
| `survey_responses` | `user_id` | INTEGER | `users.id` | Operational |

**Issue:** Mixed naming (`user_id` vs `internal_user_id` vs `tokenized_user_id`) creates confusion.

---

### 4. **Orphaned Records Risk**

**Current State:**
- ✅ Foreign keys enforce relationships (ON DELETE CASCADE)
- ⚠️ But `l1_events.user_id` has no FK constraint in some cases (duplicate constraint issue)
- ⚠️ `l1_transaction_facts.tokenized_user_id` requires tokenization to exist first

**Questions:**
1. Are all transactions linked to users? ✅ Yes (via tokenized_user_id → tokenization → users)
2. Are all events linked to users? ⚠️ Should be, but `l1_events` uses `user_id` directly
3. Are there orphaned records? Need to check

---

## 📋 Recommendations

### **Priority 1: Fix Events Table Inconsistency**

**Problem:** `l1_events` uses `user_id` (operational) while `l1_transaction_facts` uses `tokenized_user_id` (analytics).

**Recommendation:** 
- **Keep `l1_events` with `user_id`** for operational events (consent, login, admin actions)
- **Add `tokenized_user_id` column** to `l1_events` for analytics queries
- **Drop `l1_event_facts`** (empty, unused)

**Rationale:**
- Operational events (consent, login) need direct user linkage for security/audit
- Analytics events can use tokenized IDs for privacy
- Dual-column approach allows both use cases

**Migration:**
```sql
-- Add tokenized_user_id to l1_events
ALTER TABLE l1_events 
ADD COLUMN tokenized_user_id TEXT;

-- Populate from tokenization table
UPDATE l1_events e
SET tokenized_user_id = ut.tokenized_user_id
FROM l0_user_tokenization ut
WHERE ut.internal_user_id = e.user_id;

-- Add foreign key
ALTER TABLE l1_events
ADD CONSTRAINT l1_events_tokenized_user_id_fkey 
FOREIGN KEY (tokenized_user_id) 
REFERENCES l0_user_tokenization(tokenized_user_id);

-- Drop unused table
DROP TABLE IF EXISTS l1_event_facts;
```

---

### **Priority 2: Standardize ID Field Names**

**Recommendation:** Keep current naming but document clearly:

| Context | Field Name | Why |
|---------|-----------|-----|
| Core user table | `users.id` | Standard primary key |
| PII/Tokenization | `internal_user_id` | Links to `users.id` (1:1) |
| Analytics | `tokenized_user_id` | Anonymized for analytics |
| Operational | `user_id` | Direct reference to `users.id` |

**Rationale:** Different names serve different purposes. Document the pattern clearly.

---

### **Priority 3: Ensure All Records Are Linked**

**Recommendation:** Add validation queries:

```sql
-- Check for orphaned transactions
SELECT COUNT(*) FROM l1_transaction_facts tf
LEFT JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
WHERE ut.tokenized_user_id IS NULL;

-- Check for orphaned events
SELECT COUNT(*) FROM l1_events e
LEFT JOIN users u ON e.user_id = u.id
WHERE u.id IS NULL;

-- Check for missing tokenization
SELECT COUNT(*) FROM users u
LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
WHERE ut.internal_user_id IS NULL;
```

---

### **Priority 4: Table Consolidation Opportunities**

**Safe to Drop (Empty/Unused):**
- ✅ `l1_event_facts` - Empty, unused, duplicate of `l1_events`
- ✅ `l1_support_tickets` - Empty, reserved for future
- ✅ `l0_category_list` - Check if used
- ✅ `l0_insight_list` - Check if used
- ✅ `l0_admin_list` - Check if used
- ✅ `l0_privacy_metadata` - Check if used

**Keep Separate (Different Purposes):**
- ✅ `l1_events` - Operational events (consent, login, admin)
- ✅ `l1_transaction_facts` - Transaction data
- ✅ `l1_customer_facts` - Customer analytics
- ✅ `chat_bookings` - Operational booking data
- ✅ `onboarding_responses` - Onboarding flow data

---

## ✅ Best Practices Checklist

### **ID Consistency**
- [ ] All analytics tables use `tokenized_user_id`
- [ ] All operational tables use `user_id` (references `users.id`)
- [ ] All PII tables use `internal_user_id` (equals `users.id`)
- [ ] Document the pattern clearly

### **Foreign Keys**
- [ ] All foreign keys have proper constraints
- [ ] ON DELETE actions are appropriate (CASCADE for dependent data)
- [ ] No duplicate constraints
- [ ] All relationships documented in Foreign Keys sheet

### **Data Integrity**
- [ ] No orphaned transactions
- [ ] No orphaned events
- [ ] All users have tokenization entries
- [ ] Validation queries in place

### **Table Consolidation**
- [ ] Empty/unused tables identified
- [ ] Duplicate tables consolidated
- [ ] Purpose of each table clearly documented

---

## 🎯 Action Items

1. **Immediate:**
   - [ ] Add `tokenized_user_id` to `l1_events`
   - [ ] Drop `l1_event_facts` table
   - [ ] Fix duplicate foreign key constraint on `l1_events`
   - [ ] Run orphaned record checks

2. **Short-term:**
   - [ ] Document ID naming conventions
   - [ ] Add validation queries to App Health
   - [ ] Review and drop empty/unused tables

3. **Long-term:**
   - [ ] Consider making `internal_user_id` the primary key everywhere
   - [ ] Standardize on single ID type per table type
   - [ ] Add database-level constraints for data integrity

