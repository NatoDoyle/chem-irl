import { View, Text, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { BRAND_COLORS } from '../../config/brand';

type MagicLinkSentScreenRouteProp = RouteProp<AuthStackParamList, 'MagicLinkSent'>;

export default function MagicLinkSentScreen() {
  const route = useRoute<MagicLinkSentScreenRouteProp>();
  const { email } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.description}>
          We've sent a magic link to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
        <Text style={styles.instruction}>
          Click the link in the email to sign in. The link will expire in 1 hour.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 80,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 24,
    lineHeight: 24,
  },
  email: {
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  instruction: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    lineHeight: 20,
  },
});

