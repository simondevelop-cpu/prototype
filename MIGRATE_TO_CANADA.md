# Migrate Database to Canada (Toronto) - Step-by-Step Guide

**Date:** January 7, 2026  
**Current Status:** Database in Washington, D.C., USA (`iad1`)  
**Target:** Canada (Toronto) for Law 25 compliance  
**Difficulty:** 🟢 **LOW** (2-3 hours, no code changes)

---

## ✅ **Compliance Confirmation**

### **Will Toronto work for Quebec?**
✅ **YES** - Law 25 requires data in **Canada** (not specifically Quebec)
- Toronto is within Canada ✅
- Perfect for Quebec compliance ✅
- No need for database specifically in Quebec

### **Current Status:**
- **Database:** Neon, Washington, D.C., USA (`iad1`) ❌
- **Plan:** Free tier (0.5 GB) ✅
- **Vercel Functions:** Likely US-based (no Canada option) ⚠️ (acceptable if DB is in Canada)

### **Target Status:**
- **Database:** Neon, Canada (Toronto) ✅
- **Plan:** Free tier (0.5 GB) ✅
- **Vercel Functions:** US-based (unchanged) ⚠️ (acceptable with DB in Canada)

**Compliance After Migration:**
- ✅ **Data at rest:** In Canada (compliant with Law 25)
- ⚠️ **Data in transit/processing:** US-based (acceptable with documentation)
- **Verdict:** ✅ **COMPLIANT** with proper privacy policy documentation

---

## 🔍 **Pre-Migration Checklist**

Before starting, confirm:
- [ ] You have access to Neon console (https://console.neon.tech/)
- [ ] You have access to Vercel dashboard (https://vercel.com/dashboard)
- [ ] You know your current `DATABASE_URL` (or can copy it from Vercel)
- [ ] You have ~30 minutes for migration (or can do in steps)
- [ ] You can tolerate brief downtime (5-10 min) or prefer zero-downtime approach

**Current Database Info:**
- **Provider:** Neon ✅
- **Region:** Washington, D.C., USA (`iad1`) ❌
- **Plan:** Free tier (0.5 GB)
- **Size:** Unknown (likely small if only demo data)

---

## 🚀 **Migration Steps**

### **Step 1: Create New Neon Database in Canada (Toronto)** ⏱️ 15 min

1. **Go to Neon Console**
   - Visit: https://console.neon.tech/
   - Log in to your account

2. **Create New Project**
   - Click **"New Project"** or **"Create Project"**
   - **Project Name:** `prototype-canada` (or similar)
   - **Region:** Select **"Canada (Toronto)"** or **"North America - Toronto"**
     - ⚠️ **If you don't see Canada/Toronto option:** Neon may not offer it yet
     - In that case, contact Neon support or use alternative (see "Alternative Options" below)
   - **Plan:** Select **"Free"** (same as current)
   - Click **"Create Project"**

3. **Copy Connection String**
   - After creation, you'll see the connection string
   - Click **"Copy"** to copy it
   - **Format:** `postgresql://user:password@host.neon.tech/database?sslmode=require`
   - **Save this somewhere safe** (you'll need it in Step 3)

**✅ Checkpoint:** You should have:
- New Neon project created
- Connection string copied
- Region confirmed as Canada (Toronto)

---

### **Step 2: Run Schema Migration on New Database** ⏱️ 15 min

You have two options:

#### **Option A: Use Admin UI (Recommended - Easiest)**

1. **Update DATABASE_URL temporarily in Vercel**
   - Go to: https://vercel.com/dashboard
   - Select your project: **prototype**
   - Go to: **Settings** → **Environment Variables**
   - Find `DATABASE_URL`
   - Click **Edit**
   - **Temporarily** update value to **new Canadian database connection string**
   - Click **Save**
   - **⚠️ Note:** This will cause brief downtime - proceed to Step 3 quickly

2. **Run Migration via Admin UI**
   - Go to: `https://your-app.vercel.app/admin` (or your production URL)
   - Log in as admin
   - Go to **"App Health"** tab
   - Click **"Run Migration"** button (if available)
   - Or use: `/admin/migrate-l0-l1-l2` endpoint

3. **Verify Schema Created**
   - Check **App Health** dashboard
   - Look for successful migration status
   - Or run SQL directly in Neon console to verify tables exist

#### **Option B: Use Migration Scripts (More Control)**

1. **Set DATABASE_URL locally**
   ```bash
   export DATABASE_URL="postgresql://user:password@host.neon.tech/database?sslmode=require"
   # (use your new Canadian database connection string)
   ```

2. **Run schema migration**
   ```bash
   cd migrations
   npx ts-node run-migration.ts --schema-only
   ```

3. **Verify schema created**
   ```bash
   # Check tables exist
   psql $DATABASE_URL -c "\dt"
   ```

**✅ Checkpoint:** You should have:
- Schema created on new Canadian database
- All tables present (users, l0_pii_users, l0_user_tokenization, l1_transaction_facts, etc.)
- Extensions enabled (pgcrypto)

---

### **Step 3: Copy Data from Old Database to New Database** ⏱️ 30-60 min

**⚠️ Important:** This step copies all data. You can do this with zero downtime by running it in parallel.

#### **Option A: Using pg_dump/pg_restore (Recommended)**

1. **Export from old database**
   ```bash
   # Get old DATABASE_URL from Vercel (Settings → Environment Variables)
   export OLD_DB_URL="postgresql://user:password@old-host.neon.tech/database"
   export NEW_DB_URL="postgresql://user:password@new-host.neon.tech/database"
   
   # Dump schema + data
   pg_dump $OLD_DB_URL > backup.sql
   ```

2. **Restore to new database**
   ```bash
   # Restore to new Canadian database
   psql $NEW_DB_URL < backup.sql
   ```

#### **Option B: Using Neon Branching (If Available)**

Neon supports "branching" which might make this easier:
1. Check Neon console for "Branch" or "Clone" options
2. Create a branch of your current database
3. Change region of the branch (if supported)

#### **Option C: Manual Migration via Admin UI**

1. **Keep both databases connected temporarily**
   - Keep old `DATABASE_URL` in Vercel Production
   - Set new `DATABASE_URL` in Vercel Preview/Development

2. **Use data export/import scripts** (if you have them)
   - Export from old database
   - Import to new database

3. **Manual data copy** (only if small dataset)
   - Use Neon SQL editor to copy data table by table

**✅ Checkpoint:** You should have:
- All data copied to new Canadian database
- Data verified (same number of records)
- Test login with demo user works

---

### **Step 4: Test New Database (Preview Deployment)** ⏱️ 30 min

**⚠️ CRITICAL:** Test thoroughly before switching production!

1. **Create Preview Environment in Vercel**
   - Go to: Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
   - Find `DATABASE_URL`
   - Click **Edit**
   - For **Preview** environment: Set to **new Canadian database connection string**
   - Click **Save**
   - This creates a preview deployment with new database

2. **Test Preview Deployment**
   - Go to preview URL (provided by Vercel)
   - Test these critical flows:
     - ✅ Login (demo user)
     - ✅ Register (new user)
     - ✅ Onboarding completion
     - ✅ Transaction CRUD (create, read, update, delete)
     - ✅ Statement upload/parse
     - ✅ Account export
     - ✅ App Health dashboard (check all health checks)
     - ✅ Admin endpoints

3. **Verify Data Integrity**
   - Compare record counts (old DB vs new DB)
   - Check transaction amounts match
   - Verify user accounts exist
   - Confirm PII isolation working (L0/L1 architecture)

**✅ Checkpoint:** You should have:
- Preview deployment working perfectly
- All critical flows tested and passing
- Data verified as complete and correct

---

### **Step 5: Switch Production DATABASE_URL** ⏱️ 5 min

**⚠️ This causes brief downtime (1-2 minutes during redeploy)**

1. **Update Production DATABASE_URL**
   - Go to: Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
   - Find `DATABASE_URL`
   - Click **Edit**
   - For **Production** environment: Update to **new Canadian database connection string**
   - Click **Save**

2. **Redeploy Production**
   - Go to: **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**
   - Wait for deployment to complete (1-2 minutes)

3. **Verify Production**
   - Go to: `https://your-app.vercel.app`
   - Test login
   - Check App Health dashboard: `/admin` → **App Health** tab
   - Verify all health checks pass

**✅ Checkpoint:** You should have:
- Production using new Canadian database
- All features working
- Health checks passing

---

### **Step 6: Verify Migration Success** ⏱️ 15 min

1. **Check Database Region**
   - Go to: Neon Console → Your new project
   - Verify region shows: **"Canada (Toronto)"** or **"North America - Toronto"**

2. **Check App Health Dashboard**
   - Go to: `/admin` → **App Health** tab
   - Verify all checks passing:
     - ✅ Database connectivity
     - ✅ Schema integrity
     - ✅ PII isolation
     - ✅ Account deletion endpoint
     - ✅ Data export endpoint
     - ✅ 30-day data retention
     - ✅ User tokenization

3. **Test Critical User Flows**
   - ✅ Login/Register
   - ✅ Onboarding
   - ✅ Transactions CRUD
   - ✅ Statement upload
   - ✅ Account export
   - ✅ Account deletion (if needed for testing)

4. **Monitor Logs**
   - Check Vercel logs for any errors
   - Verify database connection logs show Canadian region

**✅ Checkpoint:** You should have:
- Confirmed database is in Canada (Toronto)
- All health checks passing
- All user flows working
- No errors in logs

---

### **Step 7: Clean Up Old Database (Optional - After Verification)** ⏱️ 5 min

**⚠️ Wait at least 24-48 hours after migration before deleting old database!**

1. **Verify Everything Working**
   - Confirm production has been stable for 24-48 hours
   - No issues reported
   - All health checks still passing

2. **Delete Old Neon Project**
   - Go to: Neon Console → Old project (Washington, D.C.)
   - Go to: **Settings** → **Danger Zone**
   - Click **"Delete Project"**
   - Confirm deletion

**✅ Checkpoint:** Old database deleted (optional, after verification period)

---

## 🚨 **Troubleshooting**

### **Problem: Can't find "Canada (Toronto)" region in Neon**

**Solution:**
- Neon may not offer Canada region yet (varies by availability)
- **Options:**
  1. Contact Neon support to request Canada region
  2. Use alternative provider with Canada region:
     - **Railway** (supports Canada)
     - **Render** (supports Canada)
     - **Supabase** (may support Canada - check availability)
  3. Use **Vercel Postgres** (check if they have Canada region)

### **Problem: Migration fails or data doesn't copy correctly**

**Solution:**
- Check Neon logs for errors
- Verify connection strings are correct
- Ensure schema migration ran successfully first
- Try smaller batch sizes if large dataset
- Use `pg_dump` with `--verbose` flag for more details

### **Problem: Preview deployment fails**

**Solution:**
- Check Vercel logs for errors
- Verify new `DATABASE_URL` is correct format
- Ensure schema migration completed on new database
- Check SSL settings (`?sslmode=require` should be in connection string)

### **Problem: Production deployment has errors**

**Solution:**
- **Quick Rollback:** Immediately change `DATABASE_URL` back to old database
- Check Vercel logs for specific error
- Verify new database is accessible
- Re-run schema migration if needed

---

## ✅ **Zero-Downtime Approach (Optional)**

If you need zero downtime:

1. **Create new database in Canada** (Step 1)
2. **Run schema migration** (Step 2)
3. **Copy data** (Step 3) - Do this while production is still running on old DB
4. **Set up read replication** (if Neon supports it) OR
5. **Do final sync** (copy any new data added during migration)
6. **Switch DATABASE_URL** (Step 5) - This causes ~1-2 min downtime during redeploy

**Note:** For free tier, this may not be necessary (likely small dataset). Standard approach (5-10 min downtime) is usually fine.

---

## 📋 **Alternative Options (If Neon Doesn't Have Canada)**

### **Option 1: Vercel Postgres (Check for Canada Region)**

1. Go to: Vercel Dashboard → **Storage** → **Create Database**
2. Choose **Postgres**
3. Check available regions (may include Canada)
4. If available, create database and follow same migration steps

### **Option 2: Railway (Supports Canada)**

1. Sign up at: https://railway.app/
2. Create PostgreSQL database
3. Select **Canada (Toronto)** region
4. Follow same migration steps

### **Option 3: Render (Supports Canada)**

1. Sign up at: https://render.com/
2. Create PostgreSQL database
3. Select **Canada (Toronto)** region
4. Follow same migration steps

---

## 🎯 **Success Criteria**

After migration, you should have:

✅ **Database in Canada (Toronto)**
- Confirmed in Neon console
- Region shows as Canada/Toronto

✅ **All Features Working**
- Login/Register
- Onboarding
- Transactions CRUD
- Statement upload
- Account export/deletion
- Admin dashboard

✅ **Health Checks Passing**
- All App Health checks green
- No errors in logs

✅ **Compliance Achieved**
- Law 25 compliant (data in Canada)
- Ready to document in privacy policy

---

## 📝 **Post-Migration Tasks**

After successful migration:

1. **Update Privacy Policy**
   - Document that data is stored in Canada (Toronto)
   - Note that processing happens in US (Vercel functions)
   - Explain equivalent protection measures

2. **Document Migration**
   - Record migration date
   - Note old database region (for reference)
   - Save connection strings securely (if needed for reference)

3. **Monitor for 24-48 Hours**
   - Check App Health dashboard regularly
   - Monitor Vercel logs
   - Verify no issues reported

---

## 💡 **Time Estimate**

- **Step 1:** Create new database - 15 min
- **Step 2:** Schema migration - 15 min
- **Step 3:** Data copy - 30-60 min (depends on data size)
- **Step 4:** Test preview - 30 min
- **Step 5:** Switch production - 5 min
- **Step 6:** Verify - 15 min
- **Step 7:** Clean up (optional, after 24-48h) - 5 min

**Total:** 2-3 hours (including testing)

---

## 🚀 **Ready to Start?**

1. ✅ Confirm you have access to Neon console and Vercel dashboard
2. ✅ Have 2-3 hours available for migration
3. ✅ Confirm you can tolerate brief downtime (or prefer zero-downtime approach)
4. ✅ Proceed with **Step 1** above

**Questions?** Check troubleshooting section or reach out if you encounter issues.

---

## ✅ **Bottom Line**

**Can we do it easily?** ✅ **YES**
- Standard database migration
- No code changes needed
- Low risk (can test in parallel, easy rollback)

**Will Toronto work for Quebec?** ✅ **YES**
- Law 25 requires Canada (not specifically Quebec)
- Toronto is perfect for compliance

**Any technical hiccups expected?** ✅ **NO**
- Straightforward migration process
- Can test before switching
- Easy rollback if needed

**Ready to proceed?** Start with **Step 1** above! 🚀

