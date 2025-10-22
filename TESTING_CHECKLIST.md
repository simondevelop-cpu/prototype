# Testing Checklist - Complete Validation

## 📋 Pre-Deployment Check

- [x] Architecture redesigned from scratch
- [x] Database schema uses INTEGER user IDs
- [x] JWT tokens contain INTEGER user IDs  
- [x] All queries use matching INTEGER foreign keys
- [x] Lazy initialization implemented
- [x] Documentation created
- [x] Code committed

## 🚀 Step 1: Deploy to Vercel

```bash
git push origin fix/auth-login
```

**Expected Result:**
- ✅ Build completes successfully
- ✅ No TypeScript/linter errors
- ✅ Deployment URL updates

---

## 🔍 Step 2: Check Vercel Logs (First Request)

### Action:
1. Go to Vercel dashboard → Your project → Logs
2. Open your app URL in browser
3. Try to log in (don't worry if it's slow)
4. Watch the logs in real-time

### Expected Logs:
```
[DB] Initializing database...
[DB] Creating schema...
[DB] Schema created successfully
[DB] Demo user already exists (ID: 1) OR Demo user created (ID: 1)
[DB] Sample transactions already exist OR Seeded 10 sample transactions
[DB] Database initialization complete!
```

### Possible Issues:
- ❌ `Connection refused` → DATABASE_URL not set
- ❌ `permission denied` → Database permissions issue
- ❌ `relation already exists` → Normal, tables exist (safe to ignore)

---

## 🔐 Step 3: Test Authentication

### Test 3A: Demo Login

**Action:**
1. Go to app URL
2. Click "Sign In" (should already be on login page)
3. Enter:
   - Email: `demo@canadianinsights.ca`
   - Password: `northstar-demo`
4. Click "Sign in"

**Expected Result:**
- ✅ Page loads within 1-3 seconds (first time: DB init)
- ✅ Redirects to dashboard
- ✅ Shows "Taylor Nguyen" or user name
- ✅ No 500 errors in Network tab

**If it fails:**
- Check browser Console for errors
- Check Network tab → Click on "login" request → Response tab
- Check Vercel logs for error details

### Test 3B: Invalid Credentials

**Action:**
1. Sign out
2. Try to log in with wrong password

**Expected Result:**
- ✅ Shows error: "Invalid credentials"
- ✅ Does NOT crash with 500 error
- ✅ Can try again

---

## 📊 Step 4: Test Data Endpoints

### Test 4A: Dashboard

**Action:**
1. Log in successfully
2. Should land on Dashboard tab

**Expected Result:**
- ✅ Shows "Monthly cash flow" chart
- ✅ Shows some numbers/data
- ✅ No loading spinner forever
- ✅ No 500 errors

**If it fails:**
- Open Network tab
- Look for `/api/summary` request
- Check response: should be 200, not 500
- If 500: Check Vercel logs for SQL error

### Test 4B: Transactions

**Action:**
1. Click "Transactions" tab

**Expected Result:**
- ✅ Shows list of transactions (at least 10 for demo user)
- ✅ Each transaction has: description, amount, date, category
- ✅ Transactions are sorted by date (newest first)

### Test 4C: Savings

**Action:**
1. Click "Saving" tab

**Expected Result:**
- ✅ Shows savings summary
- ✅ No 500 errors

### Test 4D: Insights

**Action:**
1. Click "Insights" tab

**Expected Result:**
- ✅ Shows insights (or placeholder)
- ✅ No 500 errors

---

## 👤 Step 5: Test User Registration

### Test 5A: Create New Account

**Action:**
1. Sign out
2. Click "Create Account" tab
3. Enter:
   - Email: `test@example.com` (or your email)
   - Password: `testpass123`
   - Name: `Test User`
4. Click "Create account"

**Expected Result:**
- ✅ Account created successfully
- ✅ Automatically logged in
- ✅ Shows "Test User" as name
- ✅ Dashboard is EMPTY (no transactions yet)
- ✅ Can navigate between tabs

### Test 5B: Duplicate Email

**Action:**
1. Sign out
2. Try to create account with `demo@canadianinsights.ca` again

**Expected Result:**
- ✅ Shows error: "Email already exists"
- ✅ Does not crash

---

## 🚪 Step 6: Test Sign Out

### Test 6A: Sign Out Button

**Action:**
1. Log in
2. Go to any tab (Dashboard, Transactions, etc.)
3. Scroll down to footer/settings
4. Click "Sign out" button

**Expected Result:**
- ✅ Redirects to login page
- ✅ Shows toast: "Signed out"
- ✅ Cannot access data endpoints anymore
- ✅ Token removed from localStorage

### Test 6B: Token Expiration

**Action:**
1. Log in
2. Open DevTools → Application tab → Local Storage
3. Find the token
4. Wait 24 hours (or modify JWT expiration for testing)
5. Try to refresh page or access data

**Expected Result:**
- ✅ Token expires
- ✅ Redirected to login page
- ✅ Shows "Session expired" or similar

---

## 🔄 Step 7: Test Persistence

### Test 7A: Refresh Page

**Action:**
1. Log in
2. Navigate to Transactions tab
3. Refresh the browser page (F5 or Cmd+R)

**Expected Result:**
- ✅ Still logged in (token persists)
- ✅ Still on Transactions tab
- ✅ Data loads correctly

### Test 7B: Close and Reopen Tab

**Action:**
1. Log in
2. Close the browser tab completely
3. Open a new tab and go to the app URL

**Expected Result:**
- ✅ Still logged in
- ✅ Data loads

### Test 7C: Different Browser

**Action:**
1. Log in on Chrome
2. Open same URL in Firefox/Safari

**Expected Result:**
- ✅ NOT logged in (different browser = different localStorage)
- ✅ Shows login page
- ✅ Can log in independently

---

## 🐛 Step 8: Check for Errors

### Network Tab Check

**Action:**
1. Open DevTools → Network tab
2. Clear log
3. Navigate through all tabs (Dashboard, Saving, Transactions, Insights)
4. Look at the requests

**Expected Result:**
- ✅ All `/api/*` requests return **200 OK**
- ✅ NO 500 errors
- ✅ NO 405 errors
- ✅ NO 404 errors (except maybe favicon)

### Console Tab Check

**Action:**
1. Open DevTools → Console tab
2. Navigate through app

**Expected Result:**
- ✅ No red errors
- ⚠️  Warnings are OK (yellow)
- ✅ No "Failed to load resource" errors

---

## 🔍 Step 9: Vercel Function Logs

### Action:
1. Go to Vercel dashboard
2. Your project → Deployments → Latest deployment
3. Click "Functions" section (scroll down)
4. Click on `/api/server.js` function
5. Look at real-time logs

### Expected Logs:
```
[DB] Initializing database... (first request only)
[DB] Database initialization complete! (first request only)
[AUTH] Login error: ... (if login fails - debug info)
[API] Transactions error: ... (if query fails - debug info)
```

### Look For:
- ✅ No `SyntaxError`
- ✅ No `TypeError: Cannot read property 'id'`
- ✅ No `relation "users" does not exist`
- ✅ No `column "user_id" does not exist`

---

## ✅ Step 10: Final Validation

### Checklist:

- [ ] Login works with demo credentials
- [ ] Dashboard shows data
- [ ] Transactions tab works
- [ ] Savings tab works
- [ ] Insights tab works
- [ ] Can create new account
- [ ] Sign out works
- [ ] Token persists across page reloads
- [ ] No 500 errors in Network tab
- [ ] No errors in Console
- [ ] Vercel logs show successful init
- [ ] Database has tables and data

---

## 🎉 Success Criteria

**ALL of the following must be TRUE:**

1. ✅ Can log in with demo credentials
2. ✅ Dashboard loads with data (not empty)
3. ✅ Transactions tab shows list of 10+ transactions
4. ✅ Can sign out and back in
5. ✅ Can create new account and log in with it
6. ✅ No 500 errors anywhere
7. ✅ Database initialized successfully (check logs)
8. ✅ All tabs are clickable and don't crash

**If ALL criteria met: 🎊 ARCHITECTURE FIX IS SUCCESSFUL! 🎊**

---

## 🆘 Troubleshooting

### Issue: Still Getting 500 Errors

**Debug Steps:**
1. Check Vercel function logs for exact error
2. Verify DATABASE_URL is set in Vercel env vars
3. Check if database tables exist:
   ```sql
   \dt
   SELECT * FROM users;
   ```
4. Look for SQL errors in logs (type mismatches, missing columns)

### Issue: Login Returns 401

**Debug Steps:**
1. Verify demo user exists in database:
   ```sql
   SELECT * FROM users WHERE email = 'demo@canadianinsights.ca';
   ```
2. Check password hash matches
3. Look at login request in Network tab → Response

### Issue: Database Won't Initialize

**Debug Steps:**
1. Check DATABASE_URL format:
   ```
   postgresql://user:pass@host.com/database?sslmode=require
   ```
2. Test connection manually using psql or database client
3. Check Neon dashboard that database is active
4. Look for connection errors in Vercel logs

### Issue: Sign Out Doesn't Work

**Debug Steps:**
1. Check if button exists: Inspect element, look for `data-action="logout"`
2. Check Console for JavaScript errors
3. Check if `clearSession()` function is called
4. Manually clear localStorage and reload

---

## 📝 Report Template

After testing, fill this out:

```
TESTING RESULTS
===============

Date: [DATE]
Vercel URL: [URL]
Commit: f80e3b3

✅ PASSED:
- [List what worked]

❌ FAILED:
- [List what didn't work]

📋 LOGS:
- [Paste relevant logs]

🔍 NOTES:
- [Any observations]
```

---

**Ready to test! Follow steps 1-10 in order.** 🚀

