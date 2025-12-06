# Vercel Single Project Setup - chem-irl

## ✅ Correct Project Configuration

**Project URL**: https://vercel.com/nathans-projects-23715d38/chem-irl

## Settings to Verify

### 1. General Settings
**URL**: https://vercel.com/nathans-projects-23715d38/chem-irl/settings/general

- **Project Name**: `chem-irl`
- **Root Directory**: `.` or empty (repo root, NOT "web")
- **Framework Preset**: Next.js (auto-detected)
- **Build Command**: Auto-detected (`npm run build`)
- **Output Directory**: Auto-detected (`out` for static export)
- **Install Command**: Auto-detected (`npm install`)

### 2. Git Settings
**URL**: https://vercel.com/nathans-projects-23715d38/chem-irl/settings/git

- **Git Repository**: `NatoDoyle/chem-irl`
- **Production Branch**: `main`
- **Only ONE Git connection** should exist

### 3. Domains
**URL**: https://vercel.com/nathans-projects-23715d38/chem-irl/settings/domains

- ✅ `chemirl.app` (primary domain)
- ✅ `www.chemirl.app` (should redirect to `chemirl.app`)

### 4. Environment Variables
**URL**: https://vercel.com/nathans-projects-23715d38/chem-irl/settings/environment-variables

For a static marketing site, you may not need many environment variables, but if you have any:
- `NEXT_PUBLIC_APP_NAME` = `Chem IRL`
- `NEXT_PUBLIC_DOMAIN` = `chemirl.app`

## After Deleting the Duplicate

1. ✅ **Verify only one project** exists for `NatoDoyle/chem-irl`
2. ✅ **Check latest deployment** is successful
3. ✅ **Test live site** at `https://chemirl.app`
4. ✅ **Verify all pages work**:
   - `https://chemirl.app/` (home)
   - `https://chemirl.app/download` (download page)
   - `https://chemirl.app/how-it-works` (how it works)

## Current Code Configuration

Your code is correctly set up:

- ✅ `vercel.json` - No buildCommand/outputDirectory (auto-detected)
- ✅ `next.config.ts` - Static export configured
- ✅ `package.json` - Clean dependencies (no unused packages)
- ✅ Build works locally (`npm run build` succeeds)

## Monitoring

After cleanup, monitor:
- **Deployments**: Should only see deployments from the single project
- **Domains**: Only `chemirl.app` should be active
- **Builds**: Should all succeed with static export

## If Issues Persist

If you still see duplicate websites:
1. Check **Deployment History** - old deployments might still be cached
2. Clear browser cache
3. Check DNS settings in Cloudflare
4. Wait 5-10 minutes for DNS propagation

