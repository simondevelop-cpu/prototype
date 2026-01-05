# Code Changes Required for L0/L1/L2 Architecture

## Overview

After running the migration, you need to update your application code to use the new schema. This document outlines the required changes.

## Key Principles

1. **PII Isolation**: Personal data (email, names, phone) only in L0 tables
2. **Analytics Anonymization**: All analytics queries use tokenized user IDs
3. **Layer Separation**: L0 for PII/auth, L1 for facts, L2 for derived views

## Required Changes by File

### 1. Transaction Queries

**Before:**
```typescript
// app/api/transactions/route.ts
const result = await pool.query(
  'SELECT * FROM transactions WHERE user_id = $1',
  [userId] // integer user ID
);
```

**After:**
```typescript
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
if (!tokenizedUserId) {
  return NextResponse.json({ error: 'Invalid user' }, { status: 401 });
}

// For analytics (dashboard, summaries)
const result = await pool.query(
  'SELECT * FROM l1_transaction_facts WHERE tokenized_user_id = $1',
  [tokenizedUserId]
);

// OR use the backward-compatible view (if still using integer IDs internally)
const result = await pool.query(
  'SELECT * FROM l2_transactions_view WHERE user_id = $1',
  [userId]
);
```

### 2. User Authentication (Keep Using Internal IDs)

**No changes needed** - Auth endpoints should continue using internal user IDs:
- Login/register endpoints
- JWT token generation
- Middleware authentication

The tokenization happens **after** auth, when querying analytics data.

### 3. PII Operations (L0 Only)

**Before:**
```typescript
// Reading user email/name
const result = await pool.query(
  'SELECT email, display_name FROM users WHERE id = $1',
  [userId]
);
```

**After:**
```typescript
// Use L0 PII table for personal data
const result = await pool.query(
  'SELECT email, first_name, last_name FROM l0_pii_users WHERE internal_user_id = $1',
  [userId]
);
```

### 4. Customer/Analytics Queries

**Before:**
```typescript
// User stats
const result = await pool.query(
  'SELECT COUNT(*) as tx_count FROM transactions WHERE user_id = $1',
  [userId]
);
```

**After:**
```typescript
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
const result = await pool.query(
  'SELECT total_transactions, account_status FROM l1_customer_facts WHERE tokenized_user_id = $1',
  [tokenizedUserId]
);
```

### 5. File Upload Tracking

**Before:**
```typescript
// No tracking
await pool.query('INSERT INTO transactions ...');
```

**After:**
```typescript
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

const tokenizedUserId = await ensureTokenizedForAnalytics(userId);

// Track file ingestion
const ingestionResult = await pool.query(
  `INSERT INTO l1_file_ingestion (
    tokenized_user_id, filename, file_size_bytes, bank_identifier,
    parse_started_at, parse_status
  ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'running')
  RETURNING id`,
  [tokenizedUserId, filename, fileSize, bankName]
);

// ... parse file ...

// Update ingestion record
await pool.query(
  `UPDATE l1_file_ingestion 
   SET parse_completed_at = CURRENT_TIMESTAMP, 
       parse_status = $1,
       transactions_parsed = $2
   WHERE id = $3`,
  ['success', transactionCount, ingestionResult.rows[0].id]
);

// Insert transactions using tokenized user ID
await pool.query(
  `INSERT INTO l1_transaction_facts (
    tokenized_user_id, transaction_date, description, amount, ...
  ) VALUES ($1, $2, $3, $4, ...)`,
  [tokenizedUserId, ...]
);
```

### 6. Event Tracking

**Before:**
```typescript
// No event tracking
```

**After:**
```typescript
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

async function trackEvent(userId: number, eventType: string, eventName: string, properties?: any) {
  const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
  if (!tokenizedUserId) return;

  await pool.query(
    `INSERT INTO l1_event_facts (
      tokenized_user_id, event_type, event_name, event_properties
    ) VALUES ($1, $2, $3, $4)`,
    [tokenizedUserId, eventType, eventName, JSON.stringify(properties || {})]
  );
}

// Usage:
await trackEvent(userId, 'user_event', 'login');
await trackEvent(userId, 'import_event', 'upload_started', { filename: 'statement.pdf' });
await trackEvent(userId, 'parsing_event', 'parse_completed', { transactions_count: 10 });
```

### 7. Admin/User Management

**Before:**
```typescript
// Admin queries users directly
const users = await pool.query('SELECT id, email FROM users');
```

**After:**
```typescript
// Admin needs PII - use L0
const users = await pool.query(`
  SELECT 
    u.id,
    p.email,
    p.first_name,
    p.last_name,
    cf.total_transactions,
    cf.account_status
  FROM users u
  JOIN l0_pii_users p ON p.internal_user_id = u.id
  LEFT JOIN l0_user_tokenization ut ON ut.internal_user_id = u.id
  LEFT JOIN l1_customer_facts cf ON cf.tokenized_user_id = ut.tokenized_user_id
`);
```

### 8. Summary/Analytics Endpoints

**Before:**
```typescript
// app/api/summary/route.ts
const result = await pool.query(
  `SELECT category, SUM(amount) as total 
   FROM transactions 
   WHERE user_id = $1 
   GROUP BY category`,
  [userId]
);
```

**After:**
```typescript
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
const result = await pool.query(
  `SELECT category, SUM(amount) as total 
   FROM l1_transaction_facts 
   WHERE tokenized_user_id = $1 
   GROUP BY category`,
  [tokenizedUserId]
);
```

## Recommended Migration Strategy (Direct - No Duplication)

### Approach: Update Code First, Then Migrate Data

**Why this approach:**
- Avoids duplicate data entirely
- Cleaner codebase
- Immediate compliance benefits
- No cleanup needed later

### Phase 1: Create Schema (Empty)
1. Run `npm run migrate -- --schema-only` to create empty new tables
2. Old tables remain intact as backup

### Phase 2: Update ALL Application Code
1. Update all queries to use new L1 tables
2. Update all inserts to use new L1 tables  
3. Implement tokenization for analytics queries
4. Use L0 tables for PII operations
5. Test thoroughly

### Phase 3: Migrate Historical Data
1. Run data migration: `psql $DATABASE_URL -f migrations/migrate-data-to-l0-l1.sql`
2. Verify data integrity
3. All new writes already go to new tables (no duplication!)

### Phase 4: Deprecate Old Tables (Later)
1. Keep old tables as backup for confidence period
2. Verify all functionality works
3. Eventually drop old tables after verification

**Result:** Clean migration with no duplicate data.

## Testing Checklist

- [ ] All transaction queries use tokenized user IDs
- [ ] PII queries only access L0 tables
- [ ] Analytics endpoints work with tokenized IDs
- [ ] File upload tracking creates l1_file_ingestion records
- [ ] Events are tracked in l1_event_facts
- [ ] Customer facts are updated when users interact
- [ ] Admin queries can access both PII and analytics data
- [ ] No real user IDs leak into analytics tables

## Backward Compatibility

The `l2_transactions_view` provides backward compatibility by mapping L1 transaction facts back to the legacy structure. You can use this view temporarily while migrating code:

```sql
-- View automatically maps tokenized IDs back to internal IDs for compatibility
SELECT * FROM l2_transactions_view WHERE user_id = 123;
```

This allows gradual migration without breaking existing code immediately.

