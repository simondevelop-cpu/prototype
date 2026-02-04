# 🗄️ Migrate to Neon (Toronto Region) - Complete Guide

## Current Setup Analysis

Your app currently uses **one database connection** via the `DATABASE_URL` or `POSTGRES_URL` environment variable. The code supports both:
- **Vercel Postgres** (if connection string contains "vercel")
- **Neon** (serverless Postgres)

**Good news:** You're already using just one database! There's no parallel setup to worry about.

---

## Why Use Neon (Toronto)?

### ✅ Advantages of Neon:
1. **Canadian Data Residency** - Toronto region keeps data in Canada (PIPEDA compliance)
2. **Better Free Tier** - 3GB storage vs Vercel's 256MB
3. **Autoscaling** - Automatically scales to zero when not in use (cost savings)
4. **Branching** - Create database branches for testing (like Git branches)
5. **Better Performance** - Optimized for serverless workloads
6. **More Control** - Direct access to database settings and monitoring

### ⚠️ Considerations:
- **Vercel Postgres** is more tightly integrated with Vercel (easier setup)
- **Neon** requires manual connection string setup (but more flexible)

**Recommendation:** Use Neon Toronto for better data residency compliance and more features.

---

## Step-by-Step Migration Guide

### Option A: Use Vercel's Neon Integration (Recommended - Easiest)

**This is the easiest method!** Vercel has a built-in Neon Postgres integration that handles everything automatically.

#### Step 1: Create Neon Project via Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **prototype**
3. Go to **Storage** tab
4. Click **"Create Database"**
5. Choose **"Neon Postgres"** (not "Postgres" - that's Vercel's own Postgres)
6. **Important:** When creating, select **"Toronto, Canada"** as the region
   - This ensures PIPEDA compliance (data stays in Canada)
7. Choose **Free tier** (3GB storage)
8. Click **"Create"**

Vercel will automatically:
- ✅ Create the Neon project
- ✅ Set up the connection string
- ✅ Configure environment variables (`POSTGRES_URL`, etc.)
- ✅ Link it to your project

#### Step 2: Verify Region

1. In Vercel Dashboard → Storage → Your Neon database
2. Click **"Open in Neon"** (top right button)
3. In Neon dashboard, verify the region shows **"Toronto"**
4. If it's not Toronto, you may need to create a new project in Toronto region

#### Step 3: Redeploy

1. Go to **Deployments** tab
2. Click **"..."** on latest deployment → **"Redeploy"**
3. The app will automatically use the new Neon database

---

### Option B: Manual Neon Setup (If You Prefer More Control)

If you want to set up Neon manually or already have a Neon project:

#### Step 1: Create Neon Project (Toronto Region)

1. Go to [Neon.tech](https://neon.tech)
2. Sign up or log in
3. Click **"New project"** (or use Vercel integration as shown in tooltip)
4. **Important:** Select **"Toronto, Canada"** as the region
   - This ensures PIPEDA compliance (data stays in Canada)
5. Choose a project name (e.g., "canadian-insights")
6. Select **Free tier** (3GB storage, perfect for your needs)
7. Click **"Create project"**

#### Step 2: Connect Neon to Vercel

1. In Neon dashboard, go to your project
2. Click **"Connect Project"** or go to **Settings** → **Integrations**
3. Connect to Vercel (if available)
4. Or manually copy the connection string from **"Connection Details"**

#### Step 3: Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add or update `POSTGRES_URL` with your Neon connection string:
   ```
   postgresql://username:password@ep-xxxxx-toronto.aws.neon.tech/dbname?sslmode=require
   ```
3. **Note:** The connection string should contain "toronto" in the hostname
4. Make sure to check all scopes: Production, Preview, Development
5. Click **"Save"**

### Step 4: Export Data from Current Database (If Needed)

**If you have existing data you want to keep:**

1. **Option A: Using Neon Console**
   - Go to your current database provider's console
   - Export data as SQL dump
   - Import into Neon using the SQL Editor

2. **Option B: Using pg_dump (if you have local access)**
   ```bash
   pg_dump $OLD_DATABASE_URL > backup.sql
   psql $NEW_NEON_URL < backup.sql
   ```

3. **Option C: Let the app recreate schema**
   - The app will automatically create tables on first connection
   - You'll lose existing data, but schema will be fresh

**For your prototype:** Option C is probably fine if you don't have critical production data.

### Step 5: Update Vercel Environment Variables (Only if using Option B)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **prototype**
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL` or `POSTGRES_URL`
5. **Update the value** with your new Neon Toronto connection string:
   ```
   postgresql://username:password@ep-xxxxx-toronto.aws.neon.tech/dbname?sslmode=require
   ```
6. **Important:** Make sure to check all scopes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
7. Click **"Save"**

### Step 6: Remove Old Database (Optional)

**If you were using Vercel Postgres:**

1. Go to Vercel Dashboard → Your Project
2. Go to **Storage** tab
3. Find your Postgres database
4. Click **"..."** → **"Delete"**
5. Confirm deletion

**Note:** Only do this after confirming Neon is working!

### Step 7: Redeploy Application

1. Go to Vercel Dashboard → Your Project
2. Go to **Deployments** tab
3. Click **"..."** on the latest deployment
4. Click **"Redeploy"**
5. Wait for deployment to complete

### Step 8: Verify Connection

1. **Check Vercel Logs:**
   - Go to your deployment → **Functions** tab
   - Look for: `[DB] Pool created` (should appear in logs)

2. **Test the API:**
   - Visit: `https://your-app.vercel.app/api/health`
   - Should return: `{"status": "ok"}`

3. **Test Login:**
   - Try logging in with demo credentials
   - Should work without errors

4. **Check Database in Neon:**
   - Go to Neon Dashboard → Your Project
   - Click **"Tables"** tab
   - You should see tables being created automatically

---

## Verification Checklist

After migration, verify:

- [ ] Neon project created in **Toronto region** (check in Neon dashboard)
- [ ] Connection string contains "toronto" in hostname (if manually set)
- [ ] `POSTGRES_URL` or `DATABASE_URL` set in Vercel (automatically if using Vercel integration)
- [ ] Application redeployed
- [ ] Health check endpoint returns `{"status": "ok"}`
- [ ] Login works without errors
- [ ] Tables visible in Neon dashboard (click "Open in Neon" from Vercel)
- [ ] Old Vercel Postgres database deleted (if applicable)

## Important Notes

### About the Neon Tooltip

The tooltip in Neon that says *"To create a new project, use the Neon Postgres integration in Vercel"* is suggesting you use **Option A** (Vercel's integration). This is the recommended approach because:

- ✅ Automatic setup and configuration
- ✅ Environment variables configured automatically
- ✅ Easier to manage from Vercel dashboard
- ✅ Better integration with Vercel deployments

### If You Already Have a Neon Project

If you already have a Neon project (like "neon-orange-queen" shown in your screenshot):

1. **Check the region:**
   - Click "Open in Neon" from Vercel Storage tab
   - Check if it's in Toronto region
   - If not, you may need to create a new project in Toronto

2. **Connect existing project:**
   - If it's already in Toronto, you can use it
   - Make sure `POSTGRES_URL` is set correctly in Vercel
   - The connection details are shown in the Vercel Storage tab

---

## Troubleshooting

### Issue: Connection Timeout

**Solution:**
- Check that SSL mode is set: `?sslmode=require` at end of connection string
- Verify Neon project is in Toronto region
- Check Vercel logs for specific error messages

### Issue: Tables Not Created

**Solution:**
- The app creates tables on first API request
- Make a request to `/api/health` or try logging in
- Check Neon dashboard → Tables tab after making a request

### Issue: Authentication Errors

**Solution:**
- Verify connection string is correct
- Check that environment variable is set for all scopes (Production, Preview, Development)
- Redeploy after updating environment variable

### Issue: Data Missing

**Solution:**
- If you had existing data, you need to export/import it (see Step 3)
- If starting fresh, the app will seed demo data automatically
- Check Vercel logs for "Seeded demo data" message

---

## Cost Comparison

| Feature | Vercel Postgres | Neon (Toronto) |
|---------|----------------|----------------|
| **Free Tier Storage** | 256MB | 3GB |
| **Free Tier Compute** | Limited | Autoscaling |
| **Region Selection** | Limited | ✅ Toronto available |
| **Branching** | ❌ | ✅ |
| **Cost After Free** | $20/month | $19/month (similar) |

**Winner:** Neon Toronto (better free tier + Canadian data residency)

---

## Next Steps After Migration

1. **Monitor Usage:**
   - Check Neon dashboard for connection metrics
   - Monitor storage usage (free tier: 3GB)

2. **Set Up Alerts:**
   - In Neon dashboard, set up alerts for storage/connection limits
   - Configure email notifications

3. **Backup Strategy:**
   - Neon automatically backs up your database
   - Consider setting up point-in-time recovery (available in paid plans)

4. **Performance Optimization:**
   - Use Neon's query performance insights
   - Monitor slow queries in Neon dashboard

---

## Summary

✅ **You're already using one database** - no parallel setup to worry about  
✅ **Neon Toronto is the better choice** - Canadian data residency + better free tier  
✅ **Migration is straightforward** - just update the connection string  
✅ **No code changes needed** - your app already supports Neon  

The migration should take about 10-15 minutes. Let me know if you need help with any step!

