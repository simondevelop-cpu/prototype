# 🔐 Onboarding & Authentication Security Review

**Date:** October 26, 2025  
**Reviewer:** AI Assistant  
**Branch:** `feature/onboarding-flow`  
**Status:** Pre-merge comprehensive review

---

## 📋 Executive Summary

### ✅ **STRENGTHS**
- Multi-layered authentication checks
- Schema-adaptive API endpoints
- Comprehensive drop-off tracking
- Good error handling and logging
- Token expiration implemented (24 hours)

### ⚠️ **CRITICAL ISSUES FOUND**
1. **Token storage inconsistency** - Multiple localStorage keys
2. **Logout incomplete** - Old token keys not cleared
3. **No token refresh mechanism** - Users kicked out after 24h
4. **Password security** - SHA-256 is weak for passwords
5. **No rate limiting** - Vulnerable to brute force
6. **Missing CSRF protection** - No token validation
7. **Incomplete onboarding users can access API** - Partial auth bypass

### 🔧 **MEDIUM PRIORITY ISSUES**
8. Email verification not enforced (skip button)
9. No password strength requirements
10. User enumeration possible via error messages
11. Missing input sanitization
12. No session invalidation on password change

---

## 🔍 DETAILED FINDINGS

---

## ❌ CRITICAL ISSUE #1: Token Storage Inconsistency

### **Problem:**
Three different localStorage keys are used inconsistently:
- `'token'` (legacy, still referenced)
- `'ci.session.token'` (current standard)
- `'user'` (legacy, should be `'ci.session.user'`)

### **Evidence:**
```typescript
// components/Login.tsx (lines 54-56)
localStorage.setItem('token', data.token);              // ❌ Legacy
localStorage.setItem('ci.session.token', data.token);   // ✅ Current
localStorage.setItem('ci.session.user', JSON.stringify(data.user)); // ✅ Current

// app/onboarding/page.tsx (lines 221-222)
localStorage.removeItem('token');   // ❌ Legacy key
localStorage.removeItem('user');    // ❌ Legacy key
```

### **Risk:**
- **Medium-High**: Inconsistent state, potential auth bypass
- Users might have stale tokens in localStorage
- Logout doesn't fully clear session

### **Fix Required:**
```typescript
// Standardize on 'ci.session.*' prefix everywhere
// Remove all references to 'token' and 'user' without prefix
// Add migration logic to clean up old keys
```

---

## ❌ CRITICAL ISSUE #2: Incomplete Logout

### **Problem:**
The "Change email or restart" button in onboarding clears old keys but not new ones:

```typescript
// app/onboarding/page.tsx (lines 219-225)
const handleBack = () => {
  if (currentStep === 0) {
    localStorage.removeItem('token');              // ❌ Old key
    localStorage.removeItem('user');               // ❌ Old key
    localStorage.removeItem('ci.session.token');   // ✅ Good
    localStorage.removeItem('ci.session.user');    // ✅ Good
    window.location.href = '/';
  }
};
```

But `app/page.tsx` logout handler only clears new keys:

```typescript
// app/page.tsx (lines 59-64)
const handleLogout = () => {
  setToken(null);
  setUser(null);
  localStorage.removeItem('ci.session.token');   // ✅ Good
  localStorage.removeItem('ci.session.user');    // ✅ Good
  // ❌ Missing: localStorage.removeItem('token');
  // ❌ Missing: localStorage.removeItem('user');
};
```

### **Risk:**
- **Medium**: Incomplete session cleanup
- Old tokens might persist and cause confusion

### **Fix Required:**
Create a centralized logout function that clears ALL possible keys.

---

## ❌ CRITICAL ISSUE #3: No Token Refresh Mechanism

### **Problem:**
Tokens expire after 24 hours (hardcoded in `lib/auth.ts`):

```typescript
// lib/auth.ts (line 4)
const SESSION_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS || 60 * 60 * 24); // 24 hours
```

**But:**
- No automatic token refresh
- No warning before expiration
- User is suddenly logged out mid-session
- No "remember me" option

### **Risk:**
- **High**: Poor UX - users lose work
- No graceful session extension

### **Fix Required:**
1. Implement sliding session (refresh token on activity)
2. Add refresh token endpoint
3. Warn user 5 minutes before expiration
4. Add "Remember me" checkbox (30-day tokens)

---

## ❌ CRITICAL ISSUE #4: Weak Password Hashing

### **Problem:**
Using SHA-256 for password hashing:

```typescript
// lib/auth.ts (lines 6-8)
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
```

**Why this is bad:**
- SHA-256 is a **fast** hash (designed for speed)
- Vulnerable to brute-force attacks
- No salt (same password = same hash)
- No key stretching

### **Risk:**
- **CRITICAL**: Database breach = instant password compromise
- Rainbow table attacks possible

### **Fix Required:**
Use `bcrypt` or `argon2`:

```typescript
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12); // 12 rounds
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

---

## ❌ CRITICAL ISSUE #5: No Rate Limiting

### **Problem:**
No rate limiting on authentication endpoints:
- `/api/auth/login`
- `/api/auth/register`
- `/api/onboarding/status`

**Attack scenario:**
```bash
# Attacker can try unlimited passwords
for password in password_list:
    POST /api/auth/login
    { "email": "victim@example.com", "password": password }
```

### **Risk:**
- **CRITICAL**: Brute force attacks possible
- Account enumeration
- DDoS vulnerability

### **Fix Required:**
Implement rate limiting with `@upstash/ratelimit`:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 minutes
});

// In login endpoint:
const identifier = email.toLowerCase();
const { success } = await ratelimit.limit(identifier);

if (!success) {
  return NextResponse.json(
    { error: 'Too many login attempts. Please try again in 15 minutes.' },
    { status: 429 }
  );
}
```

---

## ❌ CRITICAL ISSUE #6: Missing CSRF Protection

### **Problem:**
No CSRF tokens for state-changing operations:
- User registration
- Onboarding submission
- Transaction imports

**Attack scenario:**
```html
<!-- Attacker's website -->
<form action="https://yourapp.com/api/auth/register" method="POST">
  <input name="email" value="attacker@evil.com">
  <input name="password" value="hacked123">
</form>
<script>document.forms[0].submit();</script>
```

If victim is logged in, this auto-submits.

### **Risk:**
- **High**: Cross-site request forgery
- Unauthorized actions on behalf of users

### **Fix Required:**
1. Use SameSite cookies: `SameSite=Strict`
2. Add CSRF tokens to forms
3. Verify `Origin` header on API requests

---

## ❌ CRITICAL ISSUE #7: Incomplete Onboarding Users Can Access APIs

### **Problem:**
Users who haven't completed onboarding can still call API endpoints:

**Current flow:**
1. User registers → gets token
2. Redirected to `/onboarding`
3. **BUT** they can manually call `/api/transactions`, `/api/summary`, etc.

**Why?**
- API endpoints only check for valid JWT
- Don't check if onboarding is complete
- `app/page.tsx` redirects incomplete users, but APIs don't

### **Evidence:**
```typescript
// app/api/transactions/route.ts (example)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  const userId = decoded.userId || decoded.id || decoded.sub;
  
  // ❌ NO CHECK: Is onboarding complete?
  // User can access transactions even without completing onboarding
  
  const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1', [userId]);
  return NextResponse.json(result.rows);
}
```

### **Risk:**
- **High**: Partial auth bypass
- Incomplete users can access full app via direct API calls
- Onboarding can be skipped entirely

### **Fix Required:**
Create middleware to check onboarding status:

```typescript
// lib/auth-middleware.ts
export async function requireCompletedOnboarding(userId: number): Promise<boolean> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM onboarding_responses 
     WHERE user_id = $1 AND completed_at IS NOT NULL`,
    [userId]
  );
  return parseInt(result.rows[0].count) > 0;
}

// In each protected API endpoint:
const hasCompleted = await requireCompletedOnboarding(userId);
if (!hasCompleted) {
  return NextResponse.json(
    { error: 'Please complete onboarding first' },
    { status: 403 }
  );
}
```

---

## ⚠️ MEDIUM ISSUE #8: Email Verification Not Enforced

### **Problem:**
Email verification has a "Skip" button:

```typescript
// app/onboarding/page.tsx (Step 0)
<button onClick={handleNext} className="...">Skip</button>
```

**Impact:**
- Users can create accounts with fake emails
- No way to recover accounts
- Spam/bot registrations possible

### **Risk:**
- **Medium**: Account security, spam

### **Fix Required:**
1. Remove skip button (or make it admin-only)
2. Actually send verification emails
3. Block account usage until verified
4. Add resend verification option

---

## ⚠️ MEDIUM ISSUE #9: No Password Strength Requirements

### **Problem:**
No validation on password strength:

```typescript
// components/Login.tsx (line 175)
<input
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  required  // ❌ Only checks "not empty"
/>
```

Users can register with:
- `"1"` (single character)
- `"password"` (common password)
- `"12345678"` (sequential)

### **Risk:**
- **Medium**: Weak passwords = easy compromise

### **Fix Required:**
```typescript
const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain an uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain a lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain a number";
  }
  return null; // Valid
};
```

---

## ⚠️ MEDIUM ISSUE #10: User Enumeration

### **Problem:**
Different error messages reveal if email exists:

```typescript
// app/api/auth/login/route.ts (line 34-38)
if (userResult.rows.length === 0) {
  return NextResponse.json(
    { error: 'Invalid credentials' },  // ✅ Good (generic)
    { status: 401 }
  );
}

// app/api/auth/register/route.ts (line 52-55)
if (isSpecialAccount || transactionCount > 0 || completedOnboarding > 0) {
  return NextResponse.json(
    { error: 'This email is already registered. Please sign in instead.' },  // ❌ Reveals email exists
    { status: 400 }
  );
}
```

**Attack:**
Attacker can check if emails are registered:
```bash
POST /api/auth/register
{ "email": "target@company.com", "password": "test" }

Response: "This email is already registered"
→ Attacker now knows this person has an account
```

### **Risk:**
- **Medium**: Privacy leak, targeted attacks

### **Fix Required:**
Use generic messages:
```typescript
// Always return:
{ error: 'If this email is registered, you will receive a verification email.' }
```

---

## ⚠️ MEDIUM ISSUE #11: Missing Input Sanitization

### **Problem:**
User inputs are not sanitized before database insertion:

```typescript
// app/api/onboarding/route.ts (lines 84-96)
emotional_state = $1,
financial_context = $2,
motivation = $3,
motivation_other = $4,  // ❌ User-provided text, not sanitized
acquisition_source = $5,
acquisition_other = $6,  // ❌ User-provided text, not sanitized
insight_other = $8,      // ❌ User-provided text, not sanitized
first_name = $9,         // ❌ User-provided text, not sanitized
```

**Potential issues:**
- SQL injection (mitigated by parameterized queries, but still risky)
- XSS when displaying data
- Unicode/emoji issues

### **Risk:**
- **Medium**: XSS, data corruption

### **Fix Required:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitizeInput = (input: string | null): string | null => {
  if (!input) return null;
  return DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [] });
};

// Before insertion:
first_name: sanitizeInput(data.firstName),
motivation_other: sanitizeInput(data.motivationOther),
```

---

## ⚠️ MEDIUM ISSUE #12: No Session Invalidation on Password Change

### **Problem:**
If a user changes their password (future feature), old tokens remain valid.

**Attack scenario:**
1. Attacker steals user's token
2. User realizes account is compromised
3. User changes password
4. **Attacker can still use old token** (valid for 24 hours)

### **Risk:**
- **Medium**: Compromised sessions persist

### **Fix Required:**
1. Add `token_version` field to users table
2. Increment on password change
3. Include in JWT payload
4. Verify version on each request

---

## 🔍 EDGE CASES REVIEW

### ✅ **HANDLED WELL:**

1. **Multiple onboarding attempts**
   - ✅ Creates new row on Step 1
   - ✅ Updates same row on subsequent steps
   - ✅ Tracks drop-off points

2. **Re-registration with incomplete onboarding**
   - ✅ Deletes old incomplete account
   - ✅ Allows fresh start
   - ✅ Protects special accounts

3. **Schema compatibility**
   - ✅ Schema-adaptive API endpoints
   - ✅ Graceful fallback for missing columns
   - ✅ Migration scripts provided

4. **Token expiration**
   - ✅ JWT includes `exp` field
   - ✅ Verified on each request

### ❌ **NOT HANDLED:**

1. **Concurrent onboarding sessions**
   - ❌ User opens two tabs, starts onboarding in both
   - ❌ Creates two incomplete rows
   - ❌ Completion logic might update wrong row

2. **Browser back button during onboarding**
   - ❌ Progress might be lost
   - ❌ Validation state not preserved

3. **Network failure during submission**
   - ❌ No retry mechanism
   - ❌ User loses all progress
   - ❌ No draft saving

4. **Token expiration mid-onboarding**
   - ❌ User spends 25 hours on onboarding
   - ❌ Token expires
   - ❌ Submission fails with 401
   - ❌ All progress lost

5. **Database constraint violations**
   - ❌ What if `user_id` foreign key is invalid?
   - ❌ What if `date_of_birth` is in the future?
   - ❌ What if `email` format is invalid?

---

## 🛡️ SECURITY BEST PRACTICES CHECKLIST

| Practice | Status | Notes |
|----------|--------|-------|
| HTTPS enforced | ⚠️ Unknown | Check Vercel config |
| Password hashing (bcrypt/argon2) | ❌ No | Using SHA-256 |
| Rate limiting | ❌ No | Vulnerable to brute force |
| CSRF protection | ❌ No | No tokens |
| XSS prevention | ⚠️ Partial | React escapes, but no DOMPurify |
| SQL injection prevention | ✅ Yes | Parameterized queries |
| JWT secret rotation | ❌ No | Hardcoded secret |
| Token refresh | ❌ No | Hard 24h expiration |
| Email verification | ❌ No | Skip button |
| Password strength | ❌ No | No requirements |
| Session invalidation | ❌ No | No logout on password change |
| Audit logging | ⚠️ Partial | Console logs only |
| Error message sanitization | ⚠️ Partial | Some user enumeration |

---

## 📝 RECOMMENDED FIXES (Priority Order)

### 🔴 **CRITICAL (Fix Before Merge)**

1. **Standardize token storage** (30 min)
   - Use only `'ci.session.token'` and `'ci.session.user'`
   - Remove all references to legacy keys
   - Add cleanup migration

2. **Fix incomplete logout** (15 min)
   - Create centralized `clearAllTokens()` function
   - Call from all logout points

3. **Add onboarding completion check to APIs** (1 hour)
   - Create middleware function
   - Add to all protected endpoints
   - Return 403 if incomplete

### 🟠 **HIGH (Fix Within 1 Week)**

4. **Implement bcrypt password hashing** (2 hours)
   - Replace SHA-256 with bcrypt
   - Migrate existing passwords (force reset)
   - Update login/register endpoints

5. **Add rate limiting** (3 hours)
   - Install `@upstash/ratelimit`
   - Add to auth endpoints
   - Configure Redis

6. **Implement token refresh** (4 hours)
   - Add refresh token endpoint
   - Update frontend to refresh before expiry
   - Add "Remember me" option

### 🟡 **MEDIUM (Fix Within 1 Month)**

7. **Add CSRF protection** (2 hours)
8. **Enforce email verification** (4 hours)
9. **Add password strength validation** (1 hour)
10. **Sanitize user inputs** (2 hours)
11. **Fix user enumeration** (1 hour)
12. **Add session invalidation** (3 hours)

---

## 🧪 TESTING RECOMMENDATIONS

### **Before Merge:**
1. Test token consistency across all flows
2. Test logout from all entry points
3. Test API access with incomplete onboarding
4. Test concurrent onboarding sessions
5. Test network failure scenarios

### **After Merge:**
1. Penetration testing
2. Load testing on auth endpoints
3. Token expiration edge cases
4. Password reset flow (when implemented)

---

## 📊 RISK ASSESSMENT

| Issue | Severity | Exploitability | Impact | Priority |
|-------|----------|----------------|--------|----------|
| Weak password hashing | Critical | High | Critical | 🔴 P0 |
| No rate limiting | Critical | High | High | 🔴 P0 |
| Incomplete onboarding bypass | High | Medium | High | 🔴 P0 |
| Token storage inconsistency | High | Low | Medium | 🔴 P0 |
| No CSRF protection | High | Medium | High | 🟠 P1 |
| No token refresh | Medium | Low | Medium | 🟠 P1 |
| Email verification skip | Medium | High | Low | 🟡 P2 |
| User enumeration | Medium | High | Low | 🟡 P2 |

---

## ✅ CONCLUSION

**Overall Assessment:** The onboarding flow is **functionally complete** but has **significant security gaps** that must be addressed before production use.

**Recommendation:** 
- ✅ **Merge to staging** for functional testing
- ❌ **Do NOT merge to production** until P0 issues are fixed
- 🔄 **Create follow-up tickets** for P1 and P2 issues

**Estimated Time to Production-Ready:** 8-12 hours of focused security work.

---

**Reviewed by:** AI Assistant  
**Date:** October 26, 2025  
**Next Review:** After P0 fixes are implemented

