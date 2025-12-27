import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { FeedItem } from '../../lib/types';
import DiscoveryCardStack from '../../components/DiscoveryCardStack';
import MatchModal from '../../components/MatchModal';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';

type FeedItemWithPhotos = FeedItem & { photos: string[] };

export default function DiscoverScreen() {
  const [feed, setFeed] = useState<FeedItemWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [newMatchId, setNewMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setError(null);
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('get_discovery_feed', {
        p_viewer: user.id,
        p_limit: 20,
      });

      if (rpcError) {
        console.error('Error loading feed:', rpcError);
        const { message } = getErrorAlert(rpcError, 'Failed to load discovery feed');
        setError(message);
        setLoading(false);
        return;
      }

      // Fetch photos for each user (with error handling) and normalize photos array
      const feedWithPhotos: FeedItemWithPhotos[] = await Promise.all(
        (data || []).map(async (item: FeedItem): Promise<FeedItemWithPhotos> => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('photos')
              .eq('user_id', item.user_id)
              .single();

            return {
              ...item,
              photos: Array.isArray(profile?.photos) ? profile.photos : (item.photos ?? []),
            };
          } catch {
            // If profile fetch fails, use item.photos or empty array
            return {
              ...item,
              photos: item.photos ?? [],
            };
          }
        })
      );

      setFeed(feedWithPhotos);
      setError(null);
    } catch (error: any) {
      console.error('Error loading feed:', error);
      const { message } = getErrorAlert(error, 'Failed to load discovery feed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (userId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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
        <TouchableOpacity style={styles.retryButton} onPress={loadFeed}>
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
        <TouchableOpacity style={styles.refreshButton} onPress={loadFeed}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DiscoveryCardStack
        feed={feed}
        onLike={handleLike}
        onPass={handlePass}
        onRefresh={loadFeed}
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
    backgroundColor: '#fff',
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
    borderRadius: 8,
    marginTop: 8,
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
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
