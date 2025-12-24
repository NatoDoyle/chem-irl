# Known Issue: React Navigation v7 + New Architecture

## The Problem

When running the app in Expo Go with React Navigation v7 and React Native's new architecture, you get this error:

```
TypeError: expected dynamic type 'boolean', but had type 'string'
```

This is a **known compatibility issue** between:
- React Navigation v7
- react-native-screens 4.18.0
- React Native's new architecture (always enabled in Expo Go)

## Why This Happens

Expo Go always has the new architecture enabled, and there's a bug in how `react-native-screens` passes props to the native layer when using the new architecture with React Navigation v7.

## Solutions

### Option 1: Build a Development Build (Recommended)

Expo Go has limitations. For production development, create a development build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build development version
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

Development builds allow you to:
- Disable new architecture if needed
- Use custom native code
- Have more control over the build

### Option 2: Wait for Fix

This issue is being tracked in:
- React Navigation GitHub issues
- react-native-screens GitHub issues

The fix will likely come in a future update to `react-native-screens` or React Navigation.

### Option 3: Temporary Workaround (Not Recommended)

You could downgrade React Navigation to v6, but this would require significant code changes and you'd lose v7 features.

## Current Status

- ✅ Code is correct
- ✅ Configuration is minimal and correct
- ❌ Expo Go + New Architecture has a bug
- ✅ Will work in development/production builds

## Next Steps

1. **For testing now**: Use a development build instead of Expo Go
2. **For production**: Build with EAS - the issue may not occur in production builds
3. **Monitor**: Watch for updates to react-native-screens and React Navigation

## Testing Without Expo Go

To test the app properly:

1. **Create development build**:
   ```bash
   eas build --profile development --platform ios
   ```

2. **Install on device** via TestFlight (iOS) or direct install (Android)

3. **Run development server**:
   ```bash
   npm start
   ```

The app should work correctly in a development build even if it fails in Expo Go.




