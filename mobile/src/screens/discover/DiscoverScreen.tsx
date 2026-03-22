import { useState, useEffect, useCallback, useRef, MutableRefObject } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { FeedItem } from '../../lib/types';
import DiscoveryCardStack from '../../components/DiscoveryCardStack';
import MatchModal from '../../components/MatchModal';
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import ConnectionStatus from '../../components/ConnectionStatus';
import { createThrottle } from '../../lib/throttle';
import { addBreadcrumb } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';

type FeedItemWithPhotos = FeedItem & { photos: string[] };

const FEED_PAGE_SIZE = 20;
const LOAD_MORE_THRESHOLD = 5; // Load more when 5 cards remaining

export default function DiscoverScreen() {
  const [feed, setFeed] = useState<FeedItemWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [newMatchId, setNewMatchId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [seenUserIds, setSeenUserIds] = useState<Set<string>>(new Set());
  // Throttle like actions to prevent spam (min 1 second between likes)
  const likeThrottleRef = useRef(createThrottle(() => {}, 1000));
  const feedLenRef: MutableRefObject<number> = useRef(0);
  const seenIdsRef: MutableRefObject<Set<string>> = useRef(new Set());
  feedLenRef.current = feed.length;
  seenIdsRef.current = seenUserIds;

  const loadFeed = useCallback(async (reset: boolean = false) => {
    if (reset) {
      setError(null);
      setLoading(true);
      setFeed([]);
      setHasMore(true);
      setSeenUserIds(new Set());
      feedLenRef.current = 0;
      seenIdsRef.current = new Set();
    } else {
      setLoadingMore(true);
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const currentFeedSize = reset ? 0 : feedLenRef.current;
      const requestLimit = currentFeedSize + FEED_PAGE_SIZE;
      const currentSeenIds = reset ? new Set<string>() : seenIdsRef.current;

      const { data, error: rpcError } = await supabase.rpc('get_discovery_feed', {
        p_viewer: user.id,
        p_limit: requestLimit,
      });

      if (rpcError) {
        console.error('Error loading feed:', rpcError);
        const { message } = getErrorAlert(rpcError, 'Failed to load discovery feed');
        setError(message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const allItems = (data || []) as FeedItem[];

      // Filter out users we've already seen (due to RPC not supporting offset)
      const newItems = allItems.filter((item: FeedItem) => !currentSeenIds.has(item.user_id));

      // If we got fewer new items than requested, we've reached the end
      if (newItems.length === 0 || allItems.length < requestLimit) {
        setHasMore(false);
      }

      // Update seen user IDs
      const newSeenIds = new Set(currentSeenIds);
      newItems.forEach((item) => newSeenIds.add(item.user_id));
      setSeenUserIds(newSeenIds);
      seenIdsRef.current = newSeenIds;

      // Batch fetch all profiles at once to avoid N+1 query pattern
      const userIds = newItems.map((item: FeedItem) => item.user_id);

      let profilesMap = new Map<string, { photos: string[] }>();
      if (userIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, photos')
            .in('id', userIds);

          if (profilesData) {
            profilesMap = new Map(
              profilesData.map((profile) => [
                profile.id,
                { photos: Array.isArray(profile.photos) ? profile.photos : [] },
              ])
            );
          }
        } catch (error) {
          console.error('Error batch fetching profiles:', error);
        }
      }

      const feedWithPhotos: FeedItemWithPhotos[] = newItems.map((item: FeedItem) => {
        const profile = profilesMap.get(item.user_id);
        return {
          ...item,
          photos: profile?.photos ?? item.photos ?? [],
        };
      });

      setFeed((prev) => (reset ? feedWithPhotos : [...prev, ...feedWithPhotos]));
      feedLenRef.current = reset
        ? feedWithPhotos.length
        : feedLenRef.current + feedWithPhotos.length;
      setError(null);
    } catch (error: any) {
      console.error('Error loading feed:', error);
      const { message } = getErrorAlert(error, 'Failed to load discovery feed');
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(true);
  }, [loadFeed]);

  const handleLike = async (userId: string) => {
    // Prevent rapid successive likes (rate limiting)
    if (likeThrottleRef.current.isThrottled()) {
      return;
    }

    // Update throttle to prevent next call for 1 second
    likeThrottleRef.current.execute();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      addBreadcrumb('User liking another user', 'discovery', 'info', {
        liker: user.id.substring(0, 8),
        likee: userId.substring(0, 8),
      });
      trackEvent('like_sent', {
        likeeId: userId.substring(0, 8),
      });

      const { data, error } = await supabase.rpc('create_like_and_check_match', {
        p_liker: user.id,
        p_likee: userId,
      });

      if (error) {
        console.error('Error liking user:', error);
        const { title, message } = getErrorAlert(error, 'Failed to like user');
        Alert.alert(title, message);
        return;
      }

      // Check if matched
      if (data?.matched && data?.match_id) {
        addBreadcrumb('New match created', 'discovery', 'info', {
          matchId: data.match_id.substring(0, 8),
        });
        trackEvent('match_created', {
          matchId: data.match_id.substring(0, 8),
        });
        setNewMatchId(data.match_id);
        setMatchModalVisible(true);
        // Trigger matches list refresh by navigating to Matches tab temporarily
        // This ensures new match appears immediately when user navigates to Matches
        // We'll use a navigation event to trigger refresh in MatchesScreen
      }

      // Remove liked user from feed
      setFeed((prev) => prev.filter((item) => item.user_id !== userId));
    } catch (error: any) {
      console.error('Error liking user:', error);
      const { title, message } = getErrorAlert(error, 'Failed to like user');
      Alert.alert(title, message);
    }
  };

  const handlePass = (userId: string) => {
    // Simply remove from feed (no API call needed for pass)
    setFeed((prev) => prev.filter((item) => item.user_id !== userId));
  };

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
        <Text style={styles.errorText}>Failed to load discovery feed</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadFeed(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (feed.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No more profiles to discover</Text>
        <Text style={styles.emptySubtext}>Check back later for new matches</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadFeed(true)}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && feed.length > 0) {
      loadFeed(false);
    }
  };

  return (
    <View style={styles.container}>
      <ConnectionStatus />
      <DiscoveryCardStack
        feed={feed}
        onLike={handleLike}
        onPass={handlePass}
        onRefresh={() => loadFeed(true)}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
        hasMore={hasMore}
        loadMoreThreshold={LOAD_MORE_THRESHOLD}
      />
      <MatchModal
        visible={matchModalVisible}
        matchId={newMatchId}
        onClose={() => {
          setMatchModalVisible(false);
          setNewMatchId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: GOLDEN_HOUR.radius.lg,
    marginTop: 8,
    ...GOLDEN_HOUR.shadow.warm,
  },
  refreshButtonText: {
    color: '#fff',
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
    borderRadius: GOLDEN_HOUR.radius.lg,
    marginTop: 8,
    ...GOLDEN_HOUR.shadow.warm,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
