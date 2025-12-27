import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { BRAND_COLORS } from '../config/brand';

/**
 * Connection status indicator component
 * Shows online/offline status at the top of relevant screens
 */
export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Don't show anything if connected (normal state)
  if (isConnected === true) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {isConnected === false ? 'Offline' : 'Checking connection...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BRAND_COLORS.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BRAND_COLORS.warning + '80',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
