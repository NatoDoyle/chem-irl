# Quick Start - Test the App

## Step 1: Create .env File

Create a file named `.env` in the `mobile/` directory with:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_publishable_key_here
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

**Get your Supabase credentials:**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → API
4. Copy Project URL and anon public key

## Step 2: Start the App

```bash
cd mobile
npm start
```

This will:

- Start the Expo dev server
- Show a QR code
- Open Expo Go on your phone and scan the QR code

## Step 3: Test on Your Phone

1. **Install Expo Go**:
   - iOS: https://apps.apple.com/app/expo-go/id982107779
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

2. **Scan the QR code** from the terminal
3. **The app will load** on your phone!

## What to Test

- ✅ App loads without errors
- ✅ Welcome screen appears
- ✅ Can enter email and request magic link
- ✅ Magic link email arrives
- ✅ Clicking link opens app and logs you in
- ✅ Discovery feed loads (if logged in)
- ✅ Can see profile cards

## Troubleshooting

**App won't start?**

- Make sure `.env` file exists
- Restart Expo: Press `r` in terminal or restart `npm start`

**Can't connect to Supabase?**

- Check `.env` has correct values
- Verify Supabase project is active
- Check internet connection

**Deep linking not working?**

- Test on physical device (not simulator)
- Check Supabase Auth redirect URLs include `chemirl://auth/callback`
