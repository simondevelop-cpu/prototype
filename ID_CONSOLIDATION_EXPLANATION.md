# ID Consolidation Explanation

## Current ID Structure

### User IDs
1. **`users.id`** - Primary key (INTEGER, SERIAL) - The main user identifier
2. **`l0_pii_users.id`** - PII record ID (INTEGER, SERIAL) - Redundant, not needed
3. **`l0_pii_users.internal_user_id`** - Links to `users.id` (UNIQUE) - **This is the actual user ID**
4. **`l0_user_tokenization.tokenized_user_id`** - Anonymized hash for analytics (TEXT)

### Transaction IDs
1. **`transactions.id`** - Legacy transaction ID (INTEGER)
2. **`l1_transaction_facts.id`** - New transaction ID (INTEGER) - **Use this**

### Event IDs
1. **`l1_events.id`** - Event ID (INTEGER) - **Use this** (renamed from user_events)

## The Problem

**`l0_pii_users.id` vs `l0_pii_users.internal_user_id`**:
- `l0_pii_users.id` is the PII record's own primary key (1, 2, 3, ...)
- `l0_pii_users.internal_user_id` is the link to the actual user (matches `users.id`)
- This creates confusion: "Which ID should I use?"

**Example:**
```
users table:
  id = 5 (the actual user)

l0_pii_users table:
  id = 3 (PII record ID - confusing!)
  internal_user_id = 5 (links to users.id - this is what we want)
```

## Solution

### 1. Use `internal_user_id` as the Primary Identifier
- Always use `l0_pii_users.internal_user_id` when working with PII
- This matches `users.id` directly
- Consider making `internal_user_id` the primary key (requires migration)

### 2. ID Prefixes for Display
- **User IDs:** Display as "U123" (formatted from `users.id` or `internal_user_id`)
- **Transaction IDs:** Display as "T456" (formatted from `l1_transaction_facts.id`)
- **Event IDs:** Display as "E789" (formatted from `l1_events.id`)

**Implementation:**
- Created `lib/id-formatter.ts` with formatting functions
- Prefixes are **display-only** - database IDs remain numeric
- Use `formatUserId()`, `formatTransactionId()`, `formatEventId()` in UI

## Recommended Changes

### Option A: Keep Current Structure (Simpler)
- Continue using `internal_user_id` as the foreign key
- Add comments/documentation explaining the relationship
- Use ID formatters in UI for clarity

### Option B: Make `internal_user_id` the Primary Key (Cleaner)
- Drop `l0_pii_users.id` column
- Make `internal_user_id` the PRIMARY KEY
- Update all foreign key references
- **More complex migration, but cleaner long-term**

## Current Status

✅ **ID formatters created** - Ready to use in UI
⚠️ **Code review needed** - Check all places using `l0_pii_users.id` vs `internal_user_id`
⚠️ **Migration decision** - Choose Option A or B above

## Next Steps

1. Review all code that references `l0_pii_users.id`
2. Update to use `internal_user_id` instead
3. Add ID prefix formatting to admin dashboard displays
4. Decide on Option A vs B for primary key structure

