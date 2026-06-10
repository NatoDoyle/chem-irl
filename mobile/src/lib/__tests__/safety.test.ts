// Mock supabase client. `rpc` is wrapped in a closure (rather than assigned
// the bare mock) so the reference resolves at call time — the jest.mock factory
// is hoisted above the `const mockRpc` initializer, so a direct assignment would
// capture `undefined`.
const mockRpc = jest.fn();

jest.mock('../supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock observability so tests don't depend on Sentry/analytics internals,
// but we can still assert the events fire.
jest.mock('../sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  // Wrapped in a closure for the same hoisting reason as the supabase mock above.
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

// eslint-disable-next-line import/first
import { blockUser, unblockUser, submitReport } from '../safety';

const TARGET = '11111111-2222-3333-4444-555555555555';

describe('safety', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockTrackEvent.mockReset();
  });

  describe('blockUser', () => {
    it('calls block_user with the blockee and returns success', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const result = await blockUser(TARGET);

      expect(mockRpc).toHaveBeenCalledWith('block_user', { p_blockee: TARGET });
      expect(result).toEqual({ success: true });
      expect(mockTrackEvent).toHaveBeenCalledWith('user_blocked', {
        targetId: TARGET.substring(0, 8),
      });
    });

    it('maps an rpc error and does not track the event', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'nope' } });

      const result = await blockUser(TARGET);

      expect(result).toEqual({ success: false, error: 'nope' });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe('unblockUser', () => {
    it('calls unblock_user with the blockee and returns success', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const result = await unblockUser(TARGET);

      expect(mockRpc).toHaveBeenCalledWith('unblock_user', { p_blockee: TARGET });
      expect(result).toEqual({ success: true });
      expect(mockTrackEvent).toHaveBeenCalledWith('user_unblocked', {
        targetId: TARGET.substring(0, 8),
      });
    });

    it('maps an rpc error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

      const result = await unblockUser(TARGET);

      expect(result).toEqual({ success: false, error: 'boom' });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe('submitReport', () => {
    it('calls submit_report with accused, category, and trimmed description', async () => {
      mockRpc.mockResolvedValue({ data: { success: true, case_id: 'abc' }, error: null });

      const result = await submitReport(TARGET, 'harassment_hate', '  hello  ');

      expect(mockRpc).toHaveBeenCalledWith('submit_report', {
        p_accused: TARGET,
        p_category: 'harassment_hate',
        p_description: 'hello',
      });
      expect(result).toEqual({ success: true });
      expect(mockTrackEvent).toHaveBeenCalledWith('report_submitted', {
        category: 'harassment_hate',
      });
    });

    it('sends null description when omitted or blank', async () => {
      mockRpc.mockResolvedValue({ data: { success: true, case_id: 'abc' }, error: null });

      await submitReport(TARGET, 'spam_scam');
      expect(mockRpc).toHaveBeenLastCalledWith('submit_report', {
        p_accused: TARGET,
        p_category: 'spam_scam',
        p_description: null,
      });

      await submitReport(TARGET, 'spam_scam', '   ');
      expect(mockRpc).toHaveBeenLastCalledWith('submit_report', {
        p_accused: TARGET,
        p_category: 'spam_scam',
        p_description: null,
      });
    });

    it('maps an rpc error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'rejected' } });

      const result = await submitReport(TARGET, 'other', 'note');

      expect(result).toEqual({ success: false, error: 'rejected' });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });
});
