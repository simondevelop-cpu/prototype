# Vercel Production Deployment Guide

## Why Merged Branch Didn't Deploy to Production

When you merge a pull request, Vercel creates **Preview** deployments for the branch. To deploy to **Production**, you need to push to the production branch (typically `main`).

## How Vercel Deployment Works

1. **Preview Deployments**: Created automatically for:
   - Feature branches
   - Pull requests
   - Any branch that's not the production branch

2. **Production Deployments**: Created automatically when:
   - You push to the production branch (usually `main`)
   - You manually promote a preview deployment in Vercel dashboard

## Deploy to Production

### Option 1: Push to Main Branch (Recommended)

```bash
# Make sure you're on main and it's up to date
git checkout main
git pull origin main

# Merge your feature branch if not already merged
git merge admin-dashboard-cohort-analytics

# Push to main - this triggers production deployment
git push origin main
```

### Option 2: Promote Preview Deployment in Vercel

1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the preview deployment you want to promote
3. Click the three dots (⋯) menu
4. Select "Promote to Production"

### Option 3: Configure Production Branch in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Git
2. Check which branch is set as "Production Branch"
3. Ensure it's set to `main` (or your preferred production branch)

## Verify Production Deployment

After pushing to main:
1. Check Vercel Dashboard → Deployments
2. Look for a deployment with "Production" label (not "Preview")
3. The deployment should show your latest commits

## Current Status

Based on your repository:
- **Production Branch**: `main` (default)
- **Current Branch**: `admin-dashboard-cohort-analytics`
- **Action Needed**: Merge to `main` and push, or promote preview deployment

## Quick Command

```bash
# If you've already merged the PR, just push main
git checkout main
git pull origin main
git push origin main
```

This will trigger a production deployment automatically.





