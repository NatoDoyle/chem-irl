import { registerRootComponent } from 'expo';
import App from './App';
import { scrubSentryPayload } from './src/lib/sentry-scrubber';

// Initialize Sentry if DSN is provided (optional)
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const isProduction = process.env.EXPO_PUBLIC_ENVIRONMENT === 'production';
if (sentryDsn) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
      // 0.2 in prod keeps performance event volume well inside the free
      // Sentry quota under realistic usage; 1.0 in dev is harmless because
      // `enabled` is false there anyway.
      tracesSampleRate: isProduction ? 0.2 : 1.0,
      enabled: isProduction,
      // PII scrubber: drops chat bodies / emails / phones / photo URLs out
      // of every event and breadcrumb. Identical rules on the edge side.
      beforeSend: (event: unknown) => scrubSentryPayload(event),
      beforeBreadcrumb: (breadcrumb: unknown) => scrubSentryPayload(breadcrumb),
    });

    // Capture unhandled promise rejections
    // Note: React Native already logs these, Sentry will capture them too
  } catch (error) {
    // Sentry not available or initialization failed - app continues without error logging
    console.warn('Sentry initialization failed:', error);
  }
} else if (isProduction) {
  // Loud signal in TestFlight / EAS production builds when DSN is missing —
  // production crashes won't reach Sentry without it.
  console.warn(
    '[observability] EXPO_PUBLIC_SENTRY_DSN is not set in a production build. ' +
      'Errors will not be reported. Set it via EAS secrets or .env.production.'
  );
}

registerRootComponent(App);
