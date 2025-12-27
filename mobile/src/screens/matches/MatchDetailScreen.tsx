import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { Match, Proposal, Confirm } from '../../lib/types';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import ProposalCard from '../../components/ProposalCard';

const PLACEHOLDER_IMAGE = require('../../../assets/icon.png');

type MatchDetailRouteParams = {
  matchId: string;
};

type MatchDetailNavigationProp = NativeStackNavigationProp<any, 'MatchDetail'>;

export default function MatchDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<MatchDetailNavigationProp>();
  const { matchId } = route.params as MatchDetailRouteParams;

  const [match, setMatch] = useState<Match | null>(null);
  const [otherUserPhoto, setOtherUserPhoto] = useState<string>('');
  const [otherUserName, setOtherUserName] = useState<string>('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [confirms, setConfirms] = useState<Confirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveProposal, setHasActiveProposal] = useState(false);

  const loadMatchData = useCallback(async () => {
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

      // Load match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (matchError || !matchData) {
        console.error('Error loading match:', matchError);
        const { message } = getErrorAlert(
          matchError || new Error('Match not found'),
          'Failed to load match'
        );
        setError(message);
        setLoading(false);
        return;
      }

      setMatch(matchData as Match);
      const otherUserId = matchData.user_a === user.id ? matchData.user_b : matchData.user_a;

      // Load other user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('photos, prompts')
        .eq('user_id', otherUserId)
        .single();

      if (profile) {
        const photos = (profile.photos as string[]) || [];
        const prompts = (profile.prompts as Record<string, string>) || {};
        setOtherUserPhoto(photos[0] || '');
        setOtherUserName(prompts.headline || 'No name');
      }

      // Load proposals
      const { data: proposalsData } = await supabase
        .from('proposals')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });

      if (proposalsData) {
        setProposals(proposalsData as Proposal[]);
        const activeProposal = proposalsData.find((p: Proposal) => p.status === 'active');
        setHasActiveProposal(!!activeProposal);
      }

      // Load confirms
      const { data: confirmsData } = await supabase
        .from('confirms')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });

      if (confirmsData) {
        setConfirms(confirmsData as Confirm[]);
      }

      setError(null);
    } catch (error: any) {
      console.error('Error loading match data:', error);
      const { message } = getErrorAlert(error, 'Failed to load match details');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  // Auto-update proposal expiry status every minute
  // This ensures that if a proposal expires while user is viewing the screen,
  // the UI updates to show the expired state
  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;

  useEffect(() => {
    const checkExpiry = () => {
      const currentProposals = proposalsRef.current;
      if (!currentProposals.length) {
        return;
      }

      const now = new Date();
      let hasChanges = false;
      const updatedProposals = currentProposals.map((proposal) => {
        // Only check active proposals
        if (proposal.status === 'active') {
          const expiresAt = new Date(proposal.expires_at);
          if (expiresAt < now) {
            hasChanges = true;
            // Update status locally (DB update will happen on next load or via server-side trigger)
            return { ...proposal, status: 'expired' as const };
          }
        }
        return proposal;
      });

      if (hasChanges) {
        setProposals(updatedProposals);
        // Update hasActiveProposal state
        const activeProposal = updatedProposals.find((p) => p.status === 'active');
        setHasActiveProposal(!!activeProposal);
      }
    };

    // Check immediately
    checkExpiry();

    // Set up interval to check every minute
    const interval = setInterval(checkExpiry, 60000); // 60 seconds = 1 minute

    return () => {
      clearInterval(interval);
    };
  }, []); // Empty deps - only run once on mount

  const handlePropose = () => {
    navigation.navigate('Propose', { matchId });
  };

  const handleChat = () => {
    navigation.navigate('Chat', { matchId });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  if (error || !match) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Match not found'}</Text>
        {error && (
          <TouchableOpacity style={styles.retryButton} onPress={() => loadMatchData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const hasConfirmedDate = confirms.length > 0;
  const latestProposal = proposals[0];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={otherUserPhoto ? { uri: otherUserPhoto } : PLACEHOLDER_IMAGE}
          style={styles.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <Text style={styles.name}>{otherUserName}</Text>
      </View>

      {hasConfirmedDate && (
        <View style={styles.confirmedBanner}>
          <Text style={styles.confirmedText}>✓ Date Confirmed</Text>
          <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
            <Text style={styles.chatButtonText}>Open Chat</Text>
          </TouchableOpacity>
        </View>
      )}

      {latestProposal && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Proposal</Text>
          <ProposalCard
            proposal={latestProposal}
            matchId={matchId}
            onConfirm={() => loadMatchData()}
            onNoneSuits={() =>
              navigation.navigate('Propose', { matchId, responseTo: latestProposal.proposal_id })
            }
            existingConfirms={confirms}
          />
        </View>
      )}

      {!hasActiveProposal && !hasConfirmedDate && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.proposeButton} onPress={handlePropose}>
            <Text style={styles.proposeButtonText}>Propose 2-3 Times</Text>
          </TouchableOpacity>
        </View>
      )}

      {proposals.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Previous Proposals</Text>
          {proposals.slice(1).map((proposal) => (
            <ProposalCard
              key={proposal.proposal_id}
              proposal={proposal}
              matchId={matchId}
              onConfirm={() => loadMatchData()}
              onNoneSuits={() => loadMatchData()}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
  },
  confirmedBanner: {
    backgroundColor: BRAND_COLORS.success + '20',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmedText: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.success,
    marginBottom: 12,
  },
  chatButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 12,
  },
  proposeButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  proposeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.danger,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
