-- ============================================================================
-- COMPLETE PII ISOLATION MIGRATION
-- ============================================================================
-- Purpose: Remove ALL PII from non-PII tables
-- Tables to clean: chat_bookings, onboarding_responses, users
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MIGRATE PII FROM onboarding_responses TO l0_pii_users
-- ============================================================================

-- Check if PII columns exist in onboarding_responses before migrating
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

-- Drop PII columns from onboarding_responses
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_responses' AND column_name = 'first_name') THEN
    ALTER TABLE onboarding_responses DROP COLUMN first_name;
    RAISE NOTICE 'Dropped first_name from onboarding_responses';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_responses' AND column_name = 'last_name') THEN
    ALTER TABLE onboarding_responses DROP COLUMN last_name;
    RAISE NOTICE 'Dropped last_name from onboarding_responses';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_responses' AND column_name = 'date_of_birth') THEN
    ALTER TABLE onboarding_responses DROP COLUMN date_of_birth;
    RAISE NOTICE 'Dropped date_of_birth from onboarding_responses';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_responses' AND column_name = 'recovery_phone') THEN
    ALTER TABLE onboarding_responses DROP COLUMN recovery_phone;
    RAISE NOTICE 'Dropped recovery_phone from onboarding_responses';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_responses' AND column_name = 'province_region') THEN
    ALTER TABLE onboarding_responses DROP COLUMN province_region;
    RAISE NOTICE 'Dropped province_region from onboarding_responses';
  END IF;
END $$;

-- ============================================================================
-- 2. MIGRATE EMAIL FROM users TO l0_pii_users (if not already there)
-- ============================================================================

-- Ensure all users have email in l0_pii_users
INSERT INTO l0_pii_users (internal_user_id, email, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  u.created_at,
  CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM l0_pii_users pii WHERE pii.internal_user_id = u.id
)
AND u.email IS NOT NULL
ON CONFLICT (internal_user_id) 
DO UPDATE SET
  email = COALESCE(EXCLUDED.email, l0_pii_users.email),
  updated_at = CURRENT_TIMESTAMP;

-- Note: We keep email in users table for backward compatibility with auth
-- But all PII operations should use l0_pii_users.email

-- ============================================================================
-- 3. CHAT_BOOKINGS: Notes field is free text, not structured PII
-- ============================================================================

-- chat_bookings.notes is free text that MAY contain PII, but it's not structured
-- We cannot migrate it to l0_pii_users as it's unstructured
-- Recommendation: Keep notes field but add comment that it may contain PII
-- For full PII isolation, consider:
--   - Option A: Keep notes (acceptable for operational data)
--   - Option B: Move notes to a separate PII table if needed
--   - Option C: Encrypt notes field

COMMENT ON COLUMN chat_bookings.notes IS 'Free text notes from user. May contain PII. For full PII isolation, consider encryption or separate PII storage.';

-- ============================================================================
-- 4. ADD COMMENTS FOR CLARITY
-- ============================================================================

COMMENT ON TABLE l0_pii_users IS 'SINGLE SOURCE OF TRUTH for all PII. All personal data must be stored here only.';
COMMENT ON TABLE users IS 'Authentication and account status only. Email kept for backward compatibility but PII operations should use l0_pii_users.';
COMMENT ON TABLE onboarding_responses IS 'Onboarding questionnaire responses (non-PII only). All PII has been migrated to l0_pii_users.';
COMMENT ON TABLE chat_bookings IS 'Chat booking requests. Uses user_id to link to users.id. Notes field may contain unstructured PII.';

COMMIT;

