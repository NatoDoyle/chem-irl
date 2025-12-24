# Vercel Project Check - chem-irl

## Current Project
- **URL**: https://vercel.com/nathans-projects-23715d38/chem-irl
- **Name**: `chem-irl` ✅
- **Account**: `nathans-projects-23715d38`

## Steps to Find and Remove Duplicate

### 1. Check All Projects in Your Account

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Look at the list of all projects
3. Find any projects that might be duplicates:
   - Another `chem-irl` project (different URL)
   - A project named `web`
   - A project named `chem-irl-web`
   - Any project connected to the same GitHub repo: `NatoDoyle/chem-irl`

### 2. Verify the Correct Project Settings

Go to: https://vercel.com/nathans-projects-23715d38/chem-irl/settings/general

**Check these settings:**

- **Project Name**: `chem-irl` ✅
- **Root Directory**: Should be `.` or empty (NOT "web")
- **Framework Preset**: Next.js
- **Build Command**: Should be auto-detected (`npm run build`)
- **Output Directory**: Should be auto-detected (`out`)

### 3. Check Git Connection

Go to: https://vercel.com/nathans-projects-23715d38/chem-irl/settings/git

**Verify:**
- **Git Repository**: Should show `NatoDoyle/chem-irl`
- **Production Branch**: Should be `main`
- **Only ONE Git connection** should exist

### 4. Check Domains

Go to: https://vercel.com/nathans-projects-23715d38/chem-irl/settings/domains

**Verify:**
- `chemirl.app` is connected ✅
- `www.chemirl.app` redirects to `chemirl.app` ✅

### 5. Delete Any Duplicate Projects

If you find another project connected to the same repo:

1. Go to the duplicate project's settings
2. **Settings** → **General** → Scroll to bottom
3. Click **Delete Project**
4. Type the project name to confirm
5. Click **Delete**

## Common Duplicate Scenarios

### Scenario 1: Two Projects with Same Name
- One at: `nathans-projects-23715d38/chem-irl` ✅ (keep this)
- Another at: `nathans-projects-23715d38/chem-irl-xyz` ❌ (delete)

### Scenario 2: Project Named "web"
- If you see a project just named `web` connected to your repo, delete it
- The correct project is `chem-irl`

### Scenario 3: Multiple Git Connections
- If the same project has multiple Git connections, remove the duplicates
- Keep only the connection to `NatoDoyle/chem-irl` on `main` branch

## After Cleanup

Once you've deleted the duplicate:

1. **Verify only one project exists** for `NatoDoyle/chem-irl`
2. **Check the latest deployment** is successful
3. **Test the live site** at `https://chemirl.app`
4. **Monitor for 24 hours** to ensure no issues

## Need Help?

If you're still seeing two websites:
1. Check if one is a **Preview Deployment** (not a separate project)
2. Check if one is using a **different domain** (e.g., `.vercel.app` subdomain)
3. Check **Deployment History** to see if old deployments are still accessible

