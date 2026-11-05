import { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { tx, useI18n } from './i18n';
import { useSession } from './session';
import { colors, font, fs, radius, spacing } from './theme';

// The sidebar menu.
//
// This is hand-built rather than react-navigation's Drawer, and that is
// not a preference. The Drawer was here first and does not open on web:
// its own header toggle, untouched, leaves the panel parked at x=-303
// and nothing moves. A menu that cannot be opened is worse than no
// menu, and a menu that works on one platform and silently fails on the
// other is worse still.
//
// What is here instead is an overlay rendered by this file, opened by
// state it owns. Every step of that was checked in a browser, which is
// how the Drawer's failure was found in the first place.

const SidebarContext = createContext(null);

// A colour per destination, and the filled icon rather than the
// outline one.
//
// Thirteen identical glyphs down a list is a wall of text with
// decoration — nothing to aim at, and every row costing a read. The
// tile is what the eye lands on, so it carries the colour.
//
// These used to be six hand-picked hues that ignored the theme
// entirely, which meant the menu looked the same whichever theme was
// chosen and matched none of them. They are steps of the theme's own
// family now (see colour.js), so the menu is recognisably the same app
// as the screen behind it, in all three themes.
//
// The grouping is unchanged and still deliberate: the ramp is indexed
// by role, not by position, so related destinations stay related.

// Grouped, and only what the tab bar does not already show.
//
// Home, Orbit, Omba, Afya AI and Profile are one tap away at the foot of
// every screen; listing them here too made the menu fifteen rows long,
// running to the bottom of the phone. What is left falls into three
// groups, each under a heading, so the menu reads in seconds.
const SECTIONS = [
  {
    title: 'Huduma',
    items: [
      { icon: 'list', key: 'nav.myVisits', href: '/appointments' },
      { icon: 'search', key: 'nav.findCare', href: '/care' },
      { icon: 'heart-circle', key: 'nav.services', href: '/services' },
      { icon: 'car', key: 'nav.transport', href: '/transport' },
      // Role-gated: shown only to the role named, and refused by the
      // server to everyone else whatever the menu shows.
      { icon: 'briefcase', key: 'nav.staffJobs', href: '/staff-jobs', role: 'STAFF' },
      { icon: 'git-network', key: 'nav.dispatch', href: '/dispatch', role: 'ADMIN' },
    ],
  },
  {
    title: 'Afya yangu',
    items: [
      { icon: 'pulse', key: 'nav.symptoms', href: '/symptoms' },
      { icon: 'medical', key: 'nav.medications', href: '/medications' },
      { icon: 'people', key: 'nav.family', href: '/family' },
    ],
  },
  {
    title: 'Akaunti',
    items: [
      { icon: 'notifications', key: 'nav.notifications', href: '/notifications' },
      { icon: 'receipt', key: 'nav.invoices', href: '/invoices' },
      { icon: 'settings', key: 'nav.settings', href: '/settings' },
    ],
  },
];

export function SidebarProvider({ children }) {
  const [open, setOpen] = useState(false);

  const value = useMemo(
    () => ({
      open,
      openSidebar: () => setOpen(true),
      closeSidebar: () => setOpen(false),
    }),
    [open]
  );

  return (
    <SidebarContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {open ? <Sidebar /> : null}
      </View>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used inside a SidebarProvider');
  return context;
}

// Two letters at most: a long name in a 40px circle is a smear.
function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function Sidebar() {
  const { closeSidebar } = useSidebar();
  const router = useRouter();
  const { user, signOut } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.role || item.role === user?.role),
  })).filter((section) => section.items.length > 0);

  function go(href) {
    closeSidebar();
    router.push(href);
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.header}>
          {/* The user, not the logo. The house-and-stethoscope mark
              used to sit here; with it gone from the rest of the app
              this row is better served by whose account it is. */}
          <View style={styles.avatar} accessible={false}>
            <Text style={styles.avatarText}>{initials(user?.name)}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? tx('Karibu')}
            </Text>
            {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
          </View>
          <Pressable
            onPress={closeSidebar}
            accessibilityRole="button"
            accessibilityLabel={tx('Funga menyu')}
            hitSlop={10}
          >
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{tx(section.title)}</Text>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Pressable
                    key={item.href}
                    onPress={() => go(item.href)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.itemPressed]}
                  >
                    <Ionicons
                      name={active ? item.icon : `${item.icon}-outline`}
                      size={18}
                      color={active ? colors.primary : colors.muted}
                    />
                    <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
                      {t(item.key)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Straight after the list, not pinned to the foot of the
              screen: the menu ends where its content ends. */}
          <Pressable
            onPress={() => {
              closeSidebar();
              signOut();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.signOut, pressed && styles.itemPressed]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.signOutText}>{t('common.signOut')}</Text>
          </Pressable>
        </ScrollView>

      </View>

      {/* Tapping beside the panel closes it, the way a drawer does. */}
      <Pressable
        style={styles.backdrop}
        onPress={closeSidebar}
        accessibilityRole="button"
        accessibilityLabel={tx('Funga menyu kwa kugusa pembeni')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // An overlay rather than a Modal. Inside a Modal the panel opened and
  // then would not close on navigation: setOpen(false) beside
  // router.push left it sitting over the new screen, and moving the
  // close into an effect on the path closed it the instant it opened.
  // Plain conditional rendering has none of that lifecycle to fight.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 100,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    width: 272,
    backgroundColor: colors.surface,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.bold, fontSize: fs(13), color: colors.primary },
  headerText: { flex: 1 },
  name: { fontSize: fs(14), fontFamily: font.semibold, color: colors.text },
  phone: { fontSize: fs(12), color: colors.muted },

  list: { paddingBottom: spacing.md },
  section: { marginTop: spacing.sm },
  sectionTitle: {
    fontSize: fs(11),
    fontFamily: font.semibold,
    color: colors.subtle,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    marginBottom: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    marginHorizontal: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  itemActive: { backgroundColor: colors.primaryLight },
  itemPressed: { backgroundColor: colors.hairline },
  itemText: { flex: 1, fontSize: fs(14), fontFamily: font.regular, color: colors.text },
  itemTextActive: { color: colors.primary, fontFamily: font.semibold },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    marginHorizontal: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  signOutText: { fontSize: fs(14), fontFamily: font.regular, color: colors.danger },
});
