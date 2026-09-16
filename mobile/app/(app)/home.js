import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { bookings as bookingsApi, familyMembers as familyApi } from '../../lib/api';
import { useSession } from '../../lib/session';
import { Button, Card, ErrorBox } from '../../lib/ui';
import { colors, spacing } from '../../lib/theme';

const STATUS_SW = {
  REQUESTED: 'Imeombwa',
  ASSIGNED: 'Amepangiwa muuguzi',
  ACCEPTED: 'Muuguzi amekubali',
  ON_THE_WAY: 'Yupo njiani',
  ARRIVED: 'Amefika',
  IN_PROGRESS: 'Inaendelea',
  COMPLETED: 'Imekamilika',
  CANCELLED: 'Imeghairiwa',
  REJECTED: 'Imekataliwa',
  RESCHEDULED: 'Imehairishwa',
};

export default function Home() {
  const router = useRouter();
  const { user } = useSession();

  const [members, setMembers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [memberData, bookingData] = await Promise.all([
        familyApi.list(),
        bookingsApi.list(),
      ]);
      setMembers(memberData?.familyMembers ?? []);
      setVisits(bookingData?.bookings ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Reloads whenever the screen comes back into view, so a booking made
  // on the next screen is already here on return.
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Habari, {user?.name?.split(' ')[0] ?? 'karibu'}</Text>

      <ErrorBox error={error} />

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Omba muuguzi" onPress={() => router.push('/book')} />
        </View>
        <View style={styles.action}>
          <Button title="Uliza Afya AI" variant="ghost" onPress={() => router.push('/ask')} />
        </View>
      </View>

      <Text style={styles.heading}>Wanaohudumiwa</Text>
      {members.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Bado hakuna. Akaunti yako inakuwa na rekodi yako mwenyewe.</Text>
        </Card>
      ) : (
        members.map((member) => (
          <Card key={member.id}>
            <Text style={styles.cardTitle}>{member.fullName ?? member.name}</Text>
            <Text style={styles.muted}>
              {member.relationship === 'SELF' ? 'Wewe mwenyewe' : member.relationship}
            </Text>
          </Card>
        ))
      )}

      <Text style={styles.heading}>Ziara zako</Text>
      {visits.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Bado hujaomba ziara yoyote.</Text>
        </Card>
      ) : (
        visits.slice(0, 5).map((visit) => (
          <Card key={visit.id}>
            <Text style={styles.cardTitle}>{visit.locationAddress}</Text>
            <Text style={styles.muted}>
              {new Date(visit.scheduledAt).toLocaleString('sw-TZ')}
            </Text>
            <Text style={styles.status}>{STATUS_SW[visit.status] ?? visit.status}</Text>
          </Card>
        ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  actions: { marginBottom: spacing.lg },
  action: { marginBottom: spacing.sm },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2 },
  status: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
});
