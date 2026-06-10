// Supabase Edge Function: Validate IAP Receipt
// Receives a purchase receipt, validates it (placeholder), credits tokens to user.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  withObservability,
  type EdgeHandler,
} from '../_shared/observability.ts';

// Map product IDs to token amounts
const PRODUCT_TOKEN_MAP: Record<string, number> = {
  chem_tokens_3: 3,
  chem_tokens_10: 10,
  chem_tokens_25: 25,
};

const handler: EdgeHandler = async (req, ctx) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  // --- Authenticate the calling user via JWT ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    });
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    });
  }
  ctx.user_id = user.id;

  // --- Parse request body ---
  const { receipt, platform, productId } = await req.json();

  if (!receipt || !platform) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: receipt, platform' }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }

  if (platform !== 'ios' && platform !== 'android') {
    return new Response(JSON.stringify({ error: 'Invalid platform. Must be ios or android' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // --- Fail closed until real store-side verification exists ---
  // The placeholder below TRUSTS the client's receipt and credits tokens, so
  // it must only run on staging (STAGING_TRUST_RECEIPTS=true). In production
  // (env unset) we return 503 rather than crediting tokens on an unverified
  // receipt — "forgot to remove the staging override" should be louder than
  // "credited a forged receipt". This mirrors validate-subscription. Remove
  // this gate when the real Apple / Google verification (TODO below) lands.
  if (Deno.env.get('STAGING_TRUST_RECEIPTS') !== 'true') {
    console.error(
      'validate-receipt: refusing to credit tokens without real store-side ' +
        'verification. Set STAGING_TRUST_RECEIPTS=true on staging only.'
    );
    return new Response(
      JSON.stringify({
        error: 'receipt_validation_unavailable',
        detail:
          'Real App Store / Google Play receipt verification is not yet ' +
          'implemented. On staging, set STAGING_TRUST_RECEIPTS=true to allow ' +
          'placeholder behaviour during development.',
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    );
  }

  // --- Validate receipt ---
  // TODO: Production implementation — verify receipt with Apple App Store / Google Play:
  //   iOS:    POST to https://buy.itunes.apple.com/verifyReceipt (or sandbox URL)
  //   Android: Use Google Play Developer API to verify purchase token
  // For now, trust the receipt and extract the product ID from the request.
  // In production, the product ID should come from the validated receipt, not the client.

  const resolvedProductId = productId || extractProductIdFromReceipt(receipt);
  const tokenAmount = PRODUCT_TOKEN_MAP[resolvedProductId];

  if (!tokenAmount) {
    return new Response(JSON.stringify({ error: `Unknown product: ${resolvedProductId}` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // --- Credit tokens using service role (bypasses RLS) ---
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Upsert token balance: insert if new, add to existing balance
  const { data: currentRow } = await adminClient
    .from('tokens')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle();

  const previousBalance = currentRow?.balance ?? 0;
  const newBalance = previousBalance + tokenAmount;

  const { error: upsertError } = await adminClient.from('tokens').upsert(
    {
      user_id: user.id,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    console.error('Token upsert failed:', upsertError);
    return new Response(JSON.stringify({ error: 'Failed to credit tokens' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  // Record the transaction
  const { error: txError } = await adminClient.from('token_transactions').insert({
    user_id: user.id,
    amount: tokenAmount,
    reason: 'purchase',
    product_id: resolvedProductId,
    platform,
    receipt_hash: simpleHash(receipt),
  });

  if (txError) {
    // Non-fatal: tokens are already credited; log and continue
    console.error('Token transaction record failed:', txError);
  }

  return new Response(
    JSON.stringify({
      success: true,
      new_balance: newBalance,
      tokens_added: tokenAmount,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }
  );
};

serve(withObservability(handler, { name: 'validate-receipt' }));

// --- Helpers ---

/**
 * Placeholder: extract product ID from receipt data.
 * In production, this comes from the validated receipt response from Apple/Google.
 * For now, attempt to find a known product ID in the receipt string.
 */
function extractProductIdFromReceipt(receipt: string): string {
  for (const productId of Object.keys(PRODUCT_TOKEN_MAP)) {
    if (receipt.includes(productId)) {
      return productId;
    }
  }
  return '';
}

/** Simple hash for receipt deduplication (not cryptographic) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
