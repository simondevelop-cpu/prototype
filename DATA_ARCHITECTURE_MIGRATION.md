# Data Architecture Migration - L0/L1/L2 Structure

## Overview

This document outlines the migration from the current flat schema to the layered architecture (L0/L1/L2) as specified in the data architecture slide.

## Target Architecture Principles

1. **One authoritative base:** L1 facts feed all analytics; L2/L3 are derived
2. **Clean separation:** PII isolated in L0; analytics use obfuscated IDs  
3. **Schema-safe evolution:** New metrics = new views, not schema changes
4. **Regional compliance:** All data stays in-region, encrypted in transit & at rest

## Schema Layers

### L0: Auth / Privacy / Config (Isolated PII Zone)

#### A. PII Users Table (isolated)
- Stores personal identifiers linked to unique userID
- Contains: email, first_name, last_name, date_of_birth, recovery_phone, province_region
- Separate from auth credentials
- Links to tokenized user_id for analytics

#### B. Auth / User Credentials
- Separate from PII
- Contains: user_id (tokenized/anonymized), password_hash, login_attempts
- Links to PII zone via internal ID only

#### C. Category List (metadata)
- One row = category keyword
- Maps to current `admin_keywords` table

#### D. Insight List (metadata)  
- One row = insight rule
- NEW TABLE needed

#### E. Admin List (metadata)
- One row = admin configuration
- NEW TABLE needed

### L1: Canonical Fact Tables

#### D. Transaction Fact Table
- Canonical source for all transaction-level analysis
- **User anonymized** - uses tokenized user_id (hash of actual user_id)
- All transaction data: date, description, merchant, amount, cashflow, category, label
- Links to customer_facts via tokenized user_id

#### E. Customer Fact Table
- One row = one user (by tokenized user_id)
- Demographics/attributes (from onboarding, anonymized)
- Account state (active, suspended, etc.)
- Migration/segment classification
- Engagement/reengagement metrics
- Import-quality per user

#### F. Event Fact Table
- Time-stamped events
- Powers: activation, engagement, friction, drop-off, funnel metrics
- Types: user_events, import_events, parsing_events, insight_events, app_health_events
- Uses tokenized user_id

### L1: Operational Fact Tables

#### G. File Ingestion List
- One row per upload session
- userID (tokenized), bank, file size/type
- Parse start/end timestamps
- Result (success, fallback OCR, failure reason)

#### H. Support Ticket List
- One row = ticket
- user (tokenized), category, status, timestamps
- Resolution time, satisfaction
- For SRE, security & admin dashboards

#### I. Job List (Worker Pipeline)
- One row = background job
- Type, start/end times, status, retries, worker utilization
- Powers job SLA metrics, queue depth, retry rate

## Migration Strategy

### Phase 1: Create New Schema (Non-Breaking)
1. Create all new L0/L1 tables alongside existing tables
2. Add tokenization function for user_id
3. Create views that map old tables to new structure

### Phase 2: Data Migration
1. Migrate PII to L0 pii_users table
2. Create tokenized user IDs
3. Migrate transactions to transaction_facts with tokenized user_id
4. Create customer_facts records
5. Migrate file ingestion events (if tracked) to file_ingestion table
6. Create initial event_facts records from existing data

### Phase 3: Update Application Code
1. Update all queries to use new L1 tables
2. Ensure analytics only use tokenized IDs
3. Keep PII queries separate in L0

### Phase 4: Deprecate Old Tables
1. Mark old tables as deprecated
2. Eventually remove after verification period

## Tokenization Approach

- Create deterministic hash of user_id for analytics: `SHA256(user_id + SALT)`
- Store mapping in L0 auth table only
- Analytics tables never see real user_id
- PII queries join through auth table only

## Backup & Deletion Schedule (Target - MVP)

- **L0 PII/Auth:** Delete within 30 days of account closure per PIPEDA/Law 25
- **L1 Canonical Facts:** Retain 7 years for fraud, audit, reporting
- **L1 Operational Facts:** Retain 90 days hot; archive 1-5 years

