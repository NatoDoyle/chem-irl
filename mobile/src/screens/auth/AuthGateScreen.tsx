import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { BRAND, BRAND_COLORS } from '../../config/brand';

type AuthGateScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'AuthGate'>;

export default function AuthGateScreen() {
  const navigation = useNavigation<AuthGateScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{BRAND.tagline}</Text>
        <Text style={styles.description}>{BRAND.description}</Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => navigation.navigate('SignUpEmail')}
        >
          <Text style={styles.buttonTextPrimary}>Sign up</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => navigation.navigate('LoginEmail')}
        >
          <Text style={styles.buttonTextSecondary}>Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.surface,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    lineHeight: 26,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: BRAND_COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
  },
  buttonTextPrimary: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: BRAND_COLORS.primary,
    fontSize: 18,
    fontWeight: '600',
  },
});
