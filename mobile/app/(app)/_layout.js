import { Stack } from 'expo-router';
import { SidebarProvider } from '../../lib/sidebar';
import { MenuButton } from '../../lib/ui';
import { colors, font } from '../../lib/theme';

// The signed-in half of the app.
//
// This was a Drawer navigator. It was replaced because the drawer never
// opened on web — its own header toggle, untouched, left the panel
// parked off-screen at x=-303 and nothing moved, so every destination
// that lived only in the drawer was unreachable. The menu now lives in
// lib/sidebar.js, which is a Modal this app controls and which can be
// checked in a browser.
//
// The five tab destinations carry their own tab bar and their own
// headers, so the stack stays out of their way. Everything else gets
// the brand header with the menu button on the left.
//
// Orbit and Afya AI moved down into the tab bar and My visits moved up
// here, at the owner's request. The paths did not change — a route
// group is not part of the URL — so every link to /cycles, /ask and
// /appointments still lands where it did.

export default function AppLayout() {
  return (
    <SidebarProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: { fontFamily: font.semibold },
          contentStyle: { backgroundColor: colors.bg },
          headerLeft: () => <MenuButton tint={colors.onPrimary} />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="services" options={{ title: 'Chagua huduma' }} />
        <Stack.Screen name="appointments" options={{ title: 'Ziara zangu' }} />
        <Stack.Screen name="notifications" options={{ title: 'Taarifa' }} />
        <Stack.Screen name="symptoms" options={{ title: 'Ripoti dalili' }} />
        <Stack.Screen name="family" options={{ title: 'Familia yangu' }} />
        <Stack.Screen name="article" options={{ title: 'Soma' }} />
        <Stack.Screen name="medications" options={{ title: 'Dawa zangu' }} />
        <Stack.Screen name="invoices" options={{ title: 'Ankara' }} />
        <Stack.Screen name="settings" options={{ title: 'Mipangilio' }} />
      </Stack>
    </SidebarProvider>
  );
}
