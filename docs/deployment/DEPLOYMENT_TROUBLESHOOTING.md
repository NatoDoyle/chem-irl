# Deployment Troubleshooting Guide

## ✅ Configuration Check

Your configuration looks correct:
- ✅ `next.config.ts` has `output: 'export'`
- ✅ `vercel.json` has `outputDirectory: "out"`
- ✅ Build output exists in `web/out/`
- ✅ No API routes (removed for static export)

## Common Issues & Solutions

### Issue 1: Vercel Not Detecting Static Export

**Problem**: Vercel tries to run as a Next.js server app instead of static export.

**Solution**: Ensure Vercel project settings:
1. Go to Vercel Dashboard → Your Project → Settings
2. **General** → **Framework Preset**: Should be "Next.js"
3. **Build & Development Settings**:
   - **Root Directory**: `web`
   - **Build Command**: `bun run build` (or leave empty for auto-detect)
   - **Output Directory**: `out`
   - **Install Command**: `bun install`

### Issue 2: Build Fails on Vercel

**Check Vercel Build Logs**:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on failed deployment
3. Check build logs for errors

**Common Build Errors**:
- **Missing dependencies**: Ensure `package.json` has all dependencies
- **TypeScript errors**: Run `bun run build` locally first
- **Environment variables**: Add to Vercel project settings if needed

### Issue 3: Static Export Not Working

**Verify locally first**:
```bash
cd web
bun run build
# Check that out/ directory is created
ls out/
```

**If build fails locally**, fix those errors first before deploying.

### Issue 4: Vercel.json Configuration

For static exports, `vercel.json` might need adjustment. Try this minimal version:

```json
{
  "outputDirectory": "out",
  "buildCommand": "bun run build",
  "installCommand": "bun install"
}
```

The headers and redirects should still work, but if they cause issues, remove them temporarily.

### Issue 5: GitHub Integration Not Working

**Check**:
1. Vercel Dashboard → Your Project → Settings → Git
2. Ensure GitHub repo is connected
3. Check that branch is set correctly (usually `main` or `master`)

**Manual Deploy**:
If auto-deploy isn't working, you can manually trigger:
1. Vercel Dashboard → Your Project → Deployments
2. Click "Redeploy" on latest deployment
3. Or use CLI: `vercel --prod` (from `web/` directory)

## Step-by-Step Deployment Check

### 1. Verify Local Build
```bash
cd web
bun install
bun run build
```
✅ Should create `out/` directory with HTML files

### 2. Check Vercel Project Settings
- Root Directory: `web` ✓
- Framework: Next.js ✓
- Build Command: `bun run build` ✓
- Output Directory: `out` ✓

### 3. Check Git Connection
- Repository connected? ✓
- Branch set correctly? ✓
- Auto-deploy enabled? ✓

### 4. Manual Deploy (If Needed)
```bash
cd web
vercel --prod
```

## Quick Fix: Minimal vercel.json

If current `vercel.json` causes issues, try this minimal version:

```json
{
  "outputDirectory": "out"
}
```

Then add back headers/redirects one by one to identify the issue.

## Still Not Working?

1. **Check Vercel Build Logs**: Look for specific error messages
2. **Test Local Build**: Ensure `bun run build` works locally
3. **Check Vercel Status**: [status.vercel.com](https://status.vercel.com)
4. **Vercel Support**: Contact Vercel support with build logs

## Alternative: Deploy to Netlify

If Vercel continues to have issues, Netlify also supports static exports:

1. Go to [netlify.com](https://netlify.com)
2. Import GitHub repo
3. Settings:
   - Base directory: `web`
   - Build command: `bun run build`
   - Publish directory: `web/out`


