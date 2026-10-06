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
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { I18nProvider } from '../lib/i18n';
import { SessionProvider } from '../lib/session';
import { colors, font, type } from '../lib/theme';

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

export default function RootLayout() {
  const [ready, error] = useFonts({
    [font.regular]: Poppins_400Regular,
    [font.medium]: Poppins_500Medium,
    [font.semibold]: Poppins_600SemiBold,
    [font.bold]: Poppins_700Bold,
    [font.extrabold]: Poppins_800ExtraBold,
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
