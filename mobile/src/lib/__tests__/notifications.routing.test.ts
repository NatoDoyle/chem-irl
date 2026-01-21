/**
 * Unit tests for notification routing logic
 * Tests payload-to-route mapping (pure function)
 */

// Mock expo-notifications and supabase before importing
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'test-project-id',
        },
      },
    },
    easConfig: {
      projectId: 'test-project-id',
    },
  },
}));

// eslint-disable-next-line import/first
import { handleNotificationTap } from '../notifications';

// Mock navigation object
const createMockNavigation = () => ({
  navigate: jest.fn(),
});

describe('Notification Routing', () => {
  let mockNavigation: any;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockNavigation = createMockNavigation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should route match notification to MatchDetail', () => {
    const notification = {
      date: Date.now(),
      request: {
        content: {
          data: {
            type: 'match',
            matchId: 'match-123',
          },
        },
      },
    } as unknown as any;

    handleNotificationTap(notification, mockNavigation);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'MatchDetail',
        params: { matchId: 'match-123' },
      },
    });
  });

  it('should route message notification to Chat', () => {
    const notification = {
      date: Date.now(),
      request: {
        content: {
          data: {
            type: 'message',
            matchId: 'match-456',
          },
        },
      },
    } as unknown as any;

    handleNotificationTap(notification, mockNavigation);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'Chat',
        params: { matchId: 'match-456' },
      },
    });
  });

  it('should route proposal notification to MatchDetail', () => {
    const notification = {
      date: Date.now(),
      request: {
        content: {
          data: {
            type: 'proposal',
            matchId: 'match-789',
            proposalId: 'proposal-123',
          },
        },
      },
    } as unknown as any;

    handleNotificationTap(notification, mockNavigation);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'MatchDetail',
        params: { matchId: 'match-789' },
      },
    });
  });

  it('should route confirm notification to MatchDetail', () => {
    const notification = {
      date: Date.now(),
      request: {
        content: {
          data: {
            type: 'confirm',
            matchId: 'match-999',
            proposalId: 'proposal-456',
          },
        },
      },
    } as unknown as any;

    handleNotificationTap(notification, mockNavigation);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'MatchDetail',
        params: { matchId: 'match-999' },
      },
    });
  });

  it('should warn when navigation is null', () => {
    const notification = {
      date: Date.now(),
      request: {
        content: {
          data: {
            type: 'match',
            matchId: 'match-123',
          },
        },
      },
    } as unknown as any;

    handleNotificationTap(notification, null);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Navigation ref not available for notification deep link'
    );
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('should not navigate when notification type is missing', () => {
    const notification = {
      date: Date.now(),
      request: {
        content: {
          data: {
            matchId: 'match-123',
          },
        },
      },
    } as unknown as any;

    handleNotificationTap(notification, mockNavigation);

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('should not navigate when matchId is missing', () => {
    const notification = {
      date: Date.now(),
      request: {
        content: {
          data: {
            type: 'message',
          },
        },
      },
    } as unknown as any;

    handleNotificationTap(notification, mockNavigation);

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});
