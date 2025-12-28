/**
 * Analytics utilities for tracking user actions
 *
 * Provides a simple analytics interface that can be extended with
 * PostHog, Mixpanel, or other analytics SDKs in the future.
 * Currently logs to console in development, can be extended to
 * send to analytics service in production.
 */

// Lazy import analytics SDK if configured (e.g., PostHog, Mixpanel)
// For now, we'll use a simple interface that can be extended

export type AnalyticsEvent =
  | 'user_signed_up'
  | 'user_signed_in'
  | 'signup_completed'
  | 'phone_verified'
  | 'profile_completed'
  | 'like_sent'
  | 'match_created'
  | 'proposal_sent'
  | 'proposal_confirmed'
  | 'message_sent'
  | 'photo_uploaded'
  | 'photo_deleted'
  | 'profile_updated';

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

let analyticsEnabled = false;

/**
 * Initialize analytics (can be extended to initialize SDK)
 */
export function initAnalytics(): void {
  // In production, initialize analytics SDK here
  // For now, just enable logging
  analyticsEnabled = process.env.EXPO_PUBLIC_ENVIRONMENT === 'production';
}

/**
 * Track an analytics event
 */
export function trackEvent(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  if (__DEV__) {
    // Log to console in development
    console.log('[Analytics]', event, properties || {});
  }

  // In production, send to analytics service
  if (analyticsEnabled) {
    // TODO: Send to analytics SDK (PostHog, Mixpanel, etc.)
    // Example:
    // posthog.capture(event, properties);
  }
}

/**
 * Identify a user (set user properties)
 */
export function identifyUser(userId: string, properties?: AnalyticsProperties): void {
  if (__DEV__) {
    console.log('[Analytics] Identify user:', userId, properties || {});
  }

  if (analyticsEnabled) {
    // TODO: Identify user in analytics SDK
    // Example:
    // posthog.identify(userId, properties);
  }
}

/**
 * Reset user identity (on logout)
 */
export function resetUser(): void {
  if (__DEV__) {
    console.log('[Analytics] Reset user');
  }

  if (analyticsEnabled) {
    // TODO: Reset user in analytics SDK
    // Example:
    // posthog.reset();
  }
}
