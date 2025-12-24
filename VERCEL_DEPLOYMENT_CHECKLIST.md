# Vercel Deployment Checklist

## ✅ Pre-Deployment Checks

1. **Local Build Works**
   ```bash
   cd web
   npm run build
   ```
   ✅ Should create `out/` directory with HTML files

2. **Configuration Files**
   - ✅ `next.config.ts` has `output: 'export'`
   - ✅ `vercel.json` has `outputDirectory: "out"`
   - ✅ No API routes in `src/app/api/`

## 🔧 Vercel Dashboard Settings

Go to: **Vercel Dashboard → Your Project → Settings**

### General Settings
- **Framework Preset**: `Next.js` (or `Other` for static)
- **Root Directory**: `web` ⚠️ **IMPORTANT**
- **Build Command**: `npm run build` (or leave empty)
- **Output Directory**: `out` ⚠️ **IMPORTANT**
- **Install Command**: `npm install` (or leave empty)

### Git Settings
- **Production Branch**: `main` (or `master`)
- **Auto-deploy**: Enabled ✅

## 🚀 Deployment Methods

### Method 1: GitHub Auto-Deploy (Recommended)
1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Deploy static marketing site"
   git push
   ```
2. Vercel automatically deploys
3. Check Vercel Dashboard → Deployments

### Method 2: Vercel CLI
```bash
cd web
vercel login
vercel --prod
```

### Method 3: Manual Deploy via Dashboard
1. Go to Vercel Dashboard → Your Project
2. Click "Deployments" tab
3. Click "Redeploy" on latest deployment
4. Or click "Create Deployment" → Select branch → Deploy

## 🐛 Troubleshooting

### Build Fails
1. **Check Build Logs**: Vercel Dashboard → Deployment → Build Logs
2. **Common Issues**:
   - Wrong root directory (should be `web`)
   - Missing dependencies
   - TypeScript errors
   - Environment variable issues

### Wrong Output Directory
- **Symptom**: Site shows 404 or blank page
- **Fix**: Ensure `outputDirectory: "out"` in `vercel.json` AND Vercel settings

### Static Export Not Detected
- **Symptom**: Vercel tries to run as server app
- **Fix**: 
  1. Remove `"framework": "nextjs"` from `vercel.json` (already done)
  2. Ensure `next.config.ts` has `output: 'export'`
  3. Set Framework Preset to "Other" in Vercel settings

### GitHub Not Connected
1. Go to Settings → Git
2. Click "Connect Git Repository"
3. Select your GitHub repo
4. Configure root directory: `web`

## ✅ Post-Deployment Verification

After deployment, check:
- [ ] Landing page loads: `https://your-project.vercel.app/`
- [ ] Download page works: `https://your-project.vercel.app/download`
- [ ] How it works page: `https://your-project.vercel.app/how-it-works`
- [ ] Mobile responsive
- [ ] All links work

## 📝 Quick Fixes

### If Deployment Fails
1. Check Vercel build logs for specific error
2. Run `npm run build` locally to reproduce
3. Fix local errors first
4. Push fix and redeploy

### If Site Shows 404
1. Check `outputDirectory` is `out` in both:
   - `vercel.json`
   - Vercel Dashboard settings
2. Verify `out/` directory exists after build
3. Check root directory is set to `web` in Vercel

### If Auto-Deploy Not Working
1. Check Git connection in Vercel Settings
2. Verify branch name matches (main vs master)
3. Check GitHub webhook is active
4. Try manual deploy via CLI or dashboard


