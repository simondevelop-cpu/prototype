# Security Audit & Remediation Plan

**Date:** January 7, 2026  
**Branch:** New branch (to be created)  
**Purpose:** Address multer vulnerabilities and other security issues

---

## 🔍 **Current State Analysis**

### **1. Multer Usage & Risk Assessment**

**Current Version:** `multer@1.4.5-lts.2` ⚠️ **VULNERABLE**

**Where Used:**
- `server.js` line 169: `const upload = multer({...})`
- **Used for:** File upload handling (likely CSV uploads in Express server)

**Next.js API Routes:**
- ✅ `app/api/statements/upload/route.ts` - Uses Next.js `FormData` (not multer)
- ✅ `app/api/statements/parse/route.ts` - Uses Next.js `FormData` (not multer)
- ✅ These are **safe** - using Next.js built-in handlers

**Vulnerabilities in 1.4.5-lts.2:**
1. **CVE-2025-47944** - DoS from malformed multipart requests
   - Versions: 1.4.4-lts.1 up to (but not including) 2.0.0
   - **Risk:** Server crashes from specially crafted requests

2. **GHSA-44fp-w29j-9vj5** - DoS via memory leaks
   - Versions: Before 2.0.0
   - **Risk:** Unclosed streams exhaust server resources

3. **GHSA-fjgf-rc76-4x9p** - Unhandled exceptions causing crashes
   - Versions: 1.4.4-lts.1 up to (but not including) 2.0.2
   - **Risk:** Crashes from malformed requests

**Fixed in:** Multer 2.0.2+ ✅

**Risk Level:** 🟡 **MEDIUM-HIGH**
- Multer is used in `server.js` (Express server)
- Vulnerable to DoS attacks
- Could crash server with malformed requests

---

### **2. Other Security Concerns**

#### **A. JWT Secret (server.js line 50)**
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';
```
- ⚠️ **Weak default** - But uses environment variable (good!)
- ✅ **Already using env var** in production
- 🟡 **Recommendation:** Document that default is for dev only

#### **B. Tokenization Salt (server.js line 57)**
```javascript
const TOKENIZATION_SALT = process.env.TOKENIZATION_SALT || 'default_salt_change_in_production';
```
- ⚠️ **Weak default** - But uses environment variable (good!)
- ✅ **Already using env var** in production
- 🟡 **Recommendation:** Document that default is for dev only

#### **C. Demo Credentials (server.js lines 52-53)**
```javascript
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@canadianinsights.ca';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'northstar-demo';
```
- ✅ **Fine for demo** - Uses environment variables
- ✅ **No risk** - Demo account is intentional

#### **D. File Upload Security (Already Implemented)**
- ✅ File type validation (PDF only)
- ✅ File size limits (5MB max)
- ✅ Authentication required
- ✅ User-scoped uploads

#### **E. Rate Limiting**
- ✅ Implemented for auth endpoints
- ✅ In-memory store (fine for MVP)
- 🟡 **Recommendation:** Consider Redis for production scale

#### **F. CSRF Protection**
- ✅ Implemented in `lib/csrf.ts`
- ✅ Origin verification
- 🟡 **Recommendation:** Set `ALLOWED_ORIGINS` in production

---

## 🎯 **Remediation Plan**

### **Phase 1: Multer Upgrade (Priority 1 - HIGH)**

**Goal:** Upgrade multer from 1.4.5-lts.2 to 2.0.2+

**Steps:**

1. **Check Current Usage**
   ```bash
   # Review how multer is configured in server.js
   grep -n "multer\|upload" server.js
   ```

2. **Review Breaking Changes**
   - Multer 2.x has breaking API changes
   - Need to check if current config is compatible
   - Review PR #23 commits for migration path

3. **Test Upgrade Locally**
   ```bash
   # Install multer 2.x
   npm install multer@^2.0.2
   
   # Test file upload functionality
   npm run dev
   # Try uploading a CSV/PDF file
   ```

4. **Fix Any Breaking Changes**
   - Update multer configuration if needed
   - Test all upload endpoints
   - Verify error handling

5. **Test Deployment**
   ```bash
   # Build and test deployment
   npm run build
   # Deploy to preview/staging
   # Test file uploads in staging
   ```

6. **Update Dependencies**
   ```bash
   # Remove old version
   npm uninstall multer@1.4.5-lts.2
   
   # Install new version
   npm install multer@^2.0.2
   
   # Update package.json
   ```

7. **Add Package Lock (Optional)**
   - Consider adding `package-lock.json` for dependency pinning
   - From PR #26 (but not critical)

**Estimated Time:** 2-4 hours

**Risk Level:** 🟡 **MEDIUM** - Breaking changes possible

---

### **Phase 2: Security Documentation (Priority 2 - MEDIUM)**

**Goal:** Document security best practices and environment variables

**Steps:**

1. **Create `.env.example`**
   - Document required environment variables
   - Remove sensitive defaults from code
   - Add security notes

2. **Update `README.md`**
   - Add security section
   - Document environment variables
   - Add deployment security checklist

3. **Document JWT Secret Requirements**
   - Minimum length (32+ characters)
   - Random generation method
   - Never commit to git

4. **Document Tokenization Salt**
   - Similar to JWT secret
   - Generate unique salt per environment

**Estimated Time:** 1 hour

**Risk Level:** 🟢 **LOW** - Documentation only

---

### **Phase 3: Additional Security Hardening (Priority 3 - LOW)**

**Goal:** Implement additional security best practices

**Steps:**

1. **Set `ALLOWED_ORIGINS` in Production**
   - Already documented in `lib/csrf.ts`
   - Just need to set environment variable

2. **Consider Redis for Rate Limiting**
   - Current in-memory rate limiting is fine for MVP
   - Redis needed for multi-instance deployments
   - Can be done later

3. **Security Headers**
   - Add security headers middleware
   - CSP, HSTS, X-Frame-Options, etc.
   - Can use `helmet` package

4. **Dependency Audit**
   ```bash
   npm audit
   npm audit fix
   ```

**Estimated Time:** 2-3 hours

**Risk Level:** 🟢 **LOW** - Nice to have

---

## 📋 **New Branch Workflow**

### **Branch Name:**
```bash
git checkout -b security/multer-upgrade-and-audit
```

### **Commit Strategy:**
1. **Phase 1:** Multer upgrade
   - `feat: Upgrade multer to 2.0.2 for security`
   - Test thoroughly before committing
   
2. **Phase 2:** Security documentation
   - `docs: Add security best practices and env var documentation`
   
3. **Phase 3:** Additional hardening (optional)
   - `feat: Add security headers and additional hardening`

---

## ✅ **Testing Checklist**

### **After Multer Upgrade:**

- [ ] CSV upload works in Express server (`server.js`)
- [ ] PDF upload works in Next.js routes (already using FormData - no change)
- [ ] Error handling works for malformed requests
- [ ] File size limits still enforced
- [ ] File type validation still works
- [ ] Authentication still required
- [ ] No memory leaks (monitor for a few minutes)
- [ ] Server doesn't crash on malformed requests
- [ ] Deployment works on Vercel

---

## 🔒 **Risk Assessment**

### **Multer Upgrade Risks:**

**High Risk:**
- ❌ Breaking API changes in multer 2.x
- ❌ Deployment failures (PR #23 had failures)

**Medium Risk:**
- ⚠️ Configuration changes needed
- ⚠️ Error handling might break

**Low Risk:**
- ✅ Next.js routes are unaffected (use FormData)
- ✅ Only `server.js` uses multer

**Mitigation:**
- ✅ Test thoroughly locally
- ✅ Deploy to preview/staging first
- ✅ Rollback plan: revert to 1.x if needed
- ✅ Monitor for issues after deployment

---

## 📊 **Priority Summary**

| Task | Priority | Risk | Time | Blocker? |
|------|----------|------|------|----------|
| **Multer Upgrade** | 🔴 HIGH | 🟡 MEDIUM | 2-4h | No (but should do) |
| **Security Docs** | 🟡 MEDIUM | 🟢 LOW | 1h | No |
| **Additional Hardening** | 🟢 LOW | 🟢 LOW | 2-3h | No |

---

## 🚀 **Recommended Action Plan**

### **Immediate (This Week):**
1. ✅ Create new branch: `security/multer-upgrade-and-audit`
2. ✅ Upgrade multer to 2.0.2+
3. ✅ Test thoroughly locally
4. ✅ Deploy to preview/staging
5. ✅ Merge if tests pass

### **Soon (Next Week):**
1. ⚠️ Add security documentation
2. ⚠️ Create `.env.example`
3. ⚠️ Run `npm audit` and fix issues

### **Later (Optional):**
1. 🟢 Add security headers
2. 🟢 Consider Redis for rate limiting
3. 🟢 Additional hardening

---

## 📝 **References**

- **Multer 2.0.2 Release:** https://github.com/expressjs/multer/releases
- **CVE-2025-47944:** https://advisories.gitlab.com/pkg/npm/multer/CVE-2025-47944/
- **GHSA-44fp-w29j-9vj5:** https://github.com/advisories/GHSA-44fp-w29j-9vj5
- **GHSA-fjgf-rc76-4x9p:** https://github.com/advisories/GHSA-fjgf-rc76-4x9p
- **PR #23:** Previous attempt (had deployment failures)
- **PR #26:** Package-lock.json addition (separate concern)

---

## ✅ **Conclusion**

**Multer upgrade is recommended but not blocking for merge.**

- ✅ Current branch (PR #35) is safe to merge
- ⚠️ Multer vulnerability should be fixed soon (this week)
- 🟡 Risk is medium - DoS attacks possible but not data breach
- ✅ Next.js routes are safe (not using multer)

**Recommendation:** Handle multer upgrade in a new branch after merging PR #35.

