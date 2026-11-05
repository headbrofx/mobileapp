import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { I18nProvider } from '../lib/i18n';
import { SessionProvider } from '../lib/session';
import { colors, font, fontChoice, type } from '../lib/theme';

// The splash stays up until the typeface is in memory.
//
// Without this the app draws once in the system font and again in
// Poppins, and every line on screen jumps as it reflows. Holding the
// splash for that extra moment is the difference between an app that
// opens and one that flickers.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable on this platform. Nothing here is
  // worth failing a launch over.
});

// Each face mapped onto the five roles. Poppins and DM Sans are loaded a
// step lighter than the role's name, because both are dense at the
// weights the names suggest; Nunito is light and keeps its own weights.
const FACES = {
  nunito: {
    [font.regular]: Nunito_400Regular,
    [font.medium]: Nunito_500Medium,
    [font.semibold]: Nunito_600SemiBold,
    [font.bold]: Nunito_700Bold,
    [font.extrabold]: Nunito_800ExtraBold,
  },
  poppins: {
    [font.regular]: Poppins_400Regular,
    [font.medium]: Poppins_500Medium,
    [font.semibold]: Poppins_500Medium,
    [font.bold]: Poppins_600SemiBold,
    [font.extrabold]: Poppins_700Bold,
  },
  dmsans: {
    [font.regular]: DMSans_400Regular,
    [font.medium]: DMSans_500Medium,
    [font.semibold]: DMSans_500Medium,
    [font.bold]: DMSans_600SemiBold,
    [font.extrabold]: DMSans_700Bold,
  },
};

// One weight of every face, under its own name, so Settings can draw
// each choice in itself rather than describe it.
const PREVIEWS = {
  'Preview-nunito': Nunito_700Bold,
  'Preview-poppins': Poppins_600SemiBold,
  'Preview-dmsans': DMSans_600SemiBold,
};

export default function RootLayout() {
  const [ready, error] = useFonts({
    ...FACES[fontChoice],
    ...PREVIEWS,
  });

  useEffect(() => {
    // Carrying on without the font beats never getting past the
    // splash: the app falls back to the system face and still works.
    if (ready || error) SplashScreen.hideAsync().catch(() => {});
  }, [ready, error]);

  if (!ready && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
        <SessionProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.onPrimary,
              headerTitleStyle: { fontFamily: font.bold, fontSize: type.section.fontSize },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            {/* The sign-in screens carry their own brand header and
                back arrow, so a second bar above them would be one
                header too many. */}
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </SessionProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
