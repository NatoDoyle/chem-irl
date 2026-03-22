// Mock supabase client before importing profile module
const mockUpsert = jest.fn();

jest.mock('../supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockUpsert,
    })),
  },
}));

// eslint-disable-next-line import/first
import { ensureProfileExists } from '../profile';
// eslint-disable-next-line import/first
import { supabase } from '../supabase/client';

describe('ensureProfileExists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upsert a profile row with default values for the given user ID', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const result = await ensureProfileExists('user-abc-123');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: 'user-abc-123',
        prompts: {},
        availability: {},
        photos: [],
        completion_pct: 0,
        signup_completed: false,
        favourite_first_dates: [],
      },
      { onConflict: 'id' }
    );
    expect(result).toBeNull();
  });

  it('should return null when upsert succeeds', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const result = await ensureProfileExists('user-def-456');

    expect(result).toBeNull();
  });

  it('should return the error when upsert fails', async () => {
    const postgrestError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'Key (id)=(user-abc-123) already exists.',
      hint: '',
    };
    mockUpsert.mockResolvedValue({ error: postgrestError });

    const result = await ensureProfileExists('user-abc-123');

    expect(result).toBe(postgrestError);
  });

  it('should return the error when upsert fails with RLS violation', async () => {
    const rlsError = {
      code: '42501',
      message: 'new row violates row-level security policy',
      details: null,
      hint: null,
    };
    mockUpsert.mockResolvedValue({ error: rlsError });

    const result = await ensureProfileExists('user-no-access');

    expect(result).toBe(rlsError);
  });

  it('should set signup_completed to false and completion_pct to 0 for new profiles', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await ensureProfileExists('brand-new-user');

    const upsertPayload = mockUpsert.mock.calls[0][0];
    expect(upsertPayload.signup_completed).toBe(false);
    expect(upsertPayload.completion_pct).toBe(0);
  });

  it('should initialize photos as an empty array', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await ensureProfileExists('user-photos-test');

    const upsertPayload = mockUpsert.mock.calls[0][0];
    expect(upsertPayload.photos).toEqual([]);
  });

  it('should initialize prompts and availability as empty objects', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await ensureProfileExists('user-prompts-test');

    const upsertPayload = mockUpsert.mock.calls[0][0];
    expect(upsertPayload.prompts).toEqual({});
    expect(upsertPayload.availability).toEqual({});
  });

  it('should use onConflict id to avoid duplicate profile creation', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await ensureProfileExists('user-conflict-test');

    const upsertOptions = mockUpsert.mock.calls[0][1];
    expect(upsertOptions).toEqual({ onConflict: 'id' });
  });
});
