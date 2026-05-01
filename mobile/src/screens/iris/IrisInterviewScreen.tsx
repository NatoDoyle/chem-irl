import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../../config/brand';
import { supabase } from '../../lib/supabase/client';
import { trackEvent } from '../../lib/analytics';
import { getErrorAlert } from '../../lib/errors';
import { useProfileRefresh } from '../../contexts/ProfileRefreshContext';
import {
  IRIS_NAME,
  IRIS_INTRO_TITLE,
  IRIS_INTRO_BODY,
  IRIS_INTRO_START_CTA,
  IRIS_INTRO_SKIP_CTA,
} from '../../lib/iris/persona';
import { IRIS_SURFACES } from '../../lib/iris/types';
import type { ProposeBioDraftInput } from '../../lib/iris/types';
import IrisLaunchButton from '../../components/IrisLaunchButton';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type IrisInterviewScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'IrisInterview'
>;

const INTERVIEW_GREETING =
  "Hi — I'm Iris. I'd love to ask you a few things so we can write a profile " +
  "that actually sounds like you. Mostly stories, no big philosophical questions. " +
  "Ready when you are.";

export default function IrisInterviewScreen(): JSX.Element {
  const navigation = useNavigation<IrisInterviewScreenNavigationProp>();
  const refreshProfile = useProfileRefresh();
  const [savingBio, setSavingBio] = useState(false);
  const [savingFinish, setSavingFinish] = useState(false);
  const [bioApplied, setBioApplied] = useState(false);

  // Iris's bio draft tool call lands here. We write to profiles.prompts.bio
  // via the same code path the manual onboarding uses (read-modify-upsert).
  // The user is in control: nothing is saved until Iris emits the draft AND
  // the user tapped "Use this bio" in the modal.
  const handleBioDraft = useCallback(
    async (input: ProposeBioDraftInput) => {
      if (savingBio) return;
      setSavingBio(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Sign in to save your bio');
          return;
        }
        const { data: existing } = await supabase
          .from('profiles')
          .select('prompts')
          .eq('id', user.id)
          .maybeSingle();
        const prompts = ((existing?.prompts ?? {}) as Record<string, unknown>) ?? {};
        const nextPrompts = { ...prompts, bio: input.bio };
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: user.id, prompts: nextPrompts });
        if (error) {
          const { title, message } = getErrorAlert(error, 'Could not save bio');
          Alert.alert(title, message);
          return;
        }
        // iris_draft_used analytics event is added in PR 6 alongside the
        // rest of the iris_* events. Calling it here would fail type-check.
        setBioApplied(true);
        refreshProfile();
      } catch (err) {
        const { title, message } = getErrorAlert(err, 'Could not save bio');
        Alert.alert(title, message);
      } finally {
        setSavingBio(false);
      }
    },
    [savingBio, refreshProfile],
  );

  const handleFinish = useCallback(async () => {
    if (savingFinish) return;
    setSavingFinish(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign in to finish onboarding');
        return;
      }
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        completion_pct: 100,
        signup_completed: true,
      });
      if (error) {
        const { title, message } = getErrorAlert(error, 'Could not finish onboarding');
        Alert.alert(title, message);
        return;
      }
      trackEvent('onboarding_completed', { iris_used: bioApplied });
      refreshProfile();
    } catch (err) {
      const { title, message } = getErrorAlert(err, 'Could not finish onboarding');
      Alert.alert(title, message);
    } finally {
      setSavingFinish(false);
    }
  }, [savingFinish, bioApplied, refreshProfile]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>I</Text>
        </View>
        <Text style={styles.eyebrow}>{IRIS_NAME}</Text>
      </View>

      <Text style={styles.title}>{IRIS_INTRO_TITLE}</Text>
      <Text style={styles.body}>{IRIS_INTRO_BODY}</Text>

      <View style={styles.launchRow}>
        <IrisLaunchButton
          surface={IRIS_SURFACES.Interview}
          variant="block"
          label={IRIS_INTRO_START_CTA}
          initialGreeting={INTERVIEW_GREETING}
          finalizeOnClose
          onBioDraft={handleBioDraft}
        />
      </View>

      {savingBio && (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color={BRAND_COLORS.aqua[300]} />
          <Text style={styles.savingText}>Saving your bio…</Text>
        </View>
      )}

      {bioApplied && (
        <Text style={styles.bioAppliedText}>
          Bio saved to your profile. You can edit it later from Profile.
        </Text>
      )}

      <Pressable
        onPress={handleFinish}
        disabled={savingFinish}
        style={[styles.finishButton, savingFinish && styles.finishButtonDisabled]}
        accessibilityRole="button"
      >
        {savingFinish ? (
          <ActivityIndicator color={BRAND_COLORS.onPrimary} />
        ) : (
          <Text style={styles.finishText}>
            {bioApplied ? 'Done — enter the app' : 'Done — enter the app'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => navigation.goBack()}
        disabled={savingFinish}
        style={styles.skipButton}
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>{IRIS_INTRO_SKIP_CTA}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING['2xl'],
    gap: SPACING.md,
  },
  heroBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
  },
  eyebrow: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  title: {
    color: BRAND_COLORS.text[900],
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    lineHeight: TYPOGRAPHY.fontSize['3xl'] * TYPOGRAPHY.lineHeight.tight,
  },
  body: {
    color: BRAND_COLORS.text[700],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.md,
  },
  launchRow: {
    marginBottom: SPACING.md,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  savingText: {
    color: BRAND_COLORS.text[600],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  bioAppliedText: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  finishButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: MIDNIGHT.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  skipButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  skipText: {
    color: BRAND_COLORS.text[500],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
