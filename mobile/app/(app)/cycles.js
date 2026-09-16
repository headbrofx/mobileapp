import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { cycles as cyclesApi, familyMembers } from '../../lib/api';
import { Button, Card, ErrorBox } from '../../lib/ui';
import { colors, spacing } from '../../lib/theme';

// Orbit — period tracking.
//
// The API is careful about never claiming certainty, and this screen has
// to be equally careful about not undoing that. The prediction is shown
// with its confidence and the API's own note, never as a bare date that
// reads like a fact.

const CONFIDENCE_SW = {
  LOW: 'Uhakika mdogo',
  MEDIUM: 'Uhakika wa kadiri',
  HIGH: 'Uhakika mkubwa',
};

const REGULARITY_SW = {
  REGULAR: 'Unakaribiana',
  SOMEWHAT_IRREGULAR: 'Unatofautiana kidogo',
  IRREGULAR: 'Unatofautiana sana',
  UNKNOWN: 'Bado hakuna cha kusema',
};

export default function Cycles() {
  const [memberId, setMemberId] = useState(null);
  const [insights, setInsights] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const member = await familyMembers.self();
      if (!member) return;
      setMemberId(member.id);

      const [insightData, listData] = await Promise.all([
        cyclesApi.insights(member.id),
        cyclesApi.list(member.id),
      ]);
      setInsights(insightData);
      setHistory(listData?.cycles ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function logToday() {
    setError(null);
    setBusy(true);
    try {
      await cyclesApi.log(memberId, { cycleStartDate: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (err) {
      setError(err.message);
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
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorBox error={error} />

      <Button title="Hedhi imeanza leo" onPress={logToday} loading={busy} disabled={!memberId} />

      {insights ? (
        <>
          <Card style={styles.predictionCard}>
            {insights.prediction ? (
              <>
                <Text style={styles.label}>Inakadiriwa ijayo</Text>
                <Text style={styles.big}>
                  {new Date(insights.prediction.nextStart).toLocaleDateString('sw-TZ')}
                </Text>
                <Text style={styles.muted}>
                  {insights.prediction.daysUntil === 0
                    ? 'Leo'
                    : insights.prediction.daysUntil > 0
                      ? `Siku ${insights.prediction.daysUntil} zijazo`
                      : `Imechelewa siku ${Math.abs(insights.prediction.daysUntil)}`}
                  {' · '}
                  {CONFIDENCE_SW[insights.prediction.confidence]}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Bado hakuna utabiri.</Text>
            )}
          </Card>

          {/* The API's own wording, not a paraphrase of it. */}
          {insights.notes?.map((note, index) => (
            <Text key={index} style={styles.note}>
              {note}
            </Text>
          ))}

          <View style={styles.stats}>
            <Stat label="Urefu wa mzunguko" value={insights.averageCycleLength ? `Siku ${insights.averageCycleLength}` : '—'} />
            <Stat label="Urefu wa hedhi" value={insights.averagePeriodLength ? `Siku ${insights.averagePeriodLength}` : '—'} />
            <Stat label="Mwenendo" value={REGULARITY_SW[insights.regularity]} />
            <Stat label="Zilizoandikwa" value={String(insights.cyclesLogged)} />
          </View>
        </>
      ) : null}

      <Text style={styles.heading}>Historia</Text>
      {history.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Bado hujaandika chochote.</Text>
        </Card>
      ) : (
        history.slice(0, 12).map((cycle) => (
          <Card key={cycle.id}>
            <Text style={styles.cardTitle}>
              {new Date(cycle.cycleStartDate).toLocaleDateString('sw-TZ')}
            </Text>
            {cycle.flow ? <Text style={styles.muted}>Mtiririko: {cycle.flow}</Text> : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  predictionCard: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.lg },
  label: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  big: { fontSize: 26, fontWeight: '700', color: colors.primary, marginVertical: spacing.xs },
  muted: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  stat: {
    width: '50%',
    paddingVertical: spacing.sm,
  },
  statValue: { fontSize: 17, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
});
