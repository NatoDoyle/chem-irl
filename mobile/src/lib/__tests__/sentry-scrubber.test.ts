import { scrubSentryPayload, SCRUBBER_RULES } from '../sentry-scrubber';

describe('scrubSentryPayload', () => {
  describe('field dropping', () => {
    it('drops every key in DROP_KEYS at the top level', () => {
      const input = {
        message: 'hi nathan',
        message_text: 'how are you',
        body: 'long body text',
        note: 'private note',
        email: 'nathan@example.com',
        phone: '+12025551234',
        phone_number: '+12025551234',
        user_id: 'uuid-123',
      };
      const out = scrubSentryPayload(input);
      expect(out).toEqual({ user_id: 'uuid-123' });
    });

    it('drops dropped keys at any depth', () => {
      const input = {
        breadcrumbs: [{ data: { message: 'private', user_id: 'uuid-123' } }],
        contexts: { chat: { body: 'leak', match_id: 'm-1' } },
      };
      const out = scrubSentryPayload(input);
      expect(out).toEqual({
        breadcrumbs: [{ data: { user_id: 'uuid-123' } }],
        contexts: { chat: { match_id: 'm-1' } },
      });
    });
  });

  describe('photo URL replacement', () => {
    it('replaces photo URL keys with the placeholder', () => {
      const input = {
        photo_url: 'https://supabase.co/storage/signed/abc',
        signed_url: 'https://supabase.co/storage/signed/xyz',
        avatar_url: 'https://cdn.example.com/avatar.jpg',
      };
      const out = scrubSentryPayload(input);
      expect(out).toEqual({
        photo_url: '<scrubbed:photo>',
        signed_url: '<scrubbed:photo>',
        avatar_url: '<scrubbed:photo>',
      });
    });

    it('does not touch photo URL keys whose values are not strings', () => {
      const input = { photo_url: null, signed_url: undefined };
      const out = scrubSentryPayload(input);
      expect(out).toEqual({ photo_url: null, signed_url: undefined });
    });

    it('replaces photo URLs at any depth', () => {
      const input = { contexts: { profile: { photo_url: 'https://x' } } };
      const out = scrubSentryPayload(input);
      expect(out).toEqual({ contexts: { profile: { photo_url: '<scrubbed:photo>' } } });
    });
  });

  describe('email + phone hashing in string values', () => {
    it('replaces an email match with a stable hashed token', () => {
      const out = scrubSentryPayload({
        error_text: 'Failed for nathan@example.com — retrying',
      }) as { error_text: string };
      expect(out.error_text).toMatch(/^Failed for <email:[a-f0-9]{6}> — retrying$/);
    });

    it('produces the same hash for the same email across calls', () => {
      const a = scrubSentryPayload({ s: 'a@b.co' }) as { s: string };
      const b = scrubSentryPayload({ s: 'a@b.co' }) as { s: string };
      expect(a.s).toBe(b.s);
    });

    it('replaces a +-prefixed phone number with a hashed token', () => {
      const out = scrubSentryPayload({
        error_text: 'Carrier rejected +14155551234',
      }) as { error_text: string };
      expect(out.error_text).toMatch(/^Carrier rejected <phone:[a-f0-9]{6}>$/);
    });

    it('does NOT match unprefixed numeric runs (timestamps, ids)', () => {
      const out = scrubSentryPayload({
        ts: 'last seen at 1715000000000',
        order: 'order id 1234567890',
      }) as { ts: string; order: string };
      expect(out.ts).toBe('last seen at 1715000000000');
      expect(out.order).toBe('order id 1234567890');
    });
  });

  describe('truncation', () => {
    it('truncates strings over 2KB and appends the suffix', () => {
      const long = 'x'.repeat(SCRUBBER_RULES.TRUNCATE_AT + 100);
      const out = scrubSentryPayload({ s: long }) as { s: string };
      expect(out.s.length).toBe(SCRUBBER_RULES.TRUNCATE_AT + SCRUBBER_RULES.TRUNCATE_SUFFIX.length);
      expect(out.s.endsWith(SCRUBBER_RULES.TRUNCATE_SUFFIX)).toBe(true);
    });

    it('leaves strings at or under the limit untouched', () => {
      const exact = 'x'.repeat(SCRUBBER_RULES.TRUNCATE_AT);
      const out = scrubSentryPayload({ s: exact }) as { s: string };
      expect(out.s).toBe(exact);
    });
  });

  describe('depth and structure', () => {
    it('preserves arrays of mixed values', () => {
      const out = scrubSentryPayload({
        items: [1, 'plain', { user_id: 'u' }, null, true],
      });
      expect(out).toEqual({ items: [1, 'plain', { user_id: 'u' }, null, true] });
    });

    it('caps recursion at MAX_DEPTH with a placeholder', () => {
      let nested: Record<string, unknown> = { leaf: 'ok' };
      for (let i = 0; i < SCRUBBER_RULES.MAX_DEPTH + 5; i++) {
        nested = { child: nested };
      }
      const out = JSON.stringify(scrubSentryPayload(nested));
      expect(out).toContain(SCRUBBER_RULES.DEPTH_PLACEHOLDER);
    });

    it('does not mutate the input object', () => {
      const input = { message: 'drop me', user_id: 'u' };
      const before = JSON.stringify(input);
      scrubSentryPayload(input);
      expect(JSON.stringify(input)).toBe(before);
    });

    it('preserves null, undefined, numbers, booleans, bigints', () => {
      const out = scrubSentryPayload({
        a: null,
        b: undefined,
        c: 42,
        d: true,
        e: false,
        f: BigInt(9007199254740993),
      });
      expect(out).toEqual({
        a: null,
        b: undefined,
        c: 42,
        d: true,
        e: false,
        f: BigInt(9007199254740993),
      });
    });
  });

  describe('keep-list', () => {
    it('preserves user_id, match_id, proposal_id, release, platform, os_version', () => {
      const input = {
        user_id: 'u-1',
        match_id: 'm-1',
        proposal_id: 'p-1',
        release: 'abcdef0',
        platform: 'ios',
        os_version: '18.4',
      };
      const out = scrubSentryPayload(input);
      expect(out).toEqual(input);
    });
  });
});
