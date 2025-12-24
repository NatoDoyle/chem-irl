# Deployment Guide - Chem IRL

Quick guide to deploy and test the website and mobile app.

## Prerequisites

### Website Deployment
- Vercel account (free tier works)
- Vercel CLI installed: `npm i -g vercel`

### Mobile App Testing
- Node.js installed
- Expo Go app on your phone (iOS/Android)
- Supabase project with environment variables

---

## 1. Website Deployment (Vercel)

### Option A: Vercel CLI (Quick)

```bash
cd web
vercel
```

Follow the prompts:
- Link to existing project or create new
- Confirm settings (should auto-detect Next.js)
- Deploy!

### Option B: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set root directory to `web`
4. Vercel will auto-detect Next.js static export
5. Deploy!

### Verify Deployment

After deployment, visit your Vercel URL and check:
- ✅ Landing page (`/`)
- ✅ Download page (`/download`)
- ✅ How it works page (`/how-it-works`)

---

## 2. Mobile App Testing

### Step 1: Set Up Environment Variables

Create `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

**Get Supabase credentials:**
1. Go to your Supabase project dashboard
2. Settings → API
3. Copy "Project URL" → `EXPO_PUBLIC_SUPABASE_URL`
4. Copy "anon public" key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Step 2: Install Dependencies

```bash
cd mobile
npm install
```

### Step 3: Start Development Server

```bash
npm start
```

This will:
- Start Expo dev server
- Show QR code in terminal
- Open Expo DevTools in browser

### Step 4: Test on Your Phone

**Option A: Expo Go (Recommended for Testing)**
1. Install "Expo Go" app on your phone (iOS/Android)
2. Scan QR code from terminal
3. App will load on your phone

**Option B: iOS Simulator (macOS only)**
```bash
npm run ios
```

**Option C: Android Emulator**
```bash
npm run android
```

### Step 5: Test Core Features

1. **Auth Flow**
   - Enter email on welcome screen
   - Check email for magic link
   - Click link → should open app and log in

2. **Onboarding**
   - Complete profile (headline, bio)
   - Upload photos

3. **Discovery**
   - Swipe through profiles
   - Like/pass users
   - Check for matches

4. **Matches**
   - View matches list
   - Open match detail
   - Create proposal

5. **Chat**
   - Send messages
   - Verify real-time updates

---

## 3. Production Build (Mobile App)

### Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### Configure EAS

```bash
cd mobile
eas build:configure
```

This creates `eas.json` with build profiles.

### Build for iOS

```bash
eas build --platform ios
```

**Requirements:**
- macOS
- Apple Developer account ($99/year)
- Xcode installed

### Build for Android

```bash
eas build --platform android
```

**Requirements:**
- Google Play Developer account ($25 one-time)

### Submit to Stores

```bash
# iOS
eas submit --platform ios

# Android
eas submit --platform android
```

---

## 4. Database Setup

Before testing, ensure database is set up:

1. Go to Supabase SQL Editor
2. Run migrations in order:
   - `db/schema.sql`
   - `db/rls.sql`
   - `db/kpi_views.sql`
   - `db/scoring.sql`

See `web/DATABASE_SETUP.md` for details.

---

## 5. Testing Checklist

### Website
- [ ] Landing page loads
- [ ] Download page works
- [ ] How it works page displays
- [ ] All links work
- [ ] Mobile responsive

### Mobile App
- [ ] Auth flow (magic link)
- [ ] Profile setup
- [ ] Photo upload
- [ ] Discovery feed loads
- [ ] Swipe gestures work
- [ ] Like/pass actions
- [ ] Match detection
- [ ] Matches list
- [ ] Match detail
- [ ] Proposal creation
- [ ] Proposal confirmation
- [ ] Chat messages
- [ ] Real-time updates

---

## Troubleshooting

### Website Build Fails
- Check `web/next.config.ts` has `output: 'export'`
- Ensure no API routes exist
- Run `npm run build` locally first

### Mobile App Won't Connect
- Verify `.env` file exists in `mobile/` directory
- Check Supabase URL and key are correct
- Ensure Supabase project is active
- Check network connection

### Magic Link Not Working
- Verify `scheme: "chemirl"` in `mobile/app.json`
- Check deep linking is configured
- Test on physical device (simulators may have issues)

### Database Errors
- Verify RLS policies are set up
- Check user has proper permissions
- Review Supabase logs

---

## Next Steps

After successful deployment and testing:

1. **Website**: Set up custom domain in Vercel
2. **Mobile**: Submit to app stores
3. **Analytics**: Set up PostHog/Sentry
4. **Monitoring**: Configure error tracking

---

## Support

- [Documentation](./DOCUMENTATION.md) - Full technical docs
- [Mobile README](./mobile/README.md) - Mobile app details
- [Web README](./web/README.md) - Website details

