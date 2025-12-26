import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Proposal } from '../lib/types';
import { BRAND_COLORS } from '../config/brand';
import { useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { Alert } from 'react-native';

interface ProposalCardProps {
  proposal: Proposal;
  matchId: string;
  onConfirm: () => void;
  onNoneSuits: () => void;
}

export default function ProposalCard({
  proposal,
  matchId,
  onConfirm,
  onNoneSuits,
}: ProposalCardProps) {
  const [loading, setLoading] = useState(false);
  const isExpired = new Date(proposal.expires_at) < new Date();
  const isConfirmed = proposal.status === 'confirmed';

  const handleConfirm = async (chosenWindow: { start: string; end: string }) => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Create confirm record
      const { error } = await supabase.from('confirms').insert({
        proposal_id: proposal.proposal_id,
        match_id: matchId,
        confirmer_id: user.id,
        chosen_window: chosenWindow,
      });

      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return;
      }

      // Update proposal status
      await supabase
        .from('proposals')
        .update({ status: 'confirmed' })
        .eq('proposal_id', proposal.proposal_id);

      Alert.alert('Success', 'Date confirmed! Chat is now unlocked.');
      onConfirm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleNoneSuits = () => {
    // This will be handled by parent component to navigate to propose screen
    onNoneSuits();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

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
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
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
    borderRadius: 8,
    alignItems: 'center',
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
