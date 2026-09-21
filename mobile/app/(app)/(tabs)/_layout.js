import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, dark, font, fs } from '../../../lib/theme';
import { useI18n } from '../../../lib/i18n';
import { showsOrbit, useSession } from '../../../lib/session';

// Bottom tabs: the five things somebody opens the app to do.
//
// This was Home, Book, My visits, Profile. The owner moved Orbit and
// Afya AI down here and sent My visits up to the menu, and the reasoning
// is sound: Orbit and the AI are what bring somebody back between
// visits, and a list of past bookings is something you go looking for
// rather than something you reach for. My visits is still one tap away —
// from the menu, and from its own card on Home.
//
// Everything else — symptoms, family, medicines, invoices — stays in the
// menu, so the bar stops at five instead of becoming a second menu.
export default function TabsLayout() {
  const { t } = useI18n();
  const { self } = useSession();

  // Orbit is a women's health module, so the bar is five items for the
  // people it is for and four for everybody else. href: null takes the
  // tab out of the bar without unregistering the route — the screen
  // stays addressable, and guards itself.
  const orbit = showsOrbit(self);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        // Five labels where there were four. Without the font locked and
        // a slightly tighter size, "Afya AI" wraps to two lines on a
        // 360-wide phone and pushes the whole bar out of line.
        tabBarLabelStyle: { fontSize: fs(10.5), fontFamily: font.semibold },
        tabBarAllowFontScaling: false,
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cycles"
        options={{
          title: t('nav.orbit'),
          href: orbit ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-number-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: t('nav.book'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: t('nav.ai'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
          // Afya AI is drawn on navy, so the bar under it is too. A
          // light strip across the foot of a dark screen reads as a
          // seam, and this is the one screen with its own surface.
          tabBarStyle: {
            backgroundColor: dark.bgDeep,
            borderTopColor: dark.border,
            height: 62,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: dark.accent,
          tabBarInactiveTintColor: dark.subtle,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
