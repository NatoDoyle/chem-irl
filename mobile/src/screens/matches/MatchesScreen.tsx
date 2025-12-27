import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Match } from '../../lib/types';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';

const PLACEHOLDER_IMAGE = require('../../assets/icon.png');

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

export default function MatchesScreen() {
  const navigation = useNavigation<MatchesScreenNavigationProp>();
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  // Refresh matches when screen comes into focus (e.g., after returning from Discover tab with new match)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if not currently loading and we have matches (to avoid loading spinner on every focus)
      // Or if matches list is empty (to catch new matches)
      if (!loading && matches.length === 0) {
        loadMatches();
      }
    }, [loading, matches.length])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  const loadMatches = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get matches directly from matches table (RLS allows viewing own matches)
      const { data: matchesData, error } = await supabase
        .from('matches')
        .select('match_id, user_a, user_b, status, created_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading matches:', error);
        const { title, message } = getErrorAlert(error, 'Failed to load matches');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Fetch profile info for each match
      const matchesWithProfiles = await Promise.all(
        (matchesData || []).map(async (match: Match) => {
          const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;

          // Get other user's profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('photos, prompts')
            .eq('user_id', otherUserId)
            .single();

          const photos = (profile?.photos as string[]) || [];
          const prompts = (profile?.prompts as Record<string, string>) || {};

          return {
            ...match,
            otherUserId,
            otherUserPhoto: photos[0],
            otherUserName: prompts.headline || 'No name',
          };
        })
      );

      setMatches(matchesWithProfiles);
    } catch (error: any) {
      console.error('Error loading matches:', error);
      const { title, message } = getErrorAlert(error, 'Failed to load matches');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchPress = (matchId: string) => {
    navigation.navigate('MatchDetail', { matchId });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No matches yet</Text>
        <Text style={styles.emptySubtext}>Start swiping to find matches!</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadMatches}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.matchCard}
            onPress={() => handleMatchPress(item.match_id)}
          >
            <Image
              source={item.otherUserPhoto ? { uri: item.otherUserPhoto } : PLACEHOLDER_IMAGE}
              style={styles.avatar}
            />
            <View style={styles.matchInfo}>
              <Text style={styles.matchName}>{item.otherUserName}</Text>
              <Text style={styles.matchStatus}>
                {item.status === 'open' ? 'Open' : item.status}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  list: {
    padding: 16,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
