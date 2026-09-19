import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { familyMembers as familyApi, symptoms as symptomsApi } from '../../lib/api';
import { Button, Card, ErrorBox, Field } from '../../lib/ui';
import { colors, font, radius, spacing } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// Reporting a symptom.
//
// The backend enriches a submission from the catalogue and runs it
// through the red-flag rules on the way in, then hands back a verdict.
// That verdict is the reason this screen exists, so it is shown the same
// way an Afya AI emergency is: the danger colour, a heavy border, and
// wording that says go rather than hinting.
//
// The verdict is a signal to have somebody look, never a diagnosis, and
// the wording keeps to that — it repeats what the API said rather than
// interpreting it.

const SEVERITIES = [
  { value: 'MILD', label: 'Kidogo' },
  { value: 'MODERATE', label: 'Wastani' },
  { value: 'SEVERE', label: 'Kali' },
];

const UNITS = [
  { value: 'HOURS', label: 'Masaa' },
  { value: 'DAYS', label: 'Siku' },
  { value: 'WEEKS', label: 'Wiki' },
];

export default function Symptoms() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const [members, setMembers] = useState([]);
  const [memberId, setMemberId] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [history, setHistory] = useState([]);

  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('MILD');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState('DAYS');
  const [notes, setNotes] = useState('');

  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [memberData, catalogueData] = await Promise.all([
          familyApi.list(),
          symptomsApi.catalogue(),
        ]);
        const list = memberData?.familyMembers ?? [];
        setMembers(list);
        if (list.length) setMemberId(list[0].id);
        setCatalogue(catalogueData?.items ?? []);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  const loadHistory = useCallback(async () => {
    if (!memberId) return;
    try {
      const data = await symptomsApi.list(memberId);
      setHistory(data?.symptoms ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  async function submit() {
    setError(null);
    setVerdict(null);
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        severity,
        ...(durationValue ? { durationValue: Number(durationValue), durationUnit } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      const data = await symptomsApi.report(memberId, payload);
      setVerdict(data?.symptom ?? null);
      setName('');
      setDurationValue('');
      setNotes('');
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Suggestions from the catalogue, so a submission matches a known
  // entry and gets checked against its thresholds rather than being
  // stored as free text nothing recognises.
  const suggestions = name.trim().length >= 2
    ? catalogue
        .filter((item) => item.name.toLowerCase().includes(name.trim().toLowerCase()))
        .slice(0, 5)
    : [];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBox error={error} />

        {verdict ? <Verdict symptom={verdict} /> : null}

        {members.length > 1 ? (
          <>
            <Text style={styles.label}>{tx('Ni kwa ajili ya nani')}</Text>
            <View style={styles.chips}>
              {members.map((member) => (
                <Chip
                  key={member.id}
                  label={member.relationship === 'SELF' ? 'Mimi' : member.name}
                  selected={member.id === memberId}
                  onPress={() => setMemberId(member.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Field
          label={tx('Dalili')}
          placeholder={tx('mfano: Headache')}
          value={name}
          onChangeText={setName}
        />

        {suggestions.length > 0 ? (
          <View style={styles.chips}>
            {suggestions.map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                selected={name.toLowerCase() === item.name.toLowerCase()}
                onPress={() => setName(item.name)}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>{tx('Ukali')}</Text>
        <View style={styles.chips}>
          {SEVERITIES.map((option) => (
            <Chip
              key={option.value}
              label={tx(option.label)}
              selected={severity === option.value}
              onPress={() => setSeverity(option.value)}
            />
          ))}
        </View>

        <Field
          label={tx('Imechukua muda gani (hiari)')}
          placeholder={tx('mfano: 3')}
          value={durationValue}
          onChangeText={setDurationValue}
          keyboardType="number-pad"
        />
        <View style={styles.chips}>
          {UNITS.map((option) => (
            <Chip
              key={option.value}
              label={tx(option.label)}
              selected={durationUnit === option.value}
              onPress={() => setDurationUnit(option.value)}
            />
          ))}
        </View>

        <Field
          label={tx('Maelezo (hiari)')}
          placeholder={tx('Chochote kingine cha kuongeza')}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={styles.textarea}
        />

        <Button
          title={tx('Tuma dalili')}
          onPress={submit}
          loading={busy}
          disabled={!memberId || name.trim().length < 2}
        />

        <Text style={styles.heading}>{tx('Zilizopita')}</Text>
        {history.length === 0 ? (
          <Card>
            <Text style={styles.muted}>{tx('Bado hujaandika dalili yoyote.')}</Text>
          </Card>
        ) : (
          history.slice(0, 10).map((symptom) => (
            <Card key={symptom.id}>
              <Text style={styles.cardTitle}>{symptom.name}</Text>
              <Text style={styles.muted}>
                {tx(SEVERITIES.find((s) => s.value === symptom.severity)?.label ?? symptom.severity)}
                {symptom.occurredAt
                  ? ` · ${new Date(symptom.occurredAt).toLocaleDateString('sw-TZ')}`
                  : ''}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Verdict({ symptom }) {
  const flag = symptom.redFlag;

  if (flag?.isRedFlag) {
    return (
      <View style={styles.emergency}>
        <Text style={styles.emergencyHeading}>{tx('ONA MTAALAMU')}</Text>
        {/* The API's own reasons, not a rewrite of them. */}
        {flag.reasons?.map((reason, index) => (
          <Text key={index} style={styles.emergencyBody}>
            • {reason}
          </Text>
        ))}
        <Text style={styles.emergencyMeta}>{tx('Hii ni ishara ya kuchunguzwa na mtu, si uchunguzi wa ugonjwa.')}</Text>
      </View>
    );
  }

  return (
    <Card style={styles.okCard}>
      <Text style={styles.okTitle}>{tx('Imeandikwa')}</Text>
      <Text style={styles.muted}>{tx('Hakuna ishara ya hatari iliyogunduliwa kwa ulichoandika. Dalili ikizidi au ikibadilika, iandike tena.')}</Text>
    </Card>
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
  label: { fontSize: 14, fontFamily: font.semibold, color: colors.text, marginBottom: spacing.xs },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

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

  heading: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontFamily: font.semibold, color: colors.text },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2, lineHeight: 20 },

  okCard: { marginBottom: spacing.lg },
  okTitle: { fontSize: 16, fontFamily: font.semibold, color: colors.primary },

  emergency: {
    marginBottom: spacing.lg,
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  emergencyHeading: {
    fontSize: 13,
    fontFamily: font.extrabold,
    color: colors.danger,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  emergencyBody: { fontSize: 16, color: colors.danger, lineHeight: 23, fontFamily: font.semibold },
  emergencyMeta: { fontSize: 12, color: colors.danger, marginTop: spacing.sm, opacity: 0.85 },
});
