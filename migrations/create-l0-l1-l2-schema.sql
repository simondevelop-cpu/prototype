-- ============================================================================
-- DATA ARCHITECTURE MIGRATION: L0/L1/L2 Schema
-- ============================================================================
-- This migration creates the new layered architecture as per the data 
-- architecture slide, while maintaining backward compatibility with existing tables.
--
-- Principles:
-- 1. One authoritative base - L1 facts feed all analytics
-- 2. Clean separation - PII isolated in L0; analytics use obfuscated IDs
-- 3. Schema-safe evolution - New metrics = new views, not schema changes
-- 4. Regional compliance - All data stays in-region, encrypted in transit & at rest
-- ============================================================================

-- Enable pgcrypto extension for cryptographic functions (digest for tokenization)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- L0: AUTH / PRIVACY / CONFIG LAYER
-- ============================================================================

-- L0.A: PII Users Table (Isolated PII Zone)
-- Links personal identifiers to unique userID (internal only)
CREATE TABLE IF NOT EXISTS l0_pii_users (
  id SERIAL PRIMARY KEY,
  internal_user_id INTEGER NOT NULL UNIQUE, -- Links to users.id, NOT exposed to analytics
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  recovery_phone TEXT,
  province_region TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete for compliance (30 day retention)
  FOREIGN KEY (internal_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_l0_pii_internal_user_id ON l0_pii_users(internal_user_id);
CREATE INDEX IF NOT EXISTS idx_l0_pii_email ON l0_pii_users(email);
CREATE INDEX IF NOT EXISTS idx_l0_pii_deleted_at ON l0_pii_users(deleted_at) WHERE deleted_at IS NULL;

-- L0.B: Tokenized User Mapping
-- Creates anonymized user IDs for analytics (deterministic hash)
CREATE TABLE IF NOT EXISTS l0_user_tokenization (
  internal_user_id INTEGER PRIMARY KEY,
  tokenized_user_id TEXT NOT NULL UNIQUE, -- SHA256 hash of internal_user_id + salt
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (internal_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_l0_tokenized_user_id ON l0_user_tokenization(tokenized_user_id);

-- Function to generate tokenized user ID (deterministic)
CREATE OR REPLACE FUNCTION generate_tokenized_user_id(p_internal_user_id INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(p_internal_user_id::TEXT || COALESCE(current_setting('app.tokenization_salt', true), 'default_salt_change_in_production'), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- L0.C: Category List (Metadata)
-- Maps to existing admin_keywords (category reference table)
CREATE TABLE IF NOT EXISTS l0_category_list (
  id SERIAL PRIMARY KEY,
  category_key TEXT NOT NULL UNIQUE, -- e.g., 'Housing', 'Food', 'Bills'
  display_name TEXT NOT NULL,
  description TEXT,
  parent_category_key TEXT, -- For subcategories
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_category_key) REFERENCES l0_category_list(category_key)
);

CREATE INDEX IF NOT EXISTS idx_l0_category_key ON l0_category_list(category_key);
CREATE INDEX IF NOT EXISTS idx_l0_category_active ON l0_category_list(is_active) WHERE is_active = TRUE;

-- L0.D: Insight List (Metadata)
-- One row = insight rule
CREATE TABLE IF NOT EXISTS l0_insight_list (
  id SERIAL PRIMARY KEY,
  insight_key TEXT NOT NULL UNIQUE, -- e.g., 'spending_spike', 'low_balance_alert'
  insight_name TEXT NOT NULL,
  description TEXT,
  rule_definition JSONB, -- Flexible JSON structure for rule config
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_l0_insight_key ON l0_insight_list(insight_key);
CREATE INDEX IF NOT EXISTS idx_l0_insight_active ON l0_insight_list(is_active) WHERE is_active = TRUE;

-- L0.E: Admin List (Metadata)
-- One row = admin configuration
CREATE TABLE IF NOT EXISTS l0_admin_list (
  id SERIAL PRIMARY KEY,
  admin_key TEXT NOT NULL UNIQUE,
  admin_name TEXT NOT NULL,
  config_data JSONB, -- Flexible JSON structure
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_l0_admin_key ON l0_admin_list(admin_key);
CREATE INDEX IF NOT EXISTS idx_l0_admin_active ON l0_admin_list(is_active) WHERE is_active = TRUE;

-- L0.F: Privacy Compliance Metadata
CREATE TABLE IF NOT EXISTS l0_privacy_metadata (
  id SERIAL PRIMARY KEY,
  internal_user_id INTEGER NOT NULL,
  data_retention_policy TEXT, -- e.g., '30_days', '7_years'
  deletion_scheduled_at TIMESTAMP WITH TIME ZONE,
  consent_flags JSONB, -- Store consent preferences
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (internal_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_l0_privacy_user_id ON l0_privacy_metadata(internal_user_id);
CREATE INDEX IF NOT EXISTS idx_l0_privacy_deletion ON l0_privacy_metadata(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;

-- ============================================================================
-- L1: CANONICAL FACT TABLES
-- ============================================================================

-- L1.D: Transaction Fact Table
-- Canonical source for all transaction-level analysis (user anonymized)
CREATE TABLE IF NOT EXISTS l1_transaction_facts (
  id SERIAL PRIMARY KEY,
  tokenized_user_id TEXT NOT NULL, -- Anonymized user ID from l0_user_tokenization
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  cashflow TEXT NOT NULL CHECK (cashflow IN ('income', 'expense', 'other')),
  account TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- Foreign key to legacy transactions table for migration tracking
  legacy_transaction_id INTEGER,
  FOREIGN KEY (tokenized_user_id) REFERENCES l0_user_tokenization(tokenized_user_id)
);

CREATE INDEX IF NOT EXISTS idx_l1_trans_tokenized_user ON l1_transaction_facts(tokenized_user_id);
CREATE INDEX IF NOT EXISTS idx_l1_trans_date ON l1_transaction_facts(transaction_date);
CREATE INDEX IF NOT EXISTS idx_l1_trans_cashflow ON l1_transaction_facts(cashflow);
CREATE INDEX IF NOT EXISTS idx_l1_trans_category ON l1_transaction_facts(category);
CREATE INDEX IF NOT EXISTS idx_l1_trans_user_date ON l1_transaction_facts(tokenized_user_id, transaction_date);

-- L1.E: Customer Fact Table
-- One row = one user (by tokenized user_id)
CREATE TABLE IF NOT EXISTS l1_customer_facts (
  tokenized_user_id TEXT PRIMARY KEY,
  -- Demographics (anonymized aggregates only)
  age_range TEXT, -- e.g., '25-34', not exact age
  province_region TEXT, -- Generalized region
  
  -- Account state
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'closed', 'pending')),
  account_created_at TIMESTAMP WITH TIME ZONE,
  
  -- Migration / segment classification
  user_segment TEXT, -- e.g., 'new_user', 'power_user', 'churned'
  migration_flag TEXT, -- For tracking migration cohorts
  
  -- Engagement metrics (aggregated, not PII)
  last_active_at TIMESTAMP WITH TIME ZONE,
  total_transactions INTEGER DEFAULT 0,
  total_imports INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- Import quality metrics
  import_success_rate NUMERIC(5, 2), -- Percentage
  avg_transactions_per_import NUMERIC(10, 2),
  
  -- Reengagement flags
  reengagement_score NUMERIC(5, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tokenized_user_id) REFERENCES l0_user_tokenization(tokenized_user_id)
);

CREATE INDEX IF NOT EXISTS idx_l1_customer_status ON l1_customer_facts(account_status);
CREATE INDEX IF NOT EXISTS idx_l1_customer_segment ON l1_customer_facts(user_segment);
CREATE INDEX IF NOT EXISTS idx_l1_customer_last_active ON l1_customer_facts(last_active_at);

-- L1.F: Event Fact Table
-- Time-stamped events (powers activation, engagement, friction, drop-off, funnel metrics)
CREATE TABLE IF NOT EXISTS l1_event_facts (
  id SERIAL PRIMARY KEY,
  tokenized_user_id TEXT NOT NULL, -- Anonymized user ID
  event_type TEXT NOT NULL, -- e.g., 'user_event', 'import_event', 'parsing_event', 'insight_event', 'app_health_event'
  event_name TEXT NOT NULL, -- e.g., 'login', 'upload_started', 'parsing_failed', 'insight_shown'
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_properties JSONB, -- Flexible JSON structure for event data
  session_id TEXT, -- For tracking user sessions
  FOREIGN KEY (tokenized_user_id) REFERENCES l0_user_tokenization(tokenized_user_id)
);

CREATE INDEX IF NOT EXISTS idx_l1_event_tokenized_user ON l1_event_facts(tokenized_user_id);
CREATE INDEX IF NOT EXISTS idx_l1_event_type ON l1_event_facts(event_type);
CREATE INDEX IF NOT EXISTS idx_l1_event_name ON l1_event_facts(event_name);
CREATE INDEX IF NOT EXISTS idx_l1_event_timestamp ON l1_event_facts(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_l1_event_user_timestamp ON l1_event_facts(tokenized_user_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_l1_event_session ON l1_event_facts(session_id);

-- ============================================================================
-- L1: OPERATIONAL FACT TABLES
-- ============================================================================

-- L1.G: File Ingestion List
-- One row per upload session
CREATE TABLE IF NOT EXISTS l1_file_ingestion (
  id SERIAL PRIMARY KEY,
  tokenized_user_id TEXT NOT NULL, -- Anonymized user ID
  filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  file_type TEXT, -- e.g., 'application/pdf'
  bank_identifier TEXT, -- Detected bank name
  account_type TEXT, -- e.g., 'chequing', 'savings', 'credit'
  parse_started_at TIMESTAMP WITH TIME ZONE,
  parse_completed_at TIMESTAMP WITH TIME ZONE,
  parse_status TEXT CHECK (parse_status IN ('success', 'fallback_ocr', 'failure')),
  failure_reason TEXT, -- If parse_status = 'failure'
  transactions_parsed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tokenized_user_id) REFERENCES l0_user_tokenization(tokenized_user_id)
);

CREATE INDEX IF NOT EXISTS idx_l1_file_tokenized_user ON l1_file_ingestion(tokenized_user_id);
CREATE INDEX IF NOT EXISTS idx_l1_file_status ON l1_file_ingestion(parse_status);
CREATE INDEX IF NOT EXISTS idx_l1_file_timestamp ON l1_file_ingestion(parse_started_at);

-- L1.H: Support Ticket List
-- One row = ticket (for SRE, security & admin dashboards)
CREATE TABLE IF NOT EXISTS l1_support_tickets (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL UNIQUE,
  tokenized_user_id TEXT, -- Anonymized user ID (nullable for system tickets)
  ticket_category TEXT NOT NULL, -- e.g., 'technical', 'billing', 'security'
  ticket_status TEXT NOT NULL DEFAULT 'open' CHECK (ticket_status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_time_minutes INTEGER, -- Calculated
  satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
  FOREIGN KEY (tokenized_user_id) REFERENCES l0_user_tokenization(tokenized_user_id)
);

CREATE INDEX IF NOT EXISTS idx_l1_ticket_tokenized_user ON l1_support_tickets(tokenized_user_id);
CREATE INDEX IF NOT EXISTS idx_l1_ticket_status ON l1_support_tickets(ticket_status);
CREATE INDEX IF NOT EXISTS idx_l1_ticket_category ON l1_support_tickets(ticket_category);
CREATE INDEX IF NOT EXISTS idx_l1_ticket_created ON l1_support_tickets(created_at);

-- L1.I: Job List (Worker Pipeline)
-- One row = background job (powers job SLA metrics, queue depth, retry rate)
CREATE TABLE IF NOT EXISTS l1_job_list (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL, -- e.g., 'parse_pdf', 'categorize_transactions', 'generate_insights'
  tokenized_user_id TEXT, -- Anonymized user ID (nullable for system jobs)
  job_status TEXT NOT NULL DEFAULT 'queued' CHECK (job_status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER, -- Calculated
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  worker_id TEXT, -- Which worker processed this
  error_message TEXT,
  job_data JSONB -- Flexible JSON for job-specific data
);

CREATE INDEX IF NOT EXISTS idx_l1_job_type ON l1_job_list(job_type);
CREATE INDEX IF NOT EXISTS idx_l1_job_status ON l1_job_list(job_status);
CREATE INDEX IF NOT EXISTS idx_l1_job_tokenized_user ON l1_job_list(tokenized_user_id);
CREATE INDEX IF NOT EXISTS idx_l1_job_queued ON l1_job_list(queued_at);
CREATE INDEX IF NOT EXISTS idx_l1_job_status_queued ON l1_job_list(job_status, queued_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create tokenized user ID
CREATE OR REPLACE FUNCTION get_or_create_tokenized_user_id(p_internal_user_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_tokenized_id TEXT;
BEGIN
  -- Check if tokenized ID already exists
  SELECT tokenized_user_id INTO v_tokenized_id
  FROM l0_user_tokenization
  WHERE internal_user_id = p_internal_user_id;
  
  -- If not found, create it
  IF v_tokenized_id IS NULL THEN
    v_tokenized_id := generate_tokenized_user_id(p_internal_user_id);
    INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id)
    VALUES (p_internal_user_id, v_tokenized_id)
    ON CONFLICT (internal_user_id) DO UPDATE
    SET tokenized_user_id = EXCLUDED.tokenized_user_id
    RETURNING tokenized_user_id INTO v_tokenized_id;
  END IF;
  
  RETURN v_tokenized_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR BACKWARD COMPATIBILITY (L2 - Derived Views)
-- ============================================================================

-- View: Transactions (backward compatibility)
-- Maps l1_transaction_facts to legacy transactions structure
CREATE OR REPLACE VIEW l2_transactions_view AS
SELECT 
  tf.id,
  ut.internal_user_id as user_id, -- Only for legacy compatibility
  tf.transaction_date as date,
  tf.description,
  tf.merchant,
  tf.amount,
  tf.cashflow,
  tf.account,
  tf.category,
  tf.label,
  tf.created_at
FROM l1_transaction_facts tf
JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id;

-- View: Customer summary (for analytics)
CREATE OR REPLACE VIEW l2_customer_summary_view AS
SELECT 
  cf.tokenized_user_id,
  cf.account_status,
  cf.user_segment,
  cf.total_transactions,
  cf.total_imports,
  cf.onboarding_completed,
  cf.import_success_rate,
  cf.last_active_at,
  COUNT(DISTINCT DATE_TRUNC('month', tf.transaction_date)) as active_months
FROM l1_customer_facts cf
LEFT JOIN l1_transaction_facts tf ON cf.tokenized_user_id = tf.tokenized_user_id
GROUP BY 
  cf.tokenized_user_id,
  cf.account_status,
  cf.user_segment,
  cf.total_transactions,
  cf.total_imports,
  cf.onboarding_completed,
  cf.import_success_rate,
  cf.last_active_at;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE l0_pii_users IS 'L0: Isolated PII zone - personal identifiers linked to internal user ID';
COMMENT ON TABLE l0_user_tokenization IS 'L0: Maps internal user IDs to anonymized tokenized IDs for analytics';
COMMENT ON TABLE l0_category_list IS 'L0: Category metadata - one row = category keyword';
COMMENT ON TABLE l0_insight_list IS 'L0: Insight rules metadata - one row = insight rule';
COMMENT ON TABLE l0_admin_list IS 'L0: Admin configuration metadata';
COMMENT ON TABLE l1_transaction_facts IS 'L1: Canonical transaction fact table - user anonymized via tokenized_user_id';
COMMENT ON TABLE l1_customer_facts IS 'L1: Canonical customer fact table - one row per user (tokenized)';
COMMENT ON TABLE l1_event_facts IS 'L1: Event fact table - time-stamped events for analytics';
COMMENT ON TABLE l1_file_ingestion IS 'L1: File ingestion operational table - one row per upload session';
COMMENT ON TABLE l1_support_tickets IS 'L1: Support ticket operational table';
COMMENT ON TABLE l1_job_list IS 'L1: Worker pipeline job table - for SRE and job SLA metrics';

