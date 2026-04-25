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

// --- State ---

let products: Product[] = [];
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
  return products;
}

/** Get the cached product list (call initIAP first) */
export function getLoadedProducts(): Product[] {
  return products;
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

    try {
      // Validate receipt with our edge function
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

      // Acknowledge the purchase with the store
      await finishTransaction({ purchase, isConsumable: true });

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
