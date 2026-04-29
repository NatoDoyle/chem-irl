import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  AppState,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { Match } from '../../lib/types';
import { BRAND_COLORS, MIDNIGHT, GOLD, TYPOGRAPHY, SPACING } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { createDebounce } from '../../lib/debounce';
import type { RealtimeChannel } from '@supabase/supabase-js';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import GHButton from '../../components/ui/GHButton';
import { SkeletonCard } from '../../components/ui/Skeleton';

const REFRESH_THROTTLE_MS = 10000; // 10 seconds - minimum time between auto-refreshes
const REALTIME_DEBOUNCE_MS = 750; // 750ms debounce for realtime subscription callbacks

const PLACEHOLDER_IMAGE = require('../../../assets/icon.png');

type MatchesStackParamList = {
  MatchesList: undefined;
  MatchDetail: { matchId: string };
  Propose: { matchId: string; responseTo?: string };
  Chat: { matchId: string };
  ViewProfile: { userId: string };
};

type MatchesScreenNavigationProp = NativeStackNavigationProp<MatchesStackParamList, 'MatchesList'>;

interface MatchWithProfile extends Match {
  otherUserId: string;
  otherUserPhoto?: string;
  otherUserName?: string;
  lastMessage?: string;
  lastMessageIsOwn?: boolean;
  hasActiveProposal: boolean;
  hasConfirmedDate: boolean;
}

type MatchSection = {
  title: string;
  data: MatchWithProfile[];
  type: 'active' | 'expired';
};

/** Format remaining time as "Xh Ym left" */
function formatTimeLeft(expiresAt: string): { text: string; urgent: boolean } {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return { text: 'Expired', urgent: true };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const urgent = hours < 12;

  if (hours > 0) {
    return { text: `${hours}h ${minutes}m left`, urgent };
  }
  return { text: `${minutes}m left`, urgent };
}

/** Format how long ago the match was created */
function formatDaysAgo(createdAt: string): string {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Matched today';
  if (diffDays === 1) return 'Matched 1 day ago';
  return `Matched ${diffDays} days ago`;
}

// Memoized match item component for active matches
const MatchItem = memo(
  ({
    item,
    onPress,
    onPhotoPress,
  }: {
    item: MatchWithProfile;
    onPress: (item: MatchWithProfile) => void;
    onPhotoPress: (userId: string) => void;
  }) => {
    const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(item.expires_at));

    // Tick timer every 60 seconds
    useEffect(() => {
      const interval = setInterval(() => {
        setTimeLeft(formatTimeLeft(item.expires_at));
      }, 60000);
      return () => clearInterval(interval);
    }, [item.expires_at]);

    const messagePreview = item.lastMessage
      ? item.lastMessageIsOwn
        ? `You: ${item.lastMessage}`
        : item.lastMessage
      : 'No messages yet';

    return (
      <AnimatedPressable style={styles.matchCard} onPress={() => onPress(item)}>
        <View style={styles.cardRow}>
          <Pressable
            onPress={() => onPhotoPress(item.otherUserId)}
            style={styles.avatarContainer}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.otherUserName ?? 'match'}'s profile`}
            hitSlop={6}
          >
            <Image
              source={item.otherUserPhoto ? { uri: item.otherUserPhoto } : PLACEHOLDER_IMAGE}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={styles.onlineDot} />
          </Pressable>
          <View style={styles.matchInfo}>
            <View style={styles.topRow}>
              <Text style={styles.matchName} numberOfLines={1}>
                {item.otherUserName}
              </Text>
              <Text
                style={[styles.timerText, timeLeft.urgent && styles.timerTextUrgent]}
                numberOfLines={1}
              >
                {timeLeft.text}
              </Text>
            </View>
            <View style={styles.bottomRow}>
              <Text style={styles.messagePreview} numberOfLines={1}>
                {messagePreview}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    );
  }
);

MatchItem.displayName = 'MatchItem';

// Memoized match item component for expired matches
const ExpiredMatchItem = memo(
  ({
    item,
    onPress,
    onPhotoPress,
    onReactivate,
  }: {
    item: MatchWithProfile;
    onPress: (item: MatchWithProfile) => void;
    onPhotoPress: (userId: string) => void;
    onReactivate: (matchId: string) => void;
  }) => {
    const [reactivating, setReactivating] = useState(false);

    const handleReactivate = useCallback(async () => {
      setReactivating(true);
      try {
        const { error } = await supabase.rpc('reactivate_match', {
          p_match_id: item.match_id,
        });
        if (error) {
          const { message } = getErrorAlert(error, 'Failed to reactivate match');
          Alert.alert('Error', message);
        } else {
          onReactivate(item.match_id);
        }
      } catch (err: any) {
        const { message } = getErrorAlert(err, 'Failed to reactivate match');
        Alert.alert('Error', message);
      } finally {
        setReactivating(false);
      }
    }, [item.match_id, onReactivate]);

    return (
      <AnimatedPressable
        style={[styles.matchCard, styles.matchCardExpired]}
        onPress={() => onPress(item)}
      >
        <View style={styles.cardRow}>
          <Pressable
            onPress={() => onPhotoPress(item.otherUserId)}
            style={styles.avatarContainer}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.otherUserName ?? 'match'}'s profile`}
            hitSlop={6}
          >
            <Image
              source={item.otherUserPhoto ? { uri: item.otherUserPhoto } : PLACEHOLDER_IMAGE}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </Pressable>
          <View style={styles.matchInfo}>
            <View style={styles.topRow}>
              <Text style={[styles.matchName, styles.expiredText]} numberOfLines={1}>
                {item.otherUserName}
              </Text>
              <Text style={styles.expiredLabel}>Expired</Text>
            </View>
            <View style={styles.bottomRow}>
              <Text style={[styles.messagePreview, styles.expiredText]} numberOfLines={1}>
                {formatDaysAgo(item.created_at)}
              </Text>
              {reactivating ? (
                <ActivityIndicator size="small" color={GOLD[600]} />
              ) : (
                <GHButton
                  title="Reactivate"
                  onPress={handleReactivate}
                  variant="gold"
                  style={styles.reactivateButton}
                  textStyle={styles.reactivateButtonText}
                />
              )}
            </View>
          </View>
        </View>
      </AnimatedPressable>
    );
  }
);

ExpiredMatchItem.displayName = 'ExpiredMatchItem';

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
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
        // Fetch ALL matches (open + expired) for section display
        const { data: matchesData, error: queryError } = await supabase
          .from('matches')
          .select('match_id, user_a, user_b, status, created_at, expires_at')
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
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
        let profilesMap = new Map<
          string,
          { full_name: string; photos: string[]; prompts: Record<string, string> }
        >();
        if (otherUserIds.length > 0) {
          try {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, full_name, photos, prompts')
              .in('id', otherUserIds);

            // Create a map for O(1) lookup
            if (profilesData) {
              profilesMap = new Map(
                profilesData.map((profile) => [
                  profile.id,
                  {
                    full_name: (profile.full_name as string) || '',
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

        // Batch fetch last messages per match
        const matchIds = (matchesData || []).map((m: Match) => m.match_id);
        let lastMessageMap = new Map<
          string,
          { content: string; sender_id: string; created_at: string }
        >();
        if (matchIds.length > 0) {
          const { data: messagesData } = await supabase
            .from('messages')
            .select('match_id, content, sender_id, created_at')
            .in('match_id', matchIds)
            .order('created_at', { ascending: false });
          if (messagesData) {
            for (const msg of messagesData) {
              if (!lastMessageMap.has(msg.match_id)) {
                lastMessageMap.set(msg.match_id, msg);
              }
            }
          }
        }

        // Batch fetch proposal + confirm state per match. Drives smart routing
        // on tap (no proposal -> Propose, active proposal -> MatchDetail,
        // confirmed -> Chat) without an extra round-trip per card.
        const activeProposalMatchIds = new Set<string>();
        const confirmedMatchIds = new Set<string>();
        if (matchIds.length > 0) {
          const [{ data: proposalsData }, { data: confirmsData }] = await Promise.all([
            supabase.from('proposals').select('match_id, status').in('match_id', matchIds),
            supabase.from('confirms').select('match_id').in('match_id', matchIds),
          ]);
          for (const p of proposalsData || []) {
            if (p.status === 'active') {
              activeProposalMatchIds.add(p.match_id);
            }
          }
          for (const c of confirmsData || []) {
            confirmedMatchIds.add(c.match_id);
          }
        }

        // Map matches with profile info from batch fetch
        const matchesWithProfiles: MatchWithProfile[] = (matchesData || []).map((match: Match) => {
          const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;
          const profile = profilesMap.get(otherUserId);

          return {
            ...match,
            otherUserId,
            otherUserPhoto: (profile?.photos || [])[0],
            otherUserName: profile?.full_name || 'No name',
            lastMessage: lastMessageMap.get(match.match_id)?.content,
            lastMessageIsOwn: lastMessageMap.get(match.match_id)?.sender_id === user.id,
            hasActiveProposal: activeProposalMatchIds.has(match.match_id),
            hasConfirmedDate: confirmedMatchIds.has(match.match_id),
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

  // Route based on the match's current state. The previous behaviour always
  // landed on MatchDetail, which was an empty stop ("photo + name + propose
  // button") whenever no proposal existed. Now the user goes straight to the
  // next action: propose, see proposal status, or chat.
  const handleMatchPress = useCallback(
    (item: MatchWithProfile) => {
      if (item.hasConfirmedDate) {
        navigation.navigate('Chat', { matchId: item.match_id });
      } else if (item.hasActiveProposal) {
        navigation.navigate('MatchDetail', { matchId: item.match_id });
      } else {
        navigation.navigate('Propose', { matchId: item.match_id });
      }
    },
    [navigation]
  );

  const handlePhotoPress = useCallback(
    (userId: string) => {
      navigation.navigate('ViewProfile', { userId });
    },
    [navigation]
  );

  const handleReactivate = useCallback(() => {
    // Refresh matches after reactivation
    loadMatches(true);
  }, [loadMatches]);

  // Build sections for SectionList
  const activeMatches = matches.filter((m) => m.status === 'open');
  const expiredMatches = matches.filter((m) => m.status === 'expired');

  const sections: MatchSection[] = [
    { title: 'Conversations', data: activeMatches, type: 'active' as const },
    ...(expiredMatches.length > 0
      ? [{ title: 'Expired', data: expiredMatches, type: 'expired' as const }]
      : []),
  ];

  // Calculate item height for getItemLayout optimization
  // matchCard: padding 12 top + 12 bottom = 24, two rows ~48, marginBottom 12
  // Total: ~84px
  const ITEM_HEIGHT = 84;
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item, section }: { item: MatchWithProfile; section: MatchSection }) => {
      if (section.type === 'expired') {
        return (
          <ExpiredMatchItem
            item={item}
            onPress={handleMatchPress}
            onPhotoPress={handlePhotoPress}
            onReactivate={handleReactivate}
          />
        );
      }
      return <MatchItem item={item} onPress={handleMatchPress} onPhotoPress={handlePhotoPress} />;
    },
    [handleMatchPress, handlePhotoPress, handleReactivate]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: MatchSection }) => (
      <View style={styles.listHeader}>
        <Text
          style={[
            styles.listHeaderTitle,
            section.type === 'expired' && styles.listHeaderTitleMuted,
          ]}
        >
          {section.title}
        </Text>
        {section.data.length > 0 && (
          <View style={[styles.newBadge, section.type === 'expired' && styles.newBadgeExpired]}>
            <Text
              style={[
                styles.newBadgeText,
                section.type === 'expired' && styles.newBadgeTextExpired,
              ]}
            >
              {section.data.length} Match{section.data.length !== 1 ? 'es' : ''}
            </Text>
          </View>
        )}
      </View>
    ),
    []
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Matches</Text>
        </View>
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
      <View style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Failed to load matches</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <GHButton title="Retry" onPress={() => loadMatches()} style={styles.actionButton} />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>No matches yet</Text>
        <Text style={styles.emptySubtext}>Start swiping to find matches!</Text>
        <GHButton title="Refresh" onPress={() => loadMatches()} style={styles.actionButton} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Matches</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.match_id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND_COLORS.primary}
          />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonContainer: {
    padding: SPACING.base,
  },
  skeletonItem: {
    marginBottom: SPACING.md,
  },
  list: {
    padding: SPACING.base,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.base,
    marginTop: SPACING.sm,
  },
  listHeaderTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  listHeaderTitleMuted: {
    color: BRAND_COLORS.text[600],
  },
  newBadge: {
    backgroundColor: 'rgba(10, 127, 116, 0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: MIDNIGHT.radius.full,
  },
  newBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  newBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.primaryLight,
  },
  newBadgeTextExpired: {
    color: BRAND_COLORS.danger,
  },
  matchCard: {
    backgroundColor: 'rgba(17, 19, 24, 0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  matchCardExpired: {
    opacity: 0.5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MIDNIGHT.borderDefault,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND_COLORS.primary,
    borderWidth: 2,
    borderColor: MIDNIGHT.bg,
  },
  matchInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    flex: 1,
    marginRight: SPACING.sm,
  },
  timerText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[600],
  },
  timerTextUrgent: {
    color: GOLD[600],
  },
  messagePreview: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    flex: 1,
    marginRight: SPACING.sm,
  },
  chevron: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    color: BRAND_COLORS.text[500],
  },
  expiredLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.danger,
  },
  expiredText: {
    opacity: 0.8,
  },
  reactivateButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: MIDNIGHT.radius.sm,
  },
  reactivateButtonText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
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
    textAlign: 'center',
    marginBottom: SPACING.base,
  },
  actionButton: {
    marginTop: SPACING.sm,
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
    paddingHorizontal: SPACING.xl,
  },
});
