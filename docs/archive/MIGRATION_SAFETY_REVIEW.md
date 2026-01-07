# Migration Safety & Compliance Review

## Executive Summary

**Migration Approach:** ✅ Direct migration (update code, then migrate data) is safe and correct.

**Functionality Preservation:** ⚠️ Will be preserved IF code updates are done correctly.

**Compliance Gaps:** 🔴 Critical security/compliance issues need fixing BEFORE migration.

**Recommendation:** Fix security issues first, then migrate architecture.

---

## 1. Migration Safety Assessment

### ✅ Safe Aspects

1. **Schema Design is Sound**
   - New tables don't conflict with old tables
   - Foreign keys properly cascade
   - Indexes are appropriate
   - No breaking changes to existing structure

2. **Direct Migration Approach is Correct**
   - Update code first → No duplicate data risk
   - Historical data migration is safe (read-only copy)
   - Old tables remain as backup

3. **Backward Compatibility Exists**
   - `l2_transactions_view` allows gradual transition
   - Old tables can coexist during testing

### ⚠️ Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Code updates not complete** | HIGH | Update ALL transaction queries before running migration |
| **Tokenization breaks queries** | MEDIUM | Test tokenization helper functions thoroughly |
| **PII queries access wrong tables** | HIGH | Audit all PII access points |
| **Missing event tracking** | LOW | Event tracking is new feature, not breaking |

---

## 2. Functionality Preservation Analysis

### ✅ Will Preserve (If Code Updated Correctly)

| Feature | Current State | Migration Impact | Status |
|---------|--------------|------------------|--------|
| **Transaction Reads** | `SELECT * FROM transactions WHERE user_id = $1` | Needs tokenization | ⚠️ Update Required |
| **Transaction Writes** | `INSERT INTO transactions ...` | Needs tokenization | ⚠️ Update Required |
| **User Authentication** | Uses internal user IDs | No change needed | ✅ Safe |
| **Onboarding** | Uses `onboarding_responses` | PII moves to `l0_pii_users` | ⚠️ Update Required |
| **Admin Queries** | Direct user queries | Needs L0/L1 joins | ⚠️ Update Required |
| **Analytics/Dashboard** | Transaction aggregates | Needs tokenized IDs | ⚠️ Update Required |

### 🔴 Critical: Code Update Checklist

Before migrating, ensure ALL of these are updated:

- [ ] **Transaction INSERT statements** (5 files):
  - `lib/pdf-parser.ts` - `insertTransactions()`
  - `app/api/transactions/create/route.ts`
  - `app/api/statements/import/route.ts`
  - `lib/seed-demo.ts`
  - `server.js` - `seedSampleTransactions()`

- [ ] **Transaction SELECT statements** (8+ files):
  - `app/api/transactions/route.ts`
  - `app/api/summary/route.ts`
  - `app/api/categories/route.ts`
  - `lib/pdf-parser.ts` - duplicate checks
  - All other transaction queries

- [ ] **PII Queries** (3+ files):
  - `app/api/admin/customer-data/route.ts`
  - `app/api/onboarding/progress/route.ts`
  - `app/api/onboarding/route.ts`
  - Any email/name lookups

- [ ] **Onboarding Data Writes**:
  - Move PII fields to `l0_pii_users`
  - Keep behavioral data separate

### ⚠️ Potential Functionality Loss

1. **If tokenization breaks:** Analytics queries return no data
2. **If PII queries wrong table:** Admin/user info missing
3. **If transaction writes fail:** No new transactions saved

**Mitigation:** Comprehensive testing before production deployment.

---

## 3. PIPEDA / Law 25 Compliance Gaps

### 🔴 CRITICAL: Missing Compliance Features

#### A. Account Deletion Mechanism ❌

**Requirement:** PIPEDA/Law 25 require deletion within 30 days of account closure.

**Current State:**
- ❌ No account deletion endpoint
- ❌ No soft-delete mechanism in `users` table
- ❌ No scheduled deletion process
- ✅ `l0_pii_users.deleted_at` exists but unused

**Fix Required:**
```sql
-- Add soft delete to users table
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create deletion endpoint
DELETE /api/admin/users/:id (with 30-day grace period)
```

#### B. Data Retention Enforcement ❌

**Requirement:** Automatically delete PII after 30 days of account closure.

**Current State:**
- ❌ No scheduled job to delete expired data
- ❌ No cron job or worker process
- ✅ `l0_privacy_metadata.deletion_scheduled_at` exists but unused

**Fix Required:**
```typescript
// Scheduled job (Vercel Cron or worker)
async function cleanupExpiredPII() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  
  await pool.query(`
    DELETE FROM l0_pii_users 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < $1
  `, [cutoff]);
}
```

#### C. Consent Management ❌

**Requirement:** Track and manage user consent for data processing.

**Current State:**
- ❌ No consent tracking
- ❌ No consent withdrawal mechanism
- ✅ `l0_privacy_metadata.consent_flags` exists but unused

**Fix Required:**
- Consent form during onboarding
- Consent tracking in `l0_privacy_metadata`
- Consent withdrawal endpoint

#### D. Data Export (Right to Access) ❌

**Requirement:** Users have right to access their data.

**Current State:**
- ❌ No data export endpoint
- ❌ No way for users to download their data

**Fix Required:**
```
GET /api/users/export
Returns: JSON with all user data (transactions, PII, events)
```

#### E. Data Anonymization ❌

**Requirement:** After deletion, ensure PII cannot be recovered.

**Current State:**
- ✅ Tokenization provides some anonymization
- ⚠️ But analytics tables may still have joinable data

**Fix Required:**
- Verify tokenized IDs cannot be reversed
- Ensure no PII in analytics tables
- Add data anonymization audit

---

## 4. Security Issues (CRITICAL - Fix Before Migration)

### 🔴 P0: Weak Password Hashing

**Issue:** Using SHA-256 instead of bcrypt.

**Current Code:**
```typescript
// lib/auth.ts
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
```

**Risk:** Database breach = instant password compromise.

**Fix Required:**
```typescript
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Impact on Migration:**
- ⚠️ Existing passwords need rehashing on next login
- Or migrate all passwords to bcrypt (complex)
- **Recommendation:** Fix BEFORE migration, rehash on next login

---

### 🔴 P0: No Rate Limiting

**Issue:** Authentication endpoints have no rate limiting.

**Risk:** Brute force attacks, DDoS.

**Fix Required:**
- Add rate limiting to `/api/auth/login`
- Add rate limiting to `/api/auth/register`
- Use `@upstash/ratelimit` or similar

**Impact on Migration:** No impact, but fix before production.

---

### 🔴 P0: No CSRF Protection

**Issue:** State-changing operations lack CSRF protection.

**Risk:** Cross-site request forgery attacks.

**Fix Required:**
- Add CSRF tokens to forms
- Verify `Origin` header on API requests
- Use SameSite cookies

**Impact on Migration:** No impact, but fix before production.

---

## 5. Recommended Safe Migration Path

### Phase 0: Security Fixes (DO FIRST) 🔴

1. **Fix password hashing** (2 hours)
   - Replace SHA-256 with bcrypt
   - Update auth functions
   - Rehash on next login

2. **Add rate limiting** (3 hours)
   - Install `@upstash/ratelimit`
   - Add to login/register endpoints
   - Test thoroughly

3. **Add CSRF protection** (2 hours)
   - Add CSRF tokens
   - Verify Origin headers
   - Update forms

**Total: ~7 hours of security fixes**

### Phase 1: Schema Creation (Safe)

1. Create empty schema: `npm run migrate -- --schema-only`
2. Verify tables created correctly
3. Test tokenization functions

### Phase 2: Code Updates (Critical)

1. Update ALL transaction queries to use tokenized IDs
2. Update ALL transaction inserts to use new tables
3. Update PII queries to use `l0_pii_users`
4. Implement event tracking
5. **Test extensively** in development

### Phase 3: Data Migration (Safe)

1. Migrate historical data: `psql $DATABASE_URL -f migrations/migrate-data-to-l0-l1.sql`
2. Verify data integrity
3. Compare counts (old vs new)

### Phase 4: Compliance Features (Required)

1. Implement account deletion endpoint
2. Add scheduled PII cleanup job
3. Add consent management
4. Add data export endpoint
5. Test deletion flow

### Phase 5: Cutover & Testing

1. Switch all reads to new tables
2. Monitor for errors
3. Keep old tables as backup for 1 week
4. Remove old tables after confidence period

---

## 6. Critical Questions Answered

### Q: Will all functionality remain?

**A:** ✅ Yes, IF code is updated correctly. The new schema can do everything the old one did, plus more.

**Risk:** If code updates are incomplete, functionality will break.

**Mitigation:** Comprehensive testing checklist (see above).

### Q: Is there a duplicate data risk?

**A:** ✅ No, with direct migration approach (update code first, then migrate data).

**Risk:** Only if you migrate data before updating code.

**Mitigation:** Follow Phase 1 → 2 → 3 order.

### Q: Are we compliant with PIPEDA/Law 25?

**A:** ❌ **No, not yet.** Missing:
- Account deletion mechanism
- Scheduled PII cleanup
- Consent management
- Data export feature

**Required:** Implement Phase 4 compliance features.

### Q: Should we fix security issues first?

**A:** ✅ **YES.** Fix password hashing, rate limiting, CSRF before migration.

**Why:** Migration is complex enough without security debt.

---

## 7. Action Items Priority

### 🔴 P0 - Before Migration (Critical)

1. Fix password hashing (SHA-256 → bcrypt)
2. Add rate limiting to auth endpoints
3. Add CSRF protection
4. Create comprehensive code update checklist

### 🟡 P1 - During Migration

1. Update all transaction queries
2. Update all transaction inserts
3. Update PII queries
4. Implement event tracking
5. Test thoroughly

### 🟢 P2 - After Migration (Compliance)

1. Implement account deletion
2. Add scheduled PII cleanup
3. Add consent management
4. Add data export endpoint

---

## 8. Testing Strategy

### Pre-Migration Testing

- [ ] Test tokenization functions
- [ ] Test new schema queries in isolation
- [ ] Verify foreign key constraints
- [ ] Test data migration script on copy of production data

### Post-Code-Update Testing

- [ ] All transaction reads work
- [ ] All transaction writes work
- [ ] Analytics queries return correct data
- [ ] PII queries return correct data
- [ ] Admin functions work
- [ ] Event tracking works

### Post-Migration Testing

- [ ] Data counts match (old vs new)
- [ ] All functionality works
- [ ] Performance is acceptable
- [ ] No orphaned records
- [ ] Tokenization integrity verified

---

## Conclusion

**Migration is safe IF:**
1. ✅ Security issues fixed first
2. ✅ Code updates are comprehensive
3. ✅ Testing is thorough
4. ✅ Compliance features added

**Don't migrate until:**
- Password hashing is fixed
- Rate limiting is added
- All code updates are complete and tested

**Recommended timeline:**
- Week 1: Security fixes
- Week 2: Code updates + testing
- Week 3: Migration + compliance features
- Week 4: Monitoring + cleanup

