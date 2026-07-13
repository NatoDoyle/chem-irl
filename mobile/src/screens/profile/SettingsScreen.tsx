import { ReactNode, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { BRAND, BRAND_COLORS } from '../../config/brand';
import { supabase } from '../../lib/supabase/client';
import { addBreadcrumb } from '../../lib/sentry';
import { getEntitlement } from '../../lib/subscription';
import { IAPUnavailableInExpoGoError, restorePurchases } from '../../lib/iap';
import { deleteMyAccount } from '../../lib/account';
import { getErrorAlert } from '../../lib/errors';
import type { IrisEntitlementReason } from '../../lib/iris/types';
import styles from './SettingsScreen.styles';

const DELETE_CONFIRM_WORD = 'DELETE';

const SUBSCRIPTION_LABELS: Record<IrisEntitlementReason, string> = {
  unauthenticated: '—',
  never_subscribed: 'Free',
  trial: 'Trial',
  subscribed: 'Active',
  expired: 'Expired',
};

const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

type SettingsNavigationProp = NativeStackNavigationProp<any, 'Settings'>;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SettingsNavigationProp>();
  const [email, setEmail] = useState<string | null>(null);
  const [subscriptionLabel, setSubscriptionLabel] = useState<string>('—');
  const [restoring, setRestoring] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    getEntitlement()
      .then((ent) => {
        if (!cancelled) setSubscriptionLabel(SUBSCRIPTION_LABELS[ent.reason] ?? 'Free');
      })
      .catch(() => {
        if (!cancelled) setSubscriptionLabel('Free');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    addBreadcrumb('User signing out', 'auth', 'info');
    await supabase.auth.signOut();
  };

  const openURL = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', 'Please try again later.');
    });
  };

  const handleRestorePurchases = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const count = await restorePurchases();
      // Refresh entitlement after restore so the status row updates if a
      // subscription was reactivated.
      try {
        const ent = await getEntitlement();
        setSubscriptionLabel(SUBSCRIPTION_LABELS[ent.reason] ?? 'Free');
      } catch {
        /* non-fatal */
      }
      Alert.alert(
        'Restore Purchases',
        count > 0
          ? `Restored ${count} purchase${count === 1 ? '' : 's'}.`
          : 'Nothing to restore on this account.'
      );
    } catch (err) {
      if (err instanceof IAPUnavailableInExpoGoError) {
        Alert.alert('Not available', err.message);
      } else {
        Alert.alert(
          'Restore failed',
          err instanceof Error ? err.message : 'Please try again later.'
        );
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile, photos, matches, and messages. This cannot be undone.\n\nCancel your Chem Plus subscription in the App Store / Play Store separately if you have one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setDeleteModalVisible(true);
          },
        },
      ]
    );
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalVisible(false);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (deleting) return;
    if (deleteConfirmText !== DELETE_CONFIRM_WORD) return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      // No further UI work: signOut inside deleteMyAccount triggers the
      // root-level auth listener which swaps to AuthNavigator.
    } catch (err) {
      const { title, message } = getErrorAlert(err, 'Account deletion failed');
      Alert.alert(title, message);
      setDeleting(false);
    }
  };

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <AnimatedPressable
            style={styles.headerIcon}
            onPress={() => navigation.goBack()}
            haptic={false}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={BRAND_COLORS.primary} />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerIcon} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Account" />
        <Section>
          <ReadOnlyRow label="Email" value={email ?? '—'} />
          <Separator />
          <Row label="Sign Out" destructive onPress={handleSignOut} />
        </Section>

        <SectionHeader title="Subscription" />
        <Section>
          <ReadOnlyRow label="Chem Plus" value={subscriptionLabel} />
          <Separator />
          <Row label="Restore Purchases" loading={restoring} onPress={handleRestorePurchases} />
          <Separator />
          <Row
            label="Manage in App Store"
            external
            onPress={() => openURL(MANAGE_SUBSCRIPTION_URL)}
          />
        </Section>

        <SectionHeader title="Support" />
        <Section>
          <Row label="Contact Support" external onPress={() => openURL(`${BRAND.url}/support`)} />
        </Section>

        <SectionHeader title="Legal" />
        <Section>
          <Row label="Privacy Policy" external onPress={() => openURL(`${BRAND.url}/privacy`)} />
          <Separator />
          <Row label="Terms of Service" external onPress={() => openURL(`${BRAND.url}/terms`)} />
          <Separator />
          <Row label="Safety Guidelines" external onPress={() => openURL(`${BRAND.url}/safety`)} />
        </Section>

        <SectionHeader title="About" />
        <Section>
          <ReadOnlyRow label="Version" value={version} />
        </Section>

        <SectionHeader title="Danger Zone" />
        <Section>
          <Row label="Delete Account" destructive onPress={handleDeleteAccount} />
        </Section>
      </ScrollView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm deletion</Text>
            <Text style={styles.modalBody}>
              Type {DELETE_CONFIRM_WORD} to confirm. Your account and all associated data will be
              permanently removed.
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              editable={!deleting}
              placeholder={DELETE_CONFIRM_WORD}
              placeholderTextColor={BRAND_COLORS.text[500]}
              style={styles.modalInput}
              accessibilityLabel="Type DELETE to confirm"
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={closeDeleteModal}
                disabled={deleting}
                style={styles.modalCancelButton}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmDelete}
                disabled={deleting || deleteConfirmText !== DELETE_CONFIRM_WORD}
                style={[
                  styles.modalDeleteButton,
                  (deleting || deleteConfirmText !== DELETE_CONFIRM_WORD) &&
                    styles.modalDeleteButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Permanently delete account"
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={BRAND_COLORS.onPrimary} />
                ) : (
                  <Text style={styles.modalDeleteText}>Permanently Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title.toUpperCase()}</Text>
    </View>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function Separator() {
  return <View style={styles.separator} />;
}

function Row({
  label,
  destructive = false,
  external = false,
  loading = false,
  onPress,
}: {
  label: string;
  destructive?: boolean;
  external?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      style={styles.row}
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={label}
    >
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={BRAND_COLORS.primary} />
      ) : (
        <Ionicons
          name={external ? 'open-outline' : 'chevron-forward'}
          size={18}
          color={destructive ? BRAND_COLORS.danger : BRAND_COLORS.text[500]}
        />
      )}
    </AnimatedPressable>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
