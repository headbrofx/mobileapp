import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../../lib/session';
import { BASE_URL } from '../../../lib/api';
import { LANGUAGES, useI18n } from '../../../lib/i18n';
import { MenuButton } from '../../../lib/ui';
import { colors, font, radius, shadow, spacing, type } from '../../../lib/theme';

// The account tab.
//
// It was a stack of identical grey rows under a circle, and the owner
// was right that it did not look like the rest of the app. What it is
// now: a brand header the name sits inside, three shortcuts to the
// places people actually come here for, and the rest grouped under
// headings instead of poured into one long list.
//
// Orbit and Afya AI have left this list — they are tabs now, and
// offering the same thing twice a screen apart makes an app feel bigger
// than it is. My visits has come the other way, since it left the tab
// bar and needs somewhere to live.

const CARE = [
  { icon: 'list-outline', label: 'Ziara zangu', href: '/appointments', hint: 'Zilizopita na zijazo' },
  { icon: 'people-outline', label: 'Familia yangu', href: '/family', hint: 'Wale unaowahudumia' },
  { icon: 'pulse-outline', label: 'Ripoti dalili', href: '/symptoms', hint: 'Andika unavyojisikia' },
  { icon: 'medical-outline', label: 'Dawa zangu', href: '/medications', hint: 'Dozi na ratiba' },
];

const SHORTCUTS = [
  { icon: 'calendar-outline', label: 'Omba ziara', href: '/book' },
  { icon: 'list-outline', label: 'Ziara zangu', href: '/appointments' },
  { icon: 'receipt-outline', label: 'Ankara', href: '/invoices' },
];

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { t, language, setLanguage } = useI18n();

  const initials = (user?.name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.heroBar}>
          <MenuButton tint={colors.onPrimary} />
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Taarifa"
            hitSlop={8}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>

        <View style={styles.heroPerson}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? 'Karibu'}
            </Text>
            {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
            <View style={styles.roleChip}>
              <Ionicons name="shield-checkmark" size={11} color={colors.onPrimary} />
              <Text style={styles.roleText}>Akaunti imethibitishwa</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* The shortcuts overlap the header, which is what ties the two
          together instead of leaving a coloured band floating above a
          white page. */}
      <View style={styles.shortcuts}>
        {SHORTCUTS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
          >
            <View style={styles.shortcutIcon}>
              <Ionicons name={item.icon} size={19} color={colors.primary} />
            </View>
            <Text style={styles.shortcutText} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.groupTitle}>Huduma zangu</Text>
      <View style={styles.group}>
        {CARE.map((link, index) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index < CARE.length - 1 && styles.rowDivider,
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
      </View>

      <Text style={styles.groupTitle}>Mipangilio</Text>
      <View style={styles.group}>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowIcon}>
            <Ionicons name="language-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('settings.language')}</Text>
            <Text style={styles.rowHint}>Kiswahili au English</Text>
          </View>
          <View style={styles.chips}>
            {LANGUAGES.map((option) => (
              <Pressable
                key={option.code}
                onPress={() => setLanguage(option.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: language === option.code }}
                style={({ pressed }) => [
                  styles.chip,
                  language === option.code && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, language === option.code && styles.chipTextOn]}>
                  {option.code.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

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
      </View>

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}
      >
        <Ionicons name="log-out-outline" size={19} color={colors.danger} />
        <Text style={styles.signOutText}>{t('common.signOut')}</Text>
      </Pressable>

      <Text style={styles.footer}>Afya Nyumbani Home Care Services Ltd</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  pressed: { opacity: 0.75 },

  hero: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl + spacing.md,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroPerson: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 22, fontFamily: font.bold, color: colors.onPrimary },
  heroText: { flex: 1 },
  name: { ...type.title, color: colors.onPrimary },
  phone: { ...type.small, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  roleText: { ...type.tiny, fontSize: 10, color: colors.onPrimary },

  shortcuts: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: -spacing.xl,
    marginBottom: spacing.lg,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...shadow.card,
  },
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: { ...type.tiny, fontFamily: font.semibold, color: colors.text },

  groupTitle: {
    ...type.label,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
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
  rowLabel: { ...type.bodyStrong, fontSize: 15, color: colors.text },
  rowHint: { ...type.tiny, color: colors.muted, marginTop: 1 },

  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, fontFamily: font.bold, color: colors.muted },
  chipTextOn: { color: colors.onPrimary },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontFamily: font.semibold },

  footer: {
    ...type.tiny,
    color: colors.subtle,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
