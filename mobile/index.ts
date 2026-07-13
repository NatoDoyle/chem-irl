import { registerRootComponent } from 'expo';
import App from './App';

// No crash-SDK init here on purpose: Bronto is the sole telemetry
// platform (2026-07-10) and the inert Sentry init was removed 2026-07-13.
// Client errors reach Bronto via lib/clientErrorEvents.ts; native hard
// crashes are an accepted pre-launch gap (documented in
// docs/infrastructure/BRONTO_APP_OBSERVABILITY.md §3).

registerRootComponent(App);
