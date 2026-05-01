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
//   { receipt: string,                    // platform-native receipt blob
//     platform: 'ios' | 'android',
//     productId: string,                  // expected: 'chem_plus_monthly'
//     originalTransactionId: string }     // idempotency key for renewals
//
// Response shape:
//   { success: true, status: SubStatus, current_period_ends_at: string,
//     trial_ends_at?: string }
//   | { success: false, error: string }
//
// PRODUCTION TODO:
// The current implementation TRUSTS the client's claims about the receipt.
// Before launch, this function MUST:
//   * On iOS:    verify the JWS receipt with the App Store Server API
//                (https://developer.apple.com/documentation/appstoreserverapi)
//                and read product/expiry/status from the verified payload.
//   * On Android: call the Google Play Developer API
//                (purchases.subscriptionsv2.get) to verify the purchaseToken
//                and read product/expiry/status from the response.
// Until then, the function is staging-only and the App Store / Play
// configuration should not advertise live products.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  // PLACEHOLDER VALIDATION
  // See PRODUCTION TODO at top. For now we assume the receipt is good and
  // derive a 30-day period from now. This is staging-only behaviour.
  const validation = await validateReceiptPlaceholder({
    receipt,
    platform,
    productId,
  });
  if (!validation.valid) {
    return jsonResponse({ error: 'receipt_invalid' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Upsert keyed on user_id (one subscription per user). We also stamp the
  // original_transaction_id for the unique idempotency index — replaying the
  // same receipt is a no-op except for last_validated_at.
  const { error: upsertErr } = await admin.from('subscriptions').upsert(
    {
      user_id: user.id,
      product_id: productId,
      status: validation.status,
      platform,
      original_transaction_id: originalTransactionId,
      trial_ends_at: validation.trialEndsAt,
      current_period_ends_at: validation.currentPeriodEndsAt,
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
      status: validation.status,
      current_period_ends_at: validation.currentPeriodEndsAt,
      trial_ends_at: validation.trialEndsAt,
    },
    200,
  );
});

// ============================================================================
// PLACEHOLDER receipt validation — replace before launch.
// ============================================================================

interface PlaceholderValidationInput {
  receipt: string;
  platform: 'ios' | 'android';
  productId: string;
}

interface PlaceholderValidationOutput {
  valid: boolean;
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string;
}

async function validateReceiptPlaceholder(
  _: PlaceholderValidationInput,
): Promise<PlaceholderValidationOutput> {
  // 30-day period from now. Mirrors the rough monthly cadence; the real
  // App Store / Play response will give us the actual `expiresDateMs`.
  const now = Date.now();
  const periodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    valid: true,
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
