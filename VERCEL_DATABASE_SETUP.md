# 🗄️ Database Setup for Vercel

## Why You Need a Database

Your Canadian Insights app needs a database for:
- ✅ **Storing transactions** - The demo user's sample data
- ✅ **User data persistence** - New user accounts and their data
- ✅ **Insights generation** - Analyzing spending patterns
- ✅ **Budget tracking** - Monthly budget data
- ✅ **Savings goals** - Tracking financial goals

**Without a database**: Authentication works, but you'll get 500 errors when the app tries to load transactions.

## 🚀 Quick Setup: Vercel Postgres (Recommended)

### Step 1: Create Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your project: **prototype**
3. Go to **Storage** tab
4. Click **Create Database**
5. Choose **Postgres**
6. Select **Hobby** plan (free)
7. Click **Create**

### Step 2: Connect to Your Project

Vercel will automatically:
- ✅ Create the database
- ✅ Set `DATABASE_URL` environment variable
- ✅ Connect it to your project
- ✅ Make it available in all environments

### Step 3: Redeploy

The app will automatically redeploy and pick up the database connection.

That's it! 🎉

---

## 🆓 Alternative: Neon (Free Serverless Postgres)

If you prefer an external provider:

### Step 1: Create Neon Account

1. Go to [Neon.tech](https://neon.tech)
2. Sign up (free)
3. Create a new project
4. Copy the connection string

### Step 2: Add to Vercel

1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add variable:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgresql://user:pass@host/database?sslmode=require`
   - **Scope**: Production, Preview, Development (check all)
4. Click **Save**

### Step 3: Redeploy

1. Go to Deployments
2. Click **...** on latest deployment
3. Click **Redeploy**

---

## ⚙️ Environment Variables You Need

### Required (if using database):
```
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Optional (have defaults):
```
JWT_SECRET=your-secret-key-here
JWT_TTL_SECONDS=7200
DEMO_EMAIL=demo@canadianinsights.ca
DEMO_PASSWORD=northstar-demo
```

---

## 🧪 Testing Without a Database (Temporary)

If you want to test authentication without setting up a database right now:

### Step 1: Add Environment Variable

In Vercel Dashboard → Settings → Environment Variables:

- **Key**: `DISABLE_DB`
- **Value**: `1`
- **Scope**: All environments

### Step 2: Redeploy

This will:
- ✅ Authentication works (demo login, register, login)
- ✅ No 500 errors on auth endpoints
- ❌ But: No transactions, no data, no insights
- ❌ Dashboard will be empty
- ❌ Will show "Sign in to view transactions" messages

**This is only for testing the authentication flow!**

---

## 🔍 How to Check if Database is Connected

### Option 1: Check Vercel Logs

1. Go to your deployment in Vercel
2. Click **Functions** → `/api/server.js`
3. Look for logs:

**With Database:**
```
Database initialisation successful
Seeded demo data
```

**Without Database:**
```
Skipping database init in Vercel serverless
DISABLE_DB is set
```

### Option 2: Test the API

Visit: `https://your-app.vercel.app/api/health`

**Response with DB:**
```json
{
  "status": "ok"
}
```

**Response without DB:**
```json
{
  "status": "ok",
  "mode": "memory"
}
```

---

## 🎯 Recommended Approach

### For Development/Testing:
1. ✅ Set up **Vercel Postgres** (free, easiest)
2. ✅ Or use **Neon** (also free, serverless-optimized)
3. ✅ This gives you the full app experience

### For Production:
1. Use Vercel Postgres Hobby plan (free up to 256MB)
2. Or upgrade to Pro for more storage
3. Or use Neon with autoscaling

---

## 📊 Database Schema

The app will automatically create these tables:

- `users` - User accounts
- `accounts` - Financial accounts (checking, credit, etc.)
- `transactions` - All financial transactions
- `insight_feedback` - User feedback on insights

The schema is created automatically on first connection!

---

## 🐛 Troubleshooting

### 500 Errors After Setup

**Check:**
1. Is `DATABASE_URL` set in Vercel environment variables?
2. Is the connection string correct?
3. Does it include `?sslmode=require` at the end?
4. Did you redeploy after adding the variable?

### Connection Timeouts

**Solution:**
- Serverless databases (Neon, Vercel Postgres) are optimized for this
- Make sure SSL mode is enabled
- Check the database provider is accessible from Vercel's network

### Empty Database

**Solution:**
- The app seeds demo data automatically
- If transactions are missing, check Vercel function logs
- Look for "Seeded demo data" message

---

## ✅ Success Checklist

After setup, you should have:

- ✅ Database created and connected
- ✅ `DATABASE_URL` environment variable set
- ✅ Deployment successful
- ✅ No 500 errors on login
- ✅ Demo user can see transactions
- ✅ New users can register and create data
- ✅ All app features work

---

## 💰 Cost

Both recommended options have **free tiers**:

- **Vercel Postgres**: Free up to 256MB storage
- **Neon**: Free up to 3GB storage + autoscaling

Perfect for prototypes and demos! 🎉
