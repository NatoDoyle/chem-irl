'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/react';

// Browser-only Sentry init. Mounts once at the root layout. No-ops when
// NEXT_PUBLIC_SENTRY_DSN is unset (so dev/preview builds without DSN
// don't ship telemetry); only enabled in production-environment Vercel
// deployments. The tree-shaker keeps Sentry's footprint when the DSN
// env is bundled at build time.

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function SentryInit() {
  useEffect(() => {
    if (!SENTRY_DSN) return;
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
      enabled: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
      tracesSampleRate: 0.1,
    });
  }, []);

  return null;
}
