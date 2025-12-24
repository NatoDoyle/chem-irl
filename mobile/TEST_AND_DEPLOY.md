# Mobile App Testing & Deployment Guide

## Step 1: Set Up Environment Variables

### Create `.env` file

Create a `.env` file in the `mobile/` directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

### Get Supabase Credentials

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Step 2: Install Dependencies

```bash
cd mobile
npm install
```

## Step 3: Test Locally with Expo Go

### Option A: Test on Your Phone (Recommended)

1. **Install Expo Go** on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the dev server**:
   ```bash
   cd mobile
   npm start
   ```

3. **Scan the QR code**:
   - iOS: Use Camera app to scan QR code
   - Android: Use Expo Go app to scan QR code

4. **The app will load** on your phone!

### Option B: Test in Simulator/Emulator

**iOS (requires macOS):**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

**Web (for quick testing):**
```bash
npm run web
```

## Step 4: Test Core Features

Once the app loads, test:

### ✅ Auth Flow
- [ ] Welcome screen displays
- [ ] Can enter email on login screen
- [ ] Magic link email is sent
- [ ] Can open magic link (deep linking works)
- [ ] User is logged in after clicking link

### ✅ Onboarding
- [ ] Profile setup screen appears for new users
- [ ] Can enter headline and bio
- [ ] Can upload photos
- [ ] Photos save to Supabase Storage

### ✅ Main App
- [ ] Discovery feed loads
- [ ] Can see profile cards
- [ ] Can swipe/like profiles
- [ ] Matches screen shows matches
- [ ] Can view match details
- [ ] Can create proposals
- [ ] Chat screen loads for matches

## Step 5: Build for Production

### Prerequisites

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Configure EAS** (first time only):
   ```bash
   eas build:configure
   ```

### Build for iOS

```bash
eas build --platform ios
```

**Requirements:**
- Apple Developer account ($99/year)
- macOS (for local builds) or use EAS cloud builds

### Build for Android

```bash
eas build --platform android
```

**Requirements:**
- Google Play Developer account ($25 one-time)

### Build for Both

```bash
eas build --platform all
```

## Step 6: Submit to App Stores

### iOS (App Store)

```bash
eas submit --platform ios
```

**Requirements:**
- App Store Connect account
- App Store review process (1-3 days typically)

### Android (Google Play)

```bash
eas submit --platform android
```

**Requirements:**
- Google Play Console account
- Play Store review process (few hours to 1 day typically)

## Troubleshooting

### App Won't Connect to Supabase

- ✅ Check `.env` file exists and has correct values
- ✅ Restart Expo dev server after creating `.env`
- ✅ Verify Supabase URL and key are correct
- ✅ Check Supabase project is active

### Deep Linking Not Working

- ✅ Verify `scheme: "chemirl"` in `app.json`
- ✅ Check Supabase Auth redirect URLs include `chemirl://auth/callback`
- ✅ Test on physical device (simulators may have issues)

### Build Fails

- ✅ Check all environment variables are set
- ✅ Verify `app.json` configuration is correct
- ✅ Check EAS build logs for specific errors
- ✅ Ensure you're logged into EAS: `eas whoami`

### Photos Not Uploading

- ✅ Check Supabase Storage bucket exists
- ✅ Verify RLS policies allow uploads
- ✅ Check file size limits
- ✅ Verify image picker permissions

## Quick Test Checklist

Before deploying, verify:

- [ ] Environment variables set
- [ ] App starts without errors
- [ ] Can login with magic link
- [ ] Discovery feed loads
- [ ] Can like/pass profiles
- [ ] Matches appear
- [ ] Can create proposals
- [ ] Chat works
- [ ] Photos upload successfully

## Next Steps After Testing

1. **Fix any bugs** found during testing
2. **Test on multiple devices** (iOS and Android)
3. **Test with real users** (beta testing)
4. **Build production versions**
5. **Submit to app stores**




