# E2E Test Critical Risk Assessment

**Date:** January 7, 2026

---

## 🎯 Assessment of Pending E2E Journeys

### **Pending E2E Tests:**
1. **Upload/Review Statements** (`e2e-upload-review`)
2. **Returning User Journey** (`e2e-returning-user`)
3. **Token Refresh Flow** (`e2e-login` - token refresh part)

---

## 🔴 **1. Upload/Review Statements** - **CRITICAL RISK**

### **Risk Level: 🔴 HIGH**

### **Why Critical:**
- **Core User Feature**: This is how users get data into the application
- **Complex Multi-Step Flow**: Upload → Parse → Review → Edit → Confirm → Import
- **Business Impact**: If broken, users cannot use the app's primary function
- **No E2E Coverage**: Currently only covered by integration tests (API level)

### **Current Coverage:**
- ✅ Integration tests exist for `/api/statements/parse` and `/api/statements/import`
- ✅ Component logic exists (`StatementUploadModal`, `StatementReviewModal`)
- ❌ **No E2E test** to verify full user flow works end-to-end

### **What Could Break:**
- File upload UI not working
- Modal transitions broken
- Review modal not displaying correctly
- Edit functionality broken in review modal
- Import button not triggering correctly
- Error handling in UI

### **Recommendation: ✅ ADD THIS TEST**

**Priority:** 🔴 **CRITICAL**  
**Effort:** Medium (2-3 hours)  
**Risk if Missing:** Users can't upload statements = app unusable

---

## 🟡 **2. Returning User Journey** - **MODERATE RISK**

### **Risk Level: 🟡 MEDIUM**

### **Why Important:**
- **User Experience**: Tests that users can return and see their dashboard correctly
- **Session Management**: Verifies token persistence and dashboard loading
- **Common Flow**: Most users will be returning users

### **Current Coverage:**
- ✅ Login E2E test exists
- ✅ Dashboard load E2E test exists
- ✅ Integration tests for authentication and session management
- ⚠️ **No specific test** for "returning user" scenario (logout → login → dashboard)

### **What This Would Test:**
- User logs out
- User logs back in
- Dashboard loads with previous data
- Session token persists correctly

### **What Could Break:**
- Session not persisting after logout/login
- Dashboard not loading previous data
- Token refresh issues

### **Recommendation: ⚠️ OPTIONAL**

**Priority:** 🟡 **MEDIUM**  
**Effort:** Low (1-2 hours)  
**Risk if Missing:** Low - covered by existing login + dashboard tests separately

**Note:** This is more of a "nice-to-have" integration test. The individual components (login, dashboard) are already tested.

---

## 🟢 **3. Token Refresh Flow** - **LOW RISK**

### **Risk Level: 🟢 LOW**

### **Why Lower Priority:**
- **Current Implementation**: 24-hour hard expiration (no refresh endpoint yet)
- **Covered by Integration Tests**: JWT validation and expiration tested
- **Not Critical for MVP**: Token refresh is a UX improvement, not a blocker

### **Current Coverage:**
- ✅ JWT validation tests exist (`tests/security/jwt-validation.test.ts`)
- ✅ Token expiration tested
- ✅ Integration tests for auth flows
- ❌ **No E2E test** for token refresh (but no refresh endpoint exists yet)

### **What This Would Test:**
- Token near expiration triggers refresh
- Refresh endpoint works
- New token stored correctly
- User remains logged in

### **Recommendation: ❌ SKIP FOR NOW**

**Priority:** 🟢 **LOW**  
**Effort:** Medium (2-3 hours)  
**Risk if Missing:** Low - not implemented yet, and integration tests cover JWT logic

**Note:** This can be added when token refresh endpoint is implemented.

---

## 📊 Summary

| E2E Journey | Risk Level | Current Coverage | Recommendation | Effort |
|-------------|------------|------------------|----------------|--------|
| **Upload/Review** | 🔴 **CRITICAL** | Integration only | ✅ **ADD** | 2-3 hours |
| **Returning User** | 🟡 **MEDIUM** | Partial (separate tests) | ⚠️ **OPTIONAL** | 1-2 hours |
| **Token Refresh** | 🟢 **LOW** | Integration (JWT tests) | ❌ **SKIP** | N/A (not implemented) |

---

## ✅ **Final Recommendation**

### **Must Add Before Merge:**
1. ✅ **Upload/Review Statements E2E Test** - Core user feature, high risk if broken

### **Can Add Post-Merge:**
2. ⚠️ **Returning User Journey** - Nice-to-have, lower priority

### **Skip:**
3. ❌ **Token Refresh** - Not implemented yet, covered by integration tests

---

## 🎯 Action Plan

1. **Implement Upload/Review E2E Test** (Critical)
   - Test file upload flow
   - Test review modal appearance
   - Test edit functionality in review
   - Test import confirmation
   - Handle `DISABLE_DB=1` gracefully (skip actual import)

2. **Optional: Returning User Test** (Medium priority)
   - Can be added in follow-up PR

3. **Token Refresh** (Low priority)
   - Skip until refresh endpoint is implemented

---

**Conclusion:** Only **Upload/Review** is truly critical. The other two are nice-to-have but not blockers.

