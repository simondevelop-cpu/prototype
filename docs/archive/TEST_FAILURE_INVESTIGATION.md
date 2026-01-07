# Test Failure Investigation Guide

**Date:** Current  
**Status:** Tests #27-#31 failing after Test #26 succeeded

---

## 🔍 **HOW TO INVESTIGATE TEST FAILURES**

### **Step 1: Click on a Failed Test Run**
1. Go to GitHub Actions page (you're already there)
2. Click on any failed test run (e.g., "Tests #31")
3. You'll see:
   - Which job failed (Unit & Integration Tests, E2E Tests, or Test Summary)
   - Individual step status
   - Error messages and logs

### **Step 2: Check the Logs**
1. Click on the failed job (e.g., "Unit & Integration Tests")
2. Expand the failing step (e.g., "Run unit tests" or "Run integration tests")
3. Look for:
   - Error messages
   - Stack traces
   - Which specific test failed
   - Import/module resolution errors
   - Configuration errors

### **Step 3: Common Failure Causes**

#### **1. Module Resolution Errors**
- **Symptom:** `Cannot find module '@/lib/...'`
- **Cause:** Path alias `@/` not resolving
- **Fix:** Check `vitest.config.ts` resolve.alias

#### **2. Missing Dependencies**
- **Symptom:** `Cannot find module 'pg-mem'` or similar
- **Cause:** Dependency not installed
- **Fix:** Check `package.json` devDependencies

#### **3. Environment Issues**
- **Symptom:** Tests expecting database/API that isn't available
- **Cause:** Tests need mocks or test infrastructure
- **Fix:** Add mocks or skip tests that need infrastructure

#### **4. TypeScript Errors**
- **Symptom:** Type errors in test files
- **Cause:** Type definitions missing or incorrect
- **Fix:** Check `tsconfig.test.json`

---

## 📊 **CURRENT STATUS**

**Last Successful Run:** Tests #26 ✅  
**Failed Runs:** Tests #27, #28, #29, #30, #31 ❌

**What Changed:**
- Test #26: "refactor: Replace placeholder tests" - ✅ **SUCCEEDED**
- Test #27: "feat: Implement L0/L1/L2 data architecture migration" (PR sync) - ❌ **FAILED**

**Hypothesis:**
- PR sync might have introduced code that breaks tests
- Or tests might have dependency/environment issues

---

## 🎯 **NEXT STEPS**

1. **Click on Tests #31 (most recent)** to see actual error messages
2. **Check "Unit & Integration Tests" job** - see which step fails
3. **Look for specific error messages:**
   - Module resolution errors?
   - Missing dependencies?
   - Test failures?
   - Configuration errors?

4. **Share the error message** and I can help fix it

---

## ✅ **WHAT TO LOOK FOR**

When you click on a failed test, check:

1. **Which job failed?**
   - Unit & Integration Tests?
   - E2E Tests?
   - Test Summary?

2. **Which step failed?**
   - Install dependencies?
   - Run unit tests?
   - Run integration tests?
   - Generate coverage?

3. **What's the error message?**
   - Copy/paste the error
   - Look for stack traces
   - Check for module resolution issues

---

**Please click on Tests #31 and share what error you see!** 🔍

