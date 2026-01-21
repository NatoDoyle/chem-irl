import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { Match } from '../../lib/types';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { createDebounce } from '../../lib/debounce';
import type { RealtimeChannel } from '@supabase/supabase-js';

const REFRESH_THROTTLE_MS = 10000; // 10 seconds - minimum time between auto-refreshes
const REALTIME_DEBOUNCE_MS = 750; // 750ms debounce for realtime subscription callbacks

const PLACEHOLDER_IMAGE = require('../../../assets/icon.png');

type MatchesStackParamList = {
  MatchesList: undefined;
  MatchDetail: { matchId: string };
};

type MatchesScreenNavigationProp = NativeStackNavigationProp<MatchesStackParamList, 'MatchesList'>;

interface MatchWithProfile extends Match {
  otherUserId: string;
  otherUserPhoto?: string;
  otherUserName?: string;
}

// Memoized match item component for better FlatList performance
const MatchItem = memo(
  ({ item, onPress }: { item: MatchWithProfile; onPress: (matchId: string) => void }) => (
    <TouchableOpacity style={styles.matchCard} onPress={() => onPress(item.match_id)}>
      <Image
        source={item.otherUserPhoto ? { uri: item.otherUserPhoto } : PLACEHOLDER_IMAGE}
        style={styles.avatar}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.otherUserName}</Text>
        <Text style={styles.matchStatus}>{item.status === 'open' ? 'Open' : item.status}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )
);

MatchItem.displayName = 'MatchItem';

export default function MatchesScreen() {
  const navigation = useNavigation<MatchesScreenNavigationProp>();
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lastFetchTimeRef = useRef<number>(0);
  const userIdRef = useRef<string | null>(null);
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const isMountedRef = useRef<boolean>(true);
  const debouncedRefreshRef = useRef<ReturnType<typeof createDebounce> | null>(null);

  const loadMatches = useCallback(
    async (skipLoadingState: boolean = false) => {
      setError(null);
      if (!skipLoadingState) {
        setLoading(true);
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get matches directly from matches table (RLS allows viewing own matches)
        const { data: matchesData, error: queryError } = await supabase
          .from('matches')
          .select('match_id, user_a, user_b, status, created_at')
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        if (queryError) {
          console.error('Error loading matches:', queryError);
          const { message } = getErrorAlert(queryError, 'Failed to load matches');
          setError(message);
          setLoading(false);
          return;
        }

        // Batch fetch all profiles at once to avoid N+1 query pattern
        // Extract other user IDs from matches
        const otherUserIds = (matchesData || []).map((match: Match) =>
          match.user_a === user.id ? match.user_b : match.user_a
        );

        // Batch fetch all profiles in a single query
        let profilesMap = new Map<string, { photos: string[]; prompts: Record<string, string> }>();
        if (otherUserIds.length > 0) {
          try {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('user_id, photos, prompts')
              .in('user_id', otherUserIds);

            // Create a map for O(1) lookup
            if (profilesData) {
              profilesMap = new Map(
                profilesData.map((profile) => [
                  profile.user_id,
                  {
                    photos: (profile.photos as string[]) || [],
                    prompts: (profile.prompts as Record<string, string>) || {},
                  },
                ])
              );
            }
          } catch (error) {
            console.error('Error batch fetching profiles:', error);
            // Continue with empty map - will use fallback below
          }
        }

        // Map matches with profile info from batch fetch
        const matchesWithProfiles = (matchesData || []).map((match: Match) => {
          const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;
          const profile = profilesMap.get(otherUserId);
          const photos = profile?.photos || [];
          const prompts = profile?.prompts || {};

          return {
            ...match,
            otherUserId,
            otherUserPhoto: photos[0],
            otherUserName: prompts.headline || 'No name',
          };
        });

        setMatches(matchesWithProfiles);
        setError(null);
        lastFetchTimeRef.current = Date.now();
        // Store user ID for subscription setup
        if (user) {
          userIdRef.current = user.id;
        }
      } catch (error: any) {
        console.error('Error loading matches:', error);
        const { message } = getErrorAlert(error, 'Failed to load matches');
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [] // No dependencies - function is stable, skipLoadingState is a parameter
  );

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  // Set up realtime subscription for new matches
  // This provides instant updates when a new match is created, even when user is already on the screen.
  // We use focus-refresh as a fallback for when realtime fails or user switches tabs.
  useEffect(() => {
    isMountedRef.current = true;

    // Wait for initial load to complete and get user ID
    if (!userIdRef.current) {
      return;
    }

    const userId = userIdRef.current;

    // Debounced callback to refresh matches list on realtime events
    // Debouncing prevents multiple rapid fetches during bursts (e.g., multiple matches created quickly)
    // Guard: only execute if component is still mounted
    debouncedRefreshRef.current = createDebounce(() => {
      if (isMountedRef.current) {
        loadMatches(true); // Skip loading state during realtime updates
      }
    }, REALTIME_DEBOUNCE_MS);

    // Subscribe to matches table changes
    // Filter: matches where current user is either user_a or user_b
    // Since Supabase realtime filters can't easily do OR conditions, we subscribe to both
    // and deduplicate via debouncing
    // Column names verified: matches table has user_a and user_b columns (db/schema.sql)
    const channel = supabase
      .channel(`matches:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user_a=eq.${userId}`,
        },
        () => {
          debouncedRefreshRef.current?.execute();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user_b=eq.${userId}`,
        },
        () => {
          debouncedRefreshRef.current?.execute();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `user_a=eq.${userId}`,
        },
        () => {
          debouncedRefreshRef.current?.execute();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `user_b=eq.${userId}`,
        },
        () => {
          debouncedRefreshRef.current?.execute();
        }
      )
      .subscribe();

    // Track channel for cleanup
    channelsRef.current.push(channel);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;

      // Cancel any pending debounced callbacks
      if (debouncedRefreshRef.current) {
        debouncedRefreshRef.current.cancel();
        debouncedRefreshRef.current = null;
      }

      // Remove all tracked channels
      channelsRef.current.forEach((ch) => {
        supabase.removeChannel(ch);
      });
      channelsRef.current = [];
    };
  }, [loadMatches]);

  // Re-subscribe to realtime when app comes to foreground
  // This ensures we catch events that may have been missed while backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - reload matches and re-establish subscriptions
        loadMatches(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadMatches]);

  // Refresh matches when screen comes into focus, but throttle to avoid excessive calls
  // This complements realtime subscriptions by catching updates when:
  // - User switches back to the app/tab (realtime may have missed events while backgrounded)
  // - Realtime subscription fails or is delayed
  // Throttling (10s) prevents excessive network calls when rapidly switching tabs.
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;

      // Only auto-refresh if:
      // 1. Not currently loading/refreshing
      // 2. Last fetch was more than REFRESH_THROTTLE_MS ago (throttle)
      if (!loading && !refreshing && timeSinceLastFetch > REFRESH_THROTTLE_MS) {
        loadMatches();
      }
    }, [loading, refreshing, loadMatches])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatches(true); // Skip loading state during pull-to-refresh
    setRefreshing(false);
  };

  const handleMatchPress = useCallback(
    (matchId: string) => {
      navigation.navigate('MatchDetail', { matchId });
    },
    [navigation]
  );

  // Calculate item height for getItemLayout optimization
  // matchCard: padding 16 top + 16 bottom = 32, avatar 60, marginBottom 12
  // Total: 32 + 60 + 12 = 104px
  const ITEM_HEIGHT = 104;
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: MatchWithProfile }) => <MatchItem item={item} onPress={handleMatchPress} />,
    [handleMatchPress]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load matches</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadMatches()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No matches yet</Text>
        <Text style={styles.emptySubtext}>Start swiping to find matches!</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadMatches()}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.match_id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.surface,
  },
  list: {
    padding: 16,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'BRAND_COLORS.background[50]',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E2E8F0',
  },
  matchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  matchName: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 4,
  },
  matchStatus: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
  },
  chevron: {
    fontSize: 24,
    color: BRAND_COLORS.text[600],
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  refreshButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: BRAND_COLORS.danger,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
