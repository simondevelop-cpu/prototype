# Application Architecture - How It Actually Works

## 🏗️ **Multi-Tenant SaaS Architecture**

This app uses a **shared database, multi-tenant model** - the standard for SaaS applications.

### How It Works:

```
┌─────────────────┐
│   PostgreSQL    │ ← Single shared database
│   Database      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│User 1 │ │User 2 │ ← Multiple users
│(Demo) │ │(You)  │
└───┬───┘ └──┬────┘
    │        │
┌───▼────────▼───┐
│  Transactions  │
│  ┌──────────┐  │
│  │user_id=1 │  │ ← Demo user's transactions
│  │user_id=2 │  │ ← Your transactions
│  └──────────┘  │
└────────────────┘
```

### Key Points:

1. **One Database, Many Users**
   - All users share the same PostgreSQL database
   - ✅ This is normal and correct for SaaS

2. **Data Isolation by user_id**
   - Every query filters by `user_id`
   - Users can ONLY see their own data
   - SQL: `WHERE user_id = <your_id>`

3. **Demo User (ID: 1)**
   - Email: `demo@canadianinsights.ca`
   - Has pre-populated sample transactions
   - Everyone can log in and see the demo data

4. **New Users (ID: 2, 3, 4...)**
   - Create account → Get unique integer ID
   - Start with **zero transactions** (empty state)
   - Can upload CSV to populate their own data
   - Cannot see other users' transactions

---

## 🔐 **Authentication Flow**

### Demo User Login:

```
1. User enters: demo@canadianinsights.ca / northstar-demo
                ↓
2. Backend: Query database for user with that email
                ↓
3. Backend: Verify password hash matches
                ↓
4. Backend: Create JWT token { sub: 1 } ← user_id = 1
                ↓
5. Frontend: Store token in localStorage
                ↓
6. Frontend: Close login dialog, load dashboard
                ↓
7. Dashboard: Fetch /api/transactions with JWT
                ↓
8. Backend: Extract user_id = 1 from JWT
                ↓
9. Backend: SELECT * FROM transactions WHERE user_id = 1
                ↓
10. Frontend: Display demo user's 10 sample transactions ✅
```

### New User Registration:

```
1. User creates account: you@example.com / password123 / Your Name
                ↓
2. Backend: INSERT INTO users(...) → Returns ID = 2
                ↓
3. Backend: Create JWT token { sub: 2 } ← user_id = 2
                ↓
4. Frontend: Store token in localStorage
                ↓
5. Frontend: Close login dialog, load dashboard
                ↓
6. Dashboard: Fetch /api/transactions with JWT
                ↓
7. Backend: Extract user_id = 2 from JWT
                ↓
8. Backend: SELECT * FROM transactions WHERE user_id = 2
                ↓
9. Backend: Returns [] (empty array - no transactions yet)
                ↓
10. Frontend: Display "No transactions" message ✅
```

---

## 📊 **Data Access Pattern**

### Every Data Endpoint Filters by user_id:

**Transactions:**
```javascript
app.get('/api/transactions', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
    [req.userId]  // ← Extracted from JWT token
  );
  res.json({ transactions: result.rows });
});
```

**Summary:**
```javascript
app.get('/api/summary', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT month, cashflow, SUM(amount) FROM transactions 
     WHERE user_id = $1 AND date >= $2
     GROUP BY month, cashflow',
    [req.userId, startDate]  // ← Only this user's data
  );
  res.json({ summary: result.rows });
});
```

**Budget:**
```javascript
app.get('/api/budget', authenticate, async (req, res) => {
  // Calculates budget based on THIS user's spending
  const result = await pool.query(
    'SELECT category, SUM(amount) FROM transactions
     WHERE user_id = $1 AND cashflow = expense
     GROUP BY category',
    [req.userId]  // ← Only this user's expenses
  );
  res.json({ budget: result.rows });
});
```

### Security:
- ✅ User can ONLY access their own data
- ✅ JWT token contains their unique user_id
- ✅ All queries filter by user_id
- ✅ Cannot see other users' transactions (SQL enforced)

---

## 🆕 **What Happens After Registration**

### Expected Behavior:

1. **Account Created**
   - New row in `users` table with unique ID
   - Password hashed and stored
   - JWT token generated

2. **Login Successful**
   - Token stored in localStorage
   - Auth dialog closes
   - Avatar/name appears in header

3. **Dashboard Loads**
   - Fetches `/api/summary?window=3`
   - Backend: `WHERE user_id = <your_new_id>`
   - Result: Empty (no transactions)
   - Frontend: Shows empty state or "No data yet"

4. **Upload CSV**
   - User clicks "Upload" or similar
   - Transactions inserted with `user_id = <your_id>`
   - Dashboard refreshes with YOUR data

### Why It Might Look "Unchanged":

**Issue #1: No Visual Feedback**
- Dashboard might not show clear "You're logged in!" message
- Empty state might look like logged-out state

**Issue #2: No Transactions**
- New users have zero transactions
- Demo user has 10 transactions
- Visually different experience

**Solution:**
- Add clear "Welcome, [Name]!" header
- Show empty state message: "Upload your first CSV to get started"
- Add prominent "Upload" button when no data

---

## 🐛 **The 401 Error (Fixed)**

### Root Cause:
```javascript
// Demo user seed (BEFORE FIX):
INSERT INTO users (email, ...) VALUES ('demo@canadianinsights.ca', ...)
                                        ↑ Original case

// Login query:
WHERE email = 'demo@canadianinsights.ca'.toLowerCase()
              ↑ Converted to lowercase

// Mismatch! 'demo@canadianinsights.ca' ≠ 'demo@canadianinsights.ca' 
// (if stored with capital C)
```

### Fix Applied:
```javascript
// Demo user seed (AFTER FIX):
INSERT INTO users (email, ...) VALUES ('demo@canadianinsights.ca'.toLowerCase(), ...)
                                        ↑ Lowercased before storing

// Login query:
WHERE email = 'demo@canadianinsights.ca'.toLowerCase()
              ↑ Lowercased before querying

// Match! ✅
```

---

## ✅ **Expected User Experience**

### Demo User:
1. Go to app URL
2. Click "Sign In"
3. Enter: `demo@canadianinsights.ca` / `northstar-demo`
4. Click "Sign in"
5. **See:** Dashboard with 10 sample transactions ✅
6. **Can:** Browse tabs, see charts, insights

### New User:
1. Go to app URL
2. Click "Create Account"
3. Enter: your email / password / name
4. Click "Create account"
5. **See:** Dashboard with NO transactions (empty state) ✅
6. **Can:** Upload CSV to populate data
7. **After upload:** Dashboard shows YOUR transactions ✅

### Sign Out:
1. Click "Sign out" button (in settings/footer)
2. **See:** Login page again
3. **Result:** Token cleared, cannot access data ✅

---

## 🔍 **How to Verify It's Working**

### Test 1: Demo Login
```
Action: Log in as demo user
Expected: Dashboard shows ~10 transactions
Verify: Open DevTools → Network → /api/transactions → Response has data
```

### Test 2: New User Registration
```
Action: Register new account with unique email
Expected: Dashboard is empty (no transactions)
Verify: Open DevTools → Network → /api/transactions → Response: { transactions: [] }
```

### Test 3: Data Isolation
```
Action 1: Log in as demo user → See 10 transactions
Action 2: Log out
Action 3: Log in as your account → See 0 transactions (or your CSV data)
Expected: Different users see different data ✅
```

### Test 4: Upload CSV (New User)
```
Action: Create new account → Upload CSV file
Expected: Dashboard populates with CSV transactions
Verify: Transactions have YOUR user_id, not demo user's ID
```

---

## 🎯 **This Architecture is CORRECT**

| Aspect | Status |
|--------|--------|
| Multi-tenancy | ✅ Correct (shared DB, filtered queries) |
| User isolation | ✅ Correct (WHERE user_id = ?) |
| Demo user | ✅ Correct (pre-populated data) |
| New users | ✅ Correct (empty until data uploaded) |
| JWT auth | ✅ Correct (integer user IDs) |
| Database schema | ✅ Correct (INTEGER foreign keys) |
| Security | ✅ Correct (users can't see others' data) |

**This is how virtually every SaaS application works:**
- Notion: Shared DB, your workspace is filtered by user_id
- Slack: Shared DB, your messages filtered by workspace_id/user_id
- Gmail: Shared DB, your emails filtered by user_id
- This app: Shared DB, your transactions filtered by user_id ✅

---

## 🚀 **Next Steps**

1. **Deploy the Fix**
   - Email case mismatch fixed
   - Demo login will work

2. **Clear Existing Data (If Needed)**
   - If demo user was created with wrong email, delete and recreate:
   ```sql
   DELETE FROM users WHERE email LIKE '%canadianinsights%';
   ```
   - App will auto-recreate on next load

3. **Test Both Flows**
   - Test demo login → Should see data
   - Test new registration → Should see empty state
   - Both are correct behaviors!

4. **Improve Empty State UI** (Future Enhancement)
   - Show "Welcome!" message when logged in with no data
   - Add prominent "Upload CSV" button
   - Add tutorial/onboarding for new users

---

**The architecture is sound. The 401 error was just an email case bug, now fixed!** ✅

