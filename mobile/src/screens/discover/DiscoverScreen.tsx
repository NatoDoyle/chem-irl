import { useState, useEffect, useCallback, useRef, MutableRefObject } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase/client';
import { FeedItem } from '../../lib/types';
import DiscoveryCardStack from '../../components/DiscoveryCardStack';
import MatchModal from '../../components/MatchModal';
import DiscoveryFilterSheet from '../../components/DiscoveryFilterSheet';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import ConnectionStatus from '../../components/ConnectionStatus';
import { createThrottle } from '../../lib/throttle';
import { addBreadcrumb } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { SkeletonCard } from '../../components/ui/Skeleton';
import {
  DiscoveryFilters,
  DEFAULT_FILTERS,
  loadFilters,
  saveFilters,
  toRpcParams,
} from '../../lib/discoveryFilters';

type FeedItemWithPhotos = FeedItem & { photos: string[] };

const FEED_PAGE_SIZE = 20;
const LOAD_MORE_THRESHOLD = 5; // Load more when 5 cards remaining

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<FeedItemWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [newMatchId, setNewMatchId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [seenUserIds, setSeenUserIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  // Throttle like actions to prevent spam (min 1 second between likes)
  const likeThrottleRef = useRef(createThrottle(() => {}, 1000));
  const feedLenRef: MutableRefObject<number> = useRef(0);
  const seenIdsRef: MutableRefObject<Set<string>> = useRef(new Set());
  // Held in a ref so loadFeed doesn't have to be re-memoised every time
  // filters change (which would also re-trigger the load-on-mount effect).
  const filtersRef: MutableRefObject<DiscoveryFilters> = useRef(filters);
  feedLenRef.current = feed.length;
  seenIdsRef.current = seenUserIds;
  filtersRef.current = filters;

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

      const { data, error: rpcError } = await supabase.rpc('get_discovery_feed_v4', {
        p_viewer: user.id,
        p_limit: requestLimit,
        ...toRpcParams(filtersRef.current),
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

  // Hydrate filters from the user's saved profile preferences once on mount.
  // After the first load completes, the feed will refresh with these applied.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const stored = await loadFilters(user.id);
        if (cancelled) return;
        setFilters(stored);
        filtersRef.current = stored;
        // Re-run the feed query with the loaded filters. If the initial mount
        // already returned with default filters, this is the cheapest way to
        // make sure the user sees their saved set without flickering.
        loadFeed(true);
      } catch (err) {
        // Filter hydration is best-effort; failures fall back to defaults.
        console.warn('Failed to hydrate discovery filters', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  const handleApplyFilters = useCallback(
    async (next: DiscoveryFilters) => {
      setFilters(next);
      filtersRef.current = next;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await saveFilters(user.id, next);
        }
      } catch (err: any) {
        const { message } = getErrorAlert(err, 'Failed to save filters');
        Alert.alert('Filters not saved', message);
      }
      await loadFeed(true);
    },
    [loadFeed]
  );

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

  const headerContent = (
    <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
      <Text style={styles.headerTitle}>Chem IRL</Text>
      <AnimatedPressable
        onPress={() => setFilterSheetVisible(true)}
        style={styles.filterButton}
        accessibilityLabel="Filter settings"
      >
        <Ionicons name="options-outline" size={22} color={BRAND_COLORS.text[600]} />
      </AnimatedPressable>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {headerContent}
        <View style={styles.skeletonContainer}>
          <SkeletonCard style={styles.skeletonItem} />
          <SkeletonCard style={styles.skeletonItem} />
          <SkeletonCard style={styles.skeletonItem} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {headerContent}
        <View style={styles.centeredContent}>
          <Text style={styles.errorText}>Failed to load discovery feed</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <AnimatedPressable style={styles.retryButton} onPress={() => loadFeed(true)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  if (feed.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        {headerContent}
        <View style={styles.centeredContent}>
          <Text style={styles.emptyText}>No more profiles to discover</Text>
          <Text style={styles.emptySubtext}>Check back later for new matches</Text>
          <AnimatedPressable style={styles.refreshButton} onPress={() => loadFeed(true)}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </AnimatedPressable>
        </View>
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
      {headerContent}
      <ConnectionStatus />
      <View style={styles.cardArea}>
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
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <Text style={styles.footerText}>SWIPE FOR MORE REACTIONS</Text>
      </View>
      <MatchModal
        visible={matchModalVisible}
        matchId={newMatchId}
        onClose={() => {
          setMatchModalVisible(false);
          setNewMatchId(null);
        }}
      />
      <DiscoveryFilterSheet
        visible={filterSheetVisible}
        initialFilters={filters}
        onClose={() => setFilterSheetVisible(false)}
        onApply={handleApplyFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifItalic,
    color: BRAND_COLORS.primary,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArea: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    paddingTop: SPACING.md,
  },
  footerText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[500],
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  skeletonContainer: {
    flex: 1,
    padding: SPACING.base,
  },
  skeletonItem: {
    marginBottom: SPACING.md,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: SPACING.base,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: MIDNIGHT.radius.full,
    marginTop: SPACING.sm,
    ...MIDNIGHT.shadow.warm,
  },
  refreshButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.danger,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: SPACING.base,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: MIDNIGHT.radius.full,
    marginTop: SPACING.sm,
    ...MIDNIGHT.shadow.warm,
  },
  retryButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
