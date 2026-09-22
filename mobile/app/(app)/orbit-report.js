import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { familyMembers, orbit as orbitApi } from '../../lib/api';
import { ErrorBox } from '../../lib/ui';
import { tx, useI18n } from '../../lib/i18n';
import { NotYet, OrbitCard, SectionTitle, orbit } from '../../lib/orbit-ui';
import { colors, font, fs, radius, scale, spacing, type } from '../../lib/theme';

// The monthly report.
//
// This is the artefact somebody takes to an appointment, which changes
// what it is allowed to contain. A nurse reading it has to be able to
// tell at a glance how much of the month was actually recorded, because
// an average from four days and an average from twenty-eight look
// identical on paper and mean entirely different things.
//
// So the consistency line is at the top rather than buried, every
// average carries its day count, and there is no summary sentence
// grading the month. The report describes; the professional interprets.

const MONTHS_SW = [
  'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
  'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba',
];

const FIELD_LABEL = {
  energy: 'Nguvu',
  mood: 'Hisia',
  sleep: 'Usingizi',
  appetite: 'Hamu ya kula',
  pain: 'Maumivu',
};

const SYMPTOM_LABEL = {
  cramps: 'Maumivu ya tumbo',
  bloating: 'Kuvimbiwa',
  headache: 'Maumivu ya kichwa',
  backache: 'Maumivu ya mgongo',
  acne: 'Chunusi',
  discharge: 'Majimaji',
  tender_breasts: 'Matiti kuuma',
  nausea: 'Kichefuchefu',
  dizziness: 'Kizunguzungu',
};

export default function OrbitReport() {
  useI18n();
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const members = await familyMembers.list();
      const list = members?.familyMembers ?? [];
      const self = list.find((m) => m.relationship === 'SELF') ?? list[0];
      if (!self) return;
      const res = await orbitApi.report(self.id);
      setReport(res?.report ?? null);
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

  if (loading) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={orbit.plum} />
      </View>
    );
  }

  if (!report || report.status === 'NO_DATA') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorBox error={error} />
          <NotYet
            icon="document-text-outline"
            title={tx('Hakuna ripoti ya mwezi huu bado')}
            body={tx(
              'Ripoti hujengwa kutokana na uchunguzi wa kila siku. Anza kufuatilia na itaonekana hapa.'
            )}
          />
        </ScrollView>
      </View>
    );
  }

  const { period, consistency, averages, symptoms } = report;
  const monthName = tx(MONTHS_SW[period.month - 1]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ErrorBox error={error} />

        <OrbitCard tone="soft" style={styles.head}>
          <Text style={styles.kicker}>{tx('RIPOTI YA ORBIT')}</Text>
          <Text style={styles.month}>
            {monthName} {period.year}
          </Text>
        </OrbitCard>

        {/* First, not buried: how much of the month this is built from.
            An average over four days and one over twenty-eight look the
            same on a page and are not the same thing. */}
        <OrbitCard>
          <SectionTitle>{tx('Ulivyofuatilia')}</SectionTitle>
          <Text style={styles.big}>
            {consistency.daysRecorded}
            <Text style={styles.bigSuffix}> / {consistency.daysInMonth}</Text>
          </Text>
          <Text style={styles.hint}>{tx('siku zilizoandikwa mwezi huu')}</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.min(consistency.percent, 100)}%` }]} />
          </View>
          {consistency.daysRecorded < 7 ? (
            <Text style={styles.caution}>
              {tx('Siku chache zimeandikwa, kwa hiyo wastani hapa chini ni wa kuangalia kwa tahadhari.')}
            </Text>
          ) : null}
        </OrbitCard>

        <SectionTitle>{tx('Wastani wa mwezi')}</SectionTitle>
        <OrbitCard style={styles.list}>
          {Object.entries(averages).map(([field, row], index, all) => (
            <View key={field} style={[styles.row, index < all.length - 1 && styles.rowDivider]}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{tx(FIELD_LABEL[field] ?? field)}</Text>
                <Text style={styles.rowHint}>
                  {row.daysRecorded > 0
                    ? `${tx('Kutokana na siku')} ${row.daysRecorded}`
                    : tx('Hujaandika mwezi huu')}
                </Text>
              </View>
              <Text style={styles.value}>{row.average === null ? '—' : `${row.average}/5`}</Text>
            </View>
          ))}
        </OrbitCard>

        <OrbitCard>
          <SectionTitle>{tx('Hedhi')}</SectionTitle>
          <View style={styles.pairRow}>
            <Pair label={tx('Zilizoandikwa')} value={String(report.periodsRecorded)} />
            <Pair
              label={tx('Urefu wa wastani')}
              value={
                report.averagePeriodLength
                  ? `${report.averagePeriodLength} ${tx('siku')}`
                  : '—'
              }
            />
          </View>
        </OrbitCard>

        {symptoms.top.length > 0 ? (
          <>
            <SectionTitle>{tx('Dalili zilizojirudia')}</SectionTitle>
            <OrbitCard style={styles.list}>
              {symptoms.top.map((s, index) => (
                <View
                  key={s.name}
                  style={[styles.row, index < symptoms.top.length - 1 && styles.rowDivider]}
                >
                  <Text style={styles.rowLabel}>{tx(SYMPTOM_LABEL[s.name] ?? s.name)}</Text>
                  <Text style={styles.value}>
                    {s.days} {tx('siku')}
                  </Text>
                </View>
              ))}
            </OrbitCard>
          </>
        ) : null}

        <Pressable
          onPress={() => router.push('/book')}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <OrbitCard style={styles.share}>
            <View style={styles.shareIcon}>
              <Ionicons name="medkit-outline" size={18} color={orbit.plum} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{tx('Shiriki na mtaalamu wa afya')}</Text>
              <Text style={styles.rowHint}>
                {tx('Omba muuguzi na mwoneshe muhtasari huu kwenye simu yako.')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={orbit.inkFaint} />
          </OrbitCard>
        </Pressable>

        <Text style={styles.footer}>
          {tx(
            'Ripoti hii ni muhtasari wa ulichoandika mwenyewe. Si uchunguzi wa kitabibu wala hairudishi haja ya kuonana na mtaalamu.'
          )}
        </Text>
      </ScrollView>
    </View>
  );
}

function Pair({ label, value }) {
  return (
    <View style={styles.pair}>
      <Text style={styles.pairValue}>{value}</Text>
      <Text style={styles.pairLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.page },
  centre: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  pressed: { opacity: 0.85 },

  head: { alignItems: 'center', paddingVertical: spacing.md },
  kicker: {
    fontSize: fs(10),
    fontFamily: font.extrabold,
    letterSpacing: 2,
    color: orbit.plum,
  },
  month: { fontSize: fs(24), fontFamily: font.extrabold, color: orbit.ink, marginTop: 2 },

  big: { fontSize: fs(34), fontFamily: font.extrabold, color: orbit.ink },
  bigSuffix: { fontSize: fs(17), color: orbit.inkFaint, fontFamily: font.bold },
  hint: { ...type.tiny, color: orbit.inkSoft },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: orbit.plumLine,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: orbit.plum },
  caution: { ...type.tiny, color: colors.caution, marginTop: spacing.xs, lineHeight: scale(15) },

  list: { paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: orbit.plumLine },
  rowText: { flex: 1 },
  rowLabel: { ...type.bodyStrong, color: orbit.ink },
  rowHint: { ...type.tiny, color: orbit.inkSoft, marginTop: 1 },
  value: { ...type.bodyStrong, color: orbit.plum },

  pairRow: { flexDirection: 'row', gap: spacing.md },
  pair: { flex: 1 },
  pairValue: { fontSize: fs(20), fontFamily: font.extrabold, color: orbit.ink },
  pairLabel: { ...type.tiny, color: orbit.inkSoft },

  share: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shareIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: orbit.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    ...type.tiny,
    color: orbit.inkFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: scale(15),
  },
});
