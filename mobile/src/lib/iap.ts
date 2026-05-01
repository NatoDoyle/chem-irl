import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type Purchase,
  type PurchaseError,
  type Product,
  type Subscription,
  type EventSubscription,
  type FetchProductsResult,
} from 'react-native-iap';
import { supabase } from './supabase/client';

// --- Product IDs ---

export const TOKEN_PRODUCTS = {
  small: 'chem_tokens_3',
  medium: 'chem_tokens_10',
  large: 'chem_tokens_25',
} as const;
export type TokenProductId = (typeof TOKEN_PRODUCTS)[keyof typeof TOKEN_PRODUCTS];

const ALL_PRODUCT_IDS: TokenProductId[] = [
  TOKEN_PRODUCTS.small,
  TOKEN_PRODUCTS.medium,
  TOKEN_PRODUCTS.large,
];

export const SUBSCRIPTION_PRODUCTS = {
  chemPlus: 'chem_plus_monthly',
} as const;
export type SubscriptionProductId =
  (typeof SUBSCRIPTION_PRODUCTS)[keyof typeof SUBSCRIPTION_PRODUCTS];

const ALL_SUBSCRIPTION_IDS: SubscriptionProductId[] = [SUBSCRIPTION_PRODUCTS.chemPlus];

// --- State ---

let products: Product[] = [];
let subscriptions: Subscription[] = [];
let purchaseUpdateSubscription: EventSubscription | null = null;
let purchaseErrorSubscription: EventSubscription | null = null;

// --- Public API ---

/** Initialize IAP connection and fetch product info from the store */
export async function initIAP(): Promise<Product[]> {
  await initConnection();
  const result: FetchProductsResult = await fetchProducts({ skus: ALL_PRODUCT_IDS });
  // fetchProducts can return mixed Product/Subscription arrays or null;
  // filter to Product[] (in-app items only).
  products = (result ?? []).filter((item): item is Product => 'productId' in item) as Product[];

  // Warm up subscription metadata so the first chem_plus purchase request
  // doesn't pay the catalogue-fetch latency. Best-effort — failures here
  // must not block token IAP from working.
  try {
    // The `type: 'subs'` option is supported on react-native-iap v14+. We
    // cast to `unknown` first because older type defs may not declare it.
    const subResult: FetchProductsResult = await fetchProducts({
      skus: ALL_SUBSCRIPTION_IDS as unknown as string[],
      type: 'subs',
    } as Parameters<typeof fetchProducts>[0]);
    subscriptions = (subResult ?? []).filter(
      (item): item is Subscription => 'productId' in item,
    ) as Subscription[];
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('initIAP: subscription prefetch failed', err);
    }
    subscriptions = [];
  }

  return products;
}

/** Get the cached product list (call initIAP first) */
export function getLoadedProducts(): Product[] {
  return products;
}

/** Get the cached subscription list (call initIAP first) */
export function getLoadedSubscriptions(): Subscription[] {
  return subscriptions;
}

/** Request a purchase for a given token pack */
export async function purchaseTokens(productId: TokenProductId): Promise<void> {
  await requestPurchase({
    type: 'in-app',
    request: {
      apple: { sku: productId },
      google: { skus: [productId] },
    },
  });
}

/** Request a Chem Plus subscription purchase */
export async function purchaseChemPlus(): Promise<void> {
  await requestPurchase({
    type: 'subs',
    request: {
      apple: { sku: SUBSCRIPTION_PRODUCTS.chemPlus },
      google: { skus: [SUBSCRIPTION_PRODUCTS.chemPlus] },
    },
  });
}

/**
 * Set up listeners for purchase success/error events.
 * Call this once at app startup (e.g., in a useEffect).
 * Returns a cleanup function.
 */
export function setupPurchaseListener(
  onSuccess: (purchase: Purchase) => void,
  onError: (error: PurchaseError) => void
): () => void {
  // Remove any existing listeners before attaching new ones
  teardownPurchaseListeners();

  purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
    // Use purchaseToken (unified: iOS JWS or Android purchaseToken) as the receipt
    const receipt = purchase.purchaseToken;
    if (!receipt) return;

    const isSubscription = (ALL_SUBSCRIPTION_IDS as readonly string[]).includes(
      purchase.productId,
    );

    try {
      if (isSubscription) {
        const { error } = await supabase.functions.invoke('validate-subscription', {
          body: {
            receipt,
            platform: Platform.OS,
            productId: purchase.productId,
            originalTransactionId: getOriginalTransactionId(purchase),
          },
        });

        if (error) {
          onError({
            code: 'unknown' as PurchaseError['code'],
            message: error.message,
          } as PurchaseError);
          return;
        }

        // Subscriptions: NOT consumable; the platform manages renewal lifecycle.
        await finishTransaction({ purchase, isConsumable: false });
      } else {
        const { error } = await supabase.functions.invoke('validate-receipt', {
          body: {
            receipt,
            platform: Platform.OS,
            productId: purchase.productId,
          },
        });

        if (error) {
          onError({
            code: 'unknown' as PurchaseError['code'],
            message: error.message,
          } as PurchaseError);
          return;
        }

        // Token packs are consumable.
        await finishTransaction({ purchase, isConsumable: true });
      }

      onSuccess(purchase);
    } catch (err) {
      onError({
        code: 'unknown' as PurchaseError['code'],
        message: err instanceof Error ? err.message : 'Unknown purchase error',
      } as PurchaseError);
    }
  });

  purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
    onError(error);
  });

  return teardownPurchaseListeners;
}

/** Clean up IAP connection and listeners */
export async function endIAP(): Promise<void> {
  teardownPurchaseListeners();
  await endConnection();
  products = [];
  subscriptions = [];
}

// --- Internal ---

function teardownPurchaseListeners(): void {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
}

/**
 * Stable identifier across subscription renewals.
 *
 * iOS: `originalTransactionIdentifierIOS` stays the same when the
 * subscription auto-renews; that's what we key on for idempotency in
 * validate-subscription.
 * Android: the purchaseToken stays stable across renewals for the same
 * subscription; we use it as the originalTransactionId.
 */
function getOriginalTransactionId(purchase: Purchase): string {
  if (Platform.OS === 'ios') {
    const iosPurchase = purchase as Purchase & {
      originalTransactionIdentifierIOS?: string;
      transactionId?: string;
    };
    return (
      iosPurchase.originalTransactionIdentifierIOS ??
      iosPurchase.transactionId ??
      iosPurchase.purchaseToken ??
      ''
    );
  }
  return purchase.purchaseToken ?? '';
}
