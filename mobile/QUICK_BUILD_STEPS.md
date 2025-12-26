# Quick Development Build Steps

## 1. Login to Expo

```bash
cd mobile
eas login
```

You'll need to:

- Create an Expo account (free) at https://expo.dev
- Or login if you already have one

## 2. Configure Project (First Time Only)

```bash
eas build:configure
```

This will:

- Link your project to Expo
- Set up build configuration
- Ask a few questions (just accept defaults)

## 3. Build for Your Device

### iOS:

```bash
eas build --profile development --platform ios
```

### Android:

```bash
eas build --profile development --platform android
```

**Note**: First build takes 10-15 minutes. Subsequent builds are faster.

## 4. Install on Device

After build completes:

- **iOS**: Download `.ipa` file and install via TestFlight or direct install
- **Android**: Download `.apk` file and install on device

## 5. Run Development Server

```bash
npm start
```

The development build will connect to Metro just like Expo Go, but without the bugs!

## What You'll Get

- ✅ App that works without the new architecture bug
- ✅ Full access to all native features
- ✅ Can test all app functionality
- ✅ Same hot reload as Expo Go

## Build Time

- First build: ~10-15 minutes
- Subsequent builds: ~5-10 minutes
- Builds run in the cloud (no local setup needed)

## Cost

- **Free tier**: Unlimited development builds
- **Production builds**: Limited free builds per month
- No credit card required for development builds
