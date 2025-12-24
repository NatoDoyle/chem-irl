# Quick Deployment & Testing Guide

## 🚀 Website Deployment (Vercel)

### Option 1: Vercel Dashboard (Easiest)

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New Project"**
3. **Import your GitHub repository** (or connect Git provider)
4. **Configure:**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `web`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `out` (auto-detected)
5. **Click "Deploy"**

✅ **Done!** Your site will be live at `your-project.vercel.app`

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd web
vercel

# Follow prompts:
# - Link to existing project or create new
# - Confirm settings
# - Deploy!
```

---

## 📱 Mobile App Testing

### Step 1: Set Up Environment

Create `mobile/.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

**Get Supabase credentials:**
1. Go to [supabase.com](https://supabase.com) → Your project
2. Settings → API
3. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Step 2: Install & Start

```bash
cd mobile
npm install
npm start
```

### Step 3: Test on Phone

1. **Install Expo Go** on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Scan QR code** from terminal
3. **App loads on your phone!**

### Step 4: Test Features

✅ **Auth**: Enter email → Check email → Click magic link → Logs in  
✅ **Onboarding**: Complete profile → Upload photos  
✅ **Discovery**: Swipe profiles → Like/pass  
✅ **Matches**: View matches → Create proposals  
✅ **Chat**: Send messages → Real-time updates  

---

## 🗄️ Database Setup (If Not Done)

Before testing, ensure database is set up:

1. Go to Supabase → SQL Editor
2. Run these files in order:
   - `db/schema.sql`
   - `db/rls.sql`
   - `db/kpi_views.sql`
   - `db/scoring.sql`

---

## ✅ Quick Test Checklist

### Website
- [ ] Landing page loads
- [ ] Download page works
- [ ] How it works page displays
- [ ] Mobile responsive

### Mobile App
- [ ] Auth flow works
- [ ] Profile setup works
- [ ] Discovery feed loads
- [ ] Swipe gestures work
- [ ] Matches appear
- [ ] Chat works

---

## 🐛 Troubleshooting

**Website won't deploy?**
- Check `web/next.config.ts` has `output: 'export'`
- Run `npm run build` locally first

**Mobile app won't connect?**
- Verify `.env` file exists in `mobile/` directory
- Check Supabase URL/key are correct
- Ensure Supabase project is active

**Magic link not working?**
- Test on physical device (not simulator)
- Check `scheme: "chemirl"` in `mobile/app.json`

---

## 📚 Full Documentation

- [Complete Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Main Documentation](./DOCUMENTATION.md)
- [Mobile README](./mobile/README.md)

