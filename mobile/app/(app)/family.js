import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { familyMembers as familyApi } from '../../lib/api';
import { Button, Card, ErrorBox, Field } from '../../lib/ui';
import { colors, font, radius, spacing } from '../../lib/theme';

// The people this account cares for.
//
// This is the screen the app was missing. Every health endpoint hangs
// off a FamilyMember, and the backend creates exactly one on
// registration — the account holder. Without a way to add anybody else,
// a person could book a nurse for themselves and nobody else, which is
// the opposite of what a home-care app is for: most users are arranging
// care for a parent or a child, not for themselves.

const RELATIONSHIPS = [
  { value: 'PARENT', label: 'Mzazi' },
  { value: 'CHILD', label: 'Mtoto' },
  { value: 'SPOUSE', label: 'Mwenzi' },
  { value: 'SIBLING', label: 'Ndugu' },
  { value: 'GRANDPARENT', label: 'Babu/Bibi' },
  { value: 'OTHER', label: 'Mwingine' },
];

const GENDERS = [
  { value: 'FEMALE', label: 'Mke' },
  { value: 'MALE', label: 'Mume' },
  { value: 'OTHER', label: 'Nyingine' },
];

const LABEL = Object.fromEntries(RELATIONSHIPS.map((r) => [r.value, r.label]));

export default function Family() {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('PARENT');
  const [gender, setGender] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await familyApi.list();
      setMembers(data?.familyMembers ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function reset() {
    setName('');
    setRelationship('PARENT');
    setGender(null);
    setDateOfBirth('');
    setFieldErrors({});
  }

  async function submit() {
    setError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      await familyApi.create({
        name: name.trim(),
        relationship,
        ...(gender ? { gender } : {}),
        ...(dateOfBirth.trim() ? { dateOfBirth: dateOfBirth.trim() } : {}),
      });
      reset();
      setAdding(false);
      await load();
    } catch (err) {
      // Field-level complaints belong beside their field.
      if (err.errors?.length) {
        setFieldErrors(Object.fromEntries(err.errors.map((e) => [e.field, e.message])));
      }
      setError(err.errors?.length ? null : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ErrorBox error={error} />

        {members.map((member) => (
          <Card key={member.id}>
            <Text style={styles.cardTitle}>{member.name}</Text>
            <Text style={styles.muted}>
              {member.relationship === 'SELF' ? 'Wewe mwenyewe' : LABEL[member.relationship] ?? member.relationship}
              {member.dateOfBirth ? ` · ${new Date(member.dateOfBirth).toLocaleDateString('sw-TZ')}` : ''}
            </Text>
          </Card>
        ))}

        {adding ? (
          <Card style={styles.form}>
            <Text style={styles.formTitle}>Ongeza mtu</Text>

            <Field
              label="Jina"
              placeholder="Jina kamili"
              value={name}
              onChangeText={setName}
              error={fieldErrors.name}
            />

            <Text style={styles.label}>Uhusiano wako naye</Text>
            <View style={styles.chips}>
              {RELATIONSHIPS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={relationship === option.value}
                  onPress={() => setRelationship(option.value)}
                />
              ))}
            </View>

            <Text style={styles.label}>Jinsia (hiari)</Text>
            <View style={styles.chips}>
              {GENDERS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={gender === option.value}
                  onPress={() => setGender(gender === option.value ? null : option.value)}
                />
              ))}
            </View>

            <Field
              label="Tarehe ya kuzaliwa (hiari)"
              placeholder="YYYY-MM-DD"
              hint="Mfano: 1958-03-14"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              autoCapitalize="none"
              error={fieldErrors.dateOfBirth}
            />

            <Button title="Hifadhi" onPress={submit} loading={busy} disabled={name.trim().length < 2} />
            <View style={styles.cancel}>
              <Button
                title="Ghairi"
                variant="ghost"
                onPress={() => {
                  reset();
                  setAdding(false);
                }}
              />
            </View>
          </Card>
        ) : (
          <View style={styles.addWrap}>
            <Button title="Ongeza mtu wa familia" onPress={() => setAdding(true)} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  cardTitle: { fontSize: 16, fontFamily: font.semibold, color: colors.text },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2 },

  addWrap: { marginTop: spacing.md },
  form: { marginTop: spacing.md, paddingTop: spacing.md },
  formTitle: { fontSize: 17, fontFamily: font.bold, color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 14, fontFamily: font.semibold, color: colors.text, marginBottom: spacing.xs },

  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md, marginRight: -spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.cream },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.primary, fontFamily: font.semibold },

  cancel: { marginTop: spacing.xs },
});
