-- ============================================================================
-- FIX EVENTS TABLE AND REMOVE PII FROM NON-PII TABLES
-- ============================================================================
-- This migration:
-- 1. Adds tokenized_user_id to l1_events for analytics consistency
-- 2. Drops unused l1_event_facts table
-- 3. Removes any remaining PII from non-PII tables
-- 4. Fixes duplicate foreign key constraints
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX l1_events TABLE - ADD tokenized_user_id FOR ANALYTICS
-- ============================================================================

-- Add tokenized_user_id column to l1_events
ALTER TABLE l1_events 
ADD COLUMN IF NOT EXISTS tokenized_user_id TEXT;

-- Populate tokenized_user_id from tokenization table
UPDATE l1_events e
SET tokenized_user_id = ut.tokenized_user_id
FROM l0_user_tokenization ut
WHERE ut.internal_user_id = e.user_id
  AND e.tokenized_user_id IS NULL;

-- Add foreign key constraint for tokenized_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'l1_events_tokenized_user_id_fkey'
    AND table_name = 'l1_events'
  ) THEN
    ALTER TABLE l1_events
    ADD CONSTRAINT l1_events_tokenized_user_id_fkey 
    FOREIGN KEY (tokenized_user_id) 
    REFERENCES l0_user_tokenization(tokenized_user_id);
  END IF;
END $$;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_l1_events_tokenized_user_id 
ON l1_events(tokenized_user_id) 
WHERE tokenized_user_id IS NOT NULL;

-- ============================================================================
-- 2. REMOVE DUPLICATE FOREIGN KEY CONSTRAINT ON l1_events
-- ============================================================================

-- Find and drop duplicate foreign key constraints
DO $$
DECLARE
  constraint_rec RECORD;
  constraint_count INTEGER;
BEGIN
  -- Find all foreign key constraints on l1_events.user_id
  FOR constraint_rec IN
    SELECT constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'l1_events'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
    ORDER BY constraint_name
  LOOP
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'l1_events'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';
    
    -- If more than one constraint, drop the ones with longer names (usually duplicates)
    IF constraint_count > 1 THEN
      IF constraint_rec.constraint_name LIKE '%_fkey1' OR constraint_rec.constraint_name LIKE '%_fkey2' THEN
        EXECUTE format('ALTER TABLE l1_events DROP CONSTRAINT IF EXISTS %I', constraint_rec.constraint_name);
        RAISE NOTICE 'Dropped duplicate constraint: %', constraint_rec.constraint_name;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. DROP UNUSED l1_event_facts TABLE
-- ============================================================================

DROP TABLE IF EXISTS l1_event_facts CASCADE;

-- ============================================================================
-- 4. REMOVE PII FROM onboarding_responses (IF ANY REMAINS)
-- ============================================================================

-- Check if PII columns still exist and drop them
DO $$
BEGIN
  -- Drop first_name if it exists (should be in l0_pii_users)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN first_name;
    RAISE NOTICE 'Dropped first_name from onboarding_responses';
  END IF;

  -- Drop last_name if it exists (should be in l0_pii_users)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN last_name;
    RAISE NOTICE 'Dropped last_name from onboarding_responses';
  END IF;

  -- Drop date_of_birth if it exists (should be in l0_pii_users)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN date_of_birth;
    RAISE NOTICE 'Dropped date_of_birth from onboarding_responses';
  END IF;

  -- Drop recovery_phone if it exists (should be in l0_pii_users)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'recovery_phone'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN recovery_phone;
    RAISE NOTICE 'Dropped recovery_phone from onboarding_responses';
  END IF;

  -- Drop province_region if it exists (should be in l0_pii_users)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'province_region'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN province_region;
    RAISE NOTICE 'Dropped province_region from onboarding_responses';
  END IF;
END $$;

-- ============================================================================
-- 5. VERIFY users TABLE ONLY HAS EMAIL (NO OTHER PII)
-- ============================================================================

-- users table should only have email for authentication
-- All other PII should be in l0_pii_users
-- This is already correct, but we'll add a comment for clarity
COMMENT ON TABLE users IS 'Core user accounts table. Contains authentication only (email, password_hash). All other PII is in l0_pii_users.';
COMMENT ON COLUMN users.email IS 'Email address for authentication. Also stored in l0_pii_users for PII isolation.';

-- ============================================================================
-- 6. ADD COMMENTS FOR CLARITY
-- ============================================================================

COMMENT ON TABLE l1_events IS 'Event facts table. Uses user_id for operational queries, tokenized_user_id for analytics. Both columns link to the same user via l0_user_tokenization.';
COMMENT ON COLUMN l1_events.user_id IS 'Operational user ID (references users.id). Used for security, audit, and direct user queries.';
COMMENT ON COLUMN l1_events.tokenized_user_id IS 'Anonymized user ID (references l0_user_tokenization.tokenized_user_id). Used for analytics queries to maintain PII isolation.';

COMMIT;

