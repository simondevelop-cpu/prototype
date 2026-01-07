# Data Residency Compliance Check

**Date:** January 7, 2026  
**Purpose:** Verify current hosting locations and plan Canada migration for Law 25 compliance

---

## 🔍 **What We Can Check Ourselves**

### ✅ **Vercel Functions/App Compute - CONFIRMED ISSUE**

**Finding:** ⚠️ **Vercel does NOT currently offer a Canada region**

- Vercel functions can be configured to run in specific regions via `vercel.json` or dashboard
- **BUT:** No Canadian region is available
- Closest regions are in the United States (e.g., `iad1` - Washington DC, `sfo1` - San Francisco)
- This means your **API routes and serverless functions are likely running in the US**

**Impact for Law 25:**
- **Application compute (PII processing) happens in US** → Potential compliance issue for Quebec users
- However, **this is typically acceptable** if:
  1. Database is in Canada (data at rest is in Canada)
  2. You have equivalent protection measures (which you do: encryption, PII isolation, etc.)
  3. You document this in your privacy policy

**Verdict:** ⚠️ **Non-blocking IF database is in Canada** (see below)

---

### ✅ **Database - NEEDS VERIFICATION**

**Finding:** **Cannot determine from code** - Need to check your Vercel/Neon dashboard

**What we know:**
- Neon DOES support **Canada (Toronto)** region ✅
- Vercel Postgres MAY support Canadian regions (varies by plan)
- Your `DATABASE_URL` is in environment variables (we can't see it)

**This is the CRITICAL part** - Where your PII is stored (at rest)

---

## 📸 **What We Need From You (Screenshots/Info)**

### **1. Database Provider & Region (CRITICAL)**

**Option A: If using Neon**
1. Go to: https://console.neon.tech/
2. Open your project
3. Click **Settings** → **General**
4. Look for **Region** or **Location**
5. **Screenshot or tell me:** What region is shown? (e.g., "US East (Virginia)", "Canada (Toronto)", "EU (Frankfurt)")

**Option B: If using Vercel Postgres**
1. Go to: https://vercel.com/dashboard
2. Open your project
3. Click **Storage** tab
4. Click your Postgres database
5. Look for **Region** or **Location** in settings
6. **Screenshot or tell me:** What region is shown?

**Option C: Can't find region?**
- Share a screenshot of your database settings page
- Or just tell me: **Neon** or **Vercel Postgres**?

---

### **2. Vercel Function Region (OPTIONAL - FOR CONFIRMATION)**

**How to check:**
1. Open your deployed app in browser
2. Open **Developer Tools** (F12 or right-click → Inspect)
3. Go to **Network** tab
4. Refresh the page
5. Click the main document request (first one)
6. Look in **Headers** tab for `x-vercel-id` header
7. **Tell me:** What's the value? (e.g., `iad1::abcde`, `sfo1::xyz123`)

**What it means:**
- `iad1` = Washington DC (US)
- `sfo1` = San Francisco (US)
- `fra1` = Frankfurt (EU)
- **If you see US/EU codes, functions are running outside Canada** ✅ (expected, but need to document)

---

### **3. Production Data Status (HELPFUL)**

**Quick questions:**
1. **Do you have real user data in production?** (Beyond demo user)
   - Yes / No
   - If yes, roughly how many users? (1-10 / 10-100 / 100+)

2. **Database size estimate?**
   - <100MB / 100MB-1GB / >1GB

3. **Can you tolerate brief downtime?** (5-10 minutes)
   - Yes / No / Prefer zero downtime

---

## 🎯 **Compliance Assessment**

### **Scenario 1: Database in Canada (Toronto) ✅ BEST CASE**

**Setup:**
- Database: Canada (Toronto) ✅
- Vercel Functions: US (no Canada option) ⚠️
- Edge Network: Global (includes Canada) ✅

**Law 25 Compliance:**
- ✅ **Data at rest:** In Canada (compliant)
- ⚠️ **Data in transit/processing:** US-based functions (acceptable with documentation)
- **Verdict:** ✅ **COMPLIANT** with proper documentation

**Action Needed:**
1. Document in privacy policy that:
   - Data is stored in Canada
   - Processing happens in US (equivalent protection measures)
   - Strong security safeguards in place
2. **No migration needed** ✅

---

### **Scenario 2: Database in US ⚠️ NEEDS MIGRATION**

**Setup:**
- Database: US (e.g., Virginia) ❌
- Vercel Functions: US ⚠️
- Edge Network: Global ✅

**Law 25 Compliance:**
- ❌ **Data at rest:** In US (non-compliant for Quebec)
- ⚠️ **Data in transit/processing:** US-based (also non-compliant)
- **Verdict:** ❌ **NON-COMPLIANT** - Need migration

**Action Needed:**
1. **Move database to Canada (Toronto)** - This is the critical fix
2. Document processing location in privacy policy
3. **Migration required** ⚠️ (but easy to do - see below)

---

### **Scenario 3: Database in EU ⚠️ NEEDS MIGRATION**

**Setup:**
- Database: EU (e.g., Frankfurt) ❌
- Vercel Functions: US ⚠️
- Edge Network: Global ✅

**Law 25 Compliance:**
- ❌ **Data at rest:** In EU (non-compliant for Quebec)
- **Verdict:** ❌ **NON-COMPLIANT** - Need migration

**Action Needed:**
- Same as Scenario 2: Move database to Canada

---

## 🔄 **Migration Plan (If Database Not in Canada)**

### **Difficulty: 🟢 LOW-MEDIUM (2-3 hours)**

**Why it's easy:**
1. ✅ No code changes needed - just configuration
2. ✅ Migration scripts already exist
3. ✅ Can test in parallel (zero downtime approach)
4. ✅ Neon supports Canada (Toronto) region

**Steps:**
1. **Create new Neon database in Canada (Toronto)** - 15 min
2. **Run schema migration** on new DB - 15 min
3. **Copy data** from old DB to new DB - 30-60 min (depends on size)
4. **Test new database** (create preview deployment) - 30 min
5. **Switch DATABASE_URL** in Vercel - 5 min
6. **Verify** (check App Health dashboard) - 15 min

**Total:** 2-3 hours

**Risk:** 🟢 **LOW** - Can test in parallel, rollback is easy (just switch DATABASE_URL back)

---

## 📋 **What To Send Me**

**Minimum needed:**
1. Database provider: **Neon** or **Vercel Postgres**?
2. Database region: **What region is currently selected?**
3. Production data: **Yes/No** (do you have real users beyond demo?)

**Nice to have:**
4. Vercel function region: **Value of `x-vercel-id` header** (from browser dev tools)
5. Database size: **Rough estimate** (<100MB / 100MB-1GB / >1GB)
6. Downtime tolerance: **Can you do 5-10 min maintenance window?**

---

## ✅ **Confidence Assessment**

### **Can we do the switch easily?**
- ✅ **YES** - If database needs to move, migration is straightforward
- ✅ **No code changes** required
- ✅ **Low risk** - Can test in parallel
- ✅ **Rollback is easy** - Just switch DATABASE_URL back

### **Will Toronto work for Quebec?**
- ✅ **YES** - Law 25 requires data in **Canada** (not specifically Quebec)
- ✅ **Toronto is perfect** for Quebec compliance
- ✅ **No need** for database specifically in Quebec

### **Will Vercel functions being in US cause problems?**
- ⚠️ **MINOR CONCERN** - But typically acceptable if:
  - Database is in Canada (critical)
  - You document processing location in privacy policy
  - You have equivalent protection (which you do)

**Verdict:** ✅ **YES, migration will work easily** - Just need to know current database region first

---

## 🚀 **Next Steps**

1. **You:** Check database region (Neon/Vercel dashboard) - **5 minutes**
2. **You:** Share screenshot/info with me
3. **Me:** Confirm migration plan based on findings
4. **Both:** Execute migration (2-3 hours if needed)
5. **You:** Test thoroughly
6. **Both:** Update privacy policy with data residency disclosure

**Total time:** 2-4 hours (including your checks and migration if needed)

---

## 💡 **Bottom Line**

**Can we do it easily?** ✅ **YES**
- Migration is straightforward (just configuration)
- No code changes needed
- Low risk, easy rollback

**Will Toronto work for Quebec?** ✅ **YES**
- Law 25 requires Canada (not specifically Quebec)
- Toronto is perfect for compliance

**Any technical hiccups expected?** ✅ **NO**
- Standard database migration
- Can test in parallel
- Rollback is easy

**What we need:** Just your current database region to confirm migration plan ✅

