import type { User, Profile, Match, Proposal, Message } from '../types';

describe('TypeScript Types', () => {
  // Smoke tests to ensure types are properly exported and structured

  it('should have User type with required fields', () => {
    const user: User = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dob: '1990-01-01',
      gender: 'male',
      orientation: 'straight',
      city_id: 'city-123',
      timezone: 'UTC',
      last_active_at: new Date().toISOString(),
    };

    expect(user.user_id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.created_at).toBeDefined();
  });

  it('should have Profile type with optional fields', () => {
    const profile: Profile = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      prompts: { headline: 'Test', bio: 'Test bio' },
      availability: {},
      photos: ['url1', 'url2'],
      completion_pct: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(profile.user_id).toBeDefined();
    expect(profile.completion_pct).toBeGreaterThanOrEqual(0);
    expect(profile.completion_pct).toBeLessThanOrEqual(100);
  });

  it('should have Match type', () => {
    const match: Match = {
      match_id: '123e4567-e89b-12d3-a456-426614174000',
      user_a: '123e4567-e89b-12d3-a456-426614174001',
      user_b: '123e4567-e89b-12d3-a456-426614174002',
      status: 'open',
      created_at: new Date().toISOString(),
    };

    expect(match.match_id).toBeDefined();
    expect(match.user_a).toBeDefined();
    expect(match.user_b).toBeDefined();
    expect(['open', 'closed']).toContain(match.status);
  });

  it('should have Proposal type', () => {
    const proposal: Proposal = {
      proposal_id: '123e4567-e89b-12d3-a456-426614174000',
      match_id: '123e4567-e89b-12d3-a456-426614174001',
      sender_id: '123e4567-e89b-12d3-a456-426614174002',
      windows: [
        { start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z' },
        { start: '2024-01-02T10:00:00Z', end: '2024-01-02T11:00:00Z' },
      ],
      date_types: ['coffee'],
      note: 'Test note',
      status: 'active',
      expires_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    expect(proposal.proposal_id).toBeDefined();
    expect(proposal.windows.length).toBeGreaterThanOrEqual(2);
    expect(proposal.windows.length).toBeLessThanOrEqual(3);
    expect(['active', 'expired', 'confirmed']).toContain(proposal.status);
  });

  it('should have Message type', () => {
    const message: Message = {
      message_id: '123e4567-e89b-12d3-a456-426614174000',
      match_id: '123e4567-e89b-12d3-a456-426614174001',
      sender_id: '123e4567-e89b-12d3-a456-426614174002',
      content: 'Test message',
      bytes: 12,
      created_at: new Date().toISOString(),
    };

    expect(message.message_id).toBeDefined();
    expect(message.content).toBeDefined();
    expect(message.created_at).toBeDefined();
  });
});

