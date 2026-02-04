# Migration Progress Tracker

## ✅ Completed

### Security Fixes (P0)
- [x] Password hashing: SHA-256 → bcrypt
- [x] Rate limiting: Auth endpoints
- [x] CSRF protection: Origin verification

### Transaction Query Updates (Next.js API Routes)
- [x] `app/api/transactions/route.ts` - GET endpoint (read)
- [x] `app/api/transactions/create/route.ts` - POST endpoint (create)
- [x] `app/api/transactions/delete/route.ts` - DELETE endpoint
- [x] `app/api/summary/route.ts` - Summary analytics
- [x] `app/api/categories/route.ts` - Category analytics
- [x] `app/api/statements/import/route.ts` - Statement import
- [x] `lib/pdf-parser.ts` - PDF parsing & inserts
- [x] `lib/seed-demo.ts` - Demo seeding

## ⚠️ In Progress

### server.js Updates (Express Endpoints)
- [ ] `seedSampleTransactions()` function
- [ ] `ensureDemoDataExists()` function  
- [ ] `/api/transactions` GET endpoint
- [ ] `/api/summary` GET endpoint
- [ ] `/api/budget` GET endpoint
- [ ] `/api/savings` GET endpoint
- [ ] `/api/insights` GET endpoint
- [ ] `/api/reset-demo-data` POST endpoint
- [ ] Helper functions: `ensureRangeMonths()`, `getLatestMonthRange()`

## 📋 Remaining

### PII Query Updates
- [ ] `app/api/admin/customer-data/route.ts`
- [ ] `app/api/onboarding/progress/route.ts`
- [ ] `app/api/onboarding/route.ts`
- [ ] `app/api/onboarding/status/route.ts`

### Onboarding Updates
- [ ] Update onboarding to write PII to `l0_pii_users`
- [ ] Update onboarding to create `l1_customer_facts` records

### Event Tracking Implementation
- [ ] Create event tracking utility
- [ ] Add event tracking to key user actions
- [ ] Add event tracking to file uploads
- [ ] Add event tracking to parsing operations

### File Ingestion Tracking
- [ ] Update statement upload to create `l1_file_ingestion` records
- [ ] Track parse start/end times
- [ ] Track parse results

## Files Updated So Far

### New Files
- `lib/tokenization.ts` - Tokenization utilities
- `lib/rate-limit.ts` - Rate limiting
- `lib/csrf.ts` - CSRF protection
- `migrations/create-l0-l1-l2-schema.sql` - Schema
- `migrations/migrate-data-to-l0-l1.sql` - Data migration
- `migrations/run-migration.ts` - Migration runner

### Modified Files
- `lib/auth.ts` - bcrypt password hashing
- `app/api/auth/login/route.ts` - Rate limiting + CSRF
- `app/api/auth/register/route.ts` - Rate limiting + CSRF
- `app/api/transactions/route.ts` - ✅ Updated to L1
- `app/api/transactions/create/route.ts` - ✅ Updated to L1
- `app/api/transactions/delete/route.ts` - ✅ Updated to L1
- `app/api/summary/route.ts` - ✅ Updated to L1
- `app/api/categories/route.ts` - ✅ Updated to L1
- `app/api/statements/import/route.ts` - ✅ Updated to L1
- `lib/pdf-parser.ts` - ✅ Updated to L1
- `lib/seed-demo.ts` - ✅ Updated to L1
- `server.js` - Partial (auth updated, transaction endpoints pending)

