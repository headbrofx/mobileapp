import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { familyMembers, orbit as orbitApi } from '../../lib/api';
import { ErrorBox } from '../../lib/ui';
import { tx, useI18n } from '../../lib/i18n';
import { NotYet, OrbitCard, SectionTitle, StatusPill, orbit } from '../../lib/orbit-ui';
import { font, fs, radius, scale, spacing, type } from '../../lib/theme';

// My Body Patterns.
//
// Every line on this screen is a count from rows the person entered,
// and every line says how many days it came from. That is the whole
// discipline of the screen: an observation a woman cannot trace back to
// her own entries is one she has no way to judge, and a health app that
// asks to be taken on faith has not earned it.
//
// So there is no "your luteal phase is affecting your mood". There is
// "on the 9 days you recorded in the three before a period, your energy
// averaged 2.4 against 3.1 on the other 41". The second is checkable.
// The first is a story told over the top of the same numbers.
//
// Where the data does not reach, the screen says so and says what would
// close the gap. That is not an apology — refusing is the feature.

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

export default function OrbitPatterns() {
  useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const members = await familyMembers.list();
      const list = members?.familyMembers ?? [];
      const self = list.find((m) => m.relationship === 'SELF') ?? list[0];
      if (!self) return;
      const res = await orbitApi.patterns(self.id);
      setData(res?.patterns ?? null);
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

  if (!data || data.daysRecorded === 0) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorBox error={error} />
          <NotYet
            title={tx('Orbit yako ndio kwanza inaanza')}
            body={tx(
              'Fanya uchunguzi wa kila siku kwa wiki chache, na Orbit itaanza kuonyesha mwenendo wako binafsi hapa.'
            )}
          />
        </ScrollView>
      </View>
    );
  }

  const { trends, symptoms, beforePeriod, flow, thresholds } = data;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ErrorBox error={error} />

        <Text style={styles.lede}>
          {tx('Kutokana na siku')} {data.daysRecorded} {tx('ulizoandika katika siku')}{' '}
          {data.lookbackDays} {tx('zilizopita, na mizunguko')} {data.cyclesRecorded}.
        </Text>

        {/* --- Averages and direction --- */}
        <SectionTitle>{tx('Wastani wako')}</SectionTitle>
        <OrbitCard style={styles.list}>
          {Object.entries(trends).map(([field, trend], index, all) => (
            <View
              key={field}
              style={[styles.row, index < all.length - 1 && styles.rowDivider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{tx(FIELD_LABEL[field] ?? field)}</Text>
                <Text style={styles.rowHint}>
                  {trend.status === 'NO_DATA'
                    ? tx('Bado hujaandika')
                    : trend.status === 'INSUFFICIENT_DATA'
                      ? `${tx('Siku')} ${trend.daysRecorded}/${thresholds.trend}`
                      : `${tx('Wastani')} ${trend.average} · ${tx('siku')} ${trend.daysRecorded}`}
                </Text>
              </View>
              {trend.status === 'OBSERVED' && trend.direction !== 'UNKNOWN' ? (
                <View style={styles.direction}>
                  <Ionicons
                    name={
                      trend.direction === 'UP'
                        ? 'trending-up'
                        : trend.direction === 'DOWN'
                          ? 'trending-down'
                          : 'remove'
                    }
                    size={15}
                    color={trend.direction === 'STEADY' ? orbit.inkFaint : orbit.plum}
                  />
                  <Text style={styles.directionText}>
                    {tx(
                      trend.direction === 'UP'
                        ? 'Juu'
                        : trend.direction === 'DOWN'
                          ? 'Chini'
                          : 'Thabiti'
                    )}
                  </Text>
                </View>
              ) : (
                <StatusPill status="MONITORING" />
              )}
            </View>
          ))}
        </OrbitCard>

        {/* --- Around a period --- */}
        <SectionTitle>{tx('Karibu na hedhi')}</SectionTitle>
        {beforePeriod.energy.status !== 'OBSERVED' &&
        beforePeriod.mood.status !== 'OBSERVED' &&
        beforePeriod.pain.status !== 'OBSERVED' ? (
          <NotYet
            icon="calendar-outline"
            title={tx('Bado hatujaweza kulinganisha')}
            body={`${tx('Orbit inahitaji angalau mizunguko')} ${thresholds.cycles} ${tx(
              'iliyoandikwa, pamoja na siku za uchunguzi ndani na nje ya siku za kabla ya hedhi, kabla ya kulinganisha.'
            )}`}
          />
        ) : (
          <OrbitCard style={styles.list}>
            {['energy', 'mood', 'pain'].map((field, index) => {
              const o = beforePeriod[field];
              if (o.status !== 'OBSERVED') return null;
              return (
                <View key={field} style={[styles.row, index < 2 && styles.rowDivider]}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{tx(FIELD_LABEL[field])}</Text>
                    <Text style={styles.rowHint}>
                      {tx('Siku 3 kabla')}: {o.windowAverage} · {tx('siku nyingine')}:{' '}
                      {o.otherAverage}
                    </Text>
                    <Text style={styles.rowSource}>
                      {tx('Kutokana na siku')} {o.daysInWindow} {tx('na')} {o.daysOutsideWindow}
                    </Text>
                  </View>
                  {o.notable ? (
                    <View style={styles.notable}>
                      <Text style={styles.notableText}>{tx('Tofauti')}</Text>
                    </View>
                  ) : (
                    <StatusPill status="STABLE" />
                  )}
                </View>
              );
            })}
          </OrbitCard>
        )}

        {/* --- Flow --- */}
        {flow.status === 'OBSERVED' ? (
          <OrbitCard tone="rose">
            <SectionTitle>{tx('Mtiririko')}</SectionTitle>
            <Text style={styles.body}>
              {flow.heavierEarly
                ? tx('Mtiririko ulioandika umekuwa mzito zaidi siku 1–2 za mwanzo.')
                : tx('Mtiririko ulioandika haujatofautiana sana kati ya siku za mwanzo na zinazofuata.')}
            </Text>
            <Text style={styles.rowSource}>
              {tx('Kutokana na siku')} {flow.daysInWindow} {tx('za mwanzo ulizoandika.')}
            </Text>
          </OrbitCard>
        ) : null}

        {/* --- Symptoms --- */}
        <SectionTitle>{tx('Dalili zilizojirudia')}</SectionTitle>
        {symptoms.top.length === 0 ? (
          <NotYet
            icon="pulse-outline"
            title={tx('Bado hakuna dalili iliyoandikwa')}
            body={tx('Ukiweka alama kwenye dalili wakati wa uchunguzi, zitaonekana hapa.')}
          />
        ) : (
          <OrbitCard style={styles.list}>
            {symptoms.top.map((s, index) => (
              <View
                key={s.name}
                style={[styles.row, index < symptoms.top.length - 1 && styles.rowDivider]}
              >
                <Text style={styles.rowLabel}>{tx(SYMPTOM_LABEL[s.name] ?? s.name)}</Text>
                <Text style={styles.count}>
                  {s.days} {tx('siku')}
                </Text>
              </View>
            ))}
          </OrbitCard>
        )}

        <Text style={styles.footer}>
          {tx(
            'Haya ni mahesabu ya ulichoandika mwenyewe, si uchunguzi wa kitabibu. Ukiona mabadiliko yanayokusumbua, zungumza na mtaalamu wa afya.'
          )}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.page },
  centre: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },

  lede: { ...type.small, color: orbit.inkSoft, lineHeight: scale(19) },
  body: { ...type.body, color: orbit.ink, lineHeight: scale(21) },

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
  rowSource: { ...type.tiny, fontSize: fs(9), color: orbit.inkFaint, marginTop: 1 },

  direction: { alignItems: 'center' },
  directionText: { ...type.tiny, fontSize: fs(9), color: orbit.inkSoft },

  notable: {
    backgroundColor: '#FBF0E4',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  notableText: { fontSize: fs(9), fontFamily: font.bold, color: '#8A5A16', letterSpacing: 0.4 },

  count: { ...type.bodyStrong, color: orbit.plum },

  footer: {
    ...type.tiny,
    color: orbit.inkFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: scale(15),
  },
});
