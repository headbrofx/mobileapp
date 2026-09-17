// expo-router/drawer re-exports the drawer pieces, so @react-navigation
// /drawer is not a direct dependency on SDK 57 — importing from it
// would add a package the app does not need.
import { Drawer, DrawerContentScrollView, DrawerItemList } from 'expo-router/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../lib/session';
import { colors, spacing } from '../../lib/theme';

// The sidebar. Everything the signed-in user can reach lives here, so
// the app stops being three screens with no way between them.
//
// Order is by how often a person needs it, not by how the backend is
// organised: asking for a nurse and asking a question come first,
// records after, money last.

function DrawerContent(props) {
  const { user, signOut } = useSession();

  return (
    <View style={styles.drawer}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.name}>{user?.name ?? 'Karibu'}</Text>
          {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
        </View>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <Pressable onPress={signOut} style={styles.signOut} accessibilityRole="button">
        <Text style={styles.signOutText}>Toka</Text>
      </Pressable>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Drawer
      drawerContent={DrawerContent}
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerActiveBackgroundColor: colors.cream,
        drawerLabelStyle: { fontSize: 15 },
      }}
    >
      {/* The four main destinations carry their own tab bar. */}
      <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Mwanzo', title: 'Afya Nyumbani', headerShown: false }} />
      <Drawer.Screen name="ask" options={{ drawerLabel: 'Afya AI', title: 'Afya AI' }} />
      <Drawer.Screen name="symptoms" options={{ drawerLabel: 'Ripoti dalili', title: 'Ripoti dalili' }} />
      <Drawer.Screen name="family" options={{ drawerLabel: 'Familia yangu', title: 'Familia yangu' }} />
      <Drawer.Screen name="cycles" options={{ drawerLabel: 'Mzunguko wangu', title: 'Mzunguko wangu' }} />
      <Drawer.Screen name="medications" options={{ drawerLabel: 'Dawa zangu', title: 'Dawa zangu' }} />
      <Drawer.Screen name="invoices" options={{ drawerLabel: 'Ankara', title: 'Ankara' }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawer: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingTop: 0 },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.lg,
    marginBottom: spacing.sm,
  },
  name: { color: colors.onPrimary, fontSize: 18, fontWeight: '700' },
  phone: { color: colors.onPrimary, fontSize: 14, opacity: 0.85, marginTop: 2 },
  signOut: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
