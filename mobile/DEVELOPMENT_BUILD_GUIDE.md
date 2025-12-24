# Development Build Setup Guide

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

You'll be prompted to:
- Create an Expo account (if you don't have one)
- Or login with existing account

## Step 3: Configure EAS Build

EAS will create an `eas.json` file automatically, or you can create it manually.

## Step 4: Build Development Version

### For iOS:
```bash
eas build --profile development --platform ios
```

### For Android:
```bash
eas build --profile development --platform android
```

### For Both:
```bash
eas build --profile development --platform all
```

## Step 5: Install on Device

### iOS:
- Build will be uploaded to EAS
- You'll get a link to install via TestFlight (if configured) or direct download
- Install the `.ipa` file on your iPhone

### Android:
- Build will be uploaded to EAS
- You'll get a download link for the `.apk` file
- Install the `.apk` on your Android device

## Step 6: Run Development Server

After installing the development build:

```bash
cd mobile
npm start
```

The development build will connect to your Metro bundler just like Expo Go, but without the new architecture limitations.

## What's Different from Expo Go?

✅ **Development builds**:
- Can disable new architecture (if needed)
- Support custom native code
- More control over build configuration
- Fix the React Navigation v7 compatibility issue

❌ **Expo Go**:
- Always has new architecture enabled
- Limited to Expo SDK modules
- Has the boolean/string type bug we encountered

## Troubleshooting

**Build fails?**
- Check your Expo account is logged in: `eas whoami`
- Verify app.json configuration is correct
- Check build logs in EAS dashboard

**Can't install on device?**
- iOS: May need to trust developer certificate in Settings
- Android: Enable "Install from unknown sources"

**App won't connect to Metro?**
- Ensure phone and computer are on same network
- Check Metro is running: `npm start`
- Try tunnel mode: `npx expo start --tunnel`




