import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { Button, ErrorBox, Field } from '../lib/ui';
import { colors, spacing } from '../lib/theme';

export default function Login() {
  const router = useRouter();
  const { signIn } = useSession();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(identifier.trim(), password);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Karibu tena</Text>
        <Text style={styles.subtitle}>Ingia ili uendelee</Text>

        <ErrorBox error={error} />

        <Field
          label="Namba ya simu"
          placeholder="07XXXXXXXX"
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoComplete="tel"
        />
        <Field
          label="Nenosiri"
          placeholder="Nenosiri lako"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Button title="Ingia" onPress={submit} loading={busy} disabled={!identifier || !password} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Huna akaunti? </Text>
          <Link href="/register" style={styles.link}>
            Jisajili
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText: { color: colors.muted },
  link: { color: colors.primary, fontWeight: '600' },
});
