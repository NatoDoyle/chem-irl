/**
 * Tests for the client-error → Bronto pipeline (mobile side).
 *
 * recordClientError writes `client_error` analytics rows (severity→level
 * mapping, on-device scrubbing, dedupe window + session cap) via
 * trackEvent. The dedupe/budget state is intentionally module-global —
 * both capture chokepoints share it — so every test re-imports a fresh
 * module via jest.resetModules().
 */

jest.mock('../analytics', () => ({ trackEvent: jest.fn() }));

type ClientErrorEventsModule = typeof import('../clientErrorEvents');

describe('recordClientError', () => {
  let recordClientError: ClientErrorEventsModule['recordClientError'];
  let trackEvent: jest.Mock;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    recordClientError = require('../clientErrorEvents').recordClientError;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    trackEvent = require('../analytics').trackEvent as jest.Mock;
    trackEvent.mockClear();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('records a client_error with error name, message and medium/warn defaults', () => {
    recordClientError(new TypeError('boom'), { source: 'capture' });

    expect(trackEvent).toHaveBeenCalledWith(
      'client_error',
      expect.objectContaining({
        error_name: 'TypeError',
        error_message: 'boom',
        severity: 'medium',
        level: 'warn',
        source: 'capture',
      })
    );
  });

  it('maps severity onto level: critical/high → error, medium → warn, low → info', () => {
    recordClientError(new Error('a'), { source: 'capture', severity: 'critical' });
    recordClientError(new Error('b'), { source: 'capture', severity: 'high' });
    recordClientError(new Error('c'), { source: 'capture', severity: 'medium' });
    recordClientError(new Error('d'), { source: 'capture', severity: 'low' });

    const levels = trackEvent.mock.calls.map((c) => (c[1] as Record<string, unknown>).level);
    expect(levels).toEqual(['error', 'error', 'warn', 'info']);
  });

  it('hashes emails out of the message and truncates it on-device', () => {
    recordClientError(new Error(`user leak@example.com not found ${'x'.repeat(400)}`), {
      source: 'alert',
    });

    const props = trackEvent.mock.calls[0][1] as Record<string, string>;
    expect(props.error_message).not.toContain('leak@example.com');
    expect(props.error_message).toMatch(/<email:[0-9a-f]{6}>/);
    expect(props.error_message.length).toBeLessThanOrEqual(300);
  });

  it('includes kind, error_layer and call-site tags; computed keys win over tag collisions', () => {
    recordClientError(new Error('x'), {
      source: 'capture',
      kind: 'rpc.server_error',
      layer: 'edge',
      tags: { screen: 'Discover', level: 'spoofed', source: 'spoofed' },
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'client_error',
      expect.objectContaining({
        screen: 'Discover',
        kind: 'rpc.server_error',
        error_layer: 'edge',
        level: 'warn',
        source: 'capture',
      })
    );
  });

  it('records non-Error throwables with their type as error_name', () => {
    recordClientError('string failure', { source: 'alert' });

    expect(trackEvent).toHaveBeenCalledWith(
      'client_error',
      expect.objectContaining({ error_name: 'string', error_message: 'string failure' })
    );
  });

  it('no-ops on null/undefined errors', () => {
    recordClientError(null, { source: 'capture' });
    recordClientError(undefined, { source: 'alert' });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('dedupes an identical signature inside the 60s window, records again after it', () => {
    recordClientError(new Error('same'), { source: 'capture' });
    recordClientError(new Error('same'), { source: 'alert' });
    expect(trackEvent).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1_000_000 + 60_001);
    recordClientError(new Error('same'), { source: 'capture' });
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('does not dedupe distinct signatures', () => {
    recordClientError(new Error('one'), { source: 'capture' });
    recordClientError(new Error('two'), { source: 'capture' });

    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('stops recording after the per-session cap (40)', () => {
    for (let i = 0; i < 45; i++) {
      recordClientError(new Error(`err-${i}`), { source: 'capture' });
    }

    expect(trackEvent).toHaveBeenCalledTimes(40);
  });

  it('never throws, even if trackEvent itself throws', () => {
    trackEvent.mockImplementation(() => {
      throw new Error('analytics exploded');
    });

    expect(() => recordClientError(new Error('x'), { source: 'capture' })).not.toThrow();
  });
});
