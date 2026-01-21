# Requirements Review - PIPEDA/Law 25 Compliance

## What to Replace/Remove (Overselling or Not Implemented)

### ❌ **Access Logging - NOT IMPLEMENTED**
**Current text:**
> "Access logging: Administrative access to personal information is logged and periodically reviewed to detect unauthorized or inappropriate access."

**Replace with:**
> "Access logging: Administrative access to personal information will be logged for security monitoring. (Implementation pending)"

**Why:** No access logging currently implemented for admin dashboard access. Console.error logs don't constitute proper audit logging.

---

### ✅ **Password Requirements - CORRECT**
**Current text:**
> "Passwords must meet minimum length and complexity requirements and are hashed prior to storage using a modern, industry-standard password hashing algorithm."

**Keep as-is BUT make more specific:**
> "Passwords must meet minimum requirements (at least 8 characters, uppercase, lowercase, number, special character) and are hashed prior to storage using bcryptjs."

**Why:** Password requirements ARE implemented in code (8 chars, uppercase, lowercase, number, special). Current statement is accurate but vague. Making it specific shows you're not overselling.

---

### ❌ **Consent Tracking - NOT IMPLEMENTED**
**Current text:**
> "Obtain user consent at onboarding for core functionality, and separately for any non-essential features or materially new purposes."
> "Track consents given/withheld"
> "Ask users for consent if we use existing data for new purpose"
> "Have functionality for users to review the consents they have given/withheld, and to adjust"

**Replace with:**
> "User consent obtained during onboarding for data collection and processing through explicit action (completing onboarding form). Consent tracking system to be implemented for granular consent management and withdrawal capabilities. (Implementation pending)"

**Why:** No consent tracking database table exists. Onboarding completion doesn't explicitly track consent - it's implied. No consent withdrawal UI exists. PIPEDA requires consent, but not necessarily granular tracking unless you're processing sensitive data or using data for new purposes.

---

### ⚠️ **TLS Version - TOO SPECIFIC**
**Current text:**
> "Encryption in transit: All data transmitted between user devices, application servers, and databases is protected using TLS 1.2 or higher."

**Keep as-is BUT add:**
> "TLS version managed by hosting provider (Vercel). Minimum TLS 1.2 enforced by infrastructure, actual version may be higher."

**Why:** You don't control TLS version directly - Vercel does. Don't commit to managing it yourself.

---

### ⚠️ **End-to-End Encryption - CLARIFY**
**Current text:**
> "End-to-end encryption: The App does not provide end-to-end encryption, as server-side processing is required to deliver core functionality."

**Keep as-is** - This is correct and prevents false claims.

---

## What to Add (Missing PIPEDA Requirements)

### ✅ **Add: Data Breach Notification**
**Add new bullet under Security Measures:**
> "Data breach notification: Procedures in place to detect and notify affected users and relevant authorities of data breaches as required by PIPEDA and provincial privacy laws."

**Why:** PIPEDA requires breach notification. Even if not fully implemented, you need procedures documented.

---

### ✅ **Add: User Access Rights**
**Add new section after "Deletion & Storage":**
> **User Rights:**
> - Users may request access to their personal information
> - Users may request correction of inaccurate information
> - Users may request deletion of their account and associated data
> - User deletion requests processed within [X] business days (process to be defined)

**Why:** PIPEDA grants individuals right to access and correct their data. Law 25 (Quebec) requires deletion rights. Current deletion endpoint exists but needs documentation.

---

### ✅ **Add: Data Retention Specifics**
**Current text says:**
> "Inactive Accounts: No automatic deletion policy currently implemented"

**Add:**
> "Data retention: Personal information retained for duration necessary to fulfill stated purposes. Inactive accounts retained indefinitely until user requests deletion. Retention periods to be formalized in data retention policy."

**Why:** PIPEDA requires retention limits. You can't retain "indefinitely" without justification. Need policy defining retention periods.

---

### ✅ **Add: Third-Party Processing Agreements**
**Under Processors section, add:**
> "Third-party processing agreements: Written data processing agreements in place with Vercel and Neon/Vercel governing their use of personal information as processors under our instructions."

**Why:** PIPEDA requires processor agreements. May already exist in ToS, but should be documented.

---

## What's Correctly Implemented (Keep As-Is)

✅ **Data Isolation** - Correctly implemented (user_id filtering)
✅ **PII Isolation** - Correctly implemented (l0_pii_users table with deleted_at)
✅ **Admin PII Exclusion** - Correctly implemented (email/last name excluded from certain views)
✅ **Access Controls** - Correctly implemented (separate admin auth, JWT tokens)
✅ **Database Credentials** - Correctly implemented (environment variables)
✅ **Password Hashing** - Correctly implemented (bcryptjs)
✅ **JWT Expiration** - Correctly implemented
✅ **CSRF Protection** - Correctly implemented (verifyOrigin in server.js)
✅ **Cascade Deletion** - Correctly implemented (ON DELETE CASCADE for user_events)
✅ **Encryption at Rest** - Managed by hosting provider (Vercel/Neon) - correct to state
✅ **Encryption in Transit** - Managed by hosting provider (Vercel) - correct to state

---

## Summary: Legal vs. Technical Requirements

**PIPEDA/Law 25 Minimum Requirements:**
1. ✅ Consent for collection (covered - onboarding)
2. ⚠️ Consent tracking (NOT implemented - but not strictly required unless processing sensitive data)
3. ✅ Purpose limitation (covered - documented in "Why?" section)
4. ✅ Security safeguards (covered - encryption, access controls)
5. ⚠️ Retention limits (NOT defined - need policy)
6. ✅ Individual access (need to document process)
7. ✅ Accuracy/correction (need to document process)
8. ⚠️ Breach notification (need procedures)

**Bottom Line:** You're mostly compliant, but documenting a few items you haven't implemented yet. Remove claims about access logging and granular consent tracking until implemented, or clearly mark as "pending."

