import * as Font from 'expo-font';
import * as Sentry from '@sentry/react-native';
import { useEffect, useState } from 'react';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  LibreCaslonText_400Regular,
  LibreCaslonText_400Regular_Italic,
  LibreCaslonText_700Bold,
} from '@expo-google-fonts/libre-caslon-text';

const fontAssets = {
  // Body / Labels — Inter
  'Inter-Regular': Inter_400Regular,
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_700Bold,
  // Headlines — Libre Caslon Text (serif)
  'LibreCaslonText-Regular': LibreCaslonText_400Regular,
  'LibreCaslonText-Italic': LibreCaslonText_400Regular_Italic,
  'LibreCaslonText-Bold': LibreCaslonText_700Bold,
} as const;

let fontsLoaded = false;

export async function loadFonts(): Promise<void> {
  if (fontsLoaded) return;
  try {
    await Font.loadAsync(fontAssets);
    fontsLoaded = true;
  } catch (error) {
    // Font loading failed — continue without custom fonts. The app falls back
    // to system fonts, which silently breaks the Midnight Chemistry aesthetic.
    // Report to Sentry so we can detect this in prod.
    Sentry.captureMessage('[fonts] Inter/Libre Caslon load failed — system fallback', 'warning');
    Sentry.captureException(error);
    console.warn('[fonts] Failed to load fonts, using system fonts:', error);
    fontsLoaded = true;
  }
}

export function useFontsReady(): boolean {
  const [ready, setReady] = useState(fontsLoaded);

  useEffect(() => {
    if (fontsLoaded) return;
    loadFonts().then(() => setReady(true));
  }, []);

  return ready;
}
