-- Remove PII and migration-tracking columns from l1_customer_facts
-- Safe to run multiple times (IF EXISTS).
-- Run this if post-migration verification fails on "l1_customer_facts PII columns removed".

ALTER TABLE l1_customer_facts DROP COLUMN IF EXISTS age_range;
ALTER TABLE l1_customer_facts DROP COLUMN IF EXISTS province_region;
ALTER TABLE l1_customer_facts DROP COLUMN IF EXISTS migration_flag;
