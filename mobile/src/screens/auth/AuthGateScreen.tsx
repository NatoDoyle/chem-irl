import { View, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { BRAND, BRAND_COLORS, REFINED_WARMTH, TYPOGRAPHY, SPACING } from '../../config/brand';
import GHScreen from '../../components/ui/GHScreen';
import GHButton from '../../components/ui/GHButton';

type AuthGateScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'AuthGate'>;

export default function AuthGateScreen() {
  const navigation = useNavigation<AuthGateScreenNavigationProp>();

  return (
    <GHScreen gradient>
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance)}>
          <Image
            source={require('../../../assets/illustrations/auth-hero.jpg')}
            style={styles.hero}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.View
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(100)}
        >
          <Image
            source={require('../../../assets/logo-full.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.Text
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(200)}
          style={styles.title}
        >
          {BRAND.tagline}
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(300)}
          style={styles.description}
        >
          {BRAND.description}
        </Animated.Text>
      </View>
      <Animated.View
        entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(400)}
        style={styles.buttonContainer}
      >
        <GHButton
          title="Sign up"
          variant="coral"
          onPress={() => navigation.navigate('SignUpEmail')}
        />
        <GHButton
          title="Log in"
          variant="secondary"
          onPress={() => navigation.navigate('LoginEmail')}
        />
      </Animated.View>
    </GHScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    width: 200,
    height: 260,
    marginBottom: SPACING.lg,
    borderRadius: REFINED_WARMTH.radius.lg,
    opacity: 0.9,
  },
  logo: {
    width: '60%',
    height: undefined,
    aspectRatio: 727 / 800,
    alignSelf: 'center',
    marginBottom: SPACING.base,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.base,
    textAlign: 'center',
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.relaxed,
  },
  buttonContainer: {
    gap: SPACING.base,
    paddingBottom: SPACING.base,
  },
});
