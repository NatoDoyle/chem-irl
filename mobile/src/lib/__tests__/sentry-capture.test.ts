// Mock @sentry/react-native so the lazy require inside sentry.ts gets a
// jest-controlled module. captureWithTags goes through SentryModule.withScope
// → scope.setTags / setExtras / setFingerprint → SentryModule.captureException.
jest.mock('@sentry/react-native', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// eslint-disable-next-line import/first
import * as Sentry from '@sentry/react-native';
// eslint-disable-next-line import/first
import { captureWithTags } from '../sentry';
// eslint-disable-next-line import/first
import { ERROR_KINDS, ERROR_LAYERS, ERROR_SEVERITIES } from '../errors';

const mockedWithScope = Sentry.withScope as jest.Mock;
const mockedCaptureException = Sentry.captureException as jest.Mock;

interface MockScope {
  setTags: jest.Mock;
  setExtras: jest.Mock;
  setFingerprint: jest.Mock;
}

describe('captureWithTags', () => {
  let scope: MockScope;

  beforeEach(() => {
    jest.clearAllMocks();
    scope = {
      setTags: jest.fn(),
      setExtras: jest.fn(),
      setFingerprint: jest.fn(),
    };
    mockedWithScope.mockImplementation((cb: (s: MockScope) => void) => cb(scope));
  });

  it('attaches layer + severity + kind as tags and calls captureException', () => {
    const err = new Error('boom');
    captureWithTags(err, {
      layer: ERROR_LAYERS.Mobile,
      kind: ERROR_KINDS.RpcInvalidInput,
      severity: ERROR_SEVERITIES.High,
      tags: { rpc: 'propose_meet', screen: 'Propose' },
    });
    expect(mockedWithScope).toHaveBeenCalledTimes(1);
    expect(mockedCaptureException).toHaveBeenCalledWith(err);
    expect(scope.setTags).toHaveBeenCalledWith({
      layer: 'mobile',
      severity: 'high',
      kind: 'rpc.invalid_input',
      rpc: 'propose_meet',
      screen: 'Propose',
    });
  });

  it("defaults severity to 'medium' when omitted", () => {
    captureWithTags(new Error('x'), { layer: ERROR_LAYERS.Mobile });
    expect(scope.setTags).toHaveBeenCalledWith(expect.objectContaining({ severity: 'medium' }));
  });

  it('attaches a runbook_url derived from kind', () => {
    captureWithTags(new Error('x'), {
      layer: ERROR_LAYERS.Mobile,
      kind: ERROR_KINDS.AuthSessionExpired,
    });
    const extras = scope.setExtras.mock.calls[0][0] as Record<string, unknown>;
    expect(extras.runbook_url).toMatch(/auth\.session_expired\.md$/);
  });

  it('does NOT attach runbook_url when kind is omitted', () => {
    captureWithTags(new Error('x'), { layer: ERROR_LAYERS.Mobile });
    const extras = scope.setExtras.mock.calls[0][0] as Record<string, unknown>;
    expect(extras.runbook_url).toBeUndefined();
  });

  it('scrubs PII out of the extra payload (drops email, keeps user_id)', () => {
    captureWithTags(new Error('x'), {
      layer: ERROR_LAYERS.Mobile,
      extra: { email: 'leak@example.com', user_id: 'u-1', note: 'private' },
    });
    const extras = scope.setExtras.mock.calls[0][0] as Record<string, unknown>;
    expect(extras.email).toBeUndefined();
    expect(extras.note).toBeUndefined();
    expect(extras.user_id).toBe('u-1');
  });

  it('builds a stable fingerprint from layer + screen + rpc + kind', () => {
    captureWithTags(new Error('x'), {
      layer: ERROR_LAYERS.Mobile,
      kind: ERROR_KINDS.RpcServerError,
      tags: { screen: 'Discover', rpc: 'like' },
    });
    expect(scope.setFingerprint).toHaveBeenCalledWith([
      'mobile',
      'Discover',
      'like',
      'rpc.server_error',
    ]);
  });

  it('falls back to error.name in the fingerprint when kind is omitted', () => {
    class CustomError extends Error {
      override name = 'CustomError';
    }
    captureWithTags(new CustomError('x'), {
      layer: ERROR_LAYERS.Mobile,
      tags: { screen: 'Discover' },
    });
    expect(scope.setFingerprint).toHaveBeenCalledWith(['mobile', 'Discover', 'CustomError']);
  });

  it("falls back where = 'unknown' when no screen/fn/job tag is provided", () => {
    captureWithTags(new Error('x'), {
      layer: ERROR_LAYERS.Mobile,
      kind: ERROR_KINDS.NetworkOffline,
    });
    expect(scope.setFingerprint).toHaveBeenCalledWith(['mobile', 'unknown', 'network.offline']);
  });

  it('no-ops when error is null or undefined', () => {
    captureWithTags(null, { layer: ERROR_LAYERS.Mobile });
    captureWithTags(undefined, { layer: ERROR_LAYERS.Mobile });
    expect(mockedWithScope).not.toHaveBeenCalled();
    expect(mockedCaptureException).not.toHaveBeenCalled();
  });
});
