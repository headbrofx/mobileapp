import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
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
          <Stack.Screen name="login" options={{ title: 'Ingia' }} />
          <Stack.Screen name="register" options={{ title: 'Jisajili' }} />
          <Stack.Screen name="home" options={{ title: 'Afya Nyumbani' }} />
          <Stack.Screen name="ask" options={{ title: 'Afya AI' }} />
          <Stack.Screen name="book" options={{ title: 'Omba muuguzi' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
