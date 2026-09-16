import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
