import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { bookings, care, transport } from '../../lib/api';
import { Card, ErrorBox, Field } from '../../lib/ui';
import { ActionButton, InfoLine, StatusPill, Timeline, careStyles } from '../../lib/care-ui';
import { dateTimeSw, mapLink, tzs } from '../../lib/care';
import { colors, font, fs, radius, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// Following one visit or trip.
//
// The timeline is the status history the server recorded: each step it
// actually went through, when, and any note. Nothing is projected
// forward. While the nurse is on the way and sharing, her distance is
// shown as a straight line, labelled as one, and no arrival time is
// given unless a routing provider is connected: a guess shown as "12
// min" is how a family ends up waiting at the gate for forty.

const LIVE = ['ON_THE_WAY', 'EN_ROUTE', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED', 'IN_PROGRESS', 'ASSIGNED', 'ACCEPTED'];
const CLIENT_CANCELLABLE = {
  HOME_VISIT: ['REQUESTED', 'UNDER_REVIEW', 'RESCHEDULED', 'REJECTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY'],
  TRANSPORT: ['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'ASSIGNED'],
};

// Alert.alert with buttons does nothing on web. A confirm the user can
// actually see, on both.
function confirm(title, message, onYes) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: tx('Hapana'), style: 'cancel' },
    { text: tx('Ndiyo'), style: 'destructive', onPress: onYes },
  ]);
}

export default function Track() {
  useI18n();
  const router = useRouter();
  const { kind: kindParam, id } = useLocalSearchParams();
  const kind = kindParam === 'transport' ? 'TRANSPORT' : 'HOME_VISIT';

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await care.track(kindParam === 'transport' ? 'transport' : 'home-visit', id));
    } catch (err) {
      setError(err.message);
    }
  }, [kindParam, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = data?.item?.status;
  useEffect(() => {
    if (!status || !LIVE.includes(status)) return undefined;
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [status, load]);

  async function run(label, fn) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const item = data?.item;
  const details = data?.details ?? {};
  const live = data?.live;
  const canCancel = item && CLIENT_CANCELLABLE[kind].includes(item.status);

  function doCancel() {
    if (reason.trim().length < 3) {
      setError(tx('Andika sababu fupi ya kusitisha.'));
      return;
    }
    confirm(tx('Sitisha ombi?'), `${item.reference}`, () =>
      run('cancel', async () => {
        if (kind === 'TRANSPORT') await transport.cancel(id, reason.trim());
        else await bookings.cancel(id, reason.trim());
        setCancelling(false);
      })
    );
  }

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
      <ErrorBox error={error} />

      {!item ? (
        <Text style={careStyles.muted}>{tx('Inapakia…')}</Text>
      ) : (
        <>
          <Card style={styles.hero}>
            <View style={careStyles.row}>
              <View style={styles.heroIcon}>
                <Ionicons name={kind === 'TRANSPORT' ? 'car' : 'home'} size={22} color={colors.onPrimary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.heroRef} selectable>
                  {item.reference}
                </Text>
              </View>
            </View>
            <View style={[careStyles.row, styles.heroMeta]}>
              <StatusPill kind={kind} status={item.status} />
              <Text style={careStyles.muted}>{dateTimeSw(item.scheduledAt)}</Text>
            </View>
          </Card>

          {/* The fare decision, when there is one. Nothing is booked
              until the client says yes to a number they have seen. */}
          {kind === 'TRANSPORT' && item.status === 'QUOTED' ? (
            <Card style={styles.quote}>
              <Text style={styles.quoteLabel}>{tx('Bei ya safari')}</Text>
              <Text style={styles.quoteValue}>{tzs(details.quotedFareTzs)}</Text>
              {details.quoteNote ? <Text style={careStyles.muted}>{details.quoteNote}</Text> : null}
              <View style={careStyles.actions}>
                <ActionButton
                  title={tx('Kubali bei')}
                  icon="checkmark"
                  busy={busy === 'accept'}
                  onPress={() => run('accept', () => transport.acceptQuote(id))}
                />
                <ActionButton
                  variant="ghost"
                  danger
                  title={tx('Kataa')}
                  busy={busy === 'decline'}
                  onPress={() =>
                    confirm(tx('Kataa bei hii?'), tx('Ombi litasitishwa.'), () =>
                      run('decline', () => transport.declineQuote(id, 'Bei haikukubaliwa'))
                    )
                  }
                />
              </View>
            </Card>
          ) : null}

          {live?.hasLocation ? (
            <Card style={styles.live}>
              <View style={careStyles.row}>
                <Ionicons name="navigate" size={18} color={colors.primary} />
                <Text style={styles.liveTitle}>
                  {live.proximity === 'ARRIVING_SOON' ? tx('Anakaribia kufika') : tx('Yupo njiani')}
                </Text>
                {live.stale ? <Text style={styles.stale}>{tx('taarifa ya zamani')}</Text> : null}
              </View>
              {live.distanceKm != null ? (
                <Text style={styles.liveBody}>
                  {tx('Umbali')}: ~{live.distanceKm} km ({tx('mstari mnyoofu, si njia ya barabara')})
                </Text>
              ) : null}
              {live.etaMinutes != null ? (
                <Text style={styles.liveBody}>
                  {tx('Muda wa kufika')}: ~{live.etaMinutes} {tx('dakika')}
                </Text>
              ) : null}
              <Text style={styles.liveTime}>
                {tx('Mahali palipoonekana mwisho')}: {dateTimeSw(live.latestPing.recordedAt)}
              </Text>
              <ActionButton
                variant="ghost"
                icon="map-outline"
                title={tx('Fungua kwenye ramani')}
                onPress={() => Linking.openURL(mapLink(live.latestPing.lat, live.latestPing.lng))}
              />
            </Card>
          ) : null}

          <Text style={careStyles.section}>{tx('Maelezo')}</Text>
          <Card>
            <InfoLine icon="person-outline" label={tx('Mgonjwa')} value={item.patient?.name} />
            <InfoLine
              icon={kind === 'TRANSPORT' ? 'car-outline' : 'medkit-outline'}
              label={kind === 'TRANSPORT' ? tx('Dereva') : tx('Muuguzi')}
              value={item.staffName ?? tx('Bado hajapangiwa')}
            />
            {kind === 'TRANSPORT' ? (
              <>
                <InfoLine icon="car-sport-outline" label={tx('Gari')} value={details.vehicleDetails} />
                <InfoLine icon="radio-button-on-outline" label={tx('Kuchukuliwa')} value={details.pickupAddress} />
                <InfoLine icon="flag-outline" label={tx('Kwenda')} value={[details.destinationName, details.destinationAddress].filter(Boolean).join(', ')} />
                <InfoLine icon="pricetag-outline" label={tx('Bei iliyokubaliwa')} value={tzs(details.confirmedFareTzs)} />
              </>
            ) : (
              <>
                <InfoLine icon="location-outline" label={tx('Mahali')} value={item.place} />
                <InfoLine
                  icon="navigate-outline"
                  label={tx('Kufika')}
                  value={details.locationDetails ? Object.values(details.locationDetails).join(' · ') : null}
                />
                <InfoLine icon="accessibility-outline" label={tx('Ufikiaji')} value={details.accessibilityNotes} />
                <InfoLine icon="document-text-outline" label={tx('Maelezo')} value={details.notes} />
                <InfoLine icon="pricetag-outline" label={tx('Bei')} value={tzs(item.priceTzs)} />
              </>
            )}
            <InfoLine icon="information-circle-outline" label={tx('Sababu')} value={details.cancellationReason} />
          </Card>

          <Text style={careStyles.section}>{tx('Hatua')}</Text>
          <Card>
            <Timeline kind={kind} entries={data.timeline} />
          </Card>

          <View style={careStyles.actions}>
            <ActionButton variant="ghost" icon="chatbubble-ellipses-outline" title={tx('Pata msaada')} onPress={() => router.push('/ask')} />
            {canCancel && !cancelling ? (
              <ActionButton variant="ghost" danger icon="close-circle-outline" title={tx('Sitisha')} onPress={() => setCancelling(true)} />
            ) : null}
          </View>

          {cancelling ? (
            <Card style={styles.cancelCard}>
              <Field label={tx('Sababu ya kusitisha')} value={reason} onChangeText={setReason} placeholder={tx('mfano: Mgonjwa amepata nafuu')} />
              <View style={careStyles.actions}>
                <ActionButton variant="ghost" title={tx('Acha')} onPress={() => setCancelling(false)} />
                <ActionButton danger title={tx('Sitisha ombi')} busy={busy === 'cancel'} onPress={doCancel} />
              </View>
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { borderColor: colors.primaryLight, borderWidth: 1.5 },
  heroIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...type.section, color: colors.text },
  heroRef: { fontSize: fs(13), fontFamily: font.extrabold, color: colors.primaryDark, letterSpacing: 1, marginTop: 2 },
  heroMeta: { marginTop: spacing.sm, flexWrap: 'wrap' },

  quote: { backgroundColor: colors.cautionBg, borderColor: colors.cautionBg },
  quoteLabel: { ...type.tiny, color: colors.caution },
  quoteValue: { fontSize: fs(26), fontFamily: font.extrabold, color: colors.text, marginVertical: 2 },

  live: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
  liveTitle: { ...type.bodyStrong, color: colors.primaryDark, flex: 1 },
  stale: { ...type.tiny, color: colors.caution, backgroundColor: colors.cautionBg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  liveBody: { ...type.body, color: colors.text, marginTop: spacing.xs },
  liveTime: { ...type.tiny, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.sm },

  cancelCard: { marginTop: spacing.sm },
});
