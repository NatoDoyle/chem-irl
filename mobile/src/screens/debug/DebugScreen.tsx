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
import { BRAND_COLORS } from '../../config/brand';
import Constants from 'expo-constants';

type RowStatus = 'checking' | 'exists' | 'missing' | 'error';

interface RowStatusInfo {
  status: RowStatus;
  errorCode?: string;
  errorMessage?: string;
}

export default function DebugScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [usersRowStatus, setUsersRowStatus] = useState<RowStatusInfo>({ status: 'checking' });
  const [profilesRowStatus, setProfilesRowStatus] = useState<RowStatusInfo>({ status: 'checking' });

  useEffect(() => {
    if (__DEV__) {
      loadUserInfo();
      checkUsersRow();
      checkProfilesRow();
    }
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

  const checkUsersRow = async () => {
    if (!__DEV__) return;

    setUsersRowStatus({ status: 'checking' });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUsersRowStatus({ status: 'error', errorMessage: 'Not authenticated' });
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        setUsersRowStatus({
          status: 'error',
          errorCode: (error as any).code,
          errorMessage: error.message,
        });
      } else if (data) {
        setUsersRowStatus({ status: 'exists' });
      } else {
        setUsersRowStatus({ status: 'missing' });
      }
    } catch (error: any) {
      console.error('[DebugScreen] Error checking users row:', error);
      setUsersRowStatus({
        status: 'error',
        errorMessage: error.message || 'Unknown error',
      });
    }
  };

  const checkProfilesRow = async () => {
    if (!__DEV__) return;

    setProfilesRowStatus({ status: 'checking' });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setProfilesRowStatus({ status: 'error', errorMessage: 'Not authenticated' });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        setProfilesRowStatus({
          status: 'error',
          errorCode: (error as any).code,
          errorMessage: error.message,
        });
      } else if (data) {
        setProfilesRowStatus({ status: 'exists' });
      } else {
        setProfilesRowStatus({ status: 'missing' });
      }
    } catch (error: any) {
      console.error('[DebugScreen] Error checking profiles row:', error);
      setProfilesRowStatus({
        status: 'error',
        errorMessage: error.message || 'Unknown error',
      });
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
        .single();

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert('Profile Data', JSON.stringify(profile, null, 2).substring(0, 500), [
        { text: 'OK' },
      ]);
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
        {__DEV__ && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>public.users row:</Text>
              <Text style={styles.infoValue}>
                {usersRowStatus.status === 'checking'
                  ? 'Checking...'
                  : usersRowStatus.status === 'exists'
                    ? '✅ Exists'
                    : usersRowStatus.status === 'missing'
                      ? '❌ Missing'
                      : `⚠️ Error: ${usersRowStatus.errorCode || 'N/A'}`}
              </Text>
            </View>
            {usersRowStatus.status === 'error' && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>users error:</Text>
                <Text style={styles.infoValue}>
                  {usersRowStatus.errorCode || 'N/A'}: {usersRowStatus.errorMessage || 'N/A'}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>public.profiles row:</Text>
              <Text style={styles.infoValue}>
                {profilesRowStatus.status === 'checking'
                  ? 'Checking...'
                  : profilesRowStatus.status === 'exists'
                    ? '✅ Exists'
                    : profilesRowStatus.status === 'missing'
                      ? '❌ Missing'
                      : `⚠️ Error: ${profilesRowStatus.errorCode || 'N/A'}`}
              </Text>
            </View>
            {profilesRowStatus.status === 'error' && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>profiles error:</Text>
                <Text style={styles.infoValue}>
                  {profilesRowStatus.errorCode || 'N/A'}: {profilesRowStatus.errorMessage || 'N/A'}
                </Text>
              </View>
            )}
          </>
        )}
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

        {__DEV__ && (
          <>
            <TouchableOpacity
              style={[styles.button, actionLoading === 'checkUsers' && styles.buttonDisabled]}
              onPress={async () => {
                setActionLoading('checkUsers');
                await checkUsersRow();
                setActionLoading(null);
              }}
              disabled={!!actionLoading}
            >
              {actionLoading === 'checkUsers' ? (
                <ActivityIndicator color={BRAND_COLORS.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Check public.users Row</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, actionLoading === 'checkProfiles' && styles.buttonDisabled]}
              onPress={async () => {
                setActionLoading('checkProfiles');
                await checkProfilesRow();
                setActionLoading(null);
              }}
              disabled={!!actionLoading}
            >
              {actionLoading === 'checkProfiles' ? (
                <ActivityIndicator color={BRAND_COLORS.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Check public.profiles Row</Text>
              )}
            </TouchableOpacity>
          </>
        )}

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
    backgroundColor: BRAND_COLORS.surface,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLORS.text[600],
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: BRAND_COLORS.text[900],
    flex: 1,
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDanger: {
    backgroundColor: BRAND_COLORS.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
