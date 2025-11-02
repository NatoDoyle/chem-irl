# GitHub + Vercel Setup for Chem IRL

## Prerequisites
- GitHub account
- Vercel account
- Git installed on your machine

## Step 1: Install Git (if not installed)

### Windows:
1. Download Git from https://git-scm.com/download/win
2. Install with default settings
3. Restart your terminal/command prompt

### Verify Installation:
```bash
git --version
```

## Step 2: Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click "New repository"
3. Repository name: `chem-irl`
4. Description: "Chem IRL - Dating app that optimizes time-to-date"
5. Set to **Public** (for free Vercel hosting)
6. **Don't** initialize with README (we already have files)
7. Click "Create repository"

## Step 3: Push Code to GitHub

### In your web directory:
```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Chem IRL MVP with Next.js, Supabase, Stripe"

# Add remote origin (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/chem-irl.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your `chem-irl` repository
5. Framework: Next.js (auto-detected)
6. Root Directory: `web` (since your Next.js app is in the web folder)
7. Click "Deploy"

## Step 5: Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

### Required Variables:
```
NEXT_PUBLIC_APP_NAME=Chem IRL
NEXT_PUBLIC_DOMAIN=chemirl.app
NEXT_PUBLIC_APP_URL=https://chemirl.app
```

### Supabase (Get from supabase.com):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Stripe (Get from stripe.com):
```
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### PostHog (Get from posthog.com):
```
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Email/SMS:
```
POSTMARK_API_TOKEN=your_postmark_token
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

## Step 6: Add Custom Domain

### In Vercel Dashboard:
1. Go to Project Settings → Domains
2. Add `chemirl.app`
3. Add `www.chemirl.app`
4. Copy the DNS instructions

### In Cloudflare Dashboard:
Add these DNS records:
```
Type: CNAME
Name: www
Target: cname.vercel-dns.com
Proxy: ✅ (orange cloud)

Type: A
Name: @
Target: 76.76.19.61
Proxy: ✅ (orange cloud)
```

## Step 7: Automatic Deployments

After setup, every push to GitHub will automatically deploy to Vercel:

```bash
# Make changes to your code
git add .
git commit -m "Update feature X"
git push origin main

# Vercel automatically builds and deploys!
```

## Project Structure for Vercel

Your repository should look like this:
```
chem-irl/
├── web/                 # Next.js app
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   └── ...
├── README.md
└── .gitignore
```

**Important**: Vercel needs to know the root directory is `web/`

## Vercel Configuration

The `vercel.json` file is already configured for optimal deployment:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next"
}
```

## Troubleshooting

### Build Errors
- Check the Vercel build logs
- Ensure all dependencies are in package.json
- Test locally with `npm run build`

### Domain Issues
- Wait 24-48 hours for DNS propagation
- Check Cloudflare proxy settings
- Verify DNS records match Vercel's instructions

### Environment Variables
- Ensure all required vars are set
- Check variable names match exactly
- Redeploy after adding new variables

## Benefits of GitHub + Vercel

1. **Automatic Deployments**: Push to GitHub = auto-deploy
2. **Version Control**: Track all changes
3. **Collaboration**: Easy to add team members
4. **Rollbacks**: Easy to revert to previous versions
5. **Preview Deployments**: Test changes before going live
6. **Free Hosting**: Vercel free tier is generous

## Next Steps After Deployment

1. **Set up Supabase** database
2. **Configure Stripe** payments
3. **Add PostHog** analytics
4. **Test the full user flow**
5. **Set up monitoring and alerts**

## Cost

- **GitHub**: Free (public repos)
- **Vercel**: Free tier (100GB bandwidth/month)
- **Total**: $0/month until you scale!

Your app will be live at `https://chemirl.app` and automatically stay running 24/7!



