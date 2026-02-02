-- ============================================================================
-- MIGRATION: Remove PII from onboarding_responses table
-- ============================================================================
-- Purpose: Complete PII isolation by:
--   1. Migrating any remaining PII from onboarding_responses to l0_pii_users
--   2. Dropping PII columns from onboarding_responses
-- ============================================================================

-- Step 1: Migrate any remaining PII from onboarding_responses to l0_pii_users
-- This ensures all PII is in l0_pii_users before we drop the columns
-- Check if PII columns exist before migrating
DO $$
DECLARE
  has_first_name BOOLEAN;
  has_last_name BOOLEAN;
  has_date_of_birth BOOLEAN;
  has_recovery_phone BOOLEAN;
  has_province_region BOOLEAN;
BEGIN
  -- Check which PII columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'first_name'
  ) INTO has_first_name;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'last_name'
  ) INTO has_last_name;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'date_of_birth'
  ) INTO has_date_of_birth;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'recovery_phone'
  ) INTO has_recovery_phone;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'province_region'
  ) INTO has_province_region;
  
  -- Only migrate if at least one PII column exists
  IF has_first_name OR has_last_name OR has_date_of_birth OR has_recovery_phone OR has_province_region THEN
    -- Build dynamic UPDATE query based on which columns exist
    EXECUTE format('
      UPDATE l0_pii_users pii
      SET 
        %s
        updated_at = CURRENT_TIMESTAMP
      FROM onboarding_responses o
      WHERE pii.internal_user_id = o.user_id
        AND (
          %s
        )',
      -- Build SET clause
      CASE 
        WHEN has_first_name THEN 'first_name = COALESCE(pii.first_name, o.first_name),' ELSE ''
      END ||
      CASE 
        WHEN has_last_name THEN 'last_name = COALESCE(pii.last_name, o.last_name),' ELSE ''
      END ||
      CASE 
        WHEN has_date_of_birth THEN 'date_of_birth = COALESCE(pii.date_of_birth, o.date_of_birth),' ELSE ''
      END ||
      CASE 
        WHEN has_recovery_phone THEN 'recovery_phone = COALESCE(pii.recovery_phone, o.recovery_phone),' ELSE ''
      END ||
      CASE 
        WHEN has_province_region THEN 'province_region = COALESCE(pii.province_region, o.province_region),' ELSE ''
      END,
      -- Build WHERE clause
      CASE 
        WHEN has_first_name THEN '(o.first_name IS NOT NULL AND pii.first_name IS NULL)' ELSE 'FALSE'
      END ||
      CASE 
        WHEN has_last_name THEN ' OR (o.last_name IS NOT NULL AND pii.last_name IS NULL)' ELSE ''
      END ||
      CASE 
        WHEN has_date_of_birth THEN ' OR (o.date_of_birth IS NOT NULL AND pii.date_of_birth IS NULL)' ELSE ''
      END ||
      CASE 
        WHEN has_recovery_phone THEN ' OR (o.recovery_phone IS NOT NULL AND pii.recovery_phone IS NULL)' ELSE ''
      END ||
      CASE 
        WHEN has_province_region THEN ' OR (o.province_region IS NOT NULL AND pii.province_region IS NULL)' ELSE ''
      END
    );
    
    RAISE NOTICE 'Migrated PII from onboarding_responses to l0_pii_users';
  ELSE
    RAISE NOTICE 'No PII columns found in onboarding_responses - skipping migration (columns may already be dropped)';
  END IF;
END $$;

-- Step 2: Drop PII columns from onboarding_responses
-- These columns should no longer exist in onboarding_responses
DO $$
BEGIN
  -- Drop first_name if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN first_name;
    RAISE NOTICE 'Dropped first_name column from onboarding_responses';
  END IF;

  -- Drop last_name if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN last_name;
    RAISE NOTICE 'Dropped last_name column from onboarding_responses';
  END IF;

  -- Drop date_of_birth if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN date_of_birth;
    RAISE NOTICE 'Dropped date_of_birth column from onboarding_responses';
  END IF;

  -- Drop recovery_phone if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'recovery_phone'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN recovery_phone;
    RAISE NOTICE 'Dropped recovery_phone column from onboarding_responses';
  END IF;

  -- Drop province_region if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'onboarding_responses' AND column_name = 'province_region'
  ) THEN
    ALTER TABLE onboarding_responses DROP COLUMN province_region;
    RAISE NOTICE 'Dropped province_region column from onboarding_responses';
  END IF;
END $$;

-- Step 3: Add comment to onboarding_responses table
COMMENT ON TABLE onboarding_responses IS 'Onboarding questionnaire responses (non-PII only). PII has been migrated to l0_pii_users.';

