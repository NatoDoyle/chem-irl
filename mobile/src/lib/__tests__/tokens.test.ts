/**
 * Unit tests for the token-balance and reactivate-match helpers in
 * lib/tokens.ts. supabase/client is mocked at the module level so jest can
 * import the subject without pulling in the native crypto / SecureStore
 * stack that the real client builds in the React Native runtime.
 *
 * The jest.mock call below is hoisted above the imports by babel-jest, so
 * the import of `supabase` resolves to the mocked module.
 */

import { supabase } from '../supabase/client';
import { getTokenBalance, reactivateMatch } from '../tokens';

jest.mock('../supabase/client', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  mockGetUser.mockReset();
  mockFrom.mockReset();
  mockRpc.mockReset();
});

/**
 * Wires up `supabase.from('tokens').select('balance').eq('user_id', X).maybeSingle()`
 * to resolve with the given data/error. Returns the inner spies so tests can
 * assert on the chained call args (e.g. the user_id filter).
 */
function stubTokensQuery(data: { balance: number } | null, error: { message: string } | null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
  return { maybeSingle, eq, select };
}

describe('getTokenBalance', () => {
  it('returns 0 when no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await getTokenBalance()).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 0 when the tokens select errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    stubTokensQuery(null, { message: 'permission denied' });
    expect(await getTokenBalance()).toBe(0);
  });

  it('returns 0 when no row exists for the user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    stubTokensQuery(null, null);
    expect(await getTokenBalance()).toBe(0);
  });

  it('returns the row balance when present', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const { select, eq } = stubTokensQuery({ balance: 7 }, null);
    expect(await getTokenBalance()).toBe(7);
    expect(mockFrom).toHaveBeenCalledWith('tokens');
    expect(select).toHaveBeenCalledWith('balance');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

describe('reactivateMatch', () => {
  it('returns { success: false, error } when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'no tokens' } });
    const result = await reactivateMatch('match-1');
    expect(result).toEqual({ success: false, error: 'no tokens' });
    expect(mockRpc).toHaveBeenCalledWith('reactivate_match', { p_match_id: 'match-1' });
  });

  it('maps RPC success payload to camelCase', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, new_expires_at: '2026-06-01T00:00:00Z' },
      error: null,
    });
    const result = await reactivateMatch('match-1');
    expect(result).toEqual({
      success: true,
      error: undefined,
      newExpiresAt: '2026-06-01T00:00:00Z',
    });
  });

  it('propagates RPC-reported business-logic failure', async () => {
    // The RPC can succeed at the SQL layer but signal failure via the JSONB
    // payload (e.g. insufficient tokens). We surface that as-is.
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'match not expired' },
      error: null,
    });
    const result = await reactivateMatch('match-1');
    expect(result).toEqual({
      success: false,
      error: 'match not expired',
      newExpiresAt: undefined,
    });
  });
});
