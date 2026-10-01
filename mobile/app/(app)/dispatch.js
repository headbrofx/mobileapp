import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { dispatch } from '../../lib/api';
import { Card, ErrorBox } from '../../lib/ui';
import { ActionButton, Chip, Empty, RequestCard, Segmented, careStyles } from '../../lib/care-ui';
import { useSession } from '../../lib/session';
import { colors, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// The Dispatch Center: everything waiting on a person, oldest need
// first. The system recommends; the dispatcher decides. Opening an item
// shows the ranked shortlist and the reasons behind it.
//
// Hidden from everyone but an ADMIN, and every call behind it is
// refused by the server to anyone else regardless.

const VIEWS = [
  { value: 'needs_action', label: 'Zinasubiri' },
  { value: 'in_flight', label: 'Zinaendelea' },
];
const KINDS = [
  { value: 'ALL', label: 'Zote' },
  { value: 'HOME_VISIT', label: 'Ziara' },
  { value: 'TRANSPORT', label: 'Usafiri' },
];

export default function DispatchCenter() {
  useI18n();
  const router = useRouter();
  const { user } = useSession();
  const [view, setView] = useState('needs_action');
  const [kind, setKind] = useState('ALL');
  const [items, setItems] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [swept, setSwept] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [q, i] = await Promise.all([dispatch.queue(view, kind === 'ALL' ? null : kind), dispatch.integrations()]);
      setItems(q?.items ?? []);
      setSwept(q?.swept ?? null);
      setIntegrations(i);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [view, kind]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (user && user.role !== 'ADMIN') {
    return <Empty icon="lock-closed-outline" title={tx('Ukurasa huu ni wa msimamizi tu')} />;
  }

  const expired = (swept?.bookings ?? 0) + (swept?.transport ?? 0);

  return (
    <ScrollView
      contentContainerStyle={careStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.top}>
        <ActionButton variant="ghost" icon="stats-chart-outline" title={tx('Takwimu na mipangilio')} onPress={() => router.push('/dispatch-settings')} />
      </View>

      {integrations ? <IntegrationStrip data={integrations} /> : null}

      <Segmented options={VIEWS} value={view} onChange={setView} />
      <View style={careStyles.chips}>
        {KINDS.map((k) => (
          <Chip key={k.value} label={tx(k.label)} selected={kind === k.value} onPress={() => setKind(k.value)} />
        ))}
      </View>

      <ErrorBox error={error} />
      {expired ? (
        <Text style={styles.swept}>
          {expired} {tx('ombi/maombi yamepitwa na muda na wateja wamejulishwa.')}
        </Text>
      ) : null}

      {loaded && items.length === 0 ? (
        <Empty icon="checkmark-done-outline" title={view === 'needs_action' ? tx('Hakuna kinachosubiri') : tx('Hakuna kinachoendelea')} />
      ) : (
        items.map((item) => (
          <RequestCard
            key={`${item.kind}-${item.id}`}
            item={item}
            onPress={() => router.push({ pathname: '/dispatch-item', params: { kind: item.kind, id: item.id } })}
            right={
              item.hasPin ? (
                <Ionicons name="location" size={16} color={colors.primary} />
              ) : (
                <Ionicons name="location-outline" size={16} color={colors.subtle} />
              )
            }
          />
        ))
      )}
    </ScrollView>
  );
}

// What is and is not connected, said plainly at the top of the screen
// the dispatcher works from, so nobody waits on an integration that
// does not exist yet.
function IntegrationStrip({ data }) {
  const rows = [
    { label: 'Kampuni ya usafiri', on: data.transportPartner?.configured, hint: data.transportPartner?.name },
    { label: 'Ramani na muda wa kufika', on: Boolean(data.maps?.routing) },
    { label: 'SMS / WhatsApp / Push', on: Object.values(data.messaging ?? {}).some((c) => c.configured) },
    { label: 'Malipo mtandaoni', on: data.payments?.online },
  ];
  return (
    <Card style={styles.integrations}>
      {rows.map((r) => (
        <View key={r.label} style={styles.integration}>
          <View style={[styles.dot, { backgroundColor: r.on ? colors.success : colors.border }]} />
          <Text style={styles.integrationText}>{tx(r.label)}</Text>
          <Text style={[styles.integrationState, { color: r.on ? colors.success : colors.muted }]}>
            {r.on ? r.hint || tx('imeunganishwa') : tx('kwa mkono')}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', marginBottom: spacing.sm },
  swept: { ...type.small, color: colors.caution, backgroundColor: colors.cautionBg, borderRadius: 12, padding: spacing.sm, marginBottom: spacing.sm },
  integrations: { paddingVertical: spacing.sm },
  integration: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  integrationText: { ...type.small, color: colors.text, flex: 1 },
  integrationState: { ...type.tiny },
});
