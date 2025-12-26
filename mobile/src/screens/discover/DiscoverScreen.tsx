import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { FeedItem } from '../../lib/types';
import DiscoveryCardStack from '../../components/DiscoveryCardStack';
import MatchModal from '../../components/MatchModal';
import { BRAND_COLORS } from '../../config/brand';

type FeedItemWithPhotos = FeedItem & { photos: string[] };

export default function DiscoverScreen() {
  const [feed, setFeed] = useState<FeedItemWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [newMatchId, setNewMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('get_discovery_feed', {
        p_viewer: user.id,
        p_limit: 20,
      });

      if (error) {
        console.error('Error loading feed:', error);
        Alert.alert('Error', 'Failed to load discovery feed');
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
          } catch (error) {
            // If profile fetch fails, use item.photos or empty array
            return {
              ...item,
              photos: item.photos ?? [],
            };
          }
        })
      );

      setFeed(feedWithPhotos);
    } catch (error: any) {
      console.error('Error loading feed:', error);
      Alert.alert('Error', error.message || 'Failed to load discovery feed');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('create_like_and_check_match', {
        p_liker: user.id,
        p_likee: userId,
      });

      if (error) {
        console.error('Error liking user:', error);
        Alert.alert('Error', 'Failed to like user');
        return;
      }

      // Check if matched
      if (data?.matched && data?.match_id) {
        setNewMatchId(data.match_id);
        setMatchModalVisible(true);
      }

      // Remove liked user from feed
      setFeed((prev) => prev.filter((item) => item.user_id !== userId));
    } catch (error: any) {
      console.error('Error liking user:', error);
      Alert.alert('Error', error.message || 'Failed to like user');
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

  if (feed.length === 0) {
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
});
