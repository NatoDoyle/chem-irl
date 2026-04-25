import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { Match, Proposal, Confirm } from '../../lib/types';
import { BRAND_COLORS, MIDNIGHT, GOLD, TYPOGRAPHY, SPACING } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import ProposalCard from '../../components/ProposalCard';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import GHButton from '../../components/ui/GHButton';

const PHOTO_WIDTH = 200;
const PHOTO_HEIGHT = 260;

const PLACEHOLDER_IMAGE = require('../../../assets/icon.png');

type MatchDetailRouteParams = {
  matchId: string;
};

type MatchDetailNavigationProp = NativeStackNavigationProp<any, 'MatchDetail'>;

export default function MatchDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<MatchDetailNavigationProp>();
  const { matchId } = route.params as MatchDetailRouteParams;

  const [match, setMatch] = useState<Match | null>(null);
  const [otherUserPhotos, setOtherUserPhotos] = useState<string[]>([]);
  const [otherUserName, setOtherUserName] = useState<string>('');
  const [otherUserBio, setOtherUserBio] = useState<string>('');
  const [otherUserInfoPills, setOtherUserInfoPills] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
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

      // Load other user's profile (id = otherUserId; maybeSingle for missing profile)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, photos, prompts')
        .eq('id', otherUserId)
        .maybeSingle();

      if (profileError) {
        const { message } = getErrorAlert(profileError, 'Failed to load match profile');
        setError(message);
      } else if (profile) {
        const photos = (profile.photos as string[]) || [];
        const prompts = (profile.prompts as Record<string, any>) || {};
        setOtherUserPhotos(photos);
        setOtherUserName(profile.full_name || 'No name');
        setOtherUserBio(prompts.bio || '');

        // Extract info pills from demographics and preferences
        const pills: string[] = [];
        const demographics = prompts.demographics as Record<string, any> | undefined;
        const preferences = prompts.preferences as Record<string, any> | undefined;
        if (demographics) {
          Object.entries(demographics).forEach(([, value]) => {
            if (typeof value === 'string' && value) pills.push(value);
            if (Array.isArray(value))
              value.forEach((v) => typeof v === 'string' && v && pills.push(v));
          });
        }
        if (preferences) {
          Object.entries(preferences).forEach(([, value]) => {
            if (typeof value === 'string' && value) pills.push(value);
            if (Array.isArray(value))
              value.forEach((v) => typeof v === 'string' && v && pills.push(v));
          });
        }
        setOtherUserInfoPills(pills);
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
      <View style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  if (error || !match) {
    return (
      <View style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error || 'Match not found'}</Text>
        {error && (
          <AnimatedPressable style={styles.retryButton} onPress={() => loadMatchData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </AnimatedPressable>
        )}
      </View>
    );
  }

  const hasConfirmedDate = confirms.length > 0;
  const latestProposal = proposals[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top }}>
      {/* Back button */}
      <View style={styles.backButtonRow}>
        <AnimatedPressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          haptic={false}
        >
          <Ionicons name="arrow-back" size={24} color={BRAND_COLORS.primary} />
        </AnimatedPressable>
      </View>

      {/* Profile section */}
      <View style={styles.header}>
        {/* Photo gallery */}
        {otherUserPhotos.length > 0 ? (
          <View>
            <FlatList
              data={otherUserPhotos}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              snapToInterval={PHOTO_WIDTH + SPACING.sm}
              decelerationRate="fast"
              contentContainerStyle={styles.photoGallery}
              keyExtractor={(item, index) => `${index}-${item}`}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / (PHOTO_WIDTH + SPACING.sm)
                );
                setActivePhotoIndex(Math.min(index, otherUserPhotos.length - 1));
              }}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={styles.galleryPhoto}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              )}
            />
            {otherUserPhotos.length > 1 && (
              <View style={styles.pageDots}>
                {otherUserPhotos.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.pageDot, index === activePhotoIndex && styles.pageDotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <Image
            source={PLACEHOLDER_IMAGE}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}

        {/* Name */}
        <Text style={styles.name}>{otherUserName}</Text>

        {/* Bio */}
        {otherUserBio ? <Text style={styles.bio}>{otherUserBio}</Text> : null}

        {/* Info pills */}
        {otherUserInfoPills.length > 0 && (
          <View style={styles.pillsContainer}>
            {otherUserInfoPills.map((pill, index) => (
              <View key={`${pill}-${index}`} style={styles.pill}>
                <Text style={styles.pillText}>{pill}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {hasConfirmedDate && (
        <View style={styles.confirmedBanner}>
          <Text style={styles.confirmedText}>✓ Date Confirmed</Text>
          <GHButton title="Open Chat" onPress={handleChat} style={styles.chatButton} />
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
          <GHButton title="Propose 2-3 Times" onPress={handlePropose} />
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
    backgroundColor: MIDNIGHT.bg,
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    height: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: MIDNIGHT.borderDefault,
  },
  photoGallery: {
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  galleryPhoto: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    borderRadius: MIDNIGHT.radius.md,
    backgroundColor: MIDNIGHT.borderDefault,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.text[500],
  },
  pageDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.primary,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MIDNIGHT.borderDefault,
    marginBottom: SPACING.md,
    borderWidth: 3,
    borderColor: BRAND_COLORS.primary,
  },
  name: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginTop: SPACING.md,
  },
  bio: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
    paddingHorizontal: SPACING.base,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
  },
  pill: {
    backgroundColor: 'rgba(17, 19, 24, 0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  pillText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[700],
  },
  confirmedBanner: {
    ...MIDNIGHT.glassCard,
    borderColor: GOLD[600],
    padding: SPACING.base,
    margin: SPACING.base,
    alignItems: 'center',
    ...MIDNIGHT.glow.gold,
  },
  confirmedText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: GOLD[600],
    marginBottom: SPACING.md,
  },
  chatButton: {
    alignSelf: 'stretch',
  },
  section: {
    padding: SPACING.base,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.danger,
    textAlign: 'center',
    marginTop: SPACING['2xl'],
    marginBottom: SPACING.base,
    paddingHorizontal: SPACING.xl,
  },
  retryButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: MIDNIGHT.radius.lg,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    ...MIDNIGHT.glow.primary,
  },
  retryButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
