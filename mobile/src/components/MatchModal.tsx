import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../navigation/MainNavigator';
import { MatchesStackParamList } from '../navigation/MainNavigator';
import { BRAND_COLORS } from '../config/brand';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'MatchesStack'>,
  NativeStackNavigationProp<MatchesStackParamList>
>;

interface MatchModalProps {
  visible: boolean;
  matchId: string | null;
  onClose: () => void;
}

export default function MatchModal({ visible, matchId, onClose }: MatchModalProps) {
  const navigation = useNavigation<NavigationProp>();

  const handleViewMatch = () => {
    onClose();
    if (matchId) {
      // Navigate to Matches tab first to trigger refresh, then to match detail
      navigation.navigate('MatchesStack', {
        screen: 'MatchDetail',
        params: { matchId },
      });
    }
  };

  const handleContinueBrowsing = () => {
    onClose();
    // Navigate to Matches tab to trigger refresh so match appears in list
    // User can continue browsing or check matches later
    navigation.navigate('MatchesStack', { screen: 'MatchesList' });
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>🎉 It's a Match!</Text>
          <Text style={styles.message}>
            You both liked each other. Start a conversation and propose a time to meet!
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleContinueBrowsing}
            >
              <Text style={styles.secondaryButtonText}>Continue Browsing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleViewMatch}>
              <Text style={styles.buttonText}>View Match</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.primary,
    fontSize: 18,
    fontWeight: '600',
  },
});
