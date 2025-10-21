# 🔍 Debugging 405 Errors - Step by Step Guide

## Current Status

You're still getting 405 errors even after the fixes. This means we need to investigate further to find the root cause.

## 🚨 What I Notice from Your Screenshot

1. **URLs have "1" appended**: `/api/auth/login1`, `/api/auth/demo1` 
   - This is NOT in the code
   - Likely browser caching or Vercel deployment issue

2. **All endpoints returning 405**: login, demo, register
   - This suggests the routes aren't being matched at all
   - OR the middleware is still blocking them

## 📋 Diagnostic Steps

### Step 1: Push the Latest Debug Code

```bash
git push origin fix/auth-login
```

This will deploy the debug endpoints I just added.

### Step 2: Wait for Vercel Deployment

1. Go to your Vercel dashboard
2. Wait for the deployment to complete (usually 1-2 minutes)
3. Look for the green "Ready" status

### Step 3: Clear ALL Browser Cache

**Important**: The "1" in the URLs suggests caching issues.

**Option A: Hard Refresh**
- Mac: `Cmd + Shift + R`
- Windows: `Ctrl + Shift + F5`

**Option B: Clear Cache Manually**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Option C: Use Incognito/Private Window**
- Opens a fresh session with no cache

### Step 4: Test the Debug Endpoint

Once deployed, try these URLs in your browser or Postman:

**Test 1: Debug Routes**
```
GET https://your-app.vercel.app/api/debug-routes
```

Expected response:
```json
{
  "method": "GET",
  "path": "/api/debug-routes",
  "message": "Debug endpoint working - auth routes should work too"
}
```

**Test 2: Health Check**
```
GET https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "mode": "memory"
}
```

**Test 3: Demo Login (Curl)**
```bash
curl -X POST https://your-app.vercel.app/api/auth/demo \
  -H "Content-Type: application/json" \
  -v
```

Expected: 200 OK with a token

### Step 5: Check Vercel Function Logs

This is CRITICAL for debugging:

1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Deployments" → Click latest deployment
4. Click "Functions" tab
5. Click on `/api/server.js`
6. Look for logs like:
   ```
   [AUTH] Login attempt - method: POST path: /auth/login
   [AUTH] Demo (no prefix) - method: POST path: /auth/demo
   ```

## 🔍 What the Logs Will Tell Us

### If you see auth logs:
✅ Routes are being hit
❌ But something else is wrong (check the error message)

### If you DON'T see auth logs:
❌ Routes aren't being matched
❌ Middleware is blocking before routes
❌ OR Vercel routing is misconfigured

## 🎯 Likely Issues & Solutions

### Issue 1: Browser Cache (Most Likely)

**Symptoms:** URLs have "1" appended, old errors persist

**Solution:**
1. Clear browser cache completely
2. Try incognito window
3. Try different browser
4. Hard refresh (Cmd+Shift+R)

### Issue 2: Vercel Hasn't Deployed Latest Code

**Symptoms:** Changes don't appear, old behavior continues

**Solution:**
1. Check Vercel dashboard for latest commit hash
2. Compare with: `git log --oneline -1`
3. Force redeploy in Vercel if needed

### Issue 3: vercel.json Configuration

**Symptoms:** Routes work locally but not on Vercel

**Current vercel.json:**
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/server.js" }
  ]
}
```

**Potential fix** (if above doesn't work):
```json
{
  "routes": [
    { "src": "/api/auth/(.*)", "dest": "/api/server.js" },
    { "src": "/api/(.*)", "dest": "/api/server.js" }
  ]
}
```

### Issue 4: Express Route Order

**Symptoms:** Some routes work, auth routes don't

**Check:** Are auth routes defined BEFORE the catch-all `app.get('*')`?

Current order (line numbers in server.js):
- Line 126: `/api/auth/login` ✅
- Line 152: `/api/auth/demo` ✅
- Line 167: `/api/auth/register` ✅
- Line 203-273: Non-prefixed auth routes ✅
- Line 1787: `app.get('*')` catch-all ✅ (at the end)

This looks correct!

## 📸 Screenshots I Need

To help diagnose further, please provide:

1. **Vercel Deployment Dashboard**
   - Show the latest deployment
   - Show the commit message
   - Show deployment status (Ready/Error)

2. **Vercel Function Logs**
   - Go to Functions → `/api/server.js`
   - Show the logs from the last request
   - Look for `[AUTH]` messages

3. **Browser Network Tab**
   - After hard refresh
   - Show the request to `/api/auth/demo`
   - Show request headers
   - Show response

4. **Test the Debug Endpoint**
   - Open: `https://your-app.vercel.app/api/debug-routes`
   - Screenshot the response

## 🚀 Quick Test Script

Save this as `test-vercel.sh` and run it:

```bash
#!/bin/bash
VERCEL_URL="https://your-app.vercel.app"

echo "Testing debug endpoint..."
curl -s "$VERCEL_URL/api/debug-routes" | json_pp

echo -e "\nTesting health check..."
curl -s "$VERCEL_URL/api/health" | json_pp

echo -e "\nTesting demo login..."
curl -X POST "$VERCEL_URL/api/auth/demo" \
  -H "Content-Type: application/json" \
  -v 2>&1 | grep -E "< HTTP|POST|{.*}"

echo -e "\nTesting regular login..."
curl -X POST "$VERCEL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@canadianinsights.ca","password":"northstar-demo"}' \
  -v 2>&1 | grep -E "< HTTP|POST|{.*}"
```

Replace `your-app.vercel.app` with your actual Vercel URL.

## 🎉 Success Indicators

You'll know it's fixed when:

✅ No "1" in URLs
✅ Debug endpoint returns JSON
✅ Demo login returns a token
✅ Console shows 200/201 status codes
✅ Vercel logs show `[AUTH]` messages
✅ Auth dialog closes after clicking Demo login

## 🆘 Still Not Working?

If after all this it still doesn't work, we may need to:

1. **Rebuild from scratch**: Create a new Vercel project
2. **Check environment variables**: Ensure nothing is overriding settings
3. **Check Vercel runtime**: Ensure Node.js version is compatible
4. **Try Vercel CLI locally**: `vercel dev` to test locally

Let me know what you find! 🔍
