import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../../config/brand';
import Constants from 'expo-constants';

export default function DebugScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || null);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleClearCache = async () => {
    Alert.alert('Clear Cache', 'This will clear all AsyncStorage data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('cache');
          try {
            await AsyncStorage.clear();
            Alert.alert('Success', 'Cache cleared. App may need to reload.');
            await loadUserInfo();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to clear cache');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleResetOnboarding = async () => {
    Alert.alert(
      'Reset Onboarding',
      'This will reset your profile completion status to force onboarding. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('onboarding');
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Error', 'Not authenticated');
                return;
              }

              const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                completion_pct: 0,
              });

              if (error) {
                Alert.alert('Error', error.message);
                return;
              }

              Alert.alert(
                'Success',
                'Onboarding reset. Please restart the app to see onboarding screens.'
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reset onboarding');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('signout');
          try {
            await supabase.auth.signOut();
            Alert.alert('Success', 'Signed out successfully');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to sign out');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleRefetchProfile = async () => {
    setActionLoading('refetch');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert(
        'Profile Data',
        profile ? JSON.stringify(profile, null, 2).substring(0, 500) : 'No profile row',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch profile');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Debug Tools</Text>
      <Text style={styles.subtitle}>Development Only</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>User ID:</Text>
          <Text style={styles.infoValue} selectable>
            {userId || 'Not loaded'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue} selectable>
            {userEmail || 'Not available'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version:</Text>
          <Text style={styles.infoValue}>{Constants.expoConfig?.version || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Build:</Text>
          <Text style={styles.infoValue}>
            {typeof Constants.expoConfig?.runtimeVersion === 'string'
              ? Constants.expoConfig.runtimeVersion
              : 'N/A'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={[styles.button, actionLoading === 'cache' && styles.buttonDisabled]}
          onPress={handleClearCache}
          disabled={!!actionLoading}
        >
          {actionLoading === 'cache' ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Clear AsyncStorage / Cache</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, actionLoading === 'onboarding' && styles.buttonDisabled]}
          onPress={handleResetOnboarding}
          disabled={!!actionLoading}
        >
          {actionLoading === 'onboarding' ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Reset Onboarding State</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, actionLoading === 'refetch' && styles.buttonDisabled]}
          onPress={handleRefetchProfile}
          disabled={!!actionLoading}
        >
          {actionLoading === 'refetch' ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Refetch Profile</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonDanger,
            actionLoading === 'signout' && styles.buttonDisabled,
          ]}
          onPress={handleSignOut}
          disabled={!!actionLoading}
        >
          {actionLoading === 'signout' ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Sign Out</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingTop: 60,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.serifItalic,
    color: BRAND_COLORS.text[500],
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.base,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...MIDNIGHT.glassCard,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[600],
    width: 100,
  },
  infoValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[900],
    flex: 1,
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: MIDNIGHT.radius.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...MIDNIGHT.glow.primary,
  },
  buttonDanger: {
    backgroundColor: BRAND_COLORS.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
