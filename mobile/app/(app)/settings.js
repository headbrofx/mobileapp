import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../../lib/api';
import { LANGUAGES, tx, useI18n } from '../../lib/i18n';
import { TEXT_SIZE_OPTIONS, THEMES, colors, font, fs, radius, saveTextSize, saveTheme, shadow, spacing, textSizeName, themeName, type } from '../../lib/theme';

// Settings: the language and the colour.
//
// The colour used to be my decision, then the owner's, then mine again
// — four rounds of one of us guessing what the other meant. It is a
// choice now, which is the honest place for it.
//
// The one thing this screen has to be straight about is when a choice
// takes effect. Styles are built once, at launch, from whichever palette
// was saved — that is what lets every screen change at all without being
// rewritten — and styles already built cannot be repainted. On the web
// the page reloads itself and the change is simply there. On a phone it
// waits for the next launch, and this screen says so rather than leaving
// somebody tapping a colour that appears to do nothing.

// The three samples, in points, so the letters in the list are visibly
// the sizes on offer.
const SAMPLE = { small: 13, normal: 16, large: 19 };

export default function Settings() {
  const { t, language, setLanguage } = useI18n();
  const [pending, setPending] = useState(null);

  async function chooseTheme(name) {
    if (name === themeName) return;
    const applied = await saveTheme(name);
    // On web the line above reloads the page and nothing after it runs.
    if (!applied) setPending(name);
  }

  async function chooseTextSize(name) {
    if (name === textSizeName) return;
    const applied = await saveTextSize(name);
    if (!applied) setPending(name);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.groupTitle}>{tx('Rangi ya app')}</Text>
      <View style={styles.group}>
        {THEMES.map((theme, index) => {
          const active = theme.name === themeName;
          const waiting = pending === theme.name;

          return (
            <Pressable
              key={theme.name}
              onPress={() => chooseTheme(theme.name)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.row,
                index < THEMES.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: theme.swatch }]}>
                {active ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
              </View>

              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{tx(theme.label)}</Text>
                <Text style={styles.rowHint}>
                  {active
                    ? tx('Inatumika sasa')
                    : waiting
                      ? tx('Imehifadhiwa — fungua app upya ionekane')
                      : tx('Gusa kuichagua')}
                </Text>
              </View>

              {waiting ? (
                <Ionicons name="refresh-outline" size={18} color={colors.muted} />
              ) : active ? (
                <Ionicons name="radio-button-on" size={18} color={colors.primary} />
              ) : (
                <Ionicons name="radio-button-off" size={18} color={colors.subtle} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        {Platform.OS === 'web'
          ? tx('Ukichagua rangi, ukurasa unajipakia upya mara moja.')
          : tx('Rangi mpya inaonekana ukifungua app upya.')}
      </Text>

      <Text style={styles.groupTitle}>{tx('Ukubwa wa maandishi')}</Text>
      <View style={styles.group}>
        {TEXT_SIZE_OPTIONS.map((option, index) => {
          const active = option.name === textSizeName;
          const waiting = pending === option.name;

          return (
            <Pressable
              key={option.name}
              onPress={() => chooseTextSize(option.name)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.row,
                index < TEXT_SIZE_OPTIONS.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              {/* The sample is drawn at the size it sells, not at the
                  size the rest of the row happens to be. A list of
                  three identical lines that say "small", "normal" and
                  "large" tells you nothing about what you are picking. */}
              <View style={styles.rowIcon}>
                <Text style={[styles.sample, { fontSize: SAMPLE[option.name] }]}>Aa</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{tx(option.label)}</Text>
                <Text style={styles.rowHint}>
                  {active
                    ? tx('Inatumika sasa')
                    : waiting
                      ? tx('Imehifadhiwa — fungua app upya ionekane')
                      : tx('Gusa kuichagua')}
                </Text>
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={active ? colors.primary : colors.subtle}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.groupTitle}>{t('settings.language')}</Text>
      <View style={styles.group}>
        {LANGUAGES.map((option, index) => {
          const active = option.code === language;

          return (
            <Pressable
              key={option.code}
              onPress={() => setLanguage(option.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.row,
                index < LANGUAGES.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.rowIcon}>
                <Text style={styles.code}>{option.code.toUpperCase()}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{option.label}</Text>
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={active ? colors.primary : colors.subtle}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.groupTitle}>{tx('Kuhusu')}</Text>
      <View style={styles.group}>
        <Pressable
          onPress={() => Linking.openURL(`${BASE_URL}/privacy`)}
          accessibilityRole="link"
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="lock-closed-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{tx('Sera ya faragha')}</Text>
            <Text style={styles.rowHint}>{tx('Taarifa zako zinatumikaje')}</Text>
          </View>
          <Ionicons name="open-outline" size={17} color={colors.subtle} />
        </Pressable>
      </View>

      <Text style={styles.footer}>Afya Nyumbani Home Care Services Ltd</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },

  groupTitle: {
    ...type.label,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
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
  code: { fontSize: fs(12), fontFamily: font.bold, color: colors.primary },
  sample: { fontFamily: font.bold, color: colors.primary },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { ...type.bodyStrong, fontSize: fs(15), color: colors.text },
  rowHint: { ...type.tiny, color: colors.muted, marginTop: 1 },

  note: {
    ...type.small,
    color: colors.muted,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  footer: { ...type.tiny, color: colors.subtle, textAlign: 'center', marginTop: spacing.sm },
});
