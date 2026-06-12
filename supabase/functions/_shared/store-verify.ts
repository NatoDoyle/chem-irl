// Shared store-side purchase verification (Apple + Google) for IAP edge
// functions. Used by validate-receipt today; validate-subscription's
// production TODO names the same two APIs and should adopt these helpers.
//
// Apple — App Store Server API:
//   The client sends the StoreKit 2 JWS (`purchase.purchaseToken` from
//   react-native-iap v14). We decode its payload WITHOUT trusting it, take
//   only the transactionId, and fetch the authoritative signed transaction
//   from Apple over TLS (GET /inApps/v1/transactions/{id}), production
//   host first, sandbox on 404 — TestFlight and App Review both run in the
//   sandbox environment, so both must verify. The payload of Apple's
//   TLS-authenticated response is what we trust.
//   Secrets: APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID (an App Store Connect
//   in-app-purchase key), APPLE_IAP_PRIVATE_KEY (the .p8 PEM contents).
//
// Google — Play Developer API:
//   The client sends the Play purchaseToken. purchases.products.get
//   validates the token against the claimed productId (a mismatched pair
//   is rejected by Google), and we require purchaseState === 0.
//   Secret: GOOGLE_PLAY_SERVICE_ACCOUNT (the full service-account JSON;
//   the account needs androidpublisher access to the Play app).
//
// All signing uses WebCrypto only — no third-party JWT deps.

const APP_BUNDLE_ID = 'app.chemirl.mobile';
const ANDROID_PACKAGE_NAME = 'app.chemirl.mobile';

const APPLE_PROD_HOST = 'https://api.storekit.itunes.apple.com';
const APPLE_SANDBOX_HOST = 'https://api.storekit-sandbox.itunes.apple.com';

// --- Encoding helpers -------------------------------------------------------

function b64urlEncode(data: Uint8Array): string {
  let bin = '';
  for (const byte of data) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToString(segment: string): string {
  const padded =
    segment.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (segment.length % 4)) % 4);
  return atob(padded);
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Decode a JWS payload WITHOUT signature verification. Only safe for:
 *  (a) extracting a transactionId to look up via Apple's API, and
 *  (b) payloads that arrived inside a TLS-authenticated Apple response.
 */
export function decodeJwsPayload(jws: string): Record<string, unknown> | null {
  const parts = jws.split('.');
  if (parts.length !== 3) return null;
  try {
    const parsed = JSON.parse(b64urlDecodeToString(parts[1]));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: CryptoKey,
  alg: AlgorithmIdentifier | EcdsaParams
): Promise<string> {
  const enc = new TextEncoder();
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign(alg, key, enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

// --- Apple ------------------------------------------------------------------

export function isAppleConfigured(): boolean {
  return Boolean(
    Deno.env.get('APPLE_IAP_ISSUER_ID') &&
      Deno.env.get('APPLE_IAP_KEY_ID') &&
      Deno.env.get('APPLE_IAP_PRIVATE_KEY')
  );
}

async function appleApiJwt(): Promise<string> {
  const issuer = Deno.env.get('APPLE_IAP_ISSUER_ID') ?? '';
  const kid = Deno.env.get('APPLE_IAP_KEY_ID') ?? '';
  const pem = Deno.env.get('APPLE_IAP_PRIVATE_KEY') ?? '';
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: 'ES256', kid, typ: 'JWT' },
    { iss: issuer, iat: now, exp: now + 300, aud: 'appstoreconnect-v1', bid: APP_BUNDLE_ID },
    key,
    { name: 'ECDSA', hash: 'SHA-256' }
  );
}

export interface AppleVerifiedTransaction {
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  environment: string;
  type: string;
}

export type StoreVerifyFailure = {
  ok: false;
  // invalid_receipt → reject the purchase (4xx); store_unavailable →
  // transient/server-side (5xx; client retries, transaction stays
  // unfinished so the purchase listener re-fires later).
  reason: 'invalid_receipt' | 'store_unavailable';
  detail?: string;
};

export type AppleVerifyResult = { ok: true; tx: AppleVerifiedTransaction } | StoreVerifyFailure;

export async function appleVerifyTransaction(jwsFromClient: string): Promise<AppleVerifyResult> {
  const claimed = decodeJwsPayload(jwsFromClient);
  const claimedTxId = typeof claimed?.transactionId === 'string' ? claimed.transactionId : '';
  if (!claimedTxId) {
    return { ok: false, reason: 'invalid_receipt', detail: 'no transactionId in receipt JWS' };
  }

  let token: string;
  try {
    token = await appleApiJwt();
  } catch (err) {
    return {
      ok: false,
      reason: 'store_unavailable',
      detail: `apple jwt signing failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  for (const host of [APPLE_PROD_HOST, APPLE_SANDBOX_HOST]) {
    let res: Response;
    try {
      res = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(claimedTxId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      return {
        ok: false,
        reason: 'store_unavailable',
        detail: `apple fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }

    // Not found in this environment — fall through to the sandbox host.
    if (res.status === 404) continue;
    if (res.status === 401) {
      return {
        ok: false,
        reason: 'store_unavailable',
        detail: 'apple rejected our API credentials (check APPLE_IAP_* secrets)',
      };
    }
    if (!res.ok) {
      return { ok: false, reason: 'store_unavailable', detail: `apple responded ${res.status}` };
    }

    const body = (await res.json()) as { signedTransactionInfo?: unknown };
    const payload =
      typeof body.signedTransactionInfo === 'string'
        ? decodeJwsPayload(body.signedTransactionInfo)
        : null;
    if (!payload) {
      return { ok: false, reason: 'store_unavailable', detail: 'unparseable apple response' };
    }
    if (payload.bundleId !== APP_BUNDLE_ID) {
      return { ok: false, reason: 'invalid_receipt', detail: 'bundleId mismatch' };
    }
    if (payload.revocationDate !== undefined && payload.revocationDate !== null) {
      return { ok: false, reason: 'invalid_receipt', detail: 'transaction revoked (refunded)' };
    }

    return {
      ok: true,
      tx: {
        productId: String(payload.productId ?? ''),
        transactionId: String(payload.transactionId ?? claimedTxId),
        originalTransactionId: String(payload.originalTransactionId ?? claimedTxId),
        environment: String(payload.environment ?? 'Unknown'),
        type: String(payload.type ?? ''),
      },
    };
  }

  return {
    ok: false,
    reason: 'invalid_receipt',
    detail: 'transaction not found in production or sandbox',
  };
}

// --- Google -----------------------------------------------------------------

export function isGoogleConfigured(): boolean {
  return Boolean(Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT'));
}

async function googleAccessToken(): Promise<string | null> {
  try {
    const sa = JSON.parse(Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT') ?? '') as {
      client_email?: string;
      private_key?: string;
    };
    if (!sa.client_email || !sa.private_key) return null;

    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(sa.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const now = Math.floor(Date.now() / 1000);
    const assertion = await signJwt(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      key,
      { name: 'RSASSA-PKCS1-v1_5' }
    );

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: unknown };
    return typeof body.access_token === 'string' ? body.access_token : null;
  } catch {
    return null;
  }
}

export interface GoogleVerifiedPurchase {
  orderId: string;
  purchaseType: number | null;
}

export type GoogleVerifyResult = { ok: true; tx: GoogleVerifiedPurchase } | StoreVerifyFailure;

export async function googleVerifyProduct(
  purchaseToken: string,
  productId: string
): Promise<GoogleVerifyResult> {
  const token = await googleAccessToken();
  if (!token) {
    return {
      ok: false,
      reason: 'store_unavailable',
      detail: 'google auth failed (check GOOGLE_PLAY_SERVICE_ACCOUNT secret)',
    };
  }

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${ANDROID_PACKAGE_NAME}/purchases/products/${encodeURIComponent(productId)}` +
    `/tokens/${encodeURIComponent(purchaseToken)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    return {
      ok: false,
      reason: 'store_unavailable',
      detail: `google fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  // Google rejects token/product mismatches and unknown tokens with 4xx.
  if (res.status === 400 || res.status === 404) {
    return { ok: false, reason: 'invalid_receipt', detail: `google responded ${res.status}` };
  }
  if (!res.ok) {
    return { ok: false, reason: 'store_unavailable', detail: `google responded ${res.status}` };
  }

  const body = (await res.json()) as {
    purchaseState?: unknown;
    orderId?: unknown;
    purchaseType?: unknown;
  };
  if (body.purchaseState !== 0) {
    return {
      ok: false,
      reason: 'invalid_receipt',
      detail: `purchaseState ${String(body.purchaseState)} (not purchased)`,
    };
  }

  return {
    ok: true,
    tx: {
      // orderId is absent for some test purchases; fall back to a stable
      // token-derived key so idempotency still holds.
      orderId:
        typeof body.orderId === 'string' && body.orderId.length > 0
          ? body.orderId
          : `gp_token_${purchaseToken.slice(0, 100)}`,
      purchaseType: typeof body.purchaseType === 'number' ? body.purchaseType : null,
    },
  };
}

// --- Subscriptions ----------------------------------------------------------

export type SubscriptionStatus = 'trialing' | 'active' | 'grace_period' | 'expired' | 'cancelled';

export interface VerifiedSubscription {
  status: SubscriptionStatus;
  currentPeriodEndsAt: string | null;
  trialEndsAt: string | null;
  // Verified stable id: Apple originalTransactionId / Google purchaseToken.
  originalTransactionId: string;
  productId: string;
  environment: string;
}

export type SubscriptionVerifyResult = { ok: true; sub: VerifiedSubscription } | StoreVerifyFailure;

/**
 * Verify a Chem Plus subscription on iOS. The client's JWS is decoded only
 * for a transactionId; the verified transaction (fetched from Apple) yields
 * the trusted originalTransactionId — NEVER the client's claim, otherwise a
 * caller could submit someone else's originalTransactionId and inherit
 * their entitlement. Subscription status then comes from Apple's
 * Get-All-Subscription-Statuses endpoint on the same environment host.
 *
 * Apple status ints: 1 active, 2 expired, 3 billing retry, 4 billing grace
 * period, 5 revoked (refund). offerType 1 on an active sub = intro offer →
 * 'trialing'.
 */
export async function appleVerifySubscription(
  jwsFromClient: string,
  expectedProductId: string
): Promise<SubscriptionVerifyResult> {
  const claimed = decodeJwsPayload(jwsFromClient);
  const claimedTxId = typeof claimed?.transactionId === 'string' ? claimed.transactionId : '';
  if (!claimedTxId) {
    return { ok: false, reason: 'invalid_receipt', detail: 'no transactionId in receipt JWS' };
  }

  let token: string;
  try {
    token = await appleApiJwt();
  } catch (err) {
    return {
      ok: false,
      reason: 'store_unavailable',
      detail: `apple jwt signing failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
  const authHeaders = { Authorization: `Bearer ${token}` };

  for (const host of [APPLE_PROD_HOST, APPLE_SANDBOX_HOST]) {
    let txRes: Response;
    try {
      txRes = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(claimedTxId)}`, {
        headers: authHeaders,
      });
    } catch (err) {
      return {
        ok: false,
        reason: 'store_unavailable',
        detail: `apple fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
    if (txRes.status === 404) continue; // try the sandbox host
    if (!txRes.ok) {
      return { ok: false, reason: 'store_unavailable', detail: `apple responded ${txRes.status}` };
    }

    const txBody = (await txRes.json()) as { signedTransactionInfo?: unknown };
    const txPayload =
      typeof txBody.signedTransactionInfo === 'string'
        ? decodeJwsPayload(txBody.signedTransactionInfo)
        : null;
    if (!txPayload) {
      return { ok: false, reason: 'store_unavailable', detail: 'unparseable apple transaction' };
    }
    if (txPayload.bundleId !== APP_BUNDLE_ID) {
      return { ok: false, reason: 'invalid_receipt', detail: 'bundleId mismatch' };
    }
    if (txPayload.productId !== expectedProductId) {
      return {
        ok: false,
        reason: 'invalid_receipt',
        detail: `transaction is for ${String(txPayload.productId)}, not a subscription`,
      };
    }

    const verifiedOriginalId = String(txPayload.originalTransactionId ?? claimedTxId);

    // Current status for the verified subscription, from the same host.
    let statusRes: Response;
    try {
      statusRes = await fetch(
        `${host}/inApps/v1/subscriptions/${encodeURIComponent(verifiedOriginalId)}`,
        { headers: authHeaders }
      );
    } catch (err) {
      return {
        ok: false,
        reason: 'store_unavailable',
        detail: `apple status fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
    if (!statusRes.ok) {
      return {
        ok: false,
        reason: 'store_unavailable',
        detail: `apple statuses responded ${statusRes.status}`,
      };
    }

    const statusBody = (await statusRes.json()) as {
      environment?: unknown;
      data?: Array<{ lastTransactions?: Array<Record<string, unknown>> }>;
    };
    const lastTransactions = (statusBody.data ?? []).flatMap((g) => g.lastTransactions ?? []);
    const entry =
      lastTransactions.find((t) => t.originalTransactionId === verifiedOriginalId) ??
      lastTransactions[0];
    if (!entry) {
      return { ok: false, reason: 'invalid_receipt', detail: 'no subscription status found' };
    }

    const lastPayload =
      typeof entry.signedTransactionInfo === 'string'
        ? decodeJwsPayload(entry.signedTransactionInfo)
        : null;
    const expiresMs =
      typeof lastPayload?.expiresDate === 'number' ? lastPayload.expiresDate : null;
    const offerType = typeof lastPayload?.offerType === 'number' ? lastPayload.offerType : null;
    const statusInt = typeof entry.status === 'number' ? entry.status : 0;

    let status: SubscriptionStatus;
    if (statusInt === 1) status = offerType === 1 ? 'trialing' : 'active';
    else if (statusInt === 3 || statusInt === 4) status = 'grace_period';
    else if (statusInt === 5) status = 'cancelled';
    else status = 'expired';

    const expiresIso = expiresMs ? new Date(expiresMs).toISOString() : null;
    return {
      ok: true,
      sub: {
        status,
        currentPeriodEndsAt: expiresIso,
        trialEndsAt: status === 'trialing' ? expiresIso : null,
        originalTransactionId: verifiedOriginalId,
        productId: expectedProductId,
        environment: String(statusBody.environment ?? txPayload.environment ?? 'Unknown'),
      },
    };
  }

  return {
    ok: false,
    reason: 'invalid_receipt',
    detail: 'transaction not found in production or sandbox',
  };
}

/**
 * Verify a Chem Plus subscription on Android via purchases.subscriptionsv2.
 * The endpoint is keyed by purchaseToken, so the productId comes from
 * GOOGLE'S response (lineItems), not the client. CANCELED with a future
 * expiry stays 'active' (auto-renew off but the paid period is still owed);
 * 'cancelled' is reserved for revocations on the Apple side.
 */
export async function googleVerifySubscription(
  purchaseToken: string,
  expectedProductId: string
): Promise<SubscriptionVerifyResult> {
  const token = await googleAccessToken();
  if (!token) {
    return {
      ok: false,
      reason: 'store_unavailable',
      detail: 'google auth failed (check GOOGLE_PLAY_SERVICE_ACCOUNT secret)',
    };
  }

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${ANDROID_PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    return {
      ok: false,
      reason: 'store_unavailable',
      detail: `google fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
  if (res.status === 400 || res.status === 404) {
    return { ok: false, reason: 'invalid_receipt', detail: `google responded ${res.status}` };
  }
  if (!res.ok) {
    return { ok: false, reason: 'store_unavailable', detail: `google responded ${res.status}` };
  }

  const body = (await res.json()) as {
    subscriptionState?: unknown;
    testPurchase?: unknown;
    lineItems?: Array<{ productId?: unknown; expiryTime?: unknown }>;
  };

  const line = (body.lineItems ?? []).find((l) => l.productId === expectedProductId);
  if (!line) {
    return {
      ok: false,
      reason: 'invalid_receipt',
      detail: `token does not belong to ${expectedProductId}`,
    };
  }

  const expiryIso = typeof line.expiryTime === 'string' ? line.expiryTime : null;
  const expiryFuture = expiryIso !== null && Date.parse(expiryIso) > Date.now();
  const state = String(body.subscriptionState ?? '');

  let status: SubscriptionStatus;
  if (state === 'SUBSCRIPTION_STATE_ACTIVE') status = 'active';
  else if (state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') status = 'grace_period';
  else if (state === 'SUBSCRIPTION_STATE_CANCELED') status = expiryFuture ? 'active' : 'expired';
  else status = 'expired'; // EXPIRED / ON_HOLD / PAUSED / PENDING etc.

  return {
    ok: true,
    sub: {
      status,
      currentPeriodEndsAt: expiryIso,
      trialEndsAt: null,
      originalTransactionId: purchaseToken,
      productId: expectedProductId,
      environment: body.testPurchase != null ? 'test' : 'production',
    },
  };
}
