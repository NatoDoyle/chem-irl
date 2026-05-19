import { useState, useEffect, useCallback } from 'react';
import { getEntitlement } from '../../../lib/subscription';

/**
 * State + handlers for the Chem Plus upgrade card and PaywallModal on
 * ProfileScreen. `entitled` is `null` until the first entitlement check
 * resolves — the upgrade card stays hidden in that initial window so
 * users don't see a flash of CTA before we know whether they're on a
 * trial or subscription.
 */
export function useProfilePaywall(): {
  entitled: boolean | null;
  paywallVisible: boolean;
  showPaywall: () => void;
  dismissPaywall: () => void;
  refreshEntitlement: () => Promise<void>;
} {
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const refreshEntitlement = useCallback(async () => {
    try {
      const ent = await getEntitlement();
      setEntitled(ent.allowed);
    } catch {
      setEntitled(null);
    }
  }, []);

  useEffect(() => {
    refreshEntitlement();
  }, [refreshEntitlement]);

  const showPaywall = useCallback(() => {
    setPaywallVisible(true);
  }, []);

  // Re-check entitlement on dismiss so the upgrade card disappears
  // immediately once the trial / subscription lands.
  const dismissPaywall = useCallback(() => {
    setPaywallVisible(false);
    refreshEntitlement();
  }, [refreshEntitlement]);

  return { entitled, paywallVisible, showPaywall, dismissPaywall, refreshEntitlement };
}
