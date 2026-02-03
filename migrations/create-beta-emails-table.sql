-- ============================================================================
-- CREATE BETA EMAILS TABLE
-- ============================================================================
-- This migration creates a table to store pre-approved beta email addresses
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS beta_emails (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  added_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beta_emails_email ON beta_emails(email);

COMMIT;

