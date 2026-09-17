import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { bookings as bookingsApi } from '../../../lib/api';
import { Card, ErrorBox } from '../../../lib/ui';
import { colors, radius, shadow, spacing } from '../../../lib/theme';

// "My Care" from the design: what is coming, how far along it is, and
// what has already happened.
//
// The timeline is drawn from the booking state machine rather than a
// fixed list of four steps, so it cannot claim a stage the backend does
// not actually have. A cancelled or rejected visit gets no timeline at
// all — showing progress towards something that is not going to happen
// would be a lie told in pictures.

const STATUS_SW = {
  REQUESTED: 'Imeombwa',
  ASSIGNED: 'Amepangiwa',
  ACCEPTED: 'Amekubali',
  ON_THE_WAY: 'Yupo njiani',
  ARRIVED: 'Amefika',
  IN_PROGRESS: 'Inaendelea',
  COMPLETED: 'Imekamilika',
  CANCELLED: 'Imeghairiwa',
  REJECTED: 'Imekataliwa',
  RESCHEDULED: 'Imehairishwa',
};

// The path a visit actually walks, in order.
const FLOW = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
const ENDED = ['COMPLETED', 'CANCELLED', 'REJECTED'];

export default function Appointments() {
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await bookingsApi.list();
      setVisits(data?.bookings ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const current = visits.filter((visit) => !ENDED.includes(visit.status));
  const past = visits.filter((visit) => ENDED.includes(visit.status));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Ziara zangu</Text>
      <Text style={styles.subtitle}>Zinazokuja na zilizopita</Text>

      <ErrorBox error={error} />

      <Text style={styles.section}>Zinazokuja</Text>
      {current.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Huna ziara inayokuja.</Text>
        </Card>
      ) : (
        current.map((visit) => (
          <Card key={visit.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name="medkit" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {visit.locationAddress}
                </Text>
                <Text style={styles.muted}>
                  {new Date(visit.scheduledAt).toLocaleString('sw-TZ')}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{STATUS_SW[visit.status] ?? visit.status}</Text>
              </View>
            </View>

            <Timeline status={visit.status} />

            {visit.notes ? <Text style={styles.notes}>{visit.notes}</Text> : null}
          </Card>
        ))
      )}

      <Text style={styles.section}>Zilizopita</Text>
      {past.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Bado hakuna ziara iliyokamilika.</Text>
        </Card>
      ) : (
        past.slice(0, 15).map((visit) => (
          <Card key={visit.id}>
            <View style={styles.row}>
              <View style={[styles.icon, styles.iconMuted]}>
                <Ionicons
                  name={visit.status === 'COMPLETED' ? 'checkmark' : 'close'}
                  size={18}
                  color={visit.status === 'COMPLETED' ? colors.primary : colors.muted}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {visit.locationAddress}
                </Text>
                <Text style={styles.muted}>
                  {new Date(visit.scheduledAt).toLocaleDateString('sw-TZ')} ·{' '}
                  {STATUS_SW[visit.status] ?? visit.status}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function Timeline({ status }) {
  // Nothing to show progress towards once a visit has been called off.
  if (['CANCELLED', 'REJECTED'].includes(status)) return null;

  const reached = FLOW.indexOf(status);
  if (reached < 0) return null;

  // Four stages rather than all seven, so the row stays readable on a
  // phone. Each stands for the step the visit is at or has passed.
  const stages = [
    { key: 'REQUESTED', label: 'Imeombwa' },
    { key: 'ACCEPTED', label: 'Amekubali' },
    { key: 'ARRIVED', label: 'Amefika' },
    { key: 'COMPLETED', label: 'Imekwisha' },
  ];

  return (
    <View style={styles.timeline}>
      {stages.map((stage, index) => {
        const done = reached >= FLOW.indexOf(stage.key);
        return (
          <View key={stage.key} style={styles.stage}>
            <View style={styles.stageTop}>
              {index > 0 ? <View style={[styles.line, done && styles.lineDone]} /> : <View style={styles.line} />}
              <View style={[styles.dot, done && styles.dotDone]}>
                {done ? <Ionicons name="checkmark" size={11} color={colors.onPrimary} /> : null}
              </View>
              {index < stages.length - 1 ? (
                <View style={[styles.line, reached > FLOW.indexOf(stage.key) && styles.lineDone]} />
              ) : (
                <View style={styles.line} />
              )}
            </View>
            <Text style={[styles.stageLabel, done && styles.stageLabelDone]} numberOfLines={1}>
              {stage.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  card: { ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMuted: { backgroundColor: colors.bg },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  notes: { fontSize: 13, color: colors.muted, marginTop: spacing.sm, lineHeight: 19 },

  badge: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },

  timeline: { flexDirection: 'row', marginTop: spacing.md },
  stage: { flex: 1, alignItems: 'center' },
  stageTop: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  line: { flex: 1, height: 2, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.primary },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primary },
  stageLabel: { fontSize: 10, color: colors.subtle, marginTop: 4 },
  stageLabelDone: { color: colors.primary, fontWeight: '600' },
});
