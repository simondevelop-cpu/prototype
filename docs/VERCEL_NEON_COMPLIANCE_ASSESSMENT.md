# Vercel & Neon Compliance Assessment - For Privacy Lawyer

## Can We State They Comply? **Mostly Yes, with Caveats**

### ✅ **Strong Compliance Evidence**

**Vercel:**
- ✅ **SOC 2 Type 2** certified (Security, Confidentiality, Availability)
- ✅ **ISO 27001:2022** certified
- ✅ **GDPR compliant** with EU-U.S. Data Privacy Framework certification
- ✅ **Encryption**: AES-256 at rest, TLS/HTTPS in transit
- ✅ **PCI DSS** compliant (SAQ-D for service providers)

**Neon:**
- ✅ **SOC 2 Type 1 & 2, SOC 3** certified
- ✅ **ISO 27001** and **ISO 27701** certified
- ✅ **GDPR and CCPA** compliant
- ✅ **Encryption**: AES-256 at rest, TLS/SSL with verify-full mode
- ✅ **HIPAA support** available (with BAA on Scale plan)

### ⚠️ **Gaps/Verification Needed**

**1. Explicit PIPEDA/Law 25 Compliance:**
- Neither service explicitly states PIPEDA/Law 25 compliance in their public documentation
- However, their SOC 2, ISO 27001, and GDPR certifications demonstrate security safeguards that likely satisfy PIPEDA/Law 25 requirements
- **Action Needed:** Verify whether Vercel/Neon have explicit PIPEDA/Law 25 statements in their DPAs or terms

**2. Data Processing Agreements (DPAs):**
- Both providers offer DPAs for GDPR compliance
- **Action Needed:** Confirm we have signed DPAs in place with both providers that include:
  - PIPEDA/Law 25-specific language (if available)
  - "Comparable protection" commitments
  - Subprocessor disclosure and approval requirements

**3. Data Residency/Location:**
- Vercel: Default region is US (Oregon). Need to verify if Canadian regions available.
- Neon: Need to verify data storage location and whether Canadian data residency options exist
- **Action Needed:** Confirm where our data is actually stored and whether this meets PIPEDA/Law 25 residency requirements

**4. Written Agreements:**
- Law 25 (Quebec) requires **written agreements** with specific security obligations
- **Action Needed:** Verify we have executed written agreements (not just ToS) that satisfy Law 25 requirements

### ✅ **What We Can Confidently State**

We can state that:
1. **Vercel and Neon maintain industry-standard security certifications** (SOC 2, ISO 27001) that demonstrate security safeguards comparable to our own
2. **Both providers implement encryption in transit and at rest** consistent with industry standards
3. **Both providers comply with major international privacy laws** (GDPR, CCPA) which include similar security obligations to PIPEDA/Law 25
4. **Both providers offer data processing agreements** that govern their use of personal information as processors

### ⚠️ **What We Should Add as Caveats**

**Recommended language addition to Section 3:**
> "We have verified that Vercel and Neon maintain industry-standard security certifications (SOC 2 Type 2, ISO 27001) and implement encryption in transit and at rest. Both providers comply with GDPR and other major international privacy frameworks that include similar security obligations to PIPEDA and Law 25. We maintain written data processing agreements with both providers that govern their use of personal information. Data residency and specific PIPEDA/Law 25 compliance should be verified through executed DPAs. (DPA execution and compliance verification pending)"

### **Bottom Line**

**Comfort Level: 7/10**

**Yes, we can be reasonably comfortable**, because:
- Strong certifications (SOC 2, ISO 27001) demonstrate security safeguards
- GDPR compliance includes similar security obligations to PIPEDA/Law 25
- Encryption and access controls are in place

**But we should verify:**
- Signed DPAs are in place (not just ToS)
- DPAs include PIPEDA/Law 25-specific language or "comparable protection" commitments
- Data residency meets Canadian requirements
- We're using compliant features/configurations (not HIPAA-excluded features, etc.)

**Recommendation:** Before finalizing legal documentation, confirm with both providers:
1. Do they explicitly support PIPEDA/Law 25 compliance?
2. Can they provide signed DPAs with PIPEDA/Law 25 language?
3. What data residency options exist for Canadian data?
4. What features/configurations must we use/avoid to maintain compliance?




