// captureWithTags + addBreadcrumb are the app-wide error/breadcrumb
// surface (historical filename from the Sentry era; the SDK was removed
// 2026-07-13). Both delegate entirely to clientErrorEvents — the Bronto
// path — which is mocked here; its own behavior has its own test file.
jest.mock('../clientErrorEvents', () => ({
  recordClientError: jest.fn(),
  recordBreadcrumb: jest.fn(),
}));

// eslint-disable-next-line import/first
import { addBreadcrumb, captureWithTags } from '../sentry';
// eslint-disable-next-line import/first
import { recordBreadcrumb, recordClientError } from '../clientErrorEvents';
// eslint-disable-next-line import/first
import { ERROR_KINDS, ERROR_LAYERS, ERROR_SEVERITIES } from '../errors';

const mockedRecordClientError = recordClientError as jest.Mock;
const mockedRecordBreadcrumb = recordBreadcrumb as jest.Mock;

describe('captureWithTags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records the error to Bronto with the full capture context', () => {
    const err = new Error('boom');
    captureWithTags(err, {
      layer: ERROR_LAYERS.Edge,
      kind: ERROR_KINDS.RpcServerError,
      severity: ERROR_SEVERITIES.High,
      tags: { screen: 'Propose', rpc: 'propose_meet' },
      extra: { step: 'confirm' },
    });

    expect(mockedRecordClientError).toHaveBeenCalledWith(err, {
      source: 'capture',
      severity: 'high',
      kind: 'rpc.server_error',
      layer: 'edge',
      tags: { screen: 'Propose', rpc: 'propose_meet' },
      extra: { step: 'confirm' },
    });
  });

  it('defaults severity/kind/tags/extra to undefined without inventing values', () => {
    captureWithTags(new Error('x'), { layer: ERROR_LAYERS.Mobile });

    expect(mockedRecordClientError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'capture',
      severity: undefined,
      kind: undefined,
      layer: 'mobile',
      tags: undefined,
      extra: undefined,
    });
  });

  it('no-ops when error is null or undefined', () => {
    captureWithTags(null, { layer: ERROR_LAYERS.Mobile });
    captureWithTags(undefined, { layer: ERROR_LAYERS.Mobile });

    expect(mockedRecordClientError).not.toHaveBeenCalled();
  });
});

describe('addBreadcrumb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('feeds the client_error breadcrumb trail with message + category', () => {
    addBreadcrumb('Auth state changed: SIGNED_IN', 'auth', 'info');

    expect(mockedRecordBreadcrumb).toHaveBeenCalledWith('Auth state changed: SIGNED_IN', 'auth');
  });
});
