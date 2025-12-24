# Vercel Auto-Deploy Not Working - Troubleshooting

## Problem
Pushing to GitHub doesn't trigger Vercel deployment.

## Common Causes & Solutions

### 1. Vercel Project Not Connected to GitHub

**Check:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Look for your project
3. If no project exists, you need to connect it

**Fix:**
1. Click "Add New Project"
2. Import your GitHub repository
3. **IMPORTANT**: Set **Root Directory** to `web`
4. Configure:
   - Framework: Next.js (or Other)
   - Build Command: `npm run build`
   - Output Directory: `out`
5. Click "Deploy"

### 2. Wrong Root Directory

**Check:**
1. Vercel Dashboard → Your Project → Settings → General
2. Look for "Root Directory"
3. Should be: `web` (not empty or `/`)

**Fix:**
1. Settings → General → Root Directory
2. Change to: `web`
3. Save
4. Redeploy

### 3. GitHub Webhook Not Active

**Check:**
1. Vercel Dashboard → Your Project → Settings → Git
2. Check if GitHub repo is connected
3. Check if branch is set correctly (usually `main` or `master`)

**Fix:**
1. If not connected: Click "Connect Git Repository"
2. Select your GitHub repo
3. Set branch to `main` (or `master`)
4. Save

### 4. Wrong Branch

**Check:**
1. What branch are you pushing to?
2. Vercel Settings → Git → Production Branch
3. Should match your default branch

**Fix:**
- Push to the branch Vercel is watching (usually `main` or `master`)
- Or update Vercel to watch your branch

### 5. Manual Deploy First

If auto-deploy isn't working, try manual deploy:

**Option A: Vercel Dashboard**
1. Go to Deployments tab
2. Click "Create Deployment"
3. Select branch: `main` (or your branch)
4. Click "Deploy"

**Option B: Vercel CLI**
```bash
cd web
vercel login
vercel --prod
```

## Step-by-Step Setup (If Starting Fresh)

### 1. Connect GitHub to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New Project"
4. Select your repository

### 2. Configure Project Settings
- **Root Directory**: `web` ⚠️ **CRITICAL**
- **Framework Preset**: Next.js (or Other)
- **Build Command**: `npm run build`
- **Output Directory**: `out`
- **Install Command**: `npm install`

### 3. Set Production Branch
- **Production Branch**: `main` (or `master` - whatever your default is)

### 4. Deploy
- Click "Deploy"
- Wait for build to complete
- Check deployment URL

### 5. Verify Auto-Deploy
- Make a small change
- Push to GitHub
- Check Vercel Dashboard → Deployments
- Should see new deployment starting automatically

## Quick Diagnostic Commands

Check if Vercel CLI is linked:
```bash
cd web
vercel ls
```

Check project info:
```bash
cd web
vercel inspect
```

Link project manually:
```bash
cd web
vercel link
```

## Alternative: Deploy via CLI

If GitHub integration isn't working, use CLI:

```bash
cd web
vercel login
vercel --prod
```

This will:
1. Ask you to link to existing project or create new
2. Deploy directly
3. Give you a deployment URL

## Check Current Status

1. **Vercel Dashboard**: [vercel.com/dashboard](https://vercel.com/dashboard)
   - Do you see your project?
   - Are there any deployments?

2. **GitHub Repository**
   - Is it public or private?
   - Is it the correct repo?

3. **Vercel Project Settings**
   - Root Directory: `web`?
   - Git connected?
   - Production branch set?

## Still Not Working?

1. Check Vercel status: [status.vercel.com](https://status.vercel.com)
2. Check GitHub webhooks: GitHub repo → Settings → Webhooks
3. Contact Vercel support with:
   - Project name
   - Repository URL
   - Error messages (if any)


