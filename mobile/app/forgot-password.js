import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth } from '../lib/api';
import { ErrorBox } from '../lib/ui';
import { BrandFooter, BrandHeader, GradientButton, IconField } from '../lib/auth-ui';
import { colors, font, radius, spacing } from '../lib/theme';
import { tx, useI18n } from '../lib/i18n';

// The design puts "Forgot password?" on the sign-in screen, so here is
// where it goes.
//
// The endpoint behind it is real: it finds the account, mints a
// single-use token, records the request in the audit trail, and answers
// the same way whether or not the account exists — so nobody can use
// this form to find out which phone numbers are registered.
//
// What does not exist is delivery. There is no SMS gateway and no mail
// sender, so the token reaches the server log and stops there. Until
// one is connected, somebody at the office has to read it out. This
// screen says exactly that instead of "check your messages", which
// would leave a person staring at a phone that is never going to buzz.

export default function ForgotPassword() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await auth.forgotPassword(identifier.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandHeader onBack={() => router.back()} />

        <Text style={styles.title}>{tx('Umesahau nenosiri?')}</Text>
        <Text style={styles.subtitle}>{tx('Andika namba ya simu au barua pepe uliyotumia kufungua akaunti.')}</Text>

        <ErrorBox error={error} />

        {sent ? (
          <View style={styles.sent}>
            <View style={styles.sentIcon}>
              <Ionicons name="checkmark" size={30} color={colors.onPrimary} />
            </View>
            <Text style={styles.sentTitle}>{tx('Ombi limepokelewa')}</Text>
            <Text style={styles.sentText}>{tx('Tumelipokea ombi lako. Kwa sasa msimbo wa kubadilisha nenosiri haupo kwenye ujumbe — piga simu ofisini ili wakupe, kisha ubadilishe nenosiri lako.')}</Text>
            <View style={styles.sentAction}>
              <GradientButton title={tx('Rudi kuingia')} onPress={() => router.replace('/login')} icon="arrow-back" />
            </View>
          </View>
        ) : (
          <>
            <IconField
              label={tx('Namba ya simu au barua pepe')}
              icon="person-outline"
              placeholder="0712 345 678"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />

            <GradientButton
              title={tx('Tuma ombi')}
              onPress={submit}
              loading={busy}
              disabled={identifier.trim().length < 3}
            />

            <Pressable
              onPress={() => router.replace('/login')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.link}>{tx('Rudi kuingia')}</Text>
            </Pressable>
          </>
        )}

        <BrandFooter words={['Rahisi', 'Ya kuaminika', 'Kitaalamu']} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  pressed: { opacity: 0.75 },

  title: { fontSize: 24, fontFamily: font.extrabold, color: colors.text, marginTop: spacing.lg },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 3, marginBottom: spacing.lg, lineHeight: 19 },

  back: { alignItems: 'center', paddingVertical: spacing.md },
  link: { color: colors.primary, fontFamily: font.bold, fontSize: 13 },

  sent: { alignItems: 'center', paddingVertical: spacing.md },
  sentIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sentTitle: { fontSize: 18, fontFamily: font.extrabold, color: colors.text },
  sentText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    overflow: 'hidden',
  },
  sentAction: { alignSelf: 'stretch' },
});
