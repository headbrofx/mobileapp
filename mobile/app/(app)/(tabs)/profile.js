import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '../../../lib/session';
import { BASE_URL } from '../../../lib/api';
import { Card, MenuButton } from '../../../lib/ui';
import { colors, font, radius, spacing } from '../../../lib/theme';

// The fourth tab. Everything about the account, plus a way into the
// screens that are not frequent enough to earn a tab of their own — the
// same destinations the drawer holds, reachable without knowing the
// drawer is there.

const LINKS = [
  { icon: 'people-outline', label: 'Familia yangu', href: '/family', hint: 'Wale unaowahudumia' },
  { icon: 'pulse-outline', label: 'Ripoti dalili', href: '/symptoms', hint: 'Andika unavyojisikia' },
  { icon: 'calendar-number-outline', label: 'Orbit', href: '/cycles', hint: 'Hedhi, kalenda na makadirio' },
  { icon: 'medical-outline', label: 'Dawa zangu', href: '/medications', hint: 'Dozi na ratiba' },
  { icon: 'receipt-outline', label: 'Ankara', href: '/invoices', hint: 'Deni na malipo' },
  { icon: 'chatbubble-ellipses-outline', label: 'Afya AI', href: '/ask', hint: 'Uliza swali' },
];

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useSession();

  const initials = (user?.name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.menuRow}>
        <MenuButton />
      </View>

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? 'Karibu'}</Text>
        {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
      </View>

      <Card style={styles.list}>
        {LINKS.map((link, index) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index < LINKS.length - 1 && styles.rowDivider,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.rowIcon}>
              <Ionicons name={link.icon} size={19} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{link.label}</Text>
              <Text style={styles.rowHint}>{link.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        ))}
      </Card>

      <Card style={styles.list}>
        <Pressable
          onPress={() => Linking.openURL(`${BASE_URL}/privacy`)}
          accessibilityRole="link"
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="lock-closed-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Sera ya faragha</Text>
            <Text style={styles.rowHint}>Taarifa zako zinatumikaje</Text>
          </View>
          <Ionicons name="open-outline" size={17} color={colors.subtle} />
        </Pressable>
      </Card>

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}
      >
        <Ionicons name="log-out-outline" size={19} color={colors.danger} />
        <Text style={styles.signOutText}>Toka</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },

  menuRow: { flexDirection: 'row' },
  header: { alignItems: 'center', paddingVertical: spacing.lg },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  initials: { fontSize: 26, fontFamily: font.bold, color: colors.primary },
  name: { fontSize: 19, fontFamily: font.bold, color: colors.text },
  phone: { fontSize: 14, color: colors.muted, marginTop: 2 },

  list: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowPressed: { backgroundColor: colors.bg },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: font.semibold, color: colors.text },
  rowHint: { fontSize: 12, color: colors.muted, marginTop: 1 },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontFamily: font.semibold },
});
