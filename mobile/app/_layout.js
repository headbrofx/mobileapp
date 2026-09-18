import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
import { colors } from '../lib/theme';

// The drawer is driven by gestures, so everything has to sit inside a
// GestureHandlerRootView or swiping it open does nothing on Android.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.onPrimary,
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            {/* The sign-in screens carry their own brand header and
                back arrow, so a second green bar above them would be one
                header too many. */}
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            {/* The signed-in half owns its own header, from the drawer. */}
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
