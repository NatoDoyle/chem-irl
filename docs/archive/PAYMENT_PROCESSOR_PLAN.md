# Payment Processor Plan: RevenueCat + Native IAP

> Replaces Stripe, which explicitly prohibits dating apps (MCC 7273 — high-risk).

## Why RevenueCat + Native IAP

Chem IRL is mobile-only, distributed via App Store and Google Play. The standard approach for dating app monetization (used by Hinge, Bumble, Tinder) is **native In-App Purchases** — Apple StoreKit + Google Play Billing — unified through **RevenueCat** as the abstraction layer.

**Benefits:**
- No high-risk merchant account needed (Apple/Google handle payments, fraud, chargebacks)
- RevenueCat unifies iOS + Android in a single SDK and dashboard
- Receipt validation, subscription state management, and analytics included
- `react-native-purchases` has an Expo config plugin — compatible with our Expo SDK 54 setup
- Free tier covers up to $2.5K monthly tracked revenue

**Trade-off:** Apple takes 15-30% commission, Google takes 15-30%. This is unavoidable for digital goods in mobile apps. If we later want to offer lower prices via a web checkout (avoiding the commission), we can add a high-risk processor like Centrobill at that point.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Mobile App (Expo SDK 54)                           │
│  ┌───────────────────────────────────┐              │
│  │  react-native-purchases           │              │
│  │  (RevenueCat SDK)                 │              │
│  │  - Present offerings/paywall      │              │
│  │  - Trigger purchase flow          │              │
│  │  - Check entitlements locally     │              │
│  └──────────────┬────────────────────┘              │
│                 │ purchase()                         │
│                 ▼                                    │
│  ┌──────────────────────────┐                       │
│  │  StoreKit / Google Play  │ ← native payment UI   │
│  └──────────┬───────────────┘                       │
└─────────────┼───────────────────────────────────────┘
              │ receipt validated by RevenueCat
              ▼
┌─────────────────────────────────────────────────────┐
│  RevenueCat Backend (managed service)               │
│  - Receipt validation                               │
│  - Subscription state machine                       │
│  - Entitlement management                           │
│  - Webhook dispatch → your server                   │
└──────────────┬──────────────────────────────────────┘
               │ webhook POST
               ▼
┌─────────────────────────────────────────────────────┐
│  Supabase Edge Function: revenuecat-webhook         │
│  - Verify webhook auth header                       │
│  - On purchase/renewal → insert purchases,          │
│    credit credits_ledger                            │
│  - On cancellation/refund → update purchases,       │
│    debit credits_ledger                             │
└──────────────┬──────────────────────────────────────┘
               │ SQL
               ▼
┌─────────────────────────────────────────────────────┐
│  Supabase PostgreSQL                                │
│  - purchases table (adapted for IAP)                │
│  - credits_ledger table                             │
│  - profiles.subscription_status (new column)        │
└─────────────────────────────────────────────────────┘
```

## Products

| Product | IAP Type | RevenueCat Entitlement | Notes |
|---------|----------|----------------------|-------|
| Momentum+ | Auto-renewable subscription | `momentum_plus` | Monthly billing, price TBD |
| Credit Pack S | Consumable | _(none — credits tracked server-side)_ | Qty TBD |
| Credit Pack M | Consumable | _(none — credits tracked server-side)_ | Qty TBD |
| Credit Pack L | Consumable | _(none — credits tracked server-side)_ | Qty TBD |

Prices and credit quantities are configured in the store dashboards (App Store Connect, Google Play Console) and RevenueCat — not hardcoded. The app fetches current offerings at runtime.

---

## Implementation Steps

### 1. Install RevenueCat SDK

```bash
cd mobile && bun add react-native-purchases
```

Add the Expo config plugin to `mobile/app.json` → `plugins`:

```json
["react-native-purchases", { "iosApiKey": "appl_XXXXXXXX" }]
```

> Requires a dev build (not Expo Go). We already use native modules (Sentry, expo-notifications), so this is consistent.

### 2. Add environment variables

**`mobile/.env.example`** — add:
```env
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=your_revenuecat_apple_api_key
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=your_revenuecat_google_api_key
```

**`web/env.example`** — remove all Stripe vars:
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### 3. Initialize RevenueCat in App.tsx

Add to `mobile/App.tsx` during app initialization (alongside Sentry init):

```ts
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

// During app init:
Purchases.configure({
  apiKey: Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY!
    : process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY!,
});
```

After successful Supabase auth, identify the user so RevenueCat ties purchases to the right account:

```ts
await Purchases.logIn(session.user.id);
```

On sign out:

```ts
await Purchases.logOut();
```

### 4. Create purchase utilities module

**New file: `mobile/src/lib/purchases.ts`**

This wraps `react-native-purchases` calls. It does NOT write to the database — the webhook handles that.

```ts
import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';

/** Fetch current offerings (products + prices) from RevenueCat */
export async function getOfferings(): Promise<PurchasesOfferings> {
  return Purchases.getOfferings();
}

/** Purchase a package (subscription or credit pack) */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/** Check if user has active Momentum+ subscription */
export async function hasActiveSubscription(): Promise<boolean> {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active['momentum_plus'] !== undefined;
}

/** Restore purchases (required by App Store guidelines) */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** Identify user after auth (ties RevenueCat customer to Supabase user) */
export async function identifyUser(userId: string): Promise<void> {
  await Purchases.logIn(userId);
}

/** Clear identity on sign out */
export async function clearIdentity(): Promise<void> {
  await Purchases.logOut();
}
```

### 5. Create RevenueCat webhook Edge Function

**New file: `supabase/functions/revenuecat-webhook/index.ts`**

Follows the same pattern as `supabase/functions/push/index.ts`.

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') || '';

serve(async (req) => {
  // Verify authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const payload = await req.json();
  const { event } = payload;
  const eventType = event.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
  const appUserId = event.app_user_id; // Our Supabase user.id
  const store = event.store; // APP_STORE or PLAY_STORE
  const productId = event.product_id;
  const transactionId = event.transaction_id;

  try {
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'NON_RENEWING_PURCHASE': {
        // Determine purchase type from product_id naming convention
        const isSubscription = productId.includes('momentum');
        const purchaseType = isSubscription ? 'subscription' : 'credits';

        // Insert purchase record
        await supabase.from('purchases').upsert({
          user_id: appUserId,
          type: purchaseType,
          store: store === 'APP_STORE' ? 'apple' : 'google',
          store_transaction_id: transactionId,
          revenuecat_event_id: event.id,
          product_id: productId,
          amount_local: event.price,
          currency: event.currency,
          credits: isSubscription ? 0 : creditsByProductId(productId),
        }, { onConflict: 'store_transaction_id' });

        // Credit the user's credits_ledger for credit packs
        if (!isSubscription) {
          const credits = creditsByProductId(productId);
          await supabase.from('credits_ledger').insert({
            user_id: appUserId,
            delta: credits,
            description: `Purchased ${productId}`,
          });
        }

        // Update subscription status on profile
        if (isSubscription) {
          await supabase.from('profiles')
            .update({ subscription_status: 'active' })
            .eq('id', appUserId);
        }
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        await supabase.from('profiles')
          .update({ subscription_status: 'expired' })
          .eq('id', appUserId);
        break;
      }

      case 'REFUND': {
        // Mark purchase as refunded
        await supabase.from('purchases')
          .update({ refunded: true, refunded_at: new Date().toISOString() })
          .eq('store_transaction_id', transactionId);

        // Debit credits if it was a credit purchase
        // (Look up original purchase to determine credits to debit)
        const { data: purchase } = await supabase.from('purchases')
          .select('type, credits')
          .eq('store_transaction_id', transactionId)
          .single();

        if (purchase?.type === 'credits' && purchase.credits > 0) {
          await supabase.from('credits_ledger').insert({
            user_id: appUserId,
            delta: -purchase.credits,
            description: `Refund for ${productId}`,
          });
        }

        if (purchase?.type === 'subscription') {
          await supabase.from('profiles')
            .update({ subscription_status: 'expired' })
            .eq('id', appUserId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

/** Map product IDs to credit amounts. Update when products change. */
function creditsByProductId(productId: string): number {
  const map: Record<string, number> = {
    'credits_pack_s': 50,   // Update quantities when finalized
    'credits_pack_m': 120,
    'credits_pack_l': 260,
  };
  return map[productId] ?? 0;
}
```

### 6. Database migration

**New file: `supabase/migrations/<timestamp>_add_iap_purchases_support.sql`**

```sql
-- Create purchases table (adapted for IAP via RevenueCat)
CREATE TABLE IF NOT EXISTS purchases (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credits', 'subscription', 'bond')),
  store TEXT NOT NULL CHECK (store IN ('apple', 'google')),
  store_transaction_id TEXT UNIQUE NOT NULL,
  revenuecat_event_id TEXT UNIQUE,
  product_id TEXT NOT NULL,
  amount_local NUMERIC,
  currency TEXT,
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  refunded BOOLEAN DEFAULT FALSE,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_store_tx ON purchases(store_transaction_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role (webhook edge function) can insert/update
CREATE POLICY "Service role manages purchases" ON purchases
  FOR ALL USING (auth.role() = 'service_role');

-- Create credits ledger table
CREATE TABLE IF NOT EXISTS credits_ledger (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  feature TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credits_ledger_user_id ON credits_ledger(user_id);

ALTER TABLE credits_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits" ON credits_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credits" ON credits_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- Add subscription_status to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT
  DEFAULT 'none'
  CHECK (subscription_status IN ('none', 'active', 'expired', 'grace_period'));

-- Helper RPC: get user's current credit balance
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(SUM(delta), 0)::INTEGER
  FROM credits_ledger
  WHERE user_id = p_user_id;
$$;

-- Notify PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
```

### 7. Update deployment checklist

**File: `docs/deployment/DEPLOYMENT_CHECKLIST.md`**

Replace all Stripe sections with:

```markdown
### 6) RevenueCat + IAP (when monetization is implemented)
- [ ] RevenueCat account created at revenuecat.com
- [ ] RevenueCat project created, linked to App Store Connect + Google Play Console
- [ ] IAP products created in App Store Connect:
  - [ ] Momentum+ auto-renewable subscription
  - [ ] Credit Pack S (consumable)
  - [ ] Credit Pack M (consumable)
  - [ ] Credit Pack L (consumable)
- [ ] Matching products created in Google Play Console
- [ ] Products → Entitlements → Offerings configured in RevenueCat
- [ ] Webhook URL set in RevenueCat → Settings → Webhooks:
  - [ ] URL: `https://<supabase-project>.supabase.co/functions/v1/revenuecat-webhook`
  - [ ] Authorization header configured
- [ ] Environment variables set:
  - [ ] `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` (mobile)
  - [ ] `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` (mobile)
  - [ ] `REVENUECAT_WEBHOOK_SECRET` (Supabase Edge Function secret)
- [ ] `revenuecat-webhook` Edge Function deployed
- [ ] Sandbox purchase tested on iOS + Android
```

### 8. Update reference SQL files

**`db/schema.sql`** — update `purchases` table definition to match the migration (add `store`, `store_transaction_id`, `revenuecat_event_id`, `product_id`, rename `amount_eur` → `amount_local` + `currency`).

**`db/rls.sql`** — update purchases policies: users SELECT own rows, service role manages all.

---

## Files summary

### Modified
| File | Change |
|------|--------|
| `mobile/package.json` | Add `react-native-purchases` dependency |
| `mobile/app.json` | Add `react-native-purchases` to plugins |
| `mobile/App.tsx` | Initialize RevenueCat SDK, logIn/logOut |
| `mobile/.env.example` | Add `EXPO_PUBLIC_REVENUECAT_*` keys |
| `web/env.example` | Remove Stripe vars |
| `docs/deployment/DEPLOYMENT_CHECKLIST.md` | Replace Stripe with RevenueCat sections |
| `db/schema.sql` | Update purchases table reference |
| `db/rls.sql` | Update purchases policies reference |

### Created
| File | Purpose |
|------|---------|
| `mobile/src/lib/purchases.ts` | RevenueCat purchase utilities |
| `supabase/functions/revenuecat-webhook/index.ts` | Webhook handler |
| `supabase/migrations/<ts>_add_iap_purchases_support.sql` | DB migration |

---

## External setup (not code)

1. **RevenueCat** — create account, create project, get API keys
2. **App Store Connect** — create IAP products under the `app.chemirl.mobile` bundle ID
3. **Google Play Console** — create matching IAP products under `app.chemirl.mobile`
4. **RevenueCat dashboard** — link stores, configure products → entitlements → offerings, configure webhook URL
5. **Supabase dashboard** — set `REVENUECAT_WEBHOOK_SECRET` as Edge Function secret

## Out of scope (separate tasks)

- **Paywall UI** — the screens where users see pricing and tap "Subscribe" / "Buy Credits". This plan is the plumbing; UI is a follow-up.
- **Specific prices and credit quantities** — configured in store dashboards, not in code.
- **Web payment fallback** — add a high-risk processor (Centrobill, PaymentCloud) only if/when we want web-based purchases to avoid Apple/Google commission.
- **KPI views** — `db/kpi_views.sql` queries `purchases`; column names are close enough to work. Refine later.

## Platform commission reference

| Platform | Commission | Notes |
|----------|-----------|-------|
| Apple (Year 1) | 30% | Drops to 15% via Small Business Program if < $1M/yr |
| Apple (Year 2+) | 15% | Auto-renewable subscriptions after 1 year |
| Google Play | 15% | First $1M/year; 30% after |
| RevenueCat | Free up to $2.5K MTR | Then 1% of tracked revenue |

## High-risk processor alternatives (for future web payments)

If we later add web-based checkout to avoid the 30% commission:

| Processor | Dating support | EU support | Notes |
|-----------|---------------|-----------|-------|
| **Centrobill** | Specialist | Yes | Strongest dating expertise |
| **PaymentCloud** | Yes | Yes | Broad high-risk coverage |
| **Corepay** | Yes | Yes | 20+ years experience |
| **Authorize.net / NMI** | Popular for dating | Yes | Long history with dating industry |

These require merchant account applications (24-72h approval), expect 5-15% fees, and may require 3-6 month rolling reserves.

**Avoid:** Stripe (blocks dating), PayPal (restricts dating), Square (restricts dating), Adyen/Braintree (not dating-specific, likely rejection risk).
