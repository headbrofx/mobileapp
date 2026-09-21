import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, dark, font, fs } from '../../../lib/theme';
import { useI18n } from '../../../lib/i18n';
import { showsOrbit, useSession } from '../../../lib/session';

// The bar was a flat 62 tall with 8 of bottom padding, and on any
// phone with a gesture bar or a home indicator the icons were cut off
// along the bottom edge.
//
// The cause is that giving tabBarStyle an explicit height replaces the
// one react-navigation would have computed, and the one it would have
// computed is the only one that knew about the inset. So the inset is
// added back here: a fixed drawing area, plus whatever the system
// reserves underneath it, and the content padded down by the same
// amount so it sits in the bar rather than under the indicator.
//
// BAR is the drawing area — icon, label and the air around them. It
// stays fixed, so the bar looks identical on a phone with an inset and
// one without; only the reserved strip below it changes.
const BAR = 66;

function bar(inset) {
  return {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: BAR + inset,
    paddingBottom: 6 + inset,
    paddingTop: 6,
  };
}

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
  const insets = useSafeAreaInsets();

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
        tabBarStyle: bar(insets.bottom),
        // Five labels where there were four. Without the font locked and
        // a slightly tighter size, "Afya AI" wraps to two lines on a
        // 360-wide phone and pushes the whole bar out of line.
        // lineHeight is not decoration here. Without it the label's box
        // is whatever height react-navigation has left over, which
        // measured 6px against an 11px font — and the box clips, so
        // every label in the bar was sliced through the middle. An
        // explicit line box is the only thing that makes the text's
        // own height the thing that decides.
        tabBarLabelStyle: {
          fontSize: fs(10.5),
          lineHeight: fs(14),
          fontFamily: font.semibold,
          margin: 0,
          padding: 0,
        },
        tabBarAllowFontScaling: false,
        tabBarItemStyle: { paddingHorizontal: 2, paddingVertical: 0 },
        tabBarIconStyle: { marginTop: 2, marginBottom: 0 },
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
            ...bar(insets.bottom),
            backgroundColor: dark.bgDeep,
            borderTopColor: dark.border,
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
