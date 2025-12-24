# URGENT: Fix Vercel Deployment - Old Site Still Active

## The Problem
Your code changes are pushed to GitHub, but the old website is still live because:
- The **old Vercel project** is still connected to `chemirl.app` domain
- The **old project** may not be connected to GitHub, OR
- The **new project** (`chem-irl`) isn't connected to GitHub

## Immediate Fix Steps

### Step 1: Check Which Project Has the Domain

1. Go to https://vercel.com/dashboard
2. Find the **old project** (the one showing the old website)
3. Go to its **Settings → Domains**
4. Check if `chemirl.app` is listed there

### Step 2: Connect the Active Project to GitHub

**If the OLD project has the domain** (most likely):

1. Go to the **old project** in Vercel
2. Click **Settings → Git**
3. Check if it shows: `NatoDoyle/chem-irl` connected
4. If it's **NOT connected** or shows a different repo:
   - Click **Connect Git Repository**
   - Select `NatoDoyle/chem-irl`
   - Select branch: `main`
   - Click **Connect**
5. This will trigger a new deployment with your latest code

**If it's already connected but not deploying:**
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment
- Or trigger a new commit (see below)

### Step 3: Verify Root Directory

**Critical**: Check the Root Directory setting

1. Go to **Settings → General**
2. Look for **Root Directory**
3. It should be: `.` or **empty** (NOT "web")
4. If it says "web", change it to `.` or leave it empty
5. Save

**Why**: Your Git repo root IS the `web/` folder, so Root Directory should be empty/root.

### Step 4: Trigger Deployment

After connecting Git, trigger a deployment:

```bash
cd web
git commit --allow-empty -m "Trigger Vercel deployment"
git push
```

Or manually redeploy in Vercel dashboard.

### Step 5: Wait and Verify

1. Wait 2-3 minutes for deployment to complete
2. Check **Deployments** tab - should show "Building" then "Ready"
3. Visit `https://chemirl.app` - should show new content
4. Hard refresh (Ctrl+F5) to clear cache

## Alternative: Use the New Project

If you prefer to use the new `chem-irl` project:

1. Go to: https://vercel.com/nathans-projects-23715d38/chem-irl
2. **Settings → Git** → Connect to `NatoDoyle/chem-irl`
3. **Settings → Domains** → Add `chemirl.app` (will transfer from old project)
4. **Settings → General** → Verify Root Directory is `.` or empty
5. Wait for deployment

## Quick Test

After fixing, your site should show:
- ✅ New landing page with "Download the App" button
- ✅ `/download` page with app store links
- ✅ `/how-it-works` page explaining the app
- ❌ NO old product pages (discover, matches, etc.)

If you still see old pages, the wrong project is active.

