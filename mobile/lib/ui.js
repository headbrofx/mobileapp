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
import { colors, font, fs, radius, shadow, spacing, type } from './theme';
import { tx } from './i18n';
import { servicePrice } from './services-meta';

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
// Gender, in the three values the database actually stores.
//
// The labels used to be Mke and Mume, which are wife and husband —
// relationship words standing in for gender words. That was always
// wrong and is now load-bearing, because this answer decides whether
// Orbit is offered. Mwanamke and Mwanaume are the words for it.
export const GENDERS = [
  { value: 'FEMALE', label: 'Mwanamke' },
  { value: 'MALE', label: 'Mwanaume' },
  { value: 'OTHER', label: 'Nyingine' },
];

// Presentational on purpose: it reports a choice and nothing else.
// Where that choice is saved differs by screen — registration holds it
// in form state, the profile and Orbit each PATCH it — and a component
// that saved it itself would have to know which.
//
// Passing the selected value again clears it, so an optional field
// stays optional after a mis-tap.
export function GenderChips({ value, onChange, clearable = true }) {
  return (
    <View style={styles.genderChips}>
      {GENDERS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(selected && clearable ? null : option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.genderChip, selected && styles.genderChipSelected]}
          >
            <Text style={[styles.genderChipText, selected && styles.genderChipTextSelected]}>
              {tx(option.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A service's price, or the fact that there is nothing to pay.
//
// Free is a badge, where a price is a line of text. That asymmetry is
// the point: free is the one thing on a service row a client should
// catch without reading, and setting it in the same weight as
// "Kuanzia TZS 30,000" hides it in plain sight.
//
// It is deliberately not the success green. That green means finished
// and nothing else, in every theme — see theme.js. So the badge is the
// theme's own primary, dark enough on its tint to clear AA in all
// three: 7.6:1 green, 6.9:1 orange, 6.9:1 blue.
//
// A service with no price recorded renders nothing at all, which is
// what it did before and still the honest answer — we do not know.
export function PriceTag({ service, colour = colors.primary, size = 12 }) {
  const price = servicePrice(service);
  if (!price) return null;

  if (price.free) {
    return (
      <View style={styles.freeTag}>
        <Ionicons name="gift" size={fs(size)} color={colors.primaryDark} />
        <Text style={[styles.freeTagText, { fontSize: fs(size) }]}>{price.text}</Text>
      </View>
    );
  }

  return (
    <Text style={[styles.priceTagText, { color: colour, fontSize: fs(size) }]}>{price.text}</Text>
  );
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
      accessibilityLabel={tx('Fungua menyu')}
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
  label: { ...type.label, color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 3,
    ...type.body,
    fontSize: type.body.fontSize + 1,
    color: colors.text,
    minHeight: 52,
    ...shadow.card,
  },
  inputError: { borderColor: colors.danger },
  hint: { ...type.tiny, color: colors.muted, marginTop: 5 },
  fieldError: { ...type.tiny, color: colors.danger, marginTop: 5 },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    ...shadow.lifted,
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, shadowOpacity: 0, elevation: 0 },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: font.bold, fontSize: type.body.fontSize + 2, color: colors.onPrimary },
  buttonTextGhost: { color: colors.primary },

  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { ...type.small, color: colors.danger },

  menuButton: { padding: 4, borderRadius: radius.sm },
  menuPressed: { opacity: 0.6 },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  screenHeaderText: { flex: 1 },
  screenTitle: { ...type.title, color: colors.text },
  screenSubtitle: { ...type.small, color: colors.muted, marginTop: 2 },

  genderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  genderChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderChipText: { fontSize: fs(13), fontFamily: font.semibold, color: colors.muted },
  genderChipTextSelected: { color: colors.onPrimary },

  freeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  freeTagText: { fontFamily: font.extrabold, color: colors.primaryDark, letterSpacing: 0.3 },
  priceTagText: { fontFamily: font.bold },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
});
