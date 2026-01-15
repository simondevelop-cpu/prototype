# Migration Action Plan - Quick Reference

## 🎯 TL;DR

**Migration Approach:** ✅ Direct migration is safe and correct.

**BUT:** Fix security issues FIRST, then migrate.

**Compliance:** 🔴 Missing critical PIPEDA/Law 25 features - must add after migration.

---

## ⚠️ CRITICAL: Fix These BEFORE Migration

### 1. Password Hashing (2 hours) 🔴

**Current:** SHA-256 (weak, no salt)

**Fix:**
```typescript
// lib/auth.ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Update:** All calls to `hashPassword()` become `await hashPassword()`

**Files:** `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`, `server.js`

---

### 2. Rate Limiting (3 hours) 🔴

**Add to:** Login and register endpoints

**Package:** `@upstash/ratelimit` or similar

**Limit:** 5 attempts per 15 minutes per email

---

### 3. CSRF Protection (2 hours) 🔴

**Add:** CSRF tokens to forms, verify Origin header

---

## 📋 Migration Steps (In Order)

### Step 1: Security Fixes (DO FIRST)
- [ ] Fix password hashing
- [ ] Add rate limiting
- [ ] Add CSRF protection
- [ ] Test all auth flows

### Step 2: Create Schema
```bash
npm run migrate -- --schema-only
```
- [ ] Verify tables created
- [ ] Test tokenization functions

### Step 3: Update ALL Code
**Critical files to update:**

**Transaction Reads (8+ files):**
- [ ] `app/api/transactions/route.ts`
- [ ] `app/api/summary/route.ts`
- [ ] `app/api/categories/route.ts`
- [ ] `lib/pdf-parser.ts` (duplicate checks)

**Transaction Writes (5 files):**
- [ ] `lib/pdf-parser.ts` - `insertTransactions()`
- [ ] `app/api/transactions/create/route.ts`
- [ ] `app/api/statements/import/route.ts`
- [ ] `lib/seed-demo.ts`
- [ ] `server.js` - `seedSampleTransactions()`

**PII Queries (3+ files):**
- [ ] `app/api/admin/customer-data/route.ts`
- [ ] `app/api/onboarding/progress/route.ts`
- [ ] `app/api/onboarding/route.ts`

**Pattern for updates:**
```typescript
// OLD
const result = await pool.query(
  'SELECT * FROM transactions WHERE user_id = $1',
  [userId]
);

// NEW
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
const result = await pool.query(
  'SELECT * FROM l1_transaction_facts WHERE tokenized_user_id = $1',
  [tokenizedUserId]
);
```

### Step 4: Test Thoroughly
- [ ] All transaction reads work
- [ ] All transaction writes work
- [ ] Analytics work
- [ ] Admin functions work
- [ ] PII queries work

### Step 5: Migrate Data
```bash
psql $DATABASE_URL -f migrations/migrate-data-to-l0-l1.sql
```
- [ ] Verify data counts match
- [ ] Test all functionality
- [ ] Check for orphaned records

### Step 6: Compliance Features (REQUIRED)
- [ ] Account deletion endpoint
- [ ] Scheduled PII cleanup job (30-day deletion)
- [ ] Consent management
- [ ] Data export endpoint

---

## 🚨 Compliance Gaps (PIPEDA/Law 25)

### Missing Features:

1. **Account Deletion** ❌
   - Need: `DELETE /api/admin/users/:id`
   - Need: Soft delete in `users` table
   - Need: Schedule deletion 30 days after closure

2. **Scheduled PII Cleanup** ❌
   - Need: Cron job or Vercel Cron
   - Need: Delete PII 30 days after `deleted_at`

3. **Consent Management** ❌
   - Need: Consent tracking in `l0_privacy_metadata`
   - Need: Consent withdrawal endpoint

4. **Data Export** ❌
   - Need: `GET /api/users/export`
   - Need: Return all user data (PII + transactions)

**These MUST be implemented before production.**

---

## ✅ What's Safe About Migration

1. **Schema doesn't break existing tables** - Old tables remain intact
2. **Direct migration approach** - No duplicate data risk
3. **Backward-compatible views** - Gradual transition possible
4. **All functionality can be preserved** - New schema can do everything old one did

---

## ❌ What Could Go Wrong

1. **Incomplete code updates** - Missing query updates = broken functionality
2. **Tokenization breaks** - Wrong IDs = no data returned
3. **PII in wrong tables** - Compliance violation
4. **Missing compliance features** - Legal risk

**Mitigation:** Comprehensive testing + code review checklist

---

## 📊 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Security breach (weak passwords) | HIGH | CRITICAL | Fix password hashing FIRST |
| Functionality break (incomplete code) | MEDIUM | HIGH | Comprehensive testing |
| Compliance violation (missing features) | HIGH | CRITICAL | Implement Phase 6 features |
| Data loss (migration error) | LOW | CRITICAL | Test on copy first, keep backups |
| Duplicate data | LOW | MEDIUM | Direct migration approach prevents this |

---

## 🎯 Recommended Timeline

### Week 1: Security Foundation
- Day 1-2: Fix password hashing
- Day 3-4: Add rate limiting
- Day 5: Add CSRF protection
- Day 6-7: Test all security fixes

### Week 2: Code Migration
- Day 1-3: Update all transaction queries
- Day 4-5: Update all transaction inserts
- Day 6: Update PII queries
- Day 7: Comprehensive testing

### Week 3: Data Migration + Compliance
- Day 1: Create schema, migrate data
- Day 2-3: Test migration, verify data
- Day 4-5: Implement compliance features
- Day 6-7: Test compliance features

### Week 4: Production Deployment
- Day 1-2: Deploy to staging
- Day 3-4: Monitor, fix issues
- Day 5: Deploy to production
- Day 6-7: Monitor production

---

## 🔍 Quick Checklist

Before starting migration:
- [ ] Security fixes complete
- [ ] All code update locations identified
- [ ] Test environment ready
- [ ] Backup of production data
- [ ] Rollback plan documented

After migration:
- [ ] All functionality tested
- [ ] Compliance features implemented
- [ ] Monitoring in place
- [ ] Documentation updated
- [ ] Team trained on new architecture

---

## 📚 Reference Documents

- **`MIGRATION_SAFETY_REVIEW.md`** - Detailed safety analysis
- **`DATA_ARCHITECTURE_MIGRATION.md`** - Architecture details
- **`CODE_CHANGES_REQUIRED.md`** - Code update examples
- **`DIRECT_MIGRATION_APPROACH.md`** - Migration strategy

