# Fixing Duplicate Vercel Projects

## Why This Happened

When you push to GitHub, Vercel automatically creates deployments. If you:
- Changed the project structure significantly
- Modified `vercel.json` configuration
- Connected the repo multiple times
- Had a project before and created a new one

Vercel might have created a **second project** connected to the same GitHub repository.

## How to Fix It

### Step 1: Check Your Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Look for projects named:
   - `chem-irl` ✅ **This is the correct one**
   - `chem-irl-web`
   - `web`
   - Or similar variations

### Step 2: Identify the Correct Project

**Keep the project that:**
- ✅ Is named `chem-irl` (matches GitHub repo name)
- ✅ Has the correct domain (`chemirl.app`) connected
- ✅ Has the latest successful deployment
- ✅ Has Root Directory set to `.` or empty (NOT "web")
- ✅ Has the correct build settings (auto-detected, not overridden)

**Delete/Disable the project that:**
- ❌ Has old/failed deployments
- ❌ Doesn't have the domain connected
- ❌ Has incorrect build settings

### Step 3: Delete the Duplicate Project

1. In Vercel dashboard, click on the **duplicate/wrong project**
2. Go to **Settings** → **General**
3. Scroll down to **Delete Project**
4. Type the project name to confirm
5. Click **Delete**

### Step 4: Verify the Correct Project

1. Go to the **correct project** in Vercel
2. Check **Settings** → **General**:
   - **Project Name**: Should be `chem-irl` (matching your GitHub repo)
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `.` or empty (repo root, NOT "web")
   - **Build Command**: Should be auto-detected (`npm run build`)
   - **Output Directory**: Should be auto-detected (`out` for static export)

3. Check **Settings** → **Domains**:
   - Should have `chemirl.app` connected
   - Should have `www.chemirl.app` redirecting

### Step 5: Ensure Single Project Connection

1. In the **correct project**, go to **Settings** → **Git**
2. Verify it's connected to: `NatoDoyle/chem-irl`
3. Ensure **Production Branch** is set to `main`
4. If you see multiple Git connections, remove the duplicates

## Prevention

To avoid this in the future:

1. **Always use one Vercel project** per GitHub repo
2. **Don't manually create projects** - let Vercel auto-detect from GitHub
3. **Check existing projects** before connecting a new repo
4. **Use project settings** in Vercel dashboard, not just `vercel.json`

## Current Configuration

Your `vercel.json` is now correctly configured:
- ✅ No `buildCommand` (auto-detected)
- ✅ No `outputDirectory` (auto-detected for static export)
- ✅ Only headers and redirects (correct)

The duplicate is likely a **Vercel project management issue**, not a code issue.

