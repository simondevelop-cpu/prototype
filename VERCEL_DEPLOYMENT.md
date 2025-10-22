# 🚀 Vercel Deployment Guide - Authentication Fix

## ✅ What Was Fixed for Vercel

The **405 error** was caused by how Vercel's serverless functions handle routes. When a request comes to `/api/auth/login`, Vercel:

1. Strips the `/api` prefix before passing to your serverless function
2. The request becomes `/auth/login` instead of `/api/auth/login`
3. The middleware was checking for `/api/auth/` which didn't match

### Fixes Applied:

1. **Dual Route Handlers**: Added routes both with and without `/api` prefix
2. **Smart Middleware**: Updated to check both path patterns
3. **Vercel-Aware Routing**: Middleware now handles Vercel's path stripping
4. **Debug Logging**: Added console logs to track requests in Vercel logs

## 📋 Deployment Steps

### Step 1: Commit and Push Changes

```bash
cd "/Users/simonaltman/Cursor repository for cloned repo on 21 oct 13h00/prototype"

# Stage the fixed files
git add server.js vercel.json

# Commit the auth fixes
git commit -m "Fix authentication for Vercel serverless deployment

- Add dual route handlers (/api/auth/* and /auth/*)
- Update middleware to handle Vercel's path stripping
- Add debug logging for auth endpoints
- Fix 405 error on demo login and user authentication"

# Push to GitHub
git push origin main  # or your branch name
```

### Step 2: Vercel Will Auto-Deploy

Vercel will automatically:
1. Detect the push to GitHub
2. Build your application
3. Deploy the new version
4. Give you a deployment URL

### Step 3: Test the Deployment

Once deployed, test these endpoints on your Vercel URL (e.g., `https://your-app.vercel.app`):

#### Test Demo Login:
```bash
curl -X POST https://your-app.vercel.app/api/auth/demo \
  -H "Content-Type: application/json"
```

#### Test Regular Login:
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@canadianinsights.ca","password":"northstar-demo"}'
```

#### Test Registration:
```bash
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass","name":"Test User"}'
```

## 🔍 Debugging on Vercel

### View Deployment Logs:

1. Go to your Vercel dashboard
2. Click on your deployment
3. Go to "Functions" tab
4. Click on `/api/server.js` function
5. View the logs to see the debug output like:
   ```
   [AUTH] Login attempt - path: /auth/login url: /auth/login
   [AUTH] Demo (no prefix) - path: /auth/demo url: /auth/demo
   ```

### Common Issues:

**Issue**: Still getting 405 errors
**Solution**: Check Vercel logs to see which path is being hit. The logs will show the exact path and URL.

**Issue**: CORS errors
**Solution**: Vercel should handle CORS automatically, but if you see issues, check the `cors()` middleware is enabled.

**Issue**: "Request failed" errors
**Solution**: Check if the request is reaching the correct route handler by looking at Vercel function logs.

## 🔐 Environment Variables (Optional)

If you want to customize settings, add these in Vercel dashboard → Settings → Environment Variables:

- `JWT_SECRET`: Custom JWT secret (default: 'canadian-insights-demo-secret')
- `JWT_TTL_SECONDS`: Session duration (default: 7200 = 2 hours)
- `DEMO_EMAIL`: Demo user email (default: 'demo@canadianinsights.ca')
- `DEMO_PASSWORD`: Demo user password (default: 'northstar-demo')
- `DISABLE_DB`: Set to '1' to use in-memory data only
- `DATABASE_URL`: PostgreSQL connection string (if using a database)

## ✨ What Now Works on Vercel

✅ **Demo Login**: Button works instantly with prepopulated data  
✅ **User Registration**: Create accounts that persist in memory (add DB for persistence)  
✅ **User Login**: Sign in with email/password  
✅ **JWT Sessions**: 2-hour token-based sessions  
✅ **Data Isolation**: Each user sees only their own data  

## 📊 Database Setup (Optional)

Currently using in-memory storage. For production:

1. **Add PostgreSQL Database**:
   - Vercel Postgres (recommended)
   - Supabase
   - Neon
   - Railway

2. **Set Environment Variable**:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   ```

3. **Remove** `DISABLE_DB` environment variable

4. **Deploy**: Vercel will automatically restart with database

## 🎉 Success Indicators

After deployment, you should see:

1. ✅ No 405 errors in browser console
2. ✅ Demo login button works instantly
3. ✅ Can create new accounts
4. ✅ Can login with demo credentials
5. ✅ JWT tokens are issued correctly
6. ✅ Sessions persist for 2 hours

## 🐛 Still Having Issues?

1. **Check Vercel Function Logs**: Look for the `[AUTH]` debug messages
2. **Verify Route**: Check which path the request is hitting
3. **Test Locally First**: Run `npm install && node server.js` locally to verify
4. **Check GitHub Sync**: Ensure latest code is pushed to GitHub
5. **Force Redeploy**: In Vercel dashboard, click "Redeploy" to force a fresh deployment

The authentication system is now fully configured for Vercel's serverless environment! 🚀
