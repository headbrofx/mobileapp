import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  useWindowDimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { GoogleButton } from '../lib/google';
import { ErrorBox } from '../lib/ui';
import {
  BrandFooter,
  BrandHeader,
  CheckBox,
  GradientButton,
  IconField,
} from '../lib/auth-ui';
import { colors, radius, spacing, type } from '../lib/theme';
import { tx, useI18n } from '../lib/i18n';

// The sign-in screen from the design.
//
// The picture band runs to both edges with the design's curved bottom.
// It held a branded panel while there was nothing to put in it; the
// owner has now supplied the image, cropped to the band's 2:1 and
// composited onto the page background so its cut-out edges dissolve
// rather than showing as a rectangle. Changing it again is one file,
// assets/hero.png, and no code.
//
// Google sign-in is real. The app asks Google for an ID token and
// hands it to the API, which verifies the signature and the audience
// before believing it.
//
// A Google account the API has not seen comes back 409 PHONE_REQUIRED
// rather than being created, because a home-visit service cannot hold a
// client it has no number for and Google supplies none. That is the
// second panel below: same token, plus the number.

export default function Login() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const router = useRouter();
  const { signIn, signInWithGoogle } = useSession();
  // The picture keeps the design's proportion on every phone rather
  // than a height that is right on one and wrong on the rest.
  const { width } = useWindowDimensions();
  const heroHeight = Math.round(Math.min(width * 0.52, 260));

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Set once Google has verified somebody the API has never seen: their
  // token, waiting for a phone number before an account can exist.
  const [pendingGoogle, setPendingGoogle] = useState(null);
  const [googlePhone, setGooglePhone] = useState('');

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(identifier.trim(), password, { remember });
      router.replace('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Called with a token Google has already issued. A new account comes
  // back 409 PHONE_REQUIRED instead of being created, and that is not a
  // failure — it is the second half of signing up.
  async function withGoogleToken(idToken) {
    setError(null);
    try {
      await signInWithGoogle(idToken);
      router.replace('/home');
    } catch (err) {
      if (err.code === 'PHONE_REQUIRED') {
        setPendingGoogle({ idToken, email: err.errors?.email, name: err.errors?.name });
        return;
      }
      setError(err.message);
    }
  }

  async function finishGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle(pendingGoogle.idToken, googlePhone.replace(/\s/g, ''));
      router.replace('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gutter}>
          <BrandHeader />

          <View style={styles.headingRow}>
            <View style={styles.headingText}>
              <Text style={styles.title}>{tx('Karibu tena')}</Text>
              <Text style={styles.subtitle}>{tx('Ingia kwenye akaunti yako ili uendelee')}</Text>
            </View>
            <Text style={styles.script}>Afya bora{'\n'}nyumbani</Text>
          </View>
        </View>

        {/* Full bleed, as the design has it: the picture runs to both
            edges and the page's side padding resumes below it. */}
        <Image
          source={require('../assets/hero.png')}
          style={[styles.hero, { height: heroHeight }]}
          resizeMode="cover"
        />

        <View style={[styles.gutter, styles.form]}>
          <ErrorBox error={error} />

          <IconField
            label={tx('Namba ya simu au barua pepe')}
            icon="mail-outline"
            placeholder="0712 345 678"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoComplete="username"
          />

          <IconField
            label={tx('Nenosiri')}
            icon="lock-closed-outline"
            placeholder={tx('Nenosiri lako')}
            value={password}
            onChangeText={setPassword}
            secure
            autoCapitalize="none"
            autoComplete="current-password"
          />

          <View style={styles.rememberRow}>
            <CheckBox checked={remember} onToggle={() => setRemember((on) => !on)}>
              <Text style={styles.rememberText}>{tx('Nikumbuke')}</Text>
            </CheckBox>

            <Pressable
              onPress={() => router.push('/forgot-password')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.link}>{tx('Umesahau nenosiri?')}</Text>
            </Pressable>
          </View>

          <GradientButton
            title={tx('Ingia')}
            onPress={submit}
            loading={busy}
            disabled={!identifier || !password}
          />

          {pendingGoogle ? (
            <View style={styles.pending}>
              <Text style={styles.pendingTitle}>Karibu, {pendingGoogle.name}</Text>
              <Text style={styles.pendingText}>{tx('Tunahitaji namba yako ya simu ili muuguzi ajue pa kukufuata.')}</Text>

              <IconField
                label={tx('Namba ya simu')}
                icon="call-outline"
                placeholder="0712 345 678"
                value={googlePhone}
                onChangeText={setGooglePhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />

              <GradientButton
                title={tx('Maliza kujisajili')}
                onPress={finishGoogle}
                loading={busy}
                disabled={googlePhone.trim().length < 10}
              />

              <Pressable
                onPress={() => setPendingGoogle(null)}
                accessibilityRole="button"
                style={styles.cancelGoogle}
              >
                <Text style={styles.muted}>{tx('Ghairi')}</Text>
              </Pressable>
            </View>
          ) : (
            <GoogleButton onToken={withGoogleToken} onError={setError} />
          )}

          <View style={styles.registerRow}>
            <Text style={styles.muted}>{tx('Huna akaunti?')}</Text>
            <Pressable
              onPress={() => router.push('/register')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <View style={styles.linkRow}>
                <Text style={styles.link}>{tx('Jisajili')}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </View>
            </Pressable>
          </View>

          <BrandFooter words={['Rahisi', 'Ya kuaminika', 'Kitaalamu']} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  // flexGrow, not flex: the content still scrolls when it is taller
  // than the screen, but stretches to fill when it is shorter — which
  // is what stops a short page floating with dead space beneath it.
  content: { flexGrow: 1, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  gutter: { paddingHorizontal: spacing.lg },
  form: { flex: 1 },

  headingRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.lg },
  headingText: { flex: 1 },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.muted, marginTop: 4 },
  // Stands in for the handwritten accent in the design. The script font
  // it uses is not one this app ships, so this is the nearest thing
  // without adding a download for decoration.
  script: {
    ...type.small,
    fontStyle: 'italic',
    color: colors.brandOrange,
    textAlign: 'right',
    marginTop: 6,
  },

  hero: {
    width: '100%',
    borderBottomLeftRadius: radius.xxl + 10,
    borderBottomRightRadius: radius.xxl + 10,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  rememberText: { ...type.small, color: colors.muted },
  link: { ...type.label, color: colors.primary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  muted: { ...type.small, color: colors.muted },

  pending: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  pendingTitle: { ...type.section, color: colors.text },
  pendingText: { ...type.small, color: colors.muted, marginTop: 3, marginBottom: spacing.md },
  cancelGoogle: { alignItems: 'center', paddingTop: spacing.sm },
});
