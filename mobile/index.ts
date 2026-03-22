import { registerRootComponent } from 'expo';
import App from './App';

// Initialize Sentry if DSN is provided (optional)
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
      tracesSampleRate: 1.0, // Adjust in production
      // Only enable in production environment (disable in development to avoid noise)
      enabled: process.env.EXPO_PUBLIC_ENVIRONMENT === 'production',
    });

    // Capture unhandled promise rejections
    // Note: React Native already logs these, Sentry will capture them too
  } catch (error) {
    // Sentry not available or initialization failed - app continues without error logging
    console.warn('Sentry initialization failed:', error);
  }
}

registerRootComponent(App);
