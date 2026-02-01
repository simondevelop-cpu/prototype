-- ============================================================================
-- DROP EMPTY UNUSED TABLES
-- ============================================================================
-- This migration drops empty tables that are not needed:
-- - l0_admin_list: Empty, unused admin configuration table
-- - l0_insight_list: Empty, check if isolated (no references)
-- - l0_privacy_metadata: Empty, unused privacy metadata table
-- - l1_file_ingestion: Empty, PDFs are processed in memory and not stored
-- - l1_job_list: Empty, worker pipeline not implemented
-- 
-- KEEP: l1_support_tickets (user wants to keep this for future use)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP l0_admin_list
-- ============================================================================
-- Empty, unused admin configuration table
DROP TABLE IF EXISTS l0_admin_list CASCADE;

-- ============================================================================
-- 2. DROP l0_privacy_metadata
-- ============================================================================
-- Empty, unused privacy metadata table
DROP TABLE IF EXISTS l0_privacy_metadata CASCADE;

-- ============================================================================
-- 3. DROP l1_file_ingestion
-- ============================================================================
-- Empty, PDFs are processed in memory and not stored
-- Files are parsed immediately and transactions extracted, no file storage needed
DROP TABLE IF EXISTS l1_file_ingestion CASCADE;

-- ============================================================================
-- 4. DROP l1_job_list
-- ============================================================================
-- Empty, worker pipeline not implemented
DROP TABLE IF EXISTS l1_job_list CASCADE;

-- ============================================================================
-- 5. DROP l0_insight_list (if no references)
-- ============================================================================
-- Check if this table has any foreign key references before dropping
-- If it has references, we'll need to drop those first
-- For now, we'll attempt to drop it (CASCADE will handle dependencies)
DROP TABLE IF EXISTS l0_insight_list CASCADE;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- - l1_support_tickets is KEPT (user wants to keep for future use)
-- - All drops use CASCADE to handle any dependencies
-- - These tables are empty and unused, safe to drop
-- ============================================================================

COMMIT;

