# Fix Vercel Deployment - Old Site Still Active

## Problem
The old website is still live and new changes aren't deploying. This means the **wrong Vercel project** is connected to your domain, or the **correct project isn't connected to GitHub**.

## Solution: Connect Correct Project to GitHub

### Step 1: Identify Which Project Has the Domain

1. Go to https://vercel.com/dashboard
2. Check **both projects**:
   - The old one (still showing old site)
   - The new one (`chem-irl` at https://vercel.com/nathans-projects-23715d38/chem-irl)

3. For each project, check **Settings → Domains**:
   - Which one has `chemirl.app` connected? **This is the active one**

### Step 2: Connect the Correct Project to GitHub

**Option A: If the OLD project has the domain (and you want to keep it)**

1. Go to the **old project** (the one with `chemirl.app` connected)
2. Go to **Settings → Git**
3. Verify it's connected to: `NatoDoyle/chem-irl`
4. If it's NOT connected, click **Connect Git Repository**
5. Select `NatoDoyle/chem-irl` and branch `main`
6. This will trigger a new deployment with your latest changes

**Option B: If you want to use the NEW project (`chem-irl`)**

1. Go to the **new project**: https://vercel.com/nathans-projects-23715d38/chem-irl
2. Go to **Settings → Git**
3. If it's NOT connected, click **Connect Git Repository**
4. Select `NatoDoyle/chem-irl` and branch `main`
5. Go to **Settings → Domains**
6. Add `chemirl.app` (this will transfer it from the old project)
7. This will trigger a new deployment

### Step 3: Verify Root Directory

**For whichever project is active**, check:

1. Go to **Settings → General**
2. **Root Directory**: Should be `.` or empty (NOT "web")
3. If it's set to "web", change it to `.` or empty
4. Save and redeploy

### Step 4: Trigger Manual Deployment

After connecting Git:

1. Go to the **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger automatic deployment:
   ```bash
   git commit --allow-empty -m "Trigger Vercel deployment"
   git push
   ```

### Step 5: Delete the Unused Project

Once the correct project is working:

1. Go to the **unused/duplicate project**
2. **Settings → General → Delete Project**
3. Confirm deletion

## Quick Fix Commands

If you want to force a new deployment:

```bash
cd web
git commit --allow-empty -m "Force Vercel redeploy"
git push
```

This will trigger a deployment in whichever project is connected to your GitHub repo.

## Verify It's Working

After connecting the correct project:

1. Wait 2-3 minutes for deployment
2. Check **Deployments** tab - should show a new deployment
3. Visit `https://chemirl.app` - should show new content
4. Check pages:
   - `/` - Should show new landing page
   - `/download` - Should show download page
   - `/how-it-works` - Should show how it works page

## Common Issues

**Issue**: "Project not connected to Git"
- **Fix**: Go to Settings → Git → Connect Repository

**Issue**: "Root Directory is wrong"
- **Fix**: Set to `.` or empty (not "web")

**Issue**: "Domain not transferring"
- **Fix**: Remove domain from old project first, then add to new project

**Issue**: "Still seeing old site after deployment"
- **Fix**: Clear browser cache, wait 5 minutes for DNS propagation

