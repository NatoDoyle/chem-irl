// Supabase Edge Function: validate-subscription
//
// Validates an auto-renewable subscription receipt (Apple / Google) and
// upserts the matching row in `subscriptions`. Mobile calls this on:
//   • initial purchase
//   • restore-purchases
//   • renewal events surfaced to the client (StoreKit / Play Billing)
//
// This is INTENTIONALLY separate from `validate-receipt` (which handles
// consumable token packs) because subscription receipts have different
// lifecycle semantics: renewals, grace periods, refunds, re-issued
// transaction IDs. Splitting them keeps each function single-purpose.
//
// Auth: standard JWT (verify_jwt = true, the default).
//
// Body shape:
//   { receipt: string,                    // iOS: StoreKit 2 JWS; Android: purchaseToken
//     platform: 'ios' | 'android',
//     productId: string,                  // expected: 'chem_plus_monthly'
//     originalTransactionId: string }     // client claim — used ONLY on the
//                                         // staging path; verified paths derive
//                                         // the real id from the store response
//
// Response shape:
//   { success: true, status: SubStatus, current_period_ends_at: string,
//     trial_ends_at?: string }
//   | { success: false, error: string }
//
// Verification paths, in priority order (mirrors validate-receipt):
//   1. Store credentials configured → real verification via
//      _shared/store-verify.ts. iOS derives originalTransactionId from the
//      VERIFIED transaction (a client-claimed id could otherwise inherit
//      someone else's entitlement) and reads status from Apple's
//      subscription-statuses endpoint (prod host, sandbox fallback).
//      Android verifies via purchases.subscriptionsv2 (token-keyed; the
//      productId comes from Google's lineItems). This path IGNORES
//      STAGING_TRUST_RECEIPTS entirely.
//   2. No credentials + STAGING_TRUST_RECEIPTS=true → staging-only
//      placeholder (trusts the client; 30-day active period).
//   3. Otherwise → 503 fail-closed (unchanged behaviour since F7 review).
//
// Required secrets for path 1: APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID,
// APPLE_IAP_PRIVATE_KEY, GOOGLE_PLAY_SERVICE_ACCOUNT.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  appleVerifySubscription,
  googleVerifySubscription,
  isAppleConfigured,
  isGoogleConfigured,
  type VerifiedSubscription,
} from '../_shared/store-verify.ts';

const EXPECTED_PRODUCT_ID = 'chem_plus_monthly';

type SubStatus = 'trialing' | 'active' | 'grace_period' | 'expired' | 'cancelled';

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('validate-subscription: missing supabase env');
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  // Authenticate the calling user
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // Parse + validate body
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const receipt = typeof body.receipt === 'string' ? body.receipt : '';
  const platform = body.platform;
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const originalTransactionId =
    typeof body.originalTransactionId === 'string' ? body.originalTransactionId : '';

  if (!receipt || (platform !== 'ios' && platform !== 'android')) {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }
  if (productId !== EXPECTED_PRODUCT_ID) {
    return jsonResponse({ error: 'unknown_product' }, 400);
  }
  if (!originalTransactionId) {
    return jsonResponse({ error: 'missing_original_transaction_id' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // --- Path 1: real store-side verification --------------------------------
  const configured = platform === 'ios' ? isAppleConfigured() : isGoogleConfigured();
  if (configured) {
    const result =
      platform === 'ios'
        ? await appleVerifySubscription(receipt, EXPECTED_PRODUCT_ID)
        : await googleVerifySubscription(receipt, EXPECTED_PRODUCT_ID);

    if (!result.ok) {
      console.error('validate-subscription: store verification failed', result);
      return result.reason === 'invalid_receipt'
        ? jsonResponse({ error: 'receipt_invalid', detail: result.detail }, 400)
        : jsonResponse({ error: 'store_verification_failed' }, 502);
    }

    return upsertAndRespond(admin, user.id, platform, result.sub);
  }

  // --- Path 2: staging-only trusting fallback (no store creds present) -----
  const trustStaging = Deno.env.get('STAGING_TRUST_RECEIPTS') === 'true';
  if (!trustStaging) {
    // --- Path 3: fail closed -----------------------------------------------
    console.error(
      'validate-subscription: refusing to validate — store credentials not ' +
        'configured (APPLE_IAP_* / GOOGLE_PLAY_SERVICE_ACCOUNT) and ' +
        'STAGING_TRUST_RECEIPTS is not enabled.',
    );
    return jsonResponse(
      {
        error: 'receipt_validation_unavailable',
        detail:
          'Store-side subscription verification is not configured for this ' +
          'platform. Set the APPLE_IAP_* / GOOGLE_PLAY_SERVICE_ACCOUNT secrets ' +
          '(production) or STAGING_TRUST_RECEIPTS=true (staging only).',
      },
      503,
    );
  }
  console.warn(
    'validate-subscription: STAGING_TRUST_RECEIPTS=true; trusting receipt ' +
      'without store-side verification (staging only)',
  );

  const placeholder = placeholderSubscription();
  return upsertAndRespond(admin, user.id, platform, {
    status: placeholder.status,
    currentPeriodEndsAt: placeholder.currentPeriodEndsAt,
    trialEndsAt: placeholder.trialEndsAt,
    originalTransactionId,
    productId: EXPECTED_PRODUCT_ID,
    environment: 'staging-trusted',
  });
});

// ============================================================================
// Shared upsert + response
// ============================================================================

async function upsertAndRespond(
  admin: ReturnType<typeof createClient>,
  userId: string,
  platform: 'ios' | 'android',
  sub: VerifiedSubscription,
): Promise<Response> {
  // Upsert keyed on user_id (one subscription per user). The verified
  // original_transaction_id also feeds the unique idempotency index —
  // replaying the same receipt is a no-op except for last_validated_at.
  const { error: upsertErr } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      product_id: sub.productId,
      status: sub.status,
      platform,
      original_transaction_id: sub.originalTransactionId,
      trial_ends_at: sub.trialEndsAt,
      current_period_ends_at: sub.currentPeriodEndsAt,
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (upsertErr) {
    console.error('validate-subscription: upsert failed', upsertErr);
    return jsonResponse({ error: 'upsert_failed' }, 500);
  }

  return jsonResponse(
    {
      success: true,
      status: sub.status,
      current_period_ends_at: sub.currentPeriodEndsAt,
      trial_ends_at: sub.trialEndsAt,
    },
    200,
  );
}

// ============================================================================
// STAGING-ONLY placeholder — never reachable once store creds are configured.
// ============================================================================

function placeholderSubscription(): {
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string;
} {
  // 30-day period from now. Mirrors the rough monthly cadence; the real
  // App Store / Play response gives the actual expiry on path 1.
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    status: 'active',
    trialEndsAt: null,
    currentPeriodEndsAt: periodEnd,
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
