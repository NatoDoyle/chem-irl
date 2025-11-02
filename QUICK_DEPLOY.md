# Quick Deploy to Vercel - Chem IRL

## Method 1: Deploy from GitHub (Recommended)

### Step 1: Push to GitHub
```bash
# In the web directory
git init
git add .
git commit -m "Initial commit: Chem IRL MVP"
git branch -M main
git remote add origin https://github.com/yourusername/chem-irl.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your `chem-irl` repository
5. Framework: Next.js (auto-detected)
6. Root Directory: `web` (if repo is in parent folder)
7. Click "Deploy"

## Method 2: Deploy with Vercel CLI

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
# In the web directory
vercel
# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? chem-irl
# - Directory? ./
# - Override settings? No
```

### Step 3: Add Custom Domain
```bash
vercel domains add chemirl.app
vercel domains add www.chemirl.app
```

## Method 3: Drag & Drop (Easiest)

### Step 1: Create Build
```bash
# In the web directory
npm run build
# This creates a .next folder
```

### Step 2: Deploy
1. Go to [vercel.com](https://vercel.com)
2. Drag the entire `web` folder to the deployment area
3. Vercel will auto-detect Next.js and deploy

## Environment Variables

After deployment, add these in Vercel Dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_APP_NAME=Chem IRL
NEXT_PUBLIC_DOMAIN=chemirl.app
NEXT_PUBLIC_APP_URL=https://chemirl.app
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
POSTMARK_API_TOKEN=your_postmark_token
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

## Custom Domain Setup

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
Proxy: ✅

Type: A
Name: @
Target: 76.76.19.61
Proxy: ✅
```

## After Deployment

1. **Test the site**: Visit your Vercel URL
2. **Add domain**: Configure custom domain
3. **Set up services**: Supabase, Stripe, PostHog
4. **Test functionality**: All features working

## Troubleshooting

### Build Errors
- Check `npm run build` locally first
- Ensure all dependencies are installed
- Check for TypeScript errors

### Domain Issues
- Wait 24-48 hours for DNS propagation
- Check Cloudflare proxy settings
- Verify DNS records in Cloudflare

### Environment Variables
- Ensure all required vars are set
- Check variable names match exactly
- Redeploy after adding new variables




