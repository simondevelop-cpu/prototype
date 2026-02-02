# User ID Standardization Plan

## Current Problem

We have **too many user ID field names** across the codebase:
- `id` (in users table)
- `internal_user_id` (in l0_pii_users, l0_user_tokenization)
- `tokenized_user_id` (in l0_user_tokenization, l1_transaction_facts, l1_events)
- `user_id` (in chat_bookings, onboarding_responses, categorization_learning, etc.)
- `legacy_transaction_id` (in l1_transaction_facts)

## Standardization Strategy

### 1. **Core User Identifier: `users.id`**
- **Primary Key**: `users.id` (INTEGER, SERIAL)
- **Usage**: Authentication, authorization, internal operations
- **JWT Token**: Contains `users.id` in `sub` claim
- **Never exposed**: Not used in analytics or external APIs

### 2. **PII Table: `l0_pii_users.internal_user_id`**
- **Purpose**: Links PII to user (PRIMARY KEY)
- **Value**: Always equals `users.id`
- **Usage**: All PII operations
- **Rule**: `l0_pii_users.internal_user_id = users.id` (1:1 relationship)

### 3. **Tokenization: `l0_user_tokenization`**
- **`internal_user_id`**: Links to `users.id` (PRIMARY KEY)
- **`tokenized_user_id`**: SHA256 hash for analytics (TEXT)
- **Usage**: All analytics queries use `tokenized_user_id`
- **Rule**: `l0_user_tokenization.internal_user_id = users.id` (1:1 relationship)

### 4. **Analytics Tables: Use `tokenized_user_id`**
- **`l1_transaction_facts.tokenized_user_id`**: Links to `l0_user_tokenization.tokenized_user_id`
- **`l1_events.tokenized_user_id`**: Links to `l0_user_tokenization.tokenized_user_id`
- **Rule**: Never use `users.id` directly in analytics tables

### 5. **Operational Tables: Use `user_id` (references `users.id`)**
- **`chat_bookings.user_id`**: INTEGER, references `users.id`
- **`onboarding_responses.user_id`**: INTEGER, references `users.id`
- **`categorization_learning.user_id`**: INTEGER, references `users.id`
- **Rule**: These tables use `user_id` (not `internal_user_id` or `tokenized_user_id`)

## Naming Convention

| Context | Field Name | References | Example |
|---------|-----------|------------|---------|
| Users table | `id` | - | `users.id = 5` |
| PII table | `internal_user_id` | `users.id` | `l0_pii_users.internal_user_id = 5` |
| Tokenization | `internal_user_id` | `users.id` | `l0_user_tokenization.internal_user_id = 5` |
| Tokenization | `tokenized_user_id` | Hash of `internal_user_id` | `l0_user_tokenization.tokenized_user_id = 'abc123...'` |
| Analytics tables | `tokenized_user_id` | `l0_user_tokenization.tokenized_user_id` | `l1_transaction_facts.tokenized_user_id = 'abc123...'` |
| Operational tables | `user_id` | `users.id` | `chat_bookings.user_id = 5` |

## Migration Plan

### Phase 1: Remove Redundant IDs
1. ✅ Already done: `l0_pii_users.id` removed, `internal_user_id` is PRIMARY KEY
2. ✅ Already done: `l0_user_tokenization` uses `internal_user_id` as PRIMARY KEY

### Phase 2: Standardize Field Names
1. **Keep `user_id` in operational tables** (chat_bookings, onboarding_responses, etc.)
   - These reference `users.id` directly
   - No change needed

2. **Ensure analytics tables use `tokenized_user_id`**
   - ✅ `l1_transaction_facts.tokenized_user_id` - Already correct
   - ✅ `l1_events.tokenized_user_id` - Already correct

3. **Remove `legacy_transaction_id`** (optional, for cleanup)
   - Can be dropped after confirming all transactions migrated

### Phase 3: API Consistency
1. **JWT Token**: Always contains `users.id` in `sub` claim
2. **User-facing APIs**: Use `users.id` from JWT
3. **Analytics APIs**: Convert `users.id` → `tokenized_user_id` before querying
4. **PII APIs**: Use `l0_pii_users.internal_user_id` (which equals `users.id`)

## Implementation Checklist

- [ ] Review all API endpoints for consistent ID usage
- [ ] Update any APIs using wrong field names
- [ ] Remove `legacy_transaction_id` if no longer needed
- [ ] Document ID mapping in API documentation
- [ ] Add validation to ensure `internal_user_id = users.id` always

