import { createContext, useContext, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from './session';
import { colors, font, spacing } from './theme';

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

const ITEMS = [
  { icon: 'home-outline', label: 'Mwanzo', href: '/home' },
  { icon: 'grid-outline', label: 'Huduma zetu', href: '/services' },
  { icon: 'calendar-outline', label: 'Omba ziara', href: '/book' },
  { icon: 'list-outline', label: 'Ziara zangu', href: '/appointments' },
  { icon: 'chatbubble-ellipses-outline', label: 'Afya AI', href: '/ask' },
  { icon: 'notifications-outline', label: 'Taarifa', href: '/notifications' },
  { icon: 'pulse-outline', label: 'Ripoti dalili', href: '/symptoms' },
  { icon: 'people-outline', label: 'Familia yangu', href: '/family' },
  { icon: 'calendar-number-outline', label: 'Orbit', href: '/cycles' },
  { icon: 'medical-outline', label: 'Dawa zangu', href: '/medications' },
  { icon: 'receipt-outline', label: 'Ankara', href: '/invoices' },
  { icon: 'person-outline', label: 'Wasifu', href: '/profile' },
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

function Sidebar() {
  const { closeSidebar } = useSidebar();
  const router = useRouter();
  const { user, signOut } = useSession();

  function go(href) {
    closeSidebar();
    router.push(href);
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Image
            source={require('../assets/logo-mark.png')}
            style={styles.mark}
            resizeMode="contain"
            accessible={false}
          />
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? 'Karibu'}
            </Text>
            {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
          </View>
          <Pressable
            onPress={closeSidebar}
            accessibilityRole="button"
            accessibilityLabel="Funga menyu"
            hitSlop={10}
          >
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.href}
              onPress={() => go(item.href)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <Ionicons name={item.icon} size={20} color={colors.primary} />
              <Text style={styles.itemText}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          onPress={() => {
            closeSidebar();
            signOut();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOut, pressed && styles.itemPressed]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Toka</Text>
        </Pressable>
      </View>

      {/* Tapping beside the panel closes it, the way a drawer does. */}
      <Pressable
        style={styles.backdrop}
        onPress={closeSidebar}
        accessibilityRole="button"
        accessibilityLabel="Funga menyu kwa kugusa pembeni"
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
  mark: { width: 44, height: 31 },
  headerText: { flex: 1 },
  name: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  phone: { fontSize: 13, color: colors.muted, marginTop: 1 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  itemPressed: { backgroundColor: colors.primaryLight },
  itemText: { fontSize: 15, color: colors.text },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signOutText: { fontSize: 15, fontFamily: font.semibold, color: colors.danger },
});

