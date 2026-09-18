import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { ErrorBox } from '../lib/ui';
import {
  BrandFooter,
  BrandHeader,
  CheckBox,
  GradientButton,
  IconField,
  SocialRow,
} from '../lib/auth-ui';
import { colors, spacing } from '../lib/theme';

// The sign-in screen from the design.
//
// The picture band runs to both edges with the design's curved bottom.
// It held a branded panel while there was nothing to put in it; the
// owner has now supplied the image, cropped to the band's 2:1 and
// composited onto the page background so its cut-out edges dissolve
// rather than showing as a rectangle. Changing it again is one file,
// assets/hero.png, and no code.
//
// Google and Facebook are drawn because the design has them. They
// cannot sign anybody in yet: the API has no OAuth, no provider, no
// callback. Pressing one says so rather than failing quietly.

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
        <View style={styles.gutter}>
          <BrandHeader />

          <View style={styles.headingRow}>
            <View style={styles.headingText}>
              <Text style={styles.title}>Karibu tena</Text>
              <Text style={styles.subtitle}>Ingia kwenye akaunti yako ili uendelee</Text>
            </View>
            <Text style={styles.script}>Afya bora{'\n'}nyumbani</Text>
          </View>
        </View>

        {/* Full bleed, as the design has it: the picture runs to both
            edges and the page's side padding resumes below it. */}
        <Image source={require('../assets/hero.png')} style={styles.hero} resizeMode="cover" />

        <View style={styles.gutter}>
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

          <SocialRow
            onUnavailable={(provider) =>
              Alert.alert(
                `${provider} bado`,
                `Kuingia kwa ${provider} hakujawashwa bado. Tumia namba yako ya simu.`
              )
            }
          />

          <View style={styles.registerRow}>
            <Text style={styles.muted}>Huna akaunti? </Text>
            <Pressable
              onPress={() => router.push('/register')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <View style={styles.linkRow}>
                <Text style={styles.link}>Jisajili</Text>
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
  content: { paddingTop: spacing.xl, paddingBottom: spacing.lg },
  gutter: { paddingHorizontal: spacing.lg },

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
    width: '100%',
    height: 190,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

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
