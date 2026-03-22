import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Proposal } from '../lib/types';
import { BRAND_COLORS, GOLDEN_HOUR } from '../config/brand';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { Alert } from 'react-native';
import { formatProposalTime } from '../lib/timezone';
import { getErrorAlert } from '../lib/errors';
import { addBreadcrumb } from '../lib/sentry';
import { trackEvent } from '../lib/analytics';

interface ProposalCardProps {
  proposal: Proposal;
  matchId: string;
  onConfirm: () => void;
  onNoneSuits: () => void;
  existingConfirms?: { confirmer_id: string; proposal_id: string }[]; // Optional: existing confirm records to check for race conditions
}

export default function ProposalCard({
  proposal,
  matchId,
  onConfirm,
  onNoneSuits,
  existingConfirms = [],
}: ProposalCardProps) {
  const [loading, setLoading] = useState(false);
  const [isExpired, setIsExpired] = useState(() => new Date(proposal.expires_at) < new Date());
  const isConfirmed = proposal.status === 'confirmed';

  // Auto-update expiry status every minute
  useEffect(() => {
    // Check immediately if already expired
    if (isExpired) {
      return;
    }

    // Set up interval to check expiry every minute
    const interval = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(proposal.expires_at);
      if (expiresAt < now && !isExpired) {
        setIsExpired(true);
      }
    }, 60000); // Check every 60 seconds (1 minute)

    // Also calculate when it will expire and set a timeout for immediate update
    const expiresAt = new Date(proposal.expires_at);
    const now = new Date();
    const msUntilExpiry = expiresAt.getTime() - now.getTime();

    let timeoutId: NodeJS.Timeout | null = null;
    if (msUntilExpiry > 0 && msUntilExpiry < 60000) {
      // If it expires within the next minute, set a timeout for immediate update
      timeoutId = setTimeout(() => {
        setIsExpired(true);
      }, msUntilExpiry);
    }

    return () => {
      clearInterval(interval);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [proposal.expires_at, isExpired]);

  const handleConfirm = async (chosenWindow: { start: string; end: string }) => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Client-side check: prevent race condition by checking if proposal already has a confirm
      // Note: This doesn't fully prevent the race condition (backend constraint needed),
      // but it reduces the likelihood by checking before attempting insert
      const alreadyConfirmed = existingConfirms.some(
        (confirm) => confirm.proposal_id === proposal.proposal_id
      );
      if (alreadyConfirmed) {
        const { title, message } = getErrorAlert(
          'This proposal has already been confirmed. Please refresh to see the latest status.',
          'Already Confirmed'
        );
        Alert.alert(title, message);
        setLoading(false);
        onConfirm(); // Refresh parent component
        return;
      }

      // Also check if proposal status is already confirmed
      if (proposal.status === 'confirmed') {
        const { title, message } = getErrorAlert(
          'This proposal has already been confirmed. Please refresh to see the latest status.',
          'Already Confirmed'
        );
        Alert.alert(title, message);
        setLoading(false);
        onConfirm(); // Refresh parent component
        return;
      }

      addBreadcrumb('Confirming proposal', 'proposal', 'info', {
        proposalId: proposal.proposal_id.substring(0, 8),
        matchId: matchId.substring(0, 8),
      });
      trackEvent('proposal_confirmed', {
        proposalId: proposal.proposal_id.substring(0, 8),
        matchId: matchId.substring(0, 8),
      });

      // Use RPC function for atomic confirmation (prevents race conditions)
      const { data, error } = await supabase.rpc('confirm_proposal', {
        p_proposal_id: proposal.proposal_id,
        p_match_id: matchId,
        p_confirmer_id: user.id,
        p_chosen_window: chosenWindow,
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to confirm proposal');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Check if already confirmed (RPC returns success: false with already_confirmed: true)
      if (data && !data.success && data.already_confirmed) {
        const { title, message } = getErrorAlert(
          'This proposal has already been confirmed. Please refresh to see the latest status.',
          'Already Confirmed'
        );
        Alert.alert(title, message);
        setLoading(false);
        onConfirm(); // Refresh to show latest state
        return;
      }

      // Success - proposal confirmed atomically
      if (data && data.success) {
        Alert.alert('Success', 'Date confirmed! Chat is now unlocked.');
        onConfirm();
      } else {
        // Unexpected response format
        const { title, message } = getErrorAlert(
          'Unexpected response from server',
          'Failed to confirm proposal'
        );
        Alert.alert(title, message);
        setLoading(false);
      }
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to confirm proposal');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleNoneSuits = () => {
    // This will be handled by parent component to navigate to propose screen
    onNoneSuits();
  };

  // Use timezone utility for consistent timezone-aware formatting
  const formatTime = formatProposalTime;

  if (isConfirmed) {
    return (
      <View style={[styles.card, styles.confirmedCard]}>
        <Text style={styles.statusText}>✓ Confirmed</Text>
        <Text style={styles.note}>{proposal.note || 'No note'}</Text>
      </View>
    );
  }

  if (isExpired) {
    return (
      <View style={[styles.card, styles.expiredCard]}>
        <Text style={styles.statusText}>Expired</Text>
        <Text style={styles.note}>{proposal.note || 'No note'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.dateTypes}>{proposal.date_types.join(', ')}</Text>
      {proposal.note && <Text style={styles.note}>{proposal.note}</Text>}

      <View style={styles.windows}>
        {proposal.windows.map((window, index) => (
          <TouchableOpacity
            key={index}
            style={styles.windowButton}
            onPress={() => handleConfirm(window)}
            disabled={loading}
          >
            <Text style={styles.windowText}>
              {formatTime(window.start)} - {formatTime(window.end)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.noneSuitsButton} onPress={handleNoneSuits} disabled={loading}>
        <Text style={styles.noneSuitsText}>None of these suit me</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GOLDEN_HOUR.inputBg,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  confirmedCard: {
    backgroundColor: BRAND_COLORS.success + '20',
  },
  expiredCard: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  dateTypes: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  note: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginBottom: 12,
  },
  windows: {
    gap: 8,
    marginBottom: 12,
  },
  windowButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
  },
  windowText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noneSuitsButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  noneSuitsText: {
    color: BRAND_COLORS.text[600],
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.success,
    marginBottom: 8,
  },
});
