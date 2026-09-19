import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { familyMembers, orbit as orbitApi } from '../../lib/api';
import { ErrorBox } from '../../lib/ui';
import { tx, useI18n } from '../../lib/i18n';
import { OrbitCard, ScaleRow, SectionTitle, orbit } from '../../lib/orbit-ui';
import { font, fs, radius, scale, spacing, type } from '../../lib/theme';

// The daily body check-in.
//
// It was asked to take about twenty seconds, and the whole design
// follows from that number. Every control is a tap — five targets for a
// scale, a chip for a symptom — because a slider on a phone needs a
// deliberate grab and returns a value nobody can feel the difference
// between. Nothing is required: somebody who drags nothing and taps
// save has still told Orbit that today was unremarkable, and the row
// records exactly that.
//
// Saving merges. Sending energy alone does not blank the mood recorded
// an hour ago, which matters because the realistic pattern is somebody
// filling this in twice — once in the morning, once when something
// changes.
//
// The pain scale starts at 0 and the others at 1, and that is not an
// inconsistency: "no pain" is an answer, and there is no such thing as
// zero mood. Null means the question was skipped, which the pattern
// engine has to be able to tell apart from a low score.

const SYMPTOMS = [
  { key: 'cramps', label: 'Maumivu ya tumbo', icon: 'pulse-outline' },
  { key: 'bloating', label: 'Kuvimbiwa', icon: 'ellipse-outline' },
  { key: 'headache', label: 'Maumivu ya kichwa', icon: 'flash-outline' },
  { key: 'backache', label: 'Maumivu ya mgongo', icon: 'body-outline' },
  { key: 'acne', label: 'Chunusi', icon: 'water-outline' },
  { key: 'discharge', label: 'Majimaji', icon: 'rainy-outline' },
  { key: 'tender_breasts', label: 'Matiti kuuma', icon: 'heart-outline' },
  { key: 'nausea', label: 'Kichefuchefu', icon: 'sad-outline' },
  { key: 'dizziness', label: 'Kizunguzungu', icon: 'sync-outline' },
];

const FLOWS = [
  { key: 'NONE', label: 'Hakuna' },
  { key: 'SPOTTING', label: 'Matone' },
  { key: 'LIGHT', label: 'Kidogo' },
  { key: 'MEDIUM', label: 'Wastani' },
  { key: 'HEAVY', label: 'Nyingi' },
];

export default function OrbitCheckin() {
  useI18n();
  const router = useRouter();

  const [memberId, setMemberId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    mood: null,
    energy: null,
    sleep: null,
    pain: null,
    appetite: null,
    flow: null,
    symptoms: [],
    notes: '',
  });

  const load = useCallback(async () => {
    try {
      const members = await familyMembers.list();
      const list = members?.familyMembers ?? [];
      const self = list.find((m) => m.relationship === 'SELF') ?? list[0];
      if (!self) return;
      setMemberId(self.id);

      // Opening the screen twice in a day should show what is already
      // there, not a blank form that silently overwrites it.
      const today = await orbitApi.today(self.id);
      const existing = today?.checkin;
      if (existing) {
        setForm({
          mood: existing.mood,
          energy: existing.energy,
          sleep: existing.sleep,
          pain: existing.pain,
          appetite: existing.appetite,
          flow: existing.flow,
          symptoms: Array.isArray(existing.symptoms) ? existing.symptoms : [],
          notes: existing.notes ?? '',
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const set = (key, value) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSymptom = (key) => {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(key)
        ? prev.symptoms.filter((s) => s !== key)
        : [...prev.symptoms, key],
    }));
  };

  async function save() {
    if (!memberId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await orbitApi.saveCheckin(memberId, {
        ...form,
        notes: form.notes.trim() ? form.notes.trim() : null,
      });
      setSaved(true);
      router.back();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={orbit.plum} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ErrorBox error={error} />

        <Text style={styles.lede}>
          {tx('Hakuna swali la lazima. Jibu unachojua, ruka kisichokuhusu leo.')}
        </Text>

        <OrbitCard>
          <SectionTitle>{tx('Hisia')}</SectionTitle>
          <ScaleRow
            value={form.mood}
            onChange={(v) => set('mood', v)}
            lowLabel={tx('Chini')}
            highLabel={tx('Juu')}
          />
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Nguvu')}</SectionTitle>
          <ScaleRow
            value={form.energy}
            onChange={(v) => set('energy', v)}
            lowLabel={tx('Chini')}
            highLabel={tx('Juu')}
          />
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Maumivu')}</SectionTitle>
          <ScaleRow
            value={form.pain}
            onChange={(v) => set('pain', v)}
            min={0}
            max={5}
            tint={orbit.rose}
            lowLabel={tx('Hakuna')}
            highLabel={tx('Makali')}
          />
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Usingizi')}</SectionTitle>
          <ScaleRow
            value={form.sleep}
            onChange={(v) => set('sleep', v)}
            lowLabel={tx('Mbaya')}
            highLabel={tx('Mzuri')}
          />
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Hamu ya kula')}</SectionTitle>
          <ScaleRow
            value={form.appetite}
            onChange={(v) => set('appetite', v)}
            lowLabel={tx('Chini')}
            highLabel={tx('Juu')}
          />
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Hedhi leo')}</SectionTitle>
          <View style={styles.chips}>
            {FLOWS.map((option) => {
              const on = form.flow === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => set('flow', on ? null : option.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.chip,
                    on && styles.chipOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{tx(option.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Dalili')}</SectionTitle>
          <View style={styles.chips}>
            {SYMPTOMS.map((symptom) => {
              const on = form.symptoms.includes(symptom.key);
              return (
                <Pressable
                  key={symptom.key}
                  onPress={() => toggleSymptom(symptom.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.chip,
                    styles.symptomChip,
                    on && styles.chipOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={symptom.icon}
                    size={13}
                    color={on ? '#FFFFFF' : orbit.inkSoft}
                  />
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {tx(symptom.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Maelezo (si lazima)')}</SectionTitle>
          <TextInput
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder={tx('Chochote unachotaka kukumbuka')}
            placeholderTextColor={orbit.inkFaint}
            style={styles.notes}
            multiline
            maxLength={2000}
          />
        </OrbitCard>

        {/* Said here rather than only on the dashboard, because this is
            the screen where somebody types that they are in pain. */}
        <Text style={styles.privacyNote}>
          {tx('Ulichoandika ni chako. Muuguzi anaona tu ukiamua kushiriki naye.')}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          style={({ pressed }) => [styles.save, pressed && styles.pressed, saving && styles.faded]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name={saved ? 'checkmark' : 'checkmark-circle-outline'} size={19} color="#FFFFFF" />
              <Text style={styles.saveText}>{tx('Hifadhi')}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.page },
  centre: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  pressed: { opacity: 0.8 },
  faded: { opacity: 0.6 },

  lede: {
    ...type.small,
    color: orbit.inkSoft,
    lineHeight: scale(19),
    marginBottom: spacing.xs,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: orbit.plumLine,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  symptomChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipOn: { backgroundColor: orbit.plum, borderColor: orbit.plum },
  chipText: { fontSize: fs(12), fontFamily: font.semibold, color: orbit.inkSoft },
  chipTextOn: { color: '#FFFFFF' },

  notes: {
    ...type.body,
    color: orbit.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: spacing.xs,
  },

  privacyNote: {
    ...type.tiny,
    color: orbit.inkFaint,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: scale(15),
  },

  footer: {
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: orbit.plumLine,
  },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: orbit.plum,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  saveText: { color: '#FFFFFF', fontSize: fs(15), fontFamily: font.bold },
});
