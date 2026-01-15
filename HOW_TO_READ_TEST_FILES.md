# How to Read Test Files - Understanding What Tests Do

## 📍 Where to Find Test Files

All test files are in the `tests/` directory:

```
tests/
├── unit/                    # Unit tests (individual functions)
│   ├── categorization/
│   └── parsing/
├── integration/             # Integration tests (API routes, database)
│   ├── api/                 # API endpoint tests
│   ├── data/                # Data integrity tests
│   └── pipeda/              # PIPEDA compliance tests
├── security/                # Security tests (auth, CSRF, etc.)
└── e2e/                     # End-to-end tests (full UI flows)
```

## 🔍 How to Find What a Specific Test Does

### From GitHub Actions Results:

1. **See the test name** in the output:
   ```
   ✓ tests/integration/api/auth.test.ts > Authentication API > POST /api/auth/register > should register a new user
   ```

2. **Navigate to that file** in your codebase:
   - File: `tests/integration/api/auth.test.ts`
   - Test: "should register a new user"
   - Located in the "POST /api/auth/register" describe block

### Quick Navigation:

**VS Code / Cursor:**
- Press `Cmd+P` (Mac) or `Ctrl+P` (Windows)
- Type: `auth.test.ts`
- Open the file
- Use `Cmd+F` to search for the test name

**GitHub:**
- Go to your repo
- Navigate to: `tests/integration/api/auth.test.ts`
- Read the test code

## 📖 Understanding Test File Structure

### Example: `tests/integration/api/auth.test.ts`

```typescript
describe('Authentication API', () => {
  // Setup code (runs before all tests)
  beforeAll(async () => {
    // Creates test database, mocks, etc.
  });

  describe('POST /api/auth/register', () => {
    // This describe block groups related tests
    
    it('should register a new user with valid credentials', async () => {
      // Test code here:
      // 1. Creates a request
      // 2. Calls the API endpoint
      // 3. Checks the response
      
      const request = new NextRequest(...);
      const response = await registerHandler(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);        // Checks status code
      expect(data).toHaveProperty('token');     // Checks response has token
      expect(data.user.email).toBe('...');      // Checks user data
    });

    it('should reject weak passwords', async () => {
      // Another test case
    });
  });

  describe('POST /api/auth/login', () => {
    // More tests for login endpoint
  });
});
```

### Test Structure Breakdown:

1. **`describe()`** - Groups related tests
   - Outer: Feature/API name
   - Inner: Endpoint/functionality

2. **`it()` or `test()`** - Individual test case
   - Name describes what it tests
   - Contains: Arrange → Act → Assert

3. **Test Steps:**
   - **Arrange**: Set up test data (create user, mock database)
   - **Act**: Call the function/API endpoint
   - **Assert**: Check the results with `expect()`

## 🎯 Key Test Files to Review

### **Authentication Tests** (`tests/integration/api/auth.test.ts`)
**What it tests:**
- User registration (valid credentials, weak passwords, duplicate emails)
- User login (valid credentials, invalid credentials)
- Password hashing (ensures bcrypt is used)

**Key tests:**
- `should register a new user with valid credentials`
- `should reject weak passwords`
- `should reject duplicate email addresses`
- `should login with valid credentials`
- `should reject invalid credentials`

### **Transaction API Tests** (`tests/integration/api/transactions.test.ts`)
**What it tests:**
- Create, read, update, delete transactions
- **CRITICAL**: User data isolation (users can't access other users' data)

**Key tests:**
- `should create a transaction for authenticated user`
- `should return transactions for authenticated user`
- `should prevent user from accessing another user's transactions` ⚠️ Security critical
- `should only return transactions for the authenticated user` ⚠️ Security critical

### **Security Tests** (`tests/security/`)
**What they test:**
- JWT token validation (`jwt-validation.test.ts`)
- Password strength requirements (`password-validation.test.ts`)
- CSRF protection (`csrf.test.ts`)
- Rate limiting (`rate-limiting.test.ts`)

### **PIPEDA Compliance Tests** (`tests/integration/pipeda/`)
**What they test:**
- Account deletion (`account-deletion.test.ts`)
- Data export (`data-export.test.ts`)
- PII isolation (`pii-isolation.test.ts`)

## 🔎 Reading a Specific Test

### Example: "should register a new user with valid credentials"

```typescript
it('should register a new user with valid credentials', async () => {
  // ARRANGE: Create the request
  const request = new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'origin': 'http://localhost',
    },
    body: JSON.stringify({
      email: 'newuser@test.com',
      password: 'StrongP@ss1',
      name: 'Test User',
    }),
  });

  // ACT: Call the API handler
  const response = await registerHandler(request);
  const data = await response.json();

  // ASSERT: Check the results
  expect(response.status).toBe(200);        // Status should be 200 OK
  expect(data).toHaveProperty('token');     // Response should have a token
  expect(data).toHaveProperty('user');      // Response should have user data
  expect(data.user.email).toBe('newuser@test.com');  // Email should match
});
```

**What this test does:**
1. Creates a registration request with valid data
2. Calls the register API endpoint
3. Verifies:
   - Response status is 200 (success)
   - Response includes a token (user is logged in)
   - Response includes user data
   - Email matches what was sent

## 📊 Test File Locations Reference

| Test Type | Location | Example Files |
|-----------|----------|---------------|
| **API Integration** | `tests/integration/api/` | `auth.test.ts`, `transactions.test.ts` |
| **Data Integrity** | `tests/integration/data/` | `deduplication.test.ts`, `migration-integrity.test.ts` |
| **PIPEDA Compliance** | `tests/integration/pipeda/` | `account-deletion.test.ts`, `data-export.test.ts` |
| **Security** | `tests/security/` | `jwt-validation.test.ts`, `csrf.test.ts` |
| **Unit Tests** | `tests/unit/` | `categorization-engine.test.ts` |
| **E2E Tests** | `tests/e2e/` | `journeys/login.spec.ts` |

## 💡 Quick Tips

1. **Test names are descriptive**: They tell you exactly what they test
   - `should register a new user` → Tests registration
   - `should reject weak passwords` → Tests password validation

2. **Look for `expect()` statements**: These show what's being verified
   - `expect(status).toBe(200)` → Checks for success
   - `expect(data).toHaveProperty('token')` → Checks response structure

3. **Check `describe()` blocks**: They organize tests by feature/endpoint
   - `describe('POST /api/auth/register')` → All registration tests

4. **Read comments**: Test files often have comments explaining setup or complex scenarios

## 🎯 Quick Access Commands

**From terminal (in project root):**
```bash
# List all test files
find tests -name "*.test.ts" -o -name "*.spec.ts"

# Open a specific test file
code tests/integration/api/auth.test.ts    # VS Code
cursor tests/integration/api/auth.test.ts  # Cursor

# Search for a specific test
grep -r "should register" tests/
```

**From GitHub:**
- Navigate to: `tests/integration/api/auth.test.ts`
- Or search: `repo:your-repo path:tests/ filename:auth.test.ts`

---

## 📝 Summary

To see what a test does:
1. **Find the test file** from the GitHub Actions output
2. **Open it** in your editor or on GitHub
3. **Read the `it()` block** with that test name
4. **Look for `expect()` statements** to see what's being verified

The test code itself shows exactly what it's testing!

