/**
 * Analytics utilities for tracking user actions.
 *
 * Decision D1: behavioural analytics are stored Supabase-native (our own
 * EU Postgres `analytics_events` table) rather than a third-party SDK, to
 * minimise processor/transfer surface. trackEvent logs to console in dev
 * and writes to the table in production (fire-and-forget).
 */

import { Platform } from 'react-native';
import { supabase } from './supabase/client';

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
  | 'profile_updated'
  | 'onboarding_completed'
  | 'onboarding_age_completed'
  | 'onboarding_gender_completed'
  | 'onboarding_orientation_completed'
  | 'onboarding_height_completed'
  | 'onboarding_languages_completed'
  | 'onboarding_relationship_intent_completed'
  | 'onboarding_family_plans_completed'
  | 'onboarding_pets_completed'
  | 'onboarding_lifestyle_completed'
  | 'onboarding_interests_completed'
  | 'onboarding_love_language_completed'
  | 'onboarding_personality_type_completed'
  | 'onboarding_astrology_completed'
  | 'onboarding_work_education_completed'
  | 'onboarding_location_permission_completed'
  // Iris AI concierge events. Surface and reason are passed as
  // properties (e.g. {surface: 'interview'}, {reason: 'never_subscribed'}).
  | 'iris_session_started'
  | 'iris_session_completed'
  | 'iris_draft_used'
  | 'iris_draft_dismissed'
  | 'iris_paywall_shown'
  | 'iris_paywall_dismissed'
  | 'iris_trial_started'
  | 'iris_subscription_purchased'
  // Photo safety + identity verification events. Fired both during
  // onboarding and from the profile edit flow.
  | 'photo_safety_scanned'
  | 'photo_match_checked'
  | 'verification_started'
  | 'verification_completed'
  | 'verification_blocked'
  | 'verification_review_required'
  | 'verification_retry'
  // Account lifecycle
  | 'account_deleted'
  // Safety: block / unblock / report
  | 'user_blocked'
  | 'user_unblocked'
  | 'report_submitted';

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Track an analytics event. In development this logs to the console only
 * (so dev activity never pollutes the events table). In production it
 * writes to `analytics_events` fire-and-forget — analytics must never
 * block or break a user flow.
 */
export function trackEvent(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  if (__DEV__) {
    console.log('[Analytics]', event, properties || {});
    return;
  }
  void recordEvent(event, properties);
}

/**
 * Write a single event to the Supabase-native `analytics_events` table for
 * the currently authenticated user. No-ops when there is no session (we
 * only record authenticated events) and swallows all errors. Exposed
 * separately from trackEvent so the write can be awaited in tests.
 */
export async function recordEvent(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    await supabase.from('analytics_events').insert({
      user_id: userId,
      event,
      properties: properties ?? {},
      platform: Platform.OS,
    });
  } catch {
    // Analytics must never break a user flow.
  }
}

/**
 * Identify a user. Retained for call-site compatibility; under the
 * Supabase-native model each event already carries user_id, so there is no
 * separate identity to set. Logs in dev for traceability.
 */
export function identifyUser(userId: string, properties?: AnalyticsProperties): void {
  if (__DEV__) {
    console.log('[Analytics] Identify user:', userId, properties || {});
  }
}

/**
 * Reset analytics identity on logout. No-op under the Supabase-native model
 * (identity is per-event user_id). Logs in dev for traceability.
 */
export function resetUser(): void {
  if (__DEV__) {
    console.log('[Analytics] Reset user');
  }
}
