'use client';

import { useEffect } from 'react';
import { captureUtmParams } from '@/lib/utm';

/**
 * Mounted once in the root layout (like SentryInit). Persists utm_* from the
 * landing URL into sessionStorage so attribution survives the `/` → `/download`
 * hop and is available to WaitlistForm at submit time. Renders nothing.
 */
export function UtmCapture() {
  useEffect(() => {
    captureUtmParams();
  }, []);
  return null;
}
