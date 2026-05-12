/**
 * Tests for the photoModeration client lib's runtime validator.
 *
 * The validator is the contract between the moderate-photo edge function
 * and the mobile app. We rely on Anthropic tool-use to enforce the schema
 * server-side, but we still spot-check the shape on the client so a
 * partial / malformed response surfaces as a typed error instead of
 * crashing downstream UI code.
 */

// Stub the supabase client so importing photoModeration doesn't pull in
// LargeSecureStore + the env-validated createClient call. Per the pattern
// in supabase-client.test.ts.
jest.mock('../supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
  },
}));

// eslint-disable-next-line import/first
import { isValidResult } from '../photoModeration';

describe('photoModeration.isValidResult', () => {
  describe('safety', () => {
    const validSafety = {
      kind: 'safety',
      decision: 'approved',
      overallRiskScore: 12,
      summary: 'Clear selfie in natural lighting.',
      containsPerson: true,
      isProfilePhotoSuitable: true,
      recommendedAction: 'Approve and publish',
      categories: [],
      checkId: '11111111-1111-1111-1111-111111111111',
    };

    it('accepts a well-formed safety result', () => {
      expect(isValidResult(validSafety)).toBe(true);
    });

    it('rejects safety missing categories array', () => {
      const r = { ...validSafety, categories: undefined };
      expect(isValidResult(r)).toBe(false);
    });

    it('rejects safety with non-array categories', () => {
      const r = { ...validSafety, categories: 'oops' };
      expect(isValidResult(r)).toBe(false);
    });

    it('rejects safety with non-string decision', () => {
      const r = { ...validSafety, decision: 1 };
      expect(isValidResult(r)).toBe(false);
    });

    it('rejects safety with non-number overallRiskScore', () => {
      const r = { ...validSafety, overallRiskScore: '50' };
      expect(isValidResult(r)).toBe(false);
    });

    it('rejects safety with non-boolean containsPerson', () => {
      const r = { ...validSafety, containsPerson: 'true' };
      expect(isValidResult(r)).toBe(false);
    });

    it('rejects safety missing checkId', () => {
      const r: Record<string, unknown> = { ...validSafety };
      delete r.checkId;
      expect(isValidResult(r)).toBe(false);
    });
  });

  describe('match', () => {
    const validMatch = {
      kind: 'match',
      decision: 'match',
      confidence: 0.84,
      reasoning: 'Same jawline and eye spacing.',
      checkId: '22222222-2222-2222-2222-222222222222',
    };

    it('accepts a well-formed match result', () => {
      expect(isValidResult(validMatch)).toBe(true);
    });

    it('accepts match with confidence 0', () => {
      expect(isValidResult({ ...validMatch, confidence: 0 })).toBe(true);
    });

    it('rejects match with non-number confidence', () => {
      expect(isValidResult({ ...validMatch, confidence: 'high' })).toBe(false);
    });

    it('rejects match missing reasoning', () => {
      const r: Record<string, unknown> = { ...validMatch };
      delete r.reasoning;
      expect(isValidResult(r)).toBe(false);
    });

    it('rejects match missing checkId', () => {
      const r: Record<string, unknown> = { ...validMatch };
      delete r.checkId;
      expect(isValidResult(r)).toBe(false);
    });
  });

  describe('top-level shape', () => {
    it('rejects null', () => {
      expect(isValidResult(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isValidResult(undefined)).toBe(false);
    });

    it('rejects primitives', () => {
      expect(isValidResult('approved')).toBe(false);
      expect(isValidResult(42)).toBe(false);
      expect(isValidResult(true)).toBe(false);
    });

    it('rejects arrays', () => {
      expect(isValidResult([])).toBe(false);
    });

    it('rejects unknown kind', () => {
      expect(isValidResult({ kind: 'something_else', checkId: 'x' })).toBe(false);
    });

    it('rejects empty object', () => {
      expect(isValidResult({})).toBe(false);
    });
  });
});
