import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { bookings } from '../../lib/api';
import { Card, ErrorBox, Field } from '../../lib/ui';
import { ActionButton, Chip, careStyles } from '../../lib/care-ui';
import { VITAL_TYPES, VisitReportView } from '../../lib/visit-report';
import { colors, font, fs, radius, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// The nurse's report, written during or right after the visit.
//
// It saves as a draft as often as she likes; "Maliza ziara" saves and
// closes it, which also completes the booking. The server will not
// close a visit without an assessment, and neither does this screen.
//
// Vitals she records here also land in the patient's own health
// record, so the family sees the readings beside their own.

const FOLLOW_UP = [
  { label: 'Hakuna', days: null },
  { label: 'Wiki 1', days: 7 },
  { label: 'Wiki 2', days: 14 },
  { label: 'Mwezi 1', days: 30 },
];

const isoDate = (d) => d.toISOString().slice(0, 10);

export default function VisitReport() {
  useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [loaded, setLoaded] = useState(false);
  const [visit, setVisit] = useState(null);
  const [vitals, setVitals] = useState({});
  const [assessment, setAssessment] = useState('');
  const [treatment, setTreatment] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [followUp, setFollowUp] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await bookings.visit(id);
      const v = data?.visit;
      setVisit(v);
      if (v) {
        setAssessment(v.assessment ?? '');
        setTreatment(v.treatmentNotes ?? '');
        setRecommendations(v.recommendations ?? '');
        setFollowUp(v.followUpDate ?? null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Only readings she has actually typed go to the server; a blank box
  // is not a zero.
  function vitalsPayload() {
    const out = [];
    for (const v of VITAL_TYPES) {
      const entry = vitals[v.type];
      if (!entry) continue;
      if (v.pair) {
        const sys = parseInt(entry.systolic, 10);
        const dia = parseInt(entry.diastolic, 10);
        if (Number.isFinite(sys) && Number.isFinite(dia)) out.push({ type: v.type, systolic: sys, diastolic: dia, unit: v.unit });
      } else {
        const value = parseFloat(String(entry.value ?? '').replace(',', '.'));
        if (Number.isFinite(value)) out.push({ type: v.type, value, unit: v.unit });
      }
    }
    return out;
  }

  function payload() {
    const body = {};
    if (assessment.trim().length >= 3) body.assessment = assessment.trim();
    if (treatment.trim()) body.treatmentNotes = treatment.trim();
    if (recommendations.trim()) body.recommendations = recommendations.trim();
    if (followUp) body.followUpDate = followUp;
    const v = vitalsPayload();
    if (v.length) body.vitals = v;
    return body;
  }

  async function save(close) {
    setError(null);
    setNotice(null);
    if (close && assessment.trim().length < 3) {
      setError(tx('Andika tathmini yako kabla ya kumaliza ziara.'));
      return;
    }
    setBusy(close ? 'close' : 'save');
    try {
      const body = payload();
      if (Object.keys(body).length) await bookings.visitSave(id, body);
      // Readings are recorded once; clear the boxes so a second save
      // does not record them again.
      setVitals({});
      if (close) {
        const data = await bookings.visitCheckOut(id, { assessment: assessment.trim() });
        setDone(data?.visit ?? true);
      } else {
        setNotice(tx('Rasimu imehifadhiwa.'));
        await load();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const setVital = (typeKey, field, value) =>
    setVitals((all) => ({ ...all, [typeKey]: { ...(all[typeKey] ?? {}), [field]: value } }));

  if (!loaded) return <Text style={[careStyles.muted, { padding: spacing.md }]}>{tx('Inapakia…')}</Text>;

  if (done) {
    return (
      <View style={styles.doneWrap}>
        <Text style={styles.doneTitle}>{tx('Ziara imekamilika')}</Text>
        <Text style={styles.doneBody}>{tx('Ripoti imehifadhiwa na mteja ataiona kwenye "Huduma zangu".')}</Text>
        <ActionButton title={tx('Rudi kwenye kazi zangu')} icon="arrow-back" onPress={() => router.replace('/staff-jobs')} />
      </View>
    );
  }

  if (visit?.checkOutAt) {
    return (
      <ScrollView contentContainerStyle={careStyles.content}>
        <Text style={careStyles.muted}>{tx('Ziara hii imeshafungwa. Ripoti haiwezi kubadilishwa tena.')}</Text>
      </ScrollView>
    );
  }

  const recorded = Array.isArray(visit?.vitalsSnapshot) ? visit.vitalsSnapshot : [];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={careStyles.content} keyboardShouldPersistTaps="handled">
        <ErrorBox error={error} />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Text style={careStyles.section}>{tx('Vipimo')}</Text>
        {recorded.length ? (
          <Text style={styles.recorded}>
            {tx('Vimeshahifadhiwa')}: {recorded.map((r) => r.summary).join(' · ')}
          </Text>
        ) : null}
        <Card>
          {VITAL_TYPES.map((v) => (
            <View key={v.type} style={styles.vitalRow}>
              <Text style={styles.vitalLabel}>{tx(v.label)}</Text>
              {v.pair ? (
                <View style={styles.pair}>
                  <TextInput
                    style={styles.vitalInput}
                    keyboardType="number-pad"
                    placeholder="120"
                    placeholderTextColor={colors.subtle}
                    value={vitals[v.type]?.systolic ?? ''}
                    onChangeText={(t) => setVital(v.type, 'systolic', t)}
                  />
                  <Text style={styles.slash}>/</Text>
                  <TextInput
                    style={styles.vitalInput}
                    keyboardType="number-pad"
                    placeholder="80"
                    placeholderTextColor={colors.subtle}
                    value={vitals[v.type]?.diastolic ?? ''}
                    onChangeText={(t) => setVital(v.type, 'diastolic', t)}
                  />
                </View>
              ) : (
                <TextInput
                  style={styles.vitalInput}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.subtle}
                  value={vitals[v.type]?.value ?? ''}
                  onChangeText={(t) => setVital(v.type, 'value', t)}
                />
              )}
              <Text style={styles.unit}>{v.unit}</Text>
            </View>
          ))}
        </Card>

        <Text style={careStyles.section}>{tx('Ripoti')}</Text>
        <Field
          label={tx('Tathmini ya muuguzi (lazima)')}
          value={assessment}
          onChangeText={setAssessment}
          multiline
          style={styles.textarea}
          placeholder={tx('Hali ya mgonjwa uliyoiona leo')}
        />
        <Field
          label={tx('Huduma iliyotolewa')}
          value={treatment}
          onChangeText={setTreatment}
          multiline
          style={styles.textarea}
          placeholder={tx('mfano: Kidonda kimesafishwa na kufungwa upya')}
        />
        <Field
          label={tx('Mapendekezo kwa mgonjwa na familia')}
          value={recommendations}
          onChangeText={setRecommendations}
          multiline
          style={styles.textarea}
          placeholder={tx('mfano: Kunywa maji mengi, rudisha dawa saa 2 usiku')}
        />

        <Text style={styles.label}>{tx('Ziara ijayo')}</Text>
        <View style={careStyles.chips}>
          {FOLLOW_UP.map((f) => {
            const value = f.days ? isoDate(new Date(Date.now() + f.days * 86400000)) : null;
            const selected = f.days ? followUp === value : followUp === null;
            return <Chip key={f.label} label={tx(f.label)} selected={selected} onPress={() => setFollowUp(value)} />;
          })}
        </View>

        {visit ? (
          <View style={styles.preview}>
            <VisitReportView
              printable={false}
              report={{
                reference: '',
                checkInAt: visit.checkInAt,
                status: 'DRAFT',
                nurse: visit.staff?.user ? { name: visit.staff.user.name } : null,
                vitals: recorded,
                assessment: assessment.trim(),
                treatmentNotes: treatment.trim(),
                recommendations: recommendations.trim(),
                followUpDate: followUp,
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton variant="ghost" icon="save-outline" title={tx('Hifadhi rasimu')} busy={busy === 'save'} onPress={() => save(false)} />
        <ActionButton icon="checkmark-done" title={tx('Maliza ziara')} busy={busy === 'close'} onPress={() => save(true)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  notice: { ...type.small, color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: 12, marginBottom: spacing.sm },
  recorded: { ...type.small, color: colors.muted, marginBottom: spacing.xs },
  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  vitalLabel: { flex: 1, ...type.body, color: colors.text },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slash: { ...type.body, color: colors.muted },
  vitalInput: {
    width: 64,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    textAlign: 'center',
    fontSize: fs(16),
    fontFamily: font.semibold,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  unit: { width: 52, ...type.small, color: colors.muted },
  label: { ...type.label, color: colors.text, marginBottom: spacing.xs },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  preview: { marginTop: spacing.sm, opacity: 0.95 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.bg },
  doneTitle: { ...type.title, color: colors.text },
  doneBody: { ...type.body, color: colors.muted, textAlign: 'center', marginBottom: spacing.sm },
});
