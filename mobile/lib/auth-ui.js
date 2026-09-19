import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Wordmark } from './brand';
import { colors, font, radius, shadow, spacing, type } from './theme';
import { tx } from './i18n';

// The pieces the sign-in and sign-up screens are built from.
//
// They live apart from ui.js because nothing else in the app looks like
// this: icons inside the inputs, a gradient pill button, a numbered
// stepper. Putting them in ui.js would tempt the other screens to drift
// towards a style they were not designed for.

// --- Brand header -----------------------------------------------------
//
// The design draws the name in clean two-tone lettering with the
// tagline beneath. That is what this is now: the house-and-stethoscope
// mark has gone at the owner's request, and the name is set as text so
// nothing can crop it. See lib/brand.js for why the picture went.

export function BrandHeader({ onBack }) {
  return (
    <View style={styles.brandRow}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={tx('Rudi nyuma')}
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}

      <View style={styles.brandText}>
        <Wordmark size={28} />
        <Text style={styles.tagline}>{tx('Huduma bora ya afya, ndani ya nyumba yako.')}</Text>
      </View>
    </View>
  );
}

// The "or continue with" divider and the Google button.
//
// Facebook was here because the design had it. It is gone at the
// owner's request — one provider that works beats two that are drawn.
export function SocialRow({ onPress, busy }) {
  return (
    <View>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{tx('Au endelea na')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.social, pressed && styles.pressed, busy && styles.disabled]}
      >
        {busy ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <>
            <Ionicons name="logo-google" size={19} color="#DB4437" />
            <Text style={styles.socialText}>{tx('Endelea na Google')}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// --- Input with an icon in it ----------------------------------------

export function IconField({
  label,
  icon,
  hint,
  error,
  secure,
  value,
  onChangeText,
  ...props
}) {
  const [hidden, setHidden] = useState(Boolean(secure));

  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputRow, error && styles.inputRowError]}>
        <Ionicons name={icon} size={18} color={colors.subtle} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.subtle}
          secureTextEntry={hidden}
          value={value}
          onChangeText={onChangeText}
          {...props}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((on) => !on)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Onyesha nenosiri' : 'Ficha nenosiri'}
            hitSlop={10}
            style={styles.eye}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.subtle} />
          </Pressable>
        ) : null}
      </View>

      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// --- Gradient pill button --------------------------------------------

export function GradientButton({ title, onPress, loading, disabled, icon = 'arrow-forward' }) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={({ pressed }) => [pressed && !isDisabled && styles.pressed, isDisabled && styles.disabled]}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientButton}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Text style={styles.gradientButtonText}>{title}</Text>
            <Ionicons name={icon} size={18} color={colors.onPrimary} />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// --- Checkbox ---------------------------------------------------------

export function CheckBox({ checked, onToggle, children }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
      </View>
      <View style={styles.checkLabel}>{children}</View>
    </Pressable>
  );
}

// --- Numbered stepper -------------------------------------------------

export function Stepper({ steps, current }) {
  return (
    <View style={styles.stepper}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={label} style={styles.step}>
            <View style={styles.stepTop}>
              <View style={[styles.stepLine, index === 0 && styles.stepLineHidden, done && styles.stepLineDone]} />
              <View style={[styles.stepDot, (done || active) && styles.stepDotOn]}>
                {done ? (
                  <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.stepNum, active && styles.stepNumOn]}>{index + 1}</Text>
                )}
              </View>
              <View
                style={[
                  styles.stepLine,
                  index === steps.length - 1 && styles.stepLineHidden,
                  done && styles.stepLineDone,
                ]}
              />
            </View>
            <Text style={[styles.stepLabel, (done || active) && styles.stepLabelOn]} numberOfLines={2}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// --- Footer -----------------------------------------------------------
//
// The design closes both screens with a skyline and a strapline. The
// skyline is drawn here from plain views rather than shipped as an
// image: it is a row of rectangles, and an asset for that would be a
// download for nothing.

const SKYLINE = [14, 26, 18, 34, 22, 40, 16, 28, 20, 36, 15, 30, 24, 18, 32, 20];

export function BrandFooter({ words }) {
  return (
    <View style={styles.footer}>
      <View style={styles.skyline} accessible={false}>
        {SKYLINE.map((height, index) => (
          <View key={index} style={[styles.building, { height }]} />
        ))}
      </View>
      <View style={styles.footerWords}>
        {words.map((word, index) => (
          <View key={word} style={styles.footerWordWrap}>
            {index > 0 ? <Text style={styles.footerDot}>•</Text> : null}
            <Text style={styles.footerWord}>{word}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  back: { paddingRight: spacing.xs },
  brandText: { flex: 1, alignItems: 'flex-start' },
  tagline: { ...type.tiny, color: colors.muted, marginTop: 2 },

  fieldWrap: { marginBottom: spacing.md },
  label: { ...type.label, color: colors.text, marginBottom: spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    minHeight: 56,
    ...shadow.card,
  },
  inputRowError: { borderColor: colors.danger },
  inputIcon: { marginRight: spacing.xs + 2 },
  input: {
    flex: 1,
    ...type.body,
    fontSize: type.body.fontSize + 1,
    color: colors.text,
    paddingVertical: spacing.sm + 3,
  },
  eye: { paddingLeft: spacing.xs },
  hint: { ...type.tiny, color: colors.muted, marginTop: 5 },
  fieldError: { ...type.tiny, color: colors.danger, marginTop: 5 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...type.small, color: colors.subtle },

  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 1,
    ...shadow.card,
  },
  socialText: { ...type.bodyStrong, color: colors.text },

  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    minHeight: 56,
    ...shadow.lifted,
  },
  gradientButtonText: { fontFamily: font.bold, fontSize: type.body.fontSize + 2, color: colors.onPrimary },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2 },
  checkBox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { flex: 1 },

  stepper: { flexDirection: 'row', marginBottom: spacing.lg },
  step: { flex: 1, alignItems: 'center' },
  stepTop: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border },
  stepLineHidden: { backgroundColor: 'transparent' },
  stepLineDone: { backgroundColor: colors.primary },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: colors.primary, ...shadow.card },
  stepNum: { ...type.tiny, fontFamily: font.bold, color: colors.muted },
  stepNumOn: { color: colors.onPrimary },
  stepLabel: { ...type.tiny, fontSize: 10, color: colors.subtle, marginTop: 6, textAlign: 'center' },
  stepLabelOn: { color: colors.primary, fontFamily: font.bold },

  // marginTop auto is what pins this to the bottom of a screen whose
  // content does not otherwise reach it. Without it a short page floats
  // in the middle of a tall phone with dead space underneath.
  footer: { alignItems: 'center', marginTop: 'auto', paddingTop: spacing.lg },
  skyline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    opacity: 0.18,
    marginBottom: spacing.sm,
  },
  building: { width: 9, backgroundColor: colors.primary, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  footerWords: { flexDirection: 'row', alignItems: 'center' },
  footerWordWrap: { flexDirection: 'row', alignItems: 'center' },
  footerDot: { color: colors.subtle, fontSize: 11, marginHorizontal: spacing.xs },
  footerWord: { ...type.tiny, color: colors.muted },
});
