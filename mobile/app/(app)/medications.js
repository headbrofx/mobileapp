import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { familyMembers, medications as medsApi } from '../../lib/api';
import { Button, Card, ErrorBox } from '../../lib/ui';
import { colors, font, spacing } from '../../lib/theme';

// Medicines and the doses coming up.
//
// This screen reports and records. It never suggests a dose, never warns
// about interactions, and never tells anybody they have taken too much
// — the same line the API holds. It would be pointless for the API to
// hold that line if the screen in front of it crossed one.

export default function Medications() {
  const [memberId, setMemberId] = useState(null);
  const [due, setDue] = useState([]);
  const [list, setList] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const member = await familyMembers.self();
      if (!member) return;
      setMemberId(member.id);

      const [dueData, listData, adherenceData] = await Promise.all([
        medsApi.due(member.id),
        medsApi.list(member.id),
        medsApi.adherence(member.id),
      ]);
      setDue(dueData?.doses ?? []);
      setList(listData?.medications ?? []);
      setAdherence(adherenceData);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function mark(doseId, status) {
    setMarkingId(doseId);
    try {
      await medsApi.markDose(memberId, doseId, status);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingId(null);
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

      <Text style={styles.heading}>Zinazofuata</Text>
      {due.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Hakuna dozi inayokuja katika masaa 48 yajayo.</Text>
        </Card>
      ) : (
        due.map((dose) => (
          <Card key={dose.id}>
            <Text style={styles.cardTitle}>
              {dose.medication?.name} {dose.medication?.dosage}
            </Text>
            <Text style={styles.muted}>{new Date(dose.scheduledFor).toLocaleString('sw-TZ')}</Text>
            {dose.medication?.instructions ? (
              <Text style={styles.muted}>{dose.medication.instructions}</Text>
            ) : null}

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Button
                  title="Nimekunywa"
                  onPress={() => mark(dose.id, 'TAKEN')}
                  loading={markingId === dose.id}
                />
              </View>
              <View style={styles.rowItem}>
                <Button
                  title="Nimeruka"
                  variant="ghost"
                  onPress={() => mark(dose.id, 'SKIPPED')}
                  disabled={markingId === dose.id}
                />
              </View>
            </View>
          </Card>
        ))
      )}

      {adherence && adherence.dosesAnswered > 0 ? (
        <>
          <Text style={styles.heading}>Wiki iliyopita</Text>
          <Card>
            <Text style={styles.cardTitle}>{adherence.takenPercent}% zimekunywa</Text>
            <Text style={styles.muted}>
              Zilizokunywa {adherence.taken} · zilizokosekana {adherence.missed} · zilizorukwa{' '}
              {adherence.skipped}
            </Text>
          </Card>
        </>
      ) : null}

      <Text style={styles.heading}>Dawa zako</Text>
      {list.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            Hakuna dawa iliyoandikwa. Muuguzi wako ndiye anayeziandika hapa.
          </Text>
        </Card>
      ) : (
        list.map((med) => (
          <Card key={med.id}>
            <Text style={styles.cardTitle}>
              {med.name} {med.dosage}
            </Text>
            <Text style={styles.muted}>
              {med.scheduleTimes?.join(', ')} ·{' '}
              {med.status === 'ACTIVE' ? 'Inaendelea' : 'Imesimama'}
            </Text>
            {med.prescribedBy ? (
              <Text style={styles.muted}>Ameandika: {med.prescribedBy}</Text>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontFamily: font.semibold, color: colors.text },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', marginTop: spacing.md, marginHorizontal: -spacing.xs },
  rowItem: { flex: 1, marginHorizontal: spacing.xs },
});
