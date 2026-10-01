import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { care } from '../../lib/api';
import { ErrorBox } from '../../lib/ui';
import { ActionButton, Empty, RequestCard, Segmented, careStyles } from '../../lib/care-ui';
import { colors, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// My Care Requests: every home visit and every trip, for everyone in
// the family the client looks after, in four tabs.
//
// This replaced a list of bookings only. Transport is the other half of
// the same need, and a parent's appointment booked by a daughter is the
// daughter's to follow, so both kinds and every family member sit in
// one place. The server sorts them into tabs; this screen does not
// decide what "active" means.

const TABS = [
  { value: 'upcoming', label: 'Zinazokuja' },
  { value: 'active', label: 'Sasa hivi' },
  { value: 'completed', label: 'Zilizokamilika' },
  { value: 'cancelled', label: 'Zilizositishwa' },
];

const EMPTY = {
  upcoming: 'Huna ombi linalokuja.',
  active: 'Hakuna huduma inayoendelea sasa hivi.',
  completed: 'Bado hakuna huduma iliyokamilika.',
  cancelled: 'Hakuna ombi lililositishwa.',
};

export default function MyCareRequests() {
  useI18n();
  const router = useRouter();
  const [tab, setTab] = useState('upcoming');
  const [data, setData] = useState({ items: [], counts: {} });
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await care.requests(tab);
      setData({ items: result?.items ?? [], counts: result?.counts ?? {} });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Something in progress changes without anybody touching the phone.
  // Every half minute while this tab is open is enough to notice and
  // cheap enough not to matter.
  useEffect(() => {
    if (tab !== 'active' && tab !== 'upcoming') return undefined;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [tab, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function open(item) {
    router.push({
      pathname: '/track',
      params: { kind: item.kind === 'TRANSPORT' ? 'transport' : 'home-visit', id: item.id },
    });
  }

  const quoted = data.items.filter((i) => i.awaitingClient);

  return (
    <ScrollView
      contentContainerStyle={careStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.subtitle}>{tx('Ziara za nyumbani na usafiri, kwa kila mtu wa familia unayemhudumia')}</Text>

      <View style={styles.ctaRow}>
        <ActionButton title={tx('Omba ziara')} icon="home-outline" onPress={() => router.push('/book')} />
        <ActionButton variant="ghost" title={tx('Usafiri')} icon="car-outline" onPress={() => router.push('/transport')} />
      </View>

      <Segmented options={TABS} value={tab} onChange={setTab} counts={data.counts} />

      <ErrorBox error={error} />

      {quoted.length ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {tx('Una bei ya usafiri inayosubiri jibu lako.')}
          </Text>
        </View>
      ) : null}

      {loaded && data.items.length === 0 ? (
        <Empty icon="calendar-outline" title={tx(EMPTY[tab])} body={tab === 'upcoming' ? tx('Omba muuguzi aje nyumbani, au usafiri wa kukupeleka kwenye huduma.') : null} />
      ) : (
        data.items.map((item) => <RequestCard key={`${item.kind}-${item.id}`} item={item} onPress={() => open(item)} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...type.small, color: colors.muted, marginBottom: spacing.md },
  ctaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  banner: {
    backgroundColor: colors.cautionBg,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  bannerText: { ...type.small, color: colors.caution },
});
