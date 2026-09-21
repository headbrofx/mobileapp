import { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { LANGUAGES, tx, useI18n } from './i18n';
import { showsOrbit, useSession } from './session';
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
// Thirteen identical green glyphs down a list is a wall of text with
// decoration — nothing to aim at, and every row costing a read. The
// tile is what the eye actually lands on, so it carries the hue and
// the glyph sits inside it.
//
// The hues are not decorative-random: they group the app. Green is
// yours (home, your visits, your medicines), blue is scheduling and
// records, teal is clinical, amber is anything that interrupts you,
// violet is you as a person, grey is machinery.
const TINTS = {
  green: '#0E9B77',
  blue: '#3B82F6',
  teal: '#14B8A6',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  slate: '#6B7280',
};

const ITEMS = [
  { icon: 'home', key: 'nav.home', href: '/home', tint: TINTS.green },
  // Orbit sits third, under the two things somebody opens the app to
  // do. It is the reason a lot of people will keep the app installed
  // rather than delete it after one visit, and it was buried ninth.
  { icon: 'calendar-number', key: 'nav.orbit', href: '/cycles', badge: 'nav.new', tint: TINTS.blue },
  { icon: 'heart-circle', key: 'nav.services', href: '/services', tint: TINTS.teal },
  { icon: 'calendar', key: 'nav.bookVisit', href: '/book', tint: TINTS.blue },
  { icon: 'list', key: 'nav.myVisits', href: '/appointments', tint: TINTS.green },
  { icon: 'chatbubble-ellipses', key: 'nav.ai', href: '/ask', tint: TINTS.blue },
  { icon: 'notifications', key: 'nav.notifications', href: '/notifications', tint: TINTS.amber },
  { icon: 'pulse', key: 'nav.symptoms', href: '/symptoms', tint: TINTS.teal },
  { icon: 'people', key: 'nav.family', href: '/family', tint: TINTS.blue },
  { icon: 'medical', key: 'nav.medications', href: '/medications', tint: TINTS.green },
  { icon: 'receipt', key: 'nav.invoices', href: '/invoices', tint: TINTS.blue },
  { icon: 'person', key: 'nav.profile', href: '/profile', tint: TINTS.violet },
  { icon: 'settings', key: 'nav.settings', href: '/settings', tint: TINTS.slate },
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
  const { user, self, signOut } = useSession();
  const { t, language, setLanguage } = useI18n();
  const pathname = usePathname();

  // The menu drops Orbit for the same reason the tab bar does. Leaving
  // it here would make hiding the tab pointless — the menu is one tap
  // from every screen in the app.
  const items = ITEMS.filter((item) => item.key !== 'nav.orbit' || showsOrbit(self));

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

        <ScrollView showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Pressable
                key={item.href}
                onPress={() => go(item.href)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.item,
                  active && styles.itemActive,
                  pressed && styles.itemPressed,
                ]}
              >
                {/* Filled tile where you are, pale tile where you are
                    not. The hue is the same either way, so the row
                    reads as the same destination in two states rather
                    than as two different things. */}
                <View
                  style={[
                    styles.itemIcon,
                    { backgroundColor: active ? item.tint : `${item.tint}1F` },
                  ]}
                >
                  <Ionicons name={item.icon} size={19} color={active ? '#FFFFFF' : item.tint} />
                </View>

                <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
                  {t(item.key)}
                </Text>

                {item.badge ? (
                  <View style={styles.itemBadge}>
                    <Text style={styles.itemBadgeText}>{t(item.badge)}</Text>
                  </View>
                ) : null}

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={active ? colors.primary : colors.subtle}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.languageRow}>
          <Ionicons name="language-outline" size={18} color={colors.muted} />
          <Text style={styles.languageLabel}>{t('settings.language')}</Text>
          <View style={styles.languageChoices}>
            {LANGUAGES.map((option) => (
              <Pressable
                key={option.code}
                onPress={() => setLanguage(option.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: language === option.code }}
                style={({ pressed }) => [
                  styles.languageChip,
                  language === option.code && styles.languageChipOn,
                  pressed && styles.itemPressed,
                ]}
              >
                <Text
                  style={[
                    styles.languageChipText,
                    language === option.code && styles.languageChipTextOn,
                  ]}
                >
                  {option.code.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={() => {
            closeSidebar();
            signOut();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOut, pressed && styles.itemPressed]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>{t('common.signOut')}</Text>
        </Pressable>
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
    width: 286,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.bold, fontSize: fs(15), color: colors.primary },
  headerText: { flex: 1 },
  name: { fontSize: fs(16), fontFamily: font.bold, color: colors.text },
  phone: { fontSize: fs(13), color: colors.muted, marginTop: 1 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    marginHorizontal: spacing.xs + 2,
    borderRadius: radius.md,
  },
  // The row you are on is a filled pill, not a tint on the icon alone.
  // Inset from the panel edge so it reads as a selected row rather
  // than as a band across the whole drawer.
  itemActive: { backgroundColor: colors.primaryLight },
  itemPressed: { backgroundColor: colors.hairline },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, fontSize: fs(15), fontFamily: font.semibold, color: colors.text },
  itemTextActive: { color: colors.primaryDark, fontFamily: font.bold },
  itemBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  itemBadgeText: { color: colors.onPrimary, fontSize: fs(9), fontFamily: font.bold, letterSpacing: 0.4 },

  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  languageLabel: { flex: 1, fontSize: fs(14), color: colors.muted },
  languageChoices: { flexDirection: 'row', gap: 6 },
  languageChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  languageChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  languageChipText: { fontSize: fs(11), fontFamily: font.bold, color: colors.muted },
  languageChipTextOn: { color: colors.onPrimary },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signOutText: { fontSize: fs(15), fontFamily: font.semibold, color: colors.danger },
});

