// Supabase Edge Function: Validate IAP Receipt (token packs — consumables)
//
// Receives the platform purchase token from mobile (iOS: StoreKit 2 JWS,
// Android: Play purchaseToken — both arrive as `receipt`), verifies it
// STORE-SIDE, and credits tokens idempotently via the
// credit_tokens_for_purchase RPC (migration 20260612142749).
//
// Verification paths, in priority order:
//   1. Store credentials configured → real verification:
//        iOS: App Store Server API (prod host, sandbox fallback — TestFlight
//             and App Review run in sandbox); the product id is taken from
//             APPLE'S verified payload, never the client.
//        Android: Play Developer API purchases.products.get (Google rejects
//             token/product mismatches); requires purchaseState == 0.
//      This path IGNORES STAGING_TRUST_RECEIPTS entirely — a leaked staging
//      flag can no longer reopen the trust-the-client hole once creds exist.
//   2. No credentials + STAGING_TRUST_RECEIPTS=true → staging-only trusting
//      path (still credited through the idempotent RPC).
//   3. Otherwise → 503 fail-closed (unchanged since F6).
//
// Idempotency (C2): keyed on the VERIFIED Apple transactionId / Google
// orderId. Retries, restore-purchases replays, and races credit exactly once
// (RPC claims UNIQUE (platform, transaction_id) first).
//
// Response contract (unchanged for the client):
//   200 { success: true, new_balance, tokens_added }   — tokens_added is 0
//        when the transaction was already credited (restore/retry).
//   400 { error: 'invalid_receipt' | ... }              — reject; client surfaces.
//   502 { error: 'store_verification_failed' }          — transient; the client
//        does NOT finishTransaction, so the purchase listener re-fires later.
//   503 { error: 'receipt_validation_unavailable' }     — not configured.
//
// Required secrets for path 1: APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID,
// APPLE_IAP_PRIVATE_KEY, GOOGLE_PLAY_SERVICE_ACCOUNT (see _shared/store-verify.ts).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withObservability, type EdgeHandler } from '../_shared/observability.ts';
import {
  appleVerifyTransaction,
  googleVerifyProduct,
  isAppleConfigured,
  isGoogleConfigured,
} from '../_shared/store-verify.ts';

// Map product IDs to token amounts
const PRODUCT_TOKEN_MAP: Record<string, number> = {
  chem_tokens_3: 3,
  chem_tokens_10: 10,
  chem_tokens_25: 25,
};

type CreditResult = { credited: boolean; new_balance: number };

const handler: EdgeHandler = async (req, ctx) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // --- Authenticate the calling user via JWT ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401);
  }
  ctx.user_id = user.id;

  // --- Parse request body ---
  const { receipt, platform, productId } = await req.json();

  if (!receipt || typeof receipt !== 'string' || !platform) {
    return json({ error: 'Missing required fields: receipt, platform' }, 400);
  }
  if (platform !== 'ios' && platform !== 'android') {
    return json({ error: 'Invalid platform. Must be ios or android' }, 400);
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // --- Path 1: real store-side verification -------------------------------
  const configured = platform === 'ios' ? isAppleConfigured() : isGoogleConfigured();

  if (configured) {
    if (platform === 'ios') {
      const result = await appleVerifyTransaction(receipt);
      if (!result.ok) {
        console.error('validate-receipt: apple verification failed', result);
        return result.reason === 'invalid_receipt'
          ? json({ error: 'invalid_receipt', detail: result.detail }, 400)
          : json({ error: 'store_verification_failed' }, 502);
      }

      // Product id comes from Apple's verified payload — never the client.
      const tokenAmount = PRODUCT_TOKEN_MAP[result.tx.productId];
      if (!tokenAmount) {
        return json({ error: `Unknown product: ${result.tx.productId}` }, 400);
      }

      return creditViaRpc(adminClient, {
        userId: user.id,
        platform,
        transactionId: result.tx.transactionId,
        productId: result.tx.productId,
        amount: tokenAmount,
        environment: result.tx.environment,
      });
    }

    // Android: the product id must be a known SKU before we ask Google;
    // Google then validates that the token actually belongs to it.
    const claimedProductId = typeof productId === 'string' ? productId : '';
    const tokenAmount = PRODUCT_TOKEN_MAP[claimedProductId];
    if (!tokenAmount) {
      return json({ error: `Unknown product: ${claimedProductId}` }, 400);
    }

    const result = await googleVerifyProduct(receipt, claimedProductId);
    if (!result.ok) {
      console.error('validate-receipt: google verification failed', result);
      return result.reason === 'invalid_receipt'
        ? json({ error: 'invalid_receipt', detail: result.detail }, 400)
        : json({ error: 'store_verification_failed' }, 502);
    }

    return creditViaRpc(adminClient, {
      userId: user.id,
      platform,
      transactionId: result.tx.orderId,
      productId: claimedProductId,
      amount: tokenAmount,
      environment: result.tx.purchaseType === 0 ? 'test' : 'production',
    });
  }

  // --- Path 2: staging-only trusting fallback (no store creds present) ----
  if (Deno.env.get('STAGING_TRUST_RECEIPTS') === 'true') {
    const resolvedProductId =
      typeof productId === 'string' && productId
        ? productId
        : extractProductIdFromReceipt(receipt);
    const tokenAmount = PRODUCT_TOKEN_MAP[resolvedProductId];
    if (!tokenAmount) {
      return json({ error: `Unknown product: ${resolvedProductId}` }, 400);
    }

    return creditViaRpc(adminClient, {
      userId: user.id,
      platform,
      transactionId: `staging_${simpleHash(receipt)}`,
      productId: resolvedProductId,
      amount: tokenAmount,
      environment: 'staging-trusted',
    });
  }

  // --- Path 3: fail closed (unchanged since F6) ----------------------------
  console.error(
    'validate-receipt: refusing to credit tokens — store credentials not ' +
      'configured (APPLE_IAP_* / GOOGLE_PLAY_SERVICE_ACCOUNT) and ' +
      'STAGING_TRUST_RECEIPTS is not enabled.'
  );
  return json(
    {
      error: 'receipt_validation_unavailable',
      detail:
        'Store-side receipt verification is not configured for this platform. ' +
        'Set the APPLE_IAP_* / GOOGLE_PLAY_SERVICE_ACCOUNT secrets (production) ' +
        'or STAGING_TRUST_RECEIPTS=true (staging only).',
    },
    503
  );
};

serve(withObservability(handler, { name: 'validate-receipt' }));

// --- Helpers ---

async function creditViaRpc(
  adminClient: ReturnType<typeof createClient>,
  args: {
    userId: string;
    platform: 'ios' | 'android';
    transactionId: string;
    productId: string;
    amount: number;
    environment: string;
  }
): Promise<Response> {
  const { data, error } = await adminClient.rpc('credit_tokens_for_purchase', {
    p_user_id: args.userId,
    p_platform: args.platform,
    p_transaction_id: args.transactionId,
    p_product_id: args.productId,
    p_amount: args.amount,
    p_store_environment: args.environment,
  });

  if (error) {
    console.error('validate-receipt: credit_tokens_for_purchase failed', error);
    return json({ error: 'Failed to credit tokens' }, 500);
  }

  const result = data as unknown as CreditResult;
  return json(
    {
      success: true,
      new_balance: result.new_balance,
      tokens_added: result.credited ? args.amount : 0,
    },
    200
  );
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

/**
 * Staging-only: best-effort product id recovery from an opaque receipt blob
 * when the client omitted productId. Never used on the verified paths.
 */
function extractProductIdFromReceipt(receipt: string): string {
  for (const productId of Object.keys(PRODUCT_TOKEN_MAP)) {
    if (receipt.includes(productId)) {
      return productId;
    }
  }
  return '';
}

/** Simple hash for staging receipt deduplication (not cryptographic) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
