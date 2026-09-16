import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { Button, ErrorBox, Field } from '../lib/ui';
import { colors, spacing } from '../lib/theme';

export default function Register() {
  const router = useRouter();
  const { register } = useSession();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      await register({ name: name.trim(), phone: phone.trim(), password });
      router.replace('/home');
    } catch (err) {
      // The API validates field by field, so show its complaints where
      // they belong rather than as one lump at the top.
      if (err.errors?.length) {
        setFieldErrors(
          Object.fromEntries(err.errors.map((item) => [item.field, item.message]))
        );
      }
      setError(err.errors?.length ? null : err.message);
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
        <Text style={styles.title}>Fungua akaunti</Text>
        <Text style={styles.subtitle}>Ni bure, na inachukua dakika moja</Text>

        <ErrorBox error={error} />

        <Field
          label="Jina lako"
          placeholder="Jina kamili"
          value={name}
          onChangeText={setName}
          error={fieldErrors.name}
        />
        <Field
          label="Namba ya simu"
          placeholder="07XXXXXXXX"
          hint="Namba ya Tanzania, kama 0712345678"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          error={fieldErrors.phone}
        />
        <Field
          label="Nenosiri"
          placeholder="Angalau herufi 8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          error={fieldErrors.password}
        />

        <Button
          title="Jisajili"
          onPress={submit}
          loading={busy}
          disabled={!name || !phone || !password}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.lg },
});
