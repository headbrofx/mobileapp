import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { ErrorBox } from '../lib/ui';
import { BrandFooter, BrandHeader, CheckBox, GradientButton, IconField } from '../lib/auth-ui';
import { colors, radius, spacing } from '../lib/theme';

// The sign-in screen from the design.
//
// Two things in the design are not here, and both are deliberate.
//
// The photograph of a nurse with a patient: there is no photograph of
// this business's own staff, and putting a stock photograph of somebody
// else's nurse on a sign-in screen would be a small lie told to every
// person who opens the app. The band below keeps its place and its
// shape, so a real photograph drops in without the layout moving.
//
// "Continue with Google" and "Continue with Facebook": the API has no
// OAuth. There is no provider configured, no callback, nothing. A
// button that cannot sign anybody in is worse than no button, so it is
// not drawn until there is something behind it.

export default function Login() {
  const router = useRouter();
  const { signIn } = useSession();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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
        <BrandHeader />

        <View style={styles.headingRow}>
          <View style={styles.headingText}>
            <Text style={styles.title}>Karibu tena</Text>
            <Text style={styles.subtitle}>Ingia kwenye akaunti yako ili uendelee</Text>
          </View>
          <Text style={styles.script}>Afya bora{'\n'}nyumbani</Text>
        </View>

        {/* Where the photograph goes. Until there is one, the band
            carries the brand gradient at the same height and curve. */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Ionicons name="home" size={30} color="rgba(255,255,255,0.85)" />
          <Text style={styles.heroText}>Muuguzi anakuja kwako</Text>
        </LinearGradient>

        <ErrorBox error={error} />

        <IconField
          label="Namba ya simu au barua pepe"
          icon="mail-outline"
          placeholder="0712 345 678"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoComplete="username"
        />

        <IconField
          label="Nenosiri"
          icon="lock-closed-outline"
          placeholder="Nenosiri lako"
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="current-password"
        />

        <View style={styles.rememberRow}>
          <CheckBox checked={remember} onToggle={() => setRemember((on) => !on)}>
            <Text style={styles.rememberText}>Nikumbuke</Text>
          </CheckBox>

          <Pressable
            onPress={() => router.push('/forgot-password')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.link}>Umesahau nenosiri?</Text>
          </Pressable>
        </View>

        <GradientButton
          title="Ingia"
          onPress={submit}
          loading={busy}
          disabled={!identifier || !password}
        />

        <View style={styles.registerRow}>
          <Text style={styles.muted}>Huna akaunti? </Text>
          <Pressable onPress={() => router.push('/register')} accessibilityRole="button" hitSlop={8}>
            <View style={styles.linkRow}>
              <Text style={styles.link}>Jisajili</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </View>
          </Pressable>
        </View>

        <BrandFooter words={['Rahisi', 'Ya kuaminika', 'Kitaalamu']} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },

  headingRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.lg },
  headingText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 3, lineHeight: 19 },
  // Stands in for the handwritten accent in the design. The script font
  // it uses is not one this app ships, so this is the nearest thing
  // without adding a download for decoration.
  script: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '700',
    color: colors.brandOrange,
    textAlign: 'right',
    lineHeight: 17,
    marginTop: 4,
  },

  hero: {
    height: 128,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  heroText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  rememberText: { fontSize: 13, color: colors.muted },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  muted: { color: colors.muted, fontSize: 13 },
});
