import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { Match, Proposal, Confirm } from '../../lib/types';
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import ProposalCard from '../../components/ProposalCard';
import {
  INTENT_OPTIONS,
  FAMILY_PLANS_OPTIONS,
  PETS_OPTIONS,
  ACTIVITY_OPTIONS,
  FREQUENCY_OPTIONS,
  LOVE_LANGUAGE_OPTIONS,
} from '../../config/profileOptions';

const PLACEHOLDER_IMAGE = require('../../../assets/icon.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.1;

type MatchDetailRouteParams = {
  matchId: string;
};

type MatchDetailNavigationProp = NativeStackNavigationProp<any, 'MatchDetail'>;

function lookupLabel(
  options: { value: string; label: string }[],
  value: string | undefined
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

export default function MatchDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<MatchDetailNavigationProp>();
  const { matchId } = route.params as MatchDetailRouteParams;

  const [match, setMatch] = useState<Match | null>(null);
  const [otherUserPhotos, setOtherUserPhotos] = useState<string[]>([]);
  const [otherUserName, setOtherUserName] = useState<string>('');
  const [otherUserHeadline, setOtherUserHeadline] = useState<string>('');
  const [otherUserBio, setOtherUserBio] = useState<string>('');
  const [demographics, setDemographics] = useState<Record<string, any>>({});
  const [preferences, setPreferences] = useState<Record<string, any>>({});
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [confirms, setConfirms] = useState<Confirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveProposal, setHasActiveProposal] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

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
        setOtherUserName((profile.full_name as string) || prompts.headline || 'No name');
        setOtherUserHeadline(prompts.headline || '');
        setOtherUserBio(prompts.bio || '');
        setDemographics(prompts.demographics || {});
        setPreferences(prompts.preferences || {});
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
        if (proposal.status === 'active') {
          const expiresAt = new Date(proposal.expires_at);
          if (expiresAt < now) {
            hasChanges = true;
            return { ...proposal, status: 'expired' as const };
          }
        }
        return proposal;
      });

      if (hasChanges) {
        setProposals(updatedProposals);
        const activeProposal = updatedProposals.find((p) => p.status === 'active');
        setHasActiveProposal(!!activeProposal);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handlePropose = () => {
    navigation.navigate('Propose', { matchId });
  };

  const handleChat = () => {
    navigation.navigate('Chat', { matchId });
  };

  const onPhotoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActivePhotoIndex(index);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  if (error || !match) {
    return (
      <View style={styles.centered}>
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

  // Build profile detail items
  const heightDisplay = demographics.height_cm != null ? `${demographics.height_cm} cm` : null;
  const intentDisplay = lookupLabel(INTENT_OPTIONS, demographics.relationship_intent);
  const familyDisplay = lookupLabel(FAMILY_PLANS_OPTIONS, demographics.family_plans);
  const petsDisplay = lookupLabel(PETS_OPTIONS, demographics.pets);
  const activityDisplay = lookupLabel(ACTIVITY_OPTIONS, demographics.activity_level);
  const drinkingDisplay = lookupLabel(FREQUENCY_OPTIONS, demographics.drinking);
  const smokingDisplay = lookupLabel(FREQUENCY_OPTIONS, demographics.smoking);
  const loveLanguageDisplay = lookupLabel(LOVE_LANGUAGE_OPTIONS, preferences.love_language);
  const languagesArr = demographics.languages as string[] | undefined;
  const interestsArr = preferences.interests as string[] | undefined;

  const showBasics = heightDisplay || (languagesArr && languagesArr.length > 0);
  const showRelationship = intentDisplay || familyDisplay;
  const showLifestyle = activityDisplay || drinkingDisplay || smokingDisplay || petsDisplay;
  const showPersonality =
    loveLanguageDisplay || preferences.personality_type || preferences.astrology_sign;
  const showWorkEdu = preferences.job_title || preferences.education;
  const showInterests = interestsArr && interestsArr.length > 0;

  // Determine sticky CTA state
  const showProposeCTA = !hasActiveProposal && !hasConfirmedDate;
  const showChatCTA = hasConfirmedDate;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Photo gallery */}
        {otherUserPhotos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPhotoScroll}
              decelerationRate="fast"
            >
              {otherUserPhotos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ))}
            </ScrollView>
            {otherUserPhotos.length > 1 && (
              <View style={styles.paginationDots}>
                {otherUserPhotos.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.dot, index === activePhotoIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholderPhoto}>
            <Image
              source={PLACEHOLDER_IMAGE}
              style={styles.placeholderImage}
              contentFit="contain"
            />
          </View>
        )}

        {/* Name + headline */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>{otherUserName}</Text>
          {otherUserHeadline && otherUserName !== otherUserHeadline ? (
            <Text style={styles.headline}>{otherUserHeadline}</Text>
          ) : null}
        </View>

        {/* Bio */}
        {otherUserBio ? (
          <View style={styles.section}>
            <Text style={styles.bioText}>{otherUserBio}</Text>
          </View>
        ) : null}

        {/* Profile details */}
        {showBasics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basics</Text>
            <View style={styles.chipRow}>
              {heightDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{heightDisplay}</Text>
                </View>
              )}
              {languagesArr?.map((lang) => (
                <View key={lang} style={styles.chip}>
                  <Text style={styles.chipText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {showRelationship && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Relationship</Text>
            <View style={styles.chipRow}>
              {intentDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{intentDisplay}</Text>
                </View>
              )}
              {familyDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{familyDisplay}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {showLifestyle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <View style={styles.chipRow}>
              {activityDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{activityDisplay}</Text>
                </View>
              )}
              {drinkingDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Drinks: {drinkingDisplay}</Text>
                </View>
              )}
              {smokingDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Smokes: {smokingDisplay}</Text>
                </View>
              )}
              {petsDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{petsDisplay}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {showPersonality && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personality</Text>
            <View style={styles.chipRow}>
              {loveLanguageDisplay && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{loveLanguageDisplay}</Text>
                </View>
              )}
              {preferences.personality_type && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{preferences.personality_type}</Text>
                </View>
              )}
              {preferences.astrology_sign && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{preferences.astrology_sign}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {showWorkEdu && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work & Education</Text>
            <View style={styles.chipRow}>
              {preferences.job_title && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{preferences.job_title}</Text>
                </View>
              )}
              {preferences.education && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{preferences.education}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {showInterests && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.chipRow}>
              {interestsArr!.map((interest) => (
                <View key={interest} style={[styles.chip, styles.chipAccent]}>
                  <Text style={[styles.chipText, styles.chipTextAccent]}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Proposals section */}
        {hasConfirmedDate && (
          <View style={styles.confirmedBanner}>
            <Text style={styles.confirmedText}>Date Confirmed</Text>
          </View>
        )}

        {latestProposal && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {latestProposal.status === 'active' ? 'Current Proposal' : 'Latest Proposal'}
            </Text>
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

        {/* Bottom spacer for sticky CTA */}
        {(showProposeCTA || showChatCTA) && <View style={styles.ctaSpacer} />}
      </ScrollView>

      {/* Sticky bottom CTA */}
      {showProposeCTA && (
        <View style={styles.stickyCTA}>
          <TouchableOpacity style={styles.proposeButton} onPress={handlePropose}>
            <Text style={styles.proposeButtonText}>Propose 2-3 Times</Text>
          </TouchableOpacity>
        </View>
      )}
      {showChatCTA && (
        <View style={styles.stickyCTA}>
          <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
            <Text style={styles.chatButtonText}>Open Chat</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GOLDEN_HOUR.bg,
  },

  // Photo gallery
  photo: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
  },
  placeholderPhoto: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT * 0.6,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImage: {
    width: 80,
    height: 80,
    opacity: 0.4,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GOLDEN_HOUR.borderDefault,
  },
  dotActive: {
    backgroundColor: BRAND_COLORS.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Name + headline
  nameSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
  },
  headline: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Bio
  bioText: {
    fontSize: 16,
    color: BRAND_COLORS.text[700],
    lineHeight: 24,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 10,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: GOLDEN_HOUR.borderDefault,
    backgroundColor: GOLDEN_HOUR.surface,
  },
  chipText: {
    fontSize: 14,
    color: BRAND_COLORS.text[700],
    fontWeight: '500',
  },
  chipAccent: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: '#D1FFFB',
  },
  chipTextAccent: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },

  // Confirmed banner
  confirmedBanner: {
    backgroundColor: BRAND_COLORS.success + '20',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
  },
  confirmedText: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.success,
  },

  // Sticky CTA
  stickyCTA: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: GOLDEN_HOUR.bg,
    borderTopWidth: 1,
    borderTopColor: GOLDEN_HOUR.borderDefault,
  },
  ctaSpacer: {
    height: 100,
  },
  proposeButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
  },
  proposeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  chatButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Error/retry
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
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignSelf: 'center',
    marginTop: 8,
    ...GOLDEN_HOUR.shadow.warm,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
