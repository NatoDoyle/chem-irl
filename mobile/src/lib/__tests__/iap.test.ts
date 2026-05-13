/**
 * Unit tests for the billing-critical IAP helpers in lib/iap.ts. The native
 * `react-native-iap` module is lazily-required inside `loadIAP()`, so we
 * mock it at the module level and capture the listener callbacks that
 * `setupPurchaseListener` registers, then invoke them by hand to exercise
 * the validate-receipt / validate-subscription branches.
 *
 * expo-constants and react-native are mocked too because their real
 * implementations would pull native code into the Node test runtime.
 *
 * The jest.mock calls below are hoisted above the imports by babel-jest,
 * so the imports below resolve to the mocked versions.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as iapNative from 'react-native-iap';
import { supabase } from '../supabase/client';
import {
  IAPUnavailableInExpoGoError,
  initIAP,
  getLoadedProducts,
  getLoadedSubscriptions,
  purchaseTokens,
  purchaseChemPlus,
  setupPurchaseListener,
  endIAP,
  TOKEN_PRODUCTS,
  SUBSCRIPTION_PRODUCTS,
} from '../iap';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
  ExecutionEnvironment: {
    StoreClient: 'storeClient',
    Standalone: 'standalone',
    Bare: 'bare',
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../supabase/client', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(),
  fetchProducts: jest.fn(),
  requestPurchase: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  purchaseErrorListener: jest.fn(),
  finishTransaction: jest.fn(),
  endConnection: jest.fn(),
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockInitConnection = iapNative.initConnection as jest.Mock;
const mockFetchProducts = iapNative.fetchProducts as jest.Mock;
const mockRequestPurchase = iapNative.requestPurchase as jest.Mock;
const mockPurchaseUpdatedListener = iapNative.purchaseUpdatedListener as jest.Mock;
const mockPurchaseErrorListener = iapNative.purchaseErrorListener as jest.Mock;
const mockFinishTransaction = iapNative.finishTransaction as jest.Mock;
const mockEndConnection = iapNative.endConnection as jest.Mock;

beforeEach(() => {
  // Reset every mock to a clean slate
  mockInvoke.mockReset();
  mockInitConnection.mockReset();
  mockFetchProducts.mockReset();
  mockRequestPurchase.mockReset();
  mockPurchaseUpdatedListener.mockReset();
  mockPurchaseErrorListener.mockReset();
  mockFinishTransaction.mockReset();
  mockEndConnection.mockReset();

  // Default to "standalone" (i.e. not Expo Go) and iOS
  (Constants as { executionEnvironment: string }).executionEnvironment = 'standalone';
  (Platform as { OS: string }).OS = 'ios';
});

afterEach(async () => {
  // endIAP resets the module-private products/subscriptions arrays so the
  // next test starts clean. Swallow errors if the mocks weren't set up.
  try {
    mockEndConnection.mockResolvedValue(undefined);
    await endIAP();
  } catch {
    /* no-op */
  }
});

describe('IAPUnavailableInExpoGoError', () => {
  it('carries the iap-expo-go code and class name', () => {
    const err = new IAPUnavailableInExpoGoError();
    expect(err.code).toBe('iap-expo-go');
    expect(err.name).toBe('IAPUnavailableInExpoGoError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('Expo Go guard', () => {
  it('initIAP throws IAPUnavailableInExpoGoError when executionEnvironment is StoreClient', async () => {
    (Constants as { executionEnvironment: string }).executionEnvironment = 'storeClient';
    await expect(initIAP()).rejects.toBeInstanceOf(IAPUnavailableInExpoGoError);
    expect(mockInitConnection).not.toHaveBeenCalled();
  });

  it('purchaseTokens throws IAPUnavailableInExpoGoError in Expo Go', async () => {
    (Constants as { executionEnvironment: string }).executionEnvironment = 'storeClient';
    await expect(purchaseTokens(TOKEN_PRODUCTS.small)).rejects.toBeInstanceOf(
      IAPUnavailableInExpoGoError
    );
  });
});

describe('initIAP', () => {
  it('connects, fetches products, and caches the in-app-only entries', async () => {
    mockInitConnection.mockResolvedValue(undefined);
    // Mixed array: one Product, one non-Product (subscription-shaped object
    // missing the productId discriminator on this code path)
    mockFetchProducts
      .mockResolvedValueOnce([
        { productId: TOKEN_PRODUCTS.small, price: '$0.99' },
        { somethingElse: true }, // filtered out — no `productId`
      ])
      .mockResolvedValueOnce([{ productId: SUBSCRIPTION_PRODUCTS.chemPlus, price: '$4.99/mo' }]);

    const products = await initIAP();
    expect(mockInitConnection).toHaveBeenCalledTimes(1);
    expect(products).toEqual([{ productId: TOKEN_PRODUCTS.small, price: '$0.99' }]);
    expect(getLoadedProducts()).toEqual([{ productId: TOKEN_PRODUCTS.small, price: '$0.99' }]);
    expect(getLoadedSubscriptions()).toEqual([
      { productId: SUBSCRIPTION_PRODUCTS.chemPlus, price: '$4.99/mo' },
    ]);
  });

  it('swallows a subscription-prefetch failure without breaking token IAP', async () => {
    mockInitConnection.mockResolvedValue(undefined);
    mockFetchProducts
      .mockResolvedValueOnce([{ productId: TOKEN_PRODUCTS.small, price: '$0.99' }])
      .mockRejectedValueOnce(new Error('sub catalogue down'));

    const products = await initIAP();
    expect(products).toEqual([{ productId: TOKEN_PRODUCTS.small, price: '$0.99' }]);
    expect(getLoadedSubscriptions()).toEqual([]);
  });
});

describe('purchaseTokens', () => {
  it('calls requestPurchase with both apple and google SKU shapes', async () => {
    mockRequestPurchase.mockResolvedValue(undefined);
    await purchaseTokens(TOKEN_PRODUCTS.medium);
    expect(mockRequestPurchase).toHaveBeenCalledWith({
      type: 'in-app',
      request: {
        apple: { sku: 'chem_tokens_10' },
        google: { skus: ['chem_tokens_10'] },
      },
    });
  });
});

describe('purchaseChemPlus', () => {
  it('calls requestPurchase with type subs and the chem_plus_monthly SKU', async () => {
    mockRequestPurchase.mockResolvedValue(undefined);
    await purchaseChemPlus();
    expect(mockRequestPurchase).toHaveBeenCalledWith({
      type: 'subs',
      request: {
        apple: { sku: 'chem_plus_monthly' },
        google: { skus: ['chem_plus_monthly'] },
      },
    });
  });
});

describe('setupPurchaseListener', () => {
  type AnyPurchase = {
    productId: string;
    purchaseToken?: string;
    originalTransactionIdentifierIOS?: string;
    transactionId?: string;
  };
  let onSuccess: jest.Mock;
  let onError: jest.Mock;
  let updateCb: (purchase: AnyPurchase) => Promise<void>;
  let removeUpdate: jest.Mock;
  let removeError: jest.Mock;

  beforeEach(() => {
    onSuccess = jest.fn();
    onError = jest.fn();
    removeUpdate = jest.fn();
    removeError = jest.fn();
    mockPurchaseUpdatedListener.mockImplementation((cb: typeof updateCb) => {
      updateCb = cb;
      return { remove: removeUpdate };
    });
    mockPurchaseErrorListener.mockImplementation(() => ({ remove: removeError }));
    mockFinishTransaction.mockResolvedValue(undefined);
  });

  it('validates a token purchase via validate-receipt then finishes consumable', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    setupPurchaseListener(onSuccess, onError);

    const purchase: AnyPurchase = {
      productId: TOKEN_PRODUCTS.small,
      purchaseToken: 'apple-jws-blob',
    };
    await updateCb(purchase);

    expect(mockInvoke).toHaveBeenCalledWith('validate-receipt', {
      body: {
        receipt: 'apple-jws-blob',
        platform: 'ios',
        productId: TOKEN_PRODUCTS.small,
      },
    });
    expect(mockFinishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: true });
    expect(onSuccess).toHaveBeenCalledWith(purchase);
    expect(onError).not.toHaveBeenCalled();
  });

  it('validates a subscription purchase via validate-subscription with originalTransactionId', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    setupPurchaseListener(onSuccess, onError);

    const purchase: AnyPurchase = {
      productId: SUBSCRIPTION_PRODUCTS.chemPlus,
      purchaseToken: 'apple-jws-blob',
      originalTransactionIdentifierIOS: 'original-tx-1',
    };
    await updateCb(purchase);

    expect(mockInvoke).toHaveBeenCalledWith('validate-subscription', {
      body: {
        receipt: 'apple-jws-blob',
        platform: 'ios',
        productId: SUBSCRIPTION_PRODUCTS.chemPlus,
        originalTransactionId: 'original-tx-1',
      },
    });
    expect(mockFinishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: false });
    expect(onSuccess).toHaveBeenCalledWith(purchase);
  });

  it('falls back to transactionId then purchaseToken when originalTransactionIdentifierIOS is missing', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    setupPurchaseListener(onSuccess, onError);

    await updateCb({
      productId: SUBSCRIPTION_PRODUCTS.chemPlus,
      purchaseToken: 'token-fallback',
      transactionId: 'tx-fallback',
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'validate-subscription',
      expect.objectContaining({
        body: expect.objectContaining({ originalTransactionId: 'tx-fallback' }),
      })
    );
  });

  it('uses purchaseToken as originalTransactionId on Android', async () => {
    (Platform as { OS: string }).OS = 'android';
    mockInvoke.mockResolvedValue({ data: null, error: null });
    setupPurchaseListener(onSuccess, onError);

    await updateCb({
      productId: SUBSCRIPTION_PRODUCTS.chemPlus,
      purchaseToken: 'play-token-1',
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'validate-subscription',
      expect.objectContaining({
        body: expect.objectContaining({
          platform: 'android',
          originalTransactionId: 'play-token-1',
        }),
      })
    );
  });

  it('reports onError and does NOT finishTransaction when edge function rejects', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'receipt invalid' } });
    setupPurchaseListener(onSuccess, onError);

    await updateCb({ productId: TOKEN_PRODUCTS.small, purchaseToken: 'bad' });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'receipt invalid' }));
    expect(mockFinishTransaction).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('returns early (no edge function call) when purchaseToken is missing', async () => {
    setupPurchaseListener(onSuccess, onError);
    await updateCb({ productId: TOKEN_PRODUCTS.small });
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('removes prior listeners when called twice (idempotent setup)', () => {
    setupPurchaseListener(onSuccess, onError);
    const firstRemove = removeUpdate;
    const firstErrRemove = removeError;
    // Swap in new spies for the second call
    removeUpdate = jest.fn();
    removeError = jest.fn();
    setupPurchaseListener(onSuccess, onError);
    expect(firstRemove).toHaveBeenCalledTimes(1);
    expect(firstErrRemove).toHaveBeenCalledTimes(1);
  });
});

describe('endIAP', () => {
  it('disconnects and clears the cached products + subscriptions', async () => {
    mockInitConnection.mockResolvedValue(undefined);
    mockFetchProducts
      .mockResolvedValueOnce([{ productId: TOKEN_PRODUCTS.small, price: '$0.99' }])
      .mockResolvedValueOnce([{ productId: SUBSCRIPTION_PRODUCTS.chemPlus, price: '$4.99/mo' }]);
    await initIAP();
    expect(getLoadedProducts()).toHaveLength(1);
    expect(getLoadedSubscriptions()).toHaveLength(1);

    mockEndConnection.mockResolvedValue(undefined);
    await endIAP();

    expect(mockEndConnection).toHaveBeenCalledTimes(1);
    expect(getLoadedProducts()).toEqual([]);
    expect(getLoadedSubscriptions()).toEqual([]);
  });
});
