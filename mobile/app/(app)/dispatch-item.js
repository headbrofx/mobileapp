import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { dispatch, transport } from '../../lib/api';
import { Card, ErrorBox, Field } from '../../lib/ui';
import { ActionButton, InfoLine, StatusPill, Timeline, careStyles } from '../../lib/care-ui';
import { dateTimeSw, mapLink, tzs } from '../../lib/care';
import { colors, font, fs, radius, spacing, type } from '../../lib/theme';
import MapView from '../../lib/MapView';
import { tx, useI18n } from '../../lib/i18n';

// One request, from the dispatcher's side.
//
// For a home visit: the ranked shortlist with the reasons for each
// place in it. Picking the top eligible person needs no explanation;
// picking anyone else asks for one, which the server insists on too and
// keeps in the audit log. People who cannot take the slot are listed
// with why, and cannot be chosen.
//
// For a trip: review, quote a fare (the client must accept it), then
// assign either one of our staff or a transport company. With no
// company integration connected the dispatcher arranges it by phone and
// types what they were told.

const BOOKING_FAIL_FROM = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'];
const BOOKING_CANCEL_FROM = ['REQUESTED', 'UNDER_REVIEW', 'RESCHEDULED', 'REJECTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY'];
const BOOKING_ASSIGN_FROM = ['REQUESTED', 'UNDER_REVIEW', 'REJECTED', 'RESCHEDULED'];
const TRIP_PROGRESS = {
  ASSIGNED: { action: 'enRoute', label: 'Gari liko njiani' },
  EN_ROUTE: { action: 'arrivedPickup', label: 'Limefika kuchukua' },
  ARRIVED_PICKUP: { action: 'startTrip', label: 'Safari imeanza' },
  IN_TRIP: { action: 'arrivedDestination', label: 'Wamefika' },
  ARRIVED_DESTINATION: { action: 'complete', label: 'Maliza safari' },
};

export default function DispatchItem() {
  useI18n();
  const { kind, id } = useLocalSearchParams();
  const isTrip = kind === 'TRANSPORT';

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(isTrip ? await dispatch.trip(id) : await dispatch.booking(id));
    } catch (err) {
      setError(err.message);
    }
  }, [isTrip, id]);

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
      const conflicts = err.errors?.map?.((e) => e.reference).filter(Boolean);
      setError(conflicts?.length ? `${err.message}: ${conflicts.join(', ')}` : err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={careStyles.content} keyboardShouldPersistTaps="handled">
      <ErrorBox error={error} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {!data ? (
        <Text style={careStyles.muted}>{tx('Inapakia…')}</Text>
      ) : isTrip ? (
        <TripPanel data={data} busy={busy} run={run} id={id} />
      ) : (
        <BookingPanel data={data} busy={busy} run={run} id={id} />
      )}
    </ScrollView>
  );
}

function Header({ kind, reference, status, title, when }) {
  return (
    <Card style={styles.header}>
      <Text style={styles.ref} selectable>
        {reference}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <View style={[careStyles.row, styles.headerMeta]}>
        <StatusPill kind={kind} status={status} raw />
        <Text style={careStyles.muted}>{dateTimeSw(when)}</Text>
      </View>
    </Card>
  );
}

function BookingPanel({ data, busy, run, id }) {
  const { booking: b, recommendations = [], timeline = [] } = data;
  const [chosen, setChosen] = useState(null);
  const [override, setOverride] = useState('');
  const [reason, setReason] = useState('');

  const top = recommendations.find((c) => c.eligible);
  const needsReason = chosen && top && chosen !== top.id;
  const canAssign = BOOKING_ASSIGN_FROM.includes(b.status);

  return (
    <>
      <Header kind="HOME_VISIT" reference={b.bookingReference} status={b.status} title={b.service?.name} when={b.scheduledAt} />

      <Card>
        <InfoLine icon="person-outline" label={tx('Mgonjwa')} value={b.patient?.name} />
        <InfoLine icon="location-outline" label={tx('Mahali')} value={b.locationAddress} />
        <InfoLine icon="navigate-outline" label={tx('Kufika')} value={b.locationDetails ? Object.values(b.locationDetails).join(' · ') : null} />
        <InfoLine icon="accessibility-outline" label={tx('Ufikiaji')} value={b.accessibilityNotes} />
        <InfoLine icon="time-outline" label={tx('Sehemu ya siku')} value={b.timeWindow} />
        <InfoLine icon="document-text-outline" label={tx('Mahitaji')} value={b.notes} />
        <InfoLine icon="medkit-outline" label={tx('Muuguzi')} value={b.staff?.user?.name} />
        <InfoLine icon="pricetag-outline" label={tx('Bei ya orodha')} value={tzs(b.quotedPriceTzs)} />
        {b.locationLat != null ? (
          <View style={styles.map}>
            <MapView height={200} markers={[{ lat: b.locationLat, lng: b.locationLng, label: b.patient?.name, colour: colors.primary }]} zoom={15} />
          </View>
        ) : null}
        {b.locationLat != null ? (
          <ActionButton variant="ghost" icon="map-outline" title={tx('Fungua pini kwenye ramani')} onPress={() => Linking.openURL(mapLink(b.locationLat, b.locationLng))} />
        ) : (
          <Text style={styles.warn}>{tx('Hakuna pini — thibitisha eneo kwa simu.')}</Text>
        )}
      </Card>

      <View style={careStyles.actions}>
        {b.status === 'REQUESTED' ? (
          <ActionButton
            icon="eye-outline"
            title={tx('Ninalipitia')}
            busy={busy === 'review'}
            onPress={() => run('review', () => dispatch.reviewBooking(id), tx('Mteja amejulishwa kuwa ombi linapitiwa.'))}
          />
        ) : null}
      </View>

      {canAssign ? (
        <>
          <Text style={careStyles.section}>{tx('Mapendekezo')}</Text>
          <Text style={styles.hint}>{tx('Mfumo unapendekeza; wewe ndiye unaamua.')}</Text>
          {recommendations.length === 0 ? <Text style={careStyles.muted}>{tx('Hakuna mhudumu aliyeidhinishwa kwa huduma hii.')}</Text> : null}
          {recommendations.map((c) => (
            <Pressable
              key={c.id}
              disabled={!c.eligible}
              onPress={() => setChosen(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: chosen === c.id, disabled: !c.eligible }}
              style={({ pressed }) => [
                styles.candidate,
                chosen === c.id && styles.candidateOn,
                !c.eligible && styles.candidateOff,
                pressed && styles.pressed,
              ]}
            >
              <View style={careStyles.row}>
                <View style={[styles.rank, c.eligible && c.rank === 1 && styles.rankTop]}>
                  <Text style={[styles.rankText, c.eligible && c.rank === 1 && styles.rankTextTop]}>{c.rank}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.candidateName}>{c.name}</Text>
                  <Text style={careStyles.muted}>
                    {c.specialty} · {c.availability} {c.phone ? `· ${c.phone}` : ''}
                  </Text>
                </View>
                <Text style={styles.score}>{c.score}</Text>
              </View>
              {c.reasons.map((r) => (
                <Reason key={r} icon="checkmark-circle" colour={colors.success} text={r} />
              ))}
              {c.warnings.map((r) => (
                <Reason key={r} icon="alert-circle" colour={colors.caution} text={r} />
              ))}
              {c.blockers.map((r) => (
                <Reason key={r} icon="close-circle" colour={colors.danger} text={r} />
              ))}
            </Pressable>
          ))}

          {chosen ? (
            <Card style={styles.confirm}>
              {needsReason ? (
                <Field
                  label={tx('Sababu ya kutochagua pendekezo la kwanza')}
                  value={override}
                  onChangeText={setOverride}
                  placeholder={tx('mfano: Familia imemwomba yeye kwa jina')}
                />
              ) : null}
              <ActionButton
                icon="person-add"
                title={tx('Thibitisha upangaji')}
                disabled={needsReason && override.trim().length < 3}
                busy={busy === 'assign'}
                onPress={() =>
                  run('assign', () => dispatch.assignBooking(id, chosen, needsReason ? override.trim() : undefined), tx('Amepangiwa. Muuguzi na mteja wamejulishwa.'))
                }
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {BOOKING_FAIL_FROM.includes(b.status) || BOOKING_CANCEL_FROM.includes(b.status) ? (
        <Card style={styles.danger}>
          <Field label={tx('Sababu')} value={reason} onChangeText={setReason} placeholder={tx('Inahitajika kwa kusitisha au kushindikana')} />
          <View style={careStyles.actions}>
            {BOOKING_FAIL_FROM.includes(b.status) ? (
              <ActionButton
                variant="ghost"
                danger
                icon="alert-circle-outline"
                title={tx('Haikufanyika')}
                disabled={reason.trim().length < 3}
                busy={busy === 'fail'}
                onPress={() => run('fail', () => dispatch.failBooking(id, reason.trim()))}
              />
            ) : null}
            {BOOKING_CANCEL_FROM.includes(b.status) ? (
              <ActionButton
                variant="ghost"
                danger
                icon="close-circle-outline"
                title={tx('Sitisha')}
                disabled={reason.trim().length < 3}
                busy={busy === 'cancel'}
                onPress={() => run('cancel', () => dispatch.cancelBooking(id, reason.trim()))}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      <Text style={careStyles.section}>{tx('Historia')}</Text>
      <Card>
        <Timeline kind="HOME_VISIT" entries={timeline} />
      </Card>
    </>
  );
}

function TripPanel({ data, busy, run, id }) {
  const { trip: t, drivers = [], partner, timeline = [] } = data;
  const [fare, setFare] = useState(t.quotedFareTzs ? String(t.quotedFareTzs) : '');
  const [quoteNote, setQuoteNote] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState('staff');
  const [driverId, setDriverId] = useState(null);
  const [partnerName, setPartnerName] = useState(partner?.name ?? '');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicle, setVehicle] = useState('');

  const canQuote = ['REQUESTED', 'UNDER_REVIEW', 'QUOTED'].includes(t.status);
  const canAssign = ['ACCEPTED', 'ASSIGNED'].includes(t.status);
  const progress = TRIP_PROGRESS[t.status];
  const fareNumber = Number.parseInt(fare, 10);

  return (
    <>
      <Header kind="TRANSPORT" reference={t.bookingReference} status={t.status} title={t.destinationName} when={t.scheduledAt} />

      <Card>
        <InfoLine icon="person-outline" label={tx('Msafiri')} value={t.patient?.name} />
        <InfoLine icon="radio-button-on-outline" label={tx('Kuchukuliwa')} value={t.pickupAddress} />
        <InfoLine icon="flag-outline" label={tx('Kwenda')} value={[t.destinationType, t.destinationName, t.destinationAddress].filter(Boolean).join(' · ')} />
        <InfoLine icon="accessibility-outline" label={tx('Msaada')} value={t.mobilityNeeds} />
        <InfoLine icon="people-outline" label={tx('Wasafiri')} value={String(t.passengerCount)} />
        <InfoLine icon="call-outline" label={tx('Simu ya safari')} value={t.contactPhone} />
        <InfoLine icon="document-text-outline" label={tx('Maelezo')} value={t.notes} />
        <InfoLine icon="pricetag-outline" label={tx('Bei')} value={tzs(t.confirmedFareTzs ?? t.quotedFareTzs)} />
        <InfoLine icon="car-outline" label={tx('Dereva')} value={[t.driver?.user?.name ?? t.driverName, t.driverPhone, t.partnerName].filter(Boolean).join(' · ')} />
        <InfoLine icon="car-sport-outline" label={tx('Gari')} value={t.vehicleDetails} />
        {t.pickupLat != null || t.destinationLat != null ? (
          <View style={styles.map}>
            <MapView
              height={200}
              markers={[
                ...(t.pickupLat != null ? [{ lat: t.pickupLat, lng: t.pickupLng, label: tx('Kuchukuliwa'), colour: colors.primary }] : []),
                ...(t.destinationLat != null ? [{ lat: t.destinationLat, lng: t.destinationLng, label: tx('Kwenda'), colour: colors.success }] : []),
              ]}
              zoom={14}
            />
          </View>
        ) : null}
        {t.pickupLat != null ? (
          <ActionButton variant="ghost" icon="map-outline" title={tx('Fungua pini ya kuchukuliwa')} onPress={() => Linking.openURL(mapLink(t.pickupLat, t.pickupLng))} />
        ) : null}
      </Card>

      {t.status === 'REQUESTED' ? (
        <View style={careStyles.actions}>
          <ActionButton icon="eye-outline" title={tx('Ninalipitia')} busy={busy === 'review'} onPress={() => run('review', () => dispatch.tripAction(id, 'review'))} />
        </View>
      ) : null}

      {canQuote ? (
        <Card>
          <Text style={styles.cardTitle}>{tx('Tuma bei kwa mteja')}</Text>
          <Field label={tx('Bei (TZS)')} keyboardType="number-pad" value={fare} onChangeText={setFare} placeholder="25000" />
          <Field label={tx('Maelezo ya bei (hiari)')} value={quoteNote} onChangeText={setQuoteNote} placeholder={tx('mfano: Kwenda na kurudi, pamoja na kusubiri saa 1')} />
          <ActionButton
            icon="send"
            title={tx('Tuma bei')}
            disabled={!Number.isInteger(fareNumber) || fareNumber < 0}
            busy={busy === 'quote'}
            onPress={() =>
              run('quote', () => dispatch.tripAction(id, 'quote', { fareTzs: fareNumber, ...(quoteNote.trim() ? { note: quoteNote.trim() } : {}) }), tx('Bei imetumwa. Inasubiri mteja akubali.'))
            }
          />
        </Card>
      ) : null}

      {t.status === 'QUOTED' ? <Text style={styles.warn}>{tx('Inasubiri mteja akubali bei kabla ya kupanga gari.')}</Text> : null}

      {canAssign ? (
        <Card>
          <Text style={styles.cardTitle}>{tx('Panga gari')}</Text>
          <View style={careStyles.chips}>
            <ModeChip label={tx('Mhudumu wetu')} on={mode === 'staff'} onPress={() => setMode('staff')} />
            <ModeChip label={tx('Kampuni ya usafiri')} on={mode === 'partner'} onPress={() => setMode('partner')} />
          </View>

          {mode === 'staff' ? (
            <>
              {drivers.map((d) => (
                <Pressable
                  key={d.id}
                  disabled={!d.eligible}
                  onPress={() => setDriverId(d.id)}
                  style={({ pressed }) => [styles.candidate, driverId === d.id && styles.candidateOn, !d.eligible && styles.candidateOff, pressed && styles.pressed]}
                >
                  <Text style={styles.candidateName}>{d.name}</Text>
                  <Text style={careStyles.muted}>
                    {d.specialty} · {d.availability} {d.phone ? `· ${d.phone}` : ''}
                  </Text>
                  {d.blockers.map((r) => (
                    <Reason key={r} icon="close-circle" colour={colors.danger} text={r} />
                  ))}
                </Pressable>
              ))}
              <Field label={tx('Maelezo ya gari (hiari)')} value={vehicle} onChangeText={setVehicle} placeholder="Toyota Noah · T 123 ABC" />
              <ActionButton
                icon="car"
                title={tx('Mpangie')}
                disabled={!driverId}
                busy={busy === 'assign'}
                onPress={() => run('assign', () => dispatch.tripAction(id, 'assign', { staffId: driverId, ...(vehicle.trim() ? { vehicleDetails: vehicle.trim() } : {}) }))}
              />
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                {partner?.configured
                  ? tx('Kampuni imeunganishwa: unaweza kutuma kupitia mfumo wao, au kuandika maelezo uliyopewa kwa simu.')
                  : tx('Hakuna kampuni iliyounganishwa bado. Panga kwa simu, kisha andika maelezo hapa.')}
              </Text>
              {partner?.configured ? (
                <ActionButton
                  icon="cloud-upload-outline"
                  title={tx('Tuma kupitia mfumo wa kampuni')}
                  busy={busy === 'assign-api'}
                  onPress={() => run('assign-api', () => dispatch.tripAction(id, 'assign', { usePartnerApi: true }))}
                />
              ) : null}
              <Field label={tx('Jina la kampuni')} value={partnerName} onChangeText={setPartnerName} />
              <Field label={tx('Jina la dereva')} value={driverName} onChangeText={setDriverName} />
              <Field label={tx('Simu ya dereva (mteja haioni)')} keyboardType="phone-pad" value={driverPhone} onChangeText={setDriverPhone} />
              <Field label={tx('Gari')} value={vehicle} onChangeText={setVehicle} placeholder="Toyota Noah · T 123 ABC" />
              <ActionButton
                icon="car"
                title={tx('Hifadhi upangaji')}
                disabled={!partnerName.trim() && !driverName.trim()}
                busy={busy === 'assign'}
                onPress={() =>
                  run('assign', () =>
                    dispatch.tripAction(id, 'assign', {
                      ...(partnerName.trim() ? { partnerName: partnerName.trim() } : {}),
                      ...(driverName.trim() ? { driverName: driverName.trim() } : {}),
                      ...(driverPhone.trim() ? { driverPhone: driverPhone.trim() } : {}),
                      ...(vehicle.trim() ? { vehicleDetails: vehicle.trim() } : {}),
                    })
                  )
                }
              />
            </>
          )}
        </Card>
      ) : null}

      {progress ? (
        <View style={careStyles.actions}>
          <ActionButton icon="arrow-forward-circle" title={tx(progress.label)} busy={busy === 'progress'} onPress={() => run('progress', () => transport.progress(id, progress.action))} />
        </View>
      ) : null}

      {!['COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED', 'EXPIRED'].includes(t.status) ? (
        <Card style={styles.danger}>
          <Field label={tx('Sababu')} value={reason} onChangeText={setReason} placeholder={tx('Inahitajika')} />
          <View style={careStyles.actions}>
            {['REQUESTED', 'UNDER_REVIEW', 'QUOTED'].includes(t.status) ? (
              <ActionButton variant="ghost" danger title={tx('Kataa ombi')} disabled={reason.trim().length < 3} busy={busy === 'reject'} onPress={() => run('reject', () => dispatch.tripAction(id, 'reject', { reason: reason.trim() }))} />
            ) : null}
            {['ASSIGNED', 'EN_ROUTE', 'ARRIVED_PICKUP', 'IN_TRIP'].includes(t.status) ? (
              <ActionButton variant="ghost" danger title={tx('Haikufanyika')} disabled={reason.trim().length < 3} busy={busy === 'fail'} onPress={() => run('fail', () => dispatch.tripAction(id, 'fail', { reason: reason.trim() }))} />
            ) : null}
            {['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'ASSIGNED'].includes(t.status) ? (
              <ActionButton variant="ghost" danger title={tx('Sitisha')} disabled={reason.trim().length < 3} busy={busy === 'cancel'} onPress={() => run('cancel', () => transport.cancel(id, reason.trim()))} />
            ) : null}
          </View>
        </Card>
      ) : null}

      <Text style={careStyles.section}>{tx('Historia')}</Text>
      <Card>
        <Timeline kind="TRANSPORT" entries={timeline} />
      </Card>
    </>
  );
}

function ModeChip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.mode, on && styles.modeOn, pressed && styles.pressed]}>
      <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Reason({ icon, colour, text }) {
  return (
    <View style={styles.reason}>
      <Ionicons name={icon} size={13} color={colour} />
      <Text style={styles.reasonText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  notice: { ...type.small, color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: 12, marginBottom: spacing.sm },
  header: { borderColor: colors.primaryLight, borderWidth: 1.5 },
  ref: { fontSize: fs(13), fontFamily: font.extrabold, color: colors.primaryDark, letterSpacing: 1 },
  title: { ...type.section, color: colors.text, marginTop: 2 },
  headerMeta: { marginTop: spacing.sm, flexWrap: 'wrap' },
  cardTitle: { ...type.bodyStrong, fontFamily: font.bold, color: colors.text, marginBottom: spacing.sm },
  hint: { ...type.small, color: colors.muted, marginBottom: spacing.sm },
  warn: { ...type.small, color: colors.caution, marginVertical: spacing.xs },

  candidate: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  candidateOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight },
  candidateOff: { opacity: 0.55 },
  candidateName: { ...type.bodyStrong, color: colors.text },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: colors.primary },
  rankText: { fontSize: fs(12), fontFamily: font.bold, color: colors.muted },
  rankTextTop: { color: colors.onPrimary },
  score: { ...type.tiny, color: colors.muted },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  reasonText: { ...type.small, color: colors.text, flex: 1 },

  confirm: { marginTop: spacing.xs },
  map: { marginVertical: spacing.sm },
  danger: { marginTop: spacing.md, borderColor: colors.dangerBg },

  mode: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm + 2, paddingVertical: 7 },
  modeOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { fontSize: fs(12), fontFamily: font.semibold, color: colors.text },
  modeTextOn: { color: colors.onPrimary },
});
