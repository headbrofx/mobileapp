import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { bookings, transport } from '../../lib/api';
import { Card, ErrorBox, Field } from '../../lib/ui';
import { ActionButton, Empty, InfoLine, StatusPill, careStyles } from '../../lib/care-ui';
import { currentPosition, dateTimeSw } from '../../lib/care';
import { useSession } from '../../lib/session';
import { colors, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// A nurse's day: the visits and trips assigned to them, soonest first,
// with the one next step each can take. The server decides what is
// allowed; a button here is only offered when the state machine would
// accept it, so nobody is shown an action that will bounce.

const VISIT_NEXT = {
  ASSIGNED: [
    { action: 'accept', label: 'Kubali', icon: 'checkmark' },
    { action: 'reject', label: 'Kataa', icon: 'close', ghost: true, needsReason: true },
  ],
  ACCEPTED: [{ action: 'on-the-way', label: 'Nimeanza safari', icon: 'navigate' }],
  ON_THE_WAY: [{ action: 'arrive', label: 'Nimefika', icon: 'home' }],
  ARRIVED: [{ action: 'start', label: 'Anza huduma', icon: 'medkit' }],
  IN_PROGRESS: [{ action: 'complete', label: 'Maliza huduma', icon: 'checkmark-done' }],
};

const TRIP_NEXT = {
  ASSIGNED: { action: 'enRoute', label: 'Naelekea kumchukua', icon: 'navigate' },
  EN_ROUTE: { action: 'arrivedPickup', label: 'Nimefika kumchukua', icon: 'location' },
  ARRIVED_PICKUP: { action: 'startTrip', label: 'Safari imeanza', icon: 'car-sport' },
  IN_TRIP: { action: 'arrivedDestination', label: 'Tumefika', icon: 'flag' },
  ARRIVED_DESTINATION: { action: 'complete', label: 'Maliza safari', icon: 'checkmark-done' },
};

export default function StaffJobs() {
  useI18n();
  const router = useRouter();
  const { user } = useSession();
  const [visits, setVisits] = useState([]);
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [v, t] = await Promise.all([bookings.mySchedule(), transport.list()]);
      setVisits(v?.bookings ?? []);
      setTrips((t?.trips ?? []).filter((x) => TRIP_NEXT[x.status]));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function run(key, fn, message) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (message) setNotice(message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  // One position, sent when the nurse presses the button, only while
  // she is on the way. Not continuous background tracking: that needs
  // a background permission and a battery conversation this app has
  // not had with anyone yet.
  async function sharePosition(visit) {
    await run(`ping-${visit.id}`, async () => {
      const at = await currentPosition();
      await bookings.sharePosition(visit.id, at.lat, at.lng);
    }, tx('Mahali pako pametumwa kwa mteja.'));
  }

  if (user && user.role !== 'STAFF') {
    return <Empty icon="lock-closed-outline" title={tx('Ukurasa huu ni wa wahudumu tu')} />;
  }

  const nothing = visits.length === 0 && trips.length === 0;

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
        <ActionButton variant="ghost" icon="time-outline" title={tx('Upatikanaji wangu')} onPress={() => router.push('/staff-availability')} />
      </View>
      <ErrorBox error={error} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {nothing ? <Empty icon="briefcase-outline" title={tx('Huna kazi iliyopangwa kwa sasa')} body={tx('Ukipangiwa ziara au safari, itaonekana hapa.')} /> : null}

      {visits.length ? <Text style={careStyles.section}>{tx('Ziara')}</Text> : null}
      {visits.map((v) => (
        <Card key={v.id}>
          <View style={careStyles.row}>
            <View style={styles.flex}>
              <Text style={styles.title}>{v.service?.name ?? tx('Ziara')}</Text>
              <Text style={careStyles.muted}>
                {v.bookingReference} · {dateTimeSw(v.scheduledAt)}
              </Text>
            </View>
            <StatusPill kind="HOME_VISIT" status={v.status} raw />
          </View>
          <InfoLine icon="person-outline" label={tx('Mgonjwa')} value={v.patient?.name} />
          <InfoLine icon="location-outline" label={tx('Mahali')} value={v.locationAddress} />
          <InfoLine icon="navigate-outline" label={tx('Kufika')} value={v.locationDetails ? Object.values(v.locationDetails).join(' · ') : null} />
          <InfoLine icon="accessibility-outline" label={tx('Ufikiaji')} value={v.accessibilityNotes} />
          <InfoLine icon="document-text-outline" label={tx('Mahitaji')} value={v.notes} />

          <View style={careStyles.actions}>
            {(VISIT_NEXT[v.status] ?? []).map((step) =>
              step.needsReason ? (
                <ActionButton key={step.action} variant="ghost" danger icon={step.icon} title={tx(step.label)} onPress={() => setRejecting(v.id)} />
              ) : (
                <ActionButton
                  key={step.action}
                  icon={step.icon}
                  title={tx(step.label)}
                  busy={busy === `${step.action}-${v.id}`}
                  onPress={() => run(`${step.action}-${v.id}`, () => bookings.act(v.id, step.action))}
                />
              )
            )}
            {v.status === 'ON_THE_WAY' ? (
              <ActionButton
                variant="ghost"
                icon="locate"
                title={tx('Tuma mahali nilipo')}
                busy={busy === `ping-${v.id}`}
                onPress={() => sharePosition(v)}
              />
            ) : null}
          </View>

          {rejecting === v.id ? (
            <View style={styles.reject}>
              <Field label={tx('Sababu ya kukataa')} value={reason} onChangeText={setReason} placeholder={tx('mfano: Nina dharura ya familia')} />
              <View style={careStyles.actions}>
                <ActionButton variant="ghost" title={tx('Acha')} onPress={() => setRejecting(null)} />
                <ActionButton
                  danger
                  title={tx('Kataa ziara')}
                  disabled={reason.trim().length < 2}
                  busy={busy === `reject-${v.id}`}
                  onPress={() =>
                    run(`reject-${v.id}`, async () => {
                      await bookings.act(v.id, 'reject', { reason: reason.trim() });
                      setRejecting(null);
                      setReason('');
                    })
                  }
                />
              </View>
            </View>
          ) : null}
        </Card>
      ))}

      {trips.length ? <Text style={careStyles.section}>{tx('Safari')}</Text> : null}
      {trips.map((t) => {
        const next = TRIP_NEXT[t.status];
        return (
          <Card key={t.id}>
            <View style={careStyles.row}>
              <View style={styles.flex}>
                <Text style={styles.title}>{t.destinationName}</Text>
                <Text style={careStyles.muted}>
                  {t.bookingReference} · {dateTimeSw(t.scheduledAt)}
                </Text>
              </View>
              <StatusPill kind="TRANSPORT" status={t.status} raw />
            </View>
            <InfoLine icon="person-outline" label={tx('Msafiri')} value={t.patient?.name} />
            <InfoLine icon="radio-button-on-outline" label={tx('Kuchukuliwa')} value={t.pickupAddress} />
            <InfoLine icon="accessibility-outline" label={tx('Msaada')} value={t.mobilityNeeds} />
            <InfoLine icon="call-outline" label={tx('Simu ya safari')} value={t.contactPhone} />
            {next ? (
              <View style={careStyles.actions}>
                <ActionButton
                  icon={next.icon}
                  title={tx(next.label)}
                  busy={busy === `${next.action}-${t.id}`}
                  onPress={() => run(`${next.action}-${t.id}`, () => transport.progress(t.id, next.action))}
                />
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', marginBottom: spacing.sm },
  title: { ...type.bodyStrong, color: colors.text },
  notice: { ...type.small, color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: 12, marginBottom: spacing.sm },
  reject: { marginTop: spacing.sm },
});
