import { Stack } from 'expo-router';
import { SidebarProvider } from '../../lib/sidebar';
import { MenuButton } from '../../lib/ui';
import { colors } from '../../lib/theme';

// The signed-in half of the app.
//
// This was a Drawer navigator. It was replaced because the drawer never
// opened on web — its own header toggle, untouched, left the panel
// parked off-screen at x=-303 and nothing moved, so every destination
// that lived only in the drawer was unreachable. The menu now lives in
// lib/sidebar.js, which is a Modal this app controls and which can be
// checked in a browser.
//
// The four main destinations carry their own tab bar and their own
// headers, so the stack stays out of their way. Everything else gets
// the green header with the menu button on the left.

export default function AppLayout() {
  return (
    <SidebarProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg },
          headerLeft: () => <MenuButton tint={colors.onPrimary} />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="services" options={{ title: 'Chagua huduma' }} />
        <Stack.Screen name="ask" options={{ title: 'Afya AI' }} />
        <Stack.Screen name="notifications" options={{ title: 'Taarifa' }} />
        <Stack.Screen name="symptoms" options={{ title: 'Ripoti dalili' }} />
        <Stack.Screen name="family" options={{ title: 'Familia yangu' }} />
        <Stack.Screen name="cycles" options={{ title: 'Orbit' }} />
        <Stack.Screen name="medications" options={{ title: 'Dawa zangu' }} />
        <Stack.Screen name="invoices" options={{ title: 'Ankara' }} />
      </Stack>
    </SidebarProvider>
  );
}
