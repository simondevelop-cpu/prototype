# How to View Test Results

## 🎯 Quick Answer: Best Place to See Test Results

### **For Unit & Integration Tests:**

#### Option 1: GitHub Actions (Recommended for CI/CD) ⭐
1. Go to your GitHub repository
2. Click on **"Actions"** tab
3. Click on a workflow run (e.g., "Tests #XX")
4. Click on **"Unit & Integration Tests"** job
5. Scroll down to see:
   - ✅ Passing tests (green checkmarks)
   - ❌ Failing tests (red X with error details)
   - ⏭️ Skipped tests
   - Test execution times
   - Full console output

**What you'll see:**
```
✓ tests/integration/api/auth.test.ts  (6 tests) 3122ms
✓ tests/integration/api/transactions.test.ts  (11 tests) 3759ms
✓ tests/security/jwt-validation.test.ts  (12 tests) 14ms
```

#### Option 2: Local Terminal Output
Run tests locally:
```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:security      # Security tests only
```

**Output shows:**
- Test file names
- Test case names
- Pass/fail status (✓ or ❌)
- Execution time
- Error details for failures

#### Option 3: Generate Test Summary Document
```bash
npm run test:summary
```

This creates `TEST_SUMMARY.md` with:
- List of all test files
- All test cases (implemented, todo, skipped)
- Organized by test type

Then open: `TEST_SUMMARY.md` in your editor

---

### **For Coverage Reports (What Code is Tested):**

#### Option 1: HTML Coverage Report (Best Visual Experience) ⭐
```bash
npm run test:coverage
open coverage/index.html    # macOS
start coverage/index.html   # Windows
xdg-open coverage/index.html # Linux
```

**Shows:**
- File-by-file coverage percentages
- Lines covered (green) vs uncovered (red)
- Click through to see exact lines
- Interactive navigation

#### Option 2: Terminal Coverage Table
```bash
npm run test:coverage
```

**Shows in terminal:**
```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
app/api/auth/login |   63.81 |    26.66 |     100 |   63.81 |
app/api/auth/register | 57.3 |       50 |     100 |    57.3 |
-------------------|---------|----------|---------|---------|
```

#### Option 3: CI/CD Artifacts
1. Go to GitHub Actions → Failed workflow run
2. Scroll to **"Artifacts"** section
3. Download `coverage-report`
4. Extract and open `index.html`

---

### **For E2E Tests:**

#### Option 1: GitHub Actions
1. Go to Actions → Workflow run
2. Click **"E2E Tests"** job
3. View test output in logs
4. Download `playwright-report` artifact if tests fail

#### Option 2: Local HTML Report
```bash
npm run test:e2e
# Playwright automatically opens HTML report
# Or manually: open playwright-report/index.html
```

**Shows:**
- Visual test results
- Screenshots on failure
- Video recordings
- Test execution timeline

---

## 📊 Understanding Test Output

### Test Status Icons:
- ✅ **Green checkmark** = Test passed
- ❌ **Red X** = Test failed (click to see error)
- ⏭️ **Down arrow** = Test skipped
- 📝 **Todo** = Test not yet implemented

### Test Output Format:
```
✓ tests/integration/api/auth.test.ts  (6 tests) 3122ms
  ✓ Authentication API > POST /api/auth/register > should register a new user
  ✓ Authentication API > POST /api/auth/register > should reject weak passwords
  ❌ Authentication API > POST /api/auth/register > should reject duplicate emails
    → expected 400 to be 200
```

**Reading this:**
- `✓` = Test passed
- `(6 tests)` = Total tests in file
- `3122ms` = Total execution time
- Nested items = Individual test cases

---

## 🎯 Recommended Workflow

### Daily Development:
1. Run tests locally: `npm test`
2. Check terminal output for quick feedback

### Before Committing:
1. Run full test suite: `npm test`
2. Generate summary: `npm run test:summary`
3. Check coverage: `npm run test:coverage`
4. Open HTML report if coverage is low

### After CI/CD Run:
1. Check GitHub Actions for pass/fail status
2. If failed, open the failing job to see error details
3. Download coverage artifacts if needed

### Understanding Coverage Gaps:
1. Run: `npm run test:coverage`
2. Open: `coverage/index.html`
3. Look for files with low coverage (red)
4. Check `TEST_SUMMARY.md` for missing tests

---

## 🔍 Quick Reference

| What You Want | Command | Where to Look |
|--------------|---------|---------------|
| See all test results | `npm test` | Terminal |
| See what tests exist | `npm run test:summary` | `TEST_SUMMARY.md` |
| See code coverage | `npm run test:coverage` | `coverage/index.html` |
| CI/CD results | - | GitHub Actions → Workflow runs |
| E2E test results | `npm run test:e2e` | `playwright-report/index.html` |
| Specific test file | `npx vitest run path/to/test.ts` | Terminal |

---

## 📝 Current Test Status

Run this to see current status:
```bash
npm run test:summary
```

Or check GitHub Actions for the latest run results.

**Typical output shows:**
- ~75+ tests passing
- ~16 tests todo/skipped
- Coverage: ~3.8% statements (growing as we add more API tests)

