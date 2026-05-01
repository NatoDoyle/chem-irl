/**
 * Pure unit tests for the entitlement helpers. We don't exercise the RPC
 * paths here — those need a live Supabase project and live as integration
 * tests in the staging smoke suite (see docs/iris/PHASE_1_VERIFICATION.md).
 *
 * supabase/client is mocked at the module level so jest can import the
 * subject without pulling in the native crypto / SecureStore stack that
 * the real client builds in the React Native runtime.
 */

jest.mock('../supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    rpc: jest.fn(),
  },
}));

import { trialDaysRemaining } from '../subscription';
import type { IrisEntitlement } from '../iris/types';

const baseEntitlement: IrisEntitlement = {
  allowed: true,
  reason: 'trial',
  trialEndsAt: null,
  currentPeriodEndsAt: null,
};

describe('trialDaysRemaining', () => {
  const NOW = new Date('2026-05-01T12:00:00Z').getTime();
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('returns 0 when reason is not "trial"', () => {
    expect(
      trialDaysRemaining({
        ...baseEntitlement,
        reason: 'subscribed',
        trialEndsAt: new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ).toBe(0);
  });

  it('returns 0 when trialEndsAt is null', () => {
    expect(trialDaysRemaining({ ...baseEntitlement, reason: 'trial', trialEndsAt: null })).toBe(0);
  });

  it('returns 0 when trialEndsAt is unparseable', () => {
    expect(
      trialDaysRemaining({
        ...baseEntitlement,
        reason: 'trial',
        trialEndsAt: 'not-a-date',
      }),
    ).toBe(0);
  });

  it('returns 0 when trial already ended', () => {
    expect(
      trialDaysRemaining({
        ...baseEntitlement,
        reason: 'trial',
        trialEndsAt: new Date(NOW - 1).toISOString(),
      }),
    ).toBe(0);
  });

  it('returns 3 immediately after a fresh trial start', () => {
    expect(
      trialDaysRemaining({
        ...baseEntitlement,
        reason: 'trial',
        trialEndsAt: new Date(NOW + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ).toBe(3);
  });

  it('returns 1 in the final 24 hours', () => {
    expect(
      trialDaysRemaining({
        ...baseEntitlement,
        reason: 'trial',
        // 23h59m before expiry — still rounds up to 1 day
        trialEndsAt: new Date(NOW + 23 * 60 * 60 * 1000 + 59 * 60 * 1000).toISOString(),
      }),
    ).toBe(1);
  });

  it('rounds up partial days (the user-friendly choice)', () => {
    // 1.5 days remaining ⇒ "2 days left", not "1"
    expect(
      trialDaysRemaining({
        ...baseEntitlement,
        reason: 'trial',
        trialEndsAt: new Date(NOW + Math.round(1.5 * 24 * 60 * 60 * 1000)).toISOString(),
      }),
    ).toBe(2);
  });
});
