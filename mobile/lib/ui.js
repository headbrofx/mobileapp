import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSidebar } from './sidebar';
import { colors, radius, spacing } from './theme';

// Small shared pieces, so five screens do not each style a button
// slightly differently.

export function Field({ label, hint, error, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor={colors.muted}
        {...props}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, loading, disabled, variant = 'primary' }) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.primary : colors.onPrimary} />
      ) : (
        <Text style={[styles.buttonText, variant === 'ghost' && styles.buttonTextGhost]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// Whatever the API said, shown as the API said it. The server writes
// better messages than "something went wrong".
export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Opens the sidebar.
//
// The tab screens are drawn with headerShown: false so they can have
// the design's own headers, which left the menu with no button anywhere
// and everything in it — Afya AI, symptoms, family, medicines, invoices
// — effectively invisible.
//
// Two earlier attempts went through react-navigation's Drawer, one
// hand-rolled and one using the library's own DrawerToggleButton.
// Neither opened anything on web, and nor did the drawer's own header
// toggle: the panel stayed parked off-screen and no error was thrown.
// The sidebar is now this app's own Modal, so pressing this is a state
// change it controls rather than an action dispatched into a navigator
// that quietly drops it.

export function MenuButton({ tint = colors.text }) {
  const { openSidebar } = useSidebar();

  return (
    <Pressable
      onPress={openSidebar}
      accessibilityRole="button"
      accessibilityLabel="Fungua menyu"
      hitSlop={10}
      style={({ pressed }) => [styles.menuButton, pressed && styles.menuPressed]}
    >
      <Ionicons name="menu" size={24} color={tint} />
    </Pressable>
  );
}

// The top row for a tab screen that has no header of its own: the menu
// button, the screen's name, and whatever the screen wants on the right.
export function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.screenHeader}>
      <MenuButton />
      <View style={styles.screenHeaderText}>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  fieldError: { fontSize: 12, color: colors.danger, marginTop: 4 },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  buttonTextGhost: { color: colors.primary },

  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14 },

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  screenHeaderText: { flex: 1 },
  screenTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  screenSubtitle: { fontSize: 13, color: colors.muted, marginTop: 1 },

  menuButton: { padding: 4, borderRadius: radius.sm },
  menuPressed: { opacity: 0.6 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
