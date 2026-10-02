import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { care, familyMembers, newIdempotencyKey, transport } from '../../lib/api';
import { Card, ErrorBox, Field } from '../../lib/ui';
import { ActionButton, Chip, InfoLine, careStyles } from '../../lib/care-ui';
import { DESTINATION_TYPES, atHour, currentPosition, dateTimeSw, nextDays, serviceZones, zoneCircles } from '../../lib/care';
import MapView from '../../lib/MapView';
import { useSession } from '../../lib/session';
import { colors, font, fs, radius, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// "Take me to care": a ride to a hospital, clinic or pharmacy.
//
// What this screen promises is a request, not a car. A dispatcher reads
// it, sends a fare, and only books a vehicle once the client has
// accepted that fare; the screen says so before anything is sent. No
// price is shown here because none exists until a person quotes one.
//
// And it is not an ambulance. If the notes read like an emergency the
// server stops the request and this screen turns red with 112 on it.

const STEPS = ['Nani na lini', 'Kuchukuliwa', 'Kwenda', 'Msaada', 'Thibitisha'];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const STEP_FOR_ERROR = { OUT_OF_SERVICE_AREA: 1, TOO_SOON: 0 };

export default function Transport() {
  useI18n();
  const router = useRouter();
  const { user } = useSession();

  const [step, setStep] = useState(0);
  const [members, setMembers] = useState([]);
  const [places, setPlaces] = useState([]);
  const [days] = useState(() => nextDays(7));
  const [zones, setZones] = useState([]);

  const [memberId, setMemberId] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [hour, setHour] = useState(9);
  const [pickup, setPickup] = useState('');
  const [pin, setPin] = useState(null);
  const [landmark, setLandmark] = useState('');
  const [destType, setDestType] = useState('HOSPITAL');
  const [destName, setDestName] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [destPin, setDestPin] = useState(null);
  const [mobility, setMobility] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [companion, setCompanion] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [notes, setNotes] = useState('');

  const [idemKey] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    serviceZones().then(setZones);
  }, []);

  // The account's own number, as a starting point the client can
  // change. The session may arrive after this screen first renders.
  useEffect(() => {
    if (user?.phone) setPhone((current) => current || user.phone);
  }, [user?.phone]);

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([familyMembers.list(), care.locations().catch(() => null)]);
        const list = m?.familyMembers ?? [];
        setMembers(list);
        if (list.length) setMemberId(list[0].id);
        const saved = p?.locations ?? [];
        setPlaces(saved);
        const home = saved.find((x) => x.isDefault);
        if (home) usePlace(home);
      } catch (err) {
        setError(err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function usePlace(place) {
    setPickup(place.address);
    setPin(place.lat != null ? { lat: place.lat, lng: place.lng } : null);
    setLandmark(place.details?.landmark ?? '');
  }

  async function locate() {
    setError(null);
    setLocating(true);
    try {
      setPin(await currentPosition());
    } catch (err) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  }

  const scheduledAt = atHour(days[dayIndex].date, hour);
  const member = members.find((m) => m.id === memberId);

  async function submit({ acknowledged = false } = {}) {
    setError(null);
    setBusy(true);
    try {
      const data = await transport.create(
        {
          familyMemberId: memberId,
          pickupAddress: pickup.trim(),
          ...(pin ? { pickupLat: pin.lat, pickupLng: pin.lng } : {}),
          ...(landmark.trim() ? { pickupDetails: { landmark: landmark.trim() } } : {}),
          destinationType: destType,
          destinationName: destName.trim(),
          ...(destAddress.trim() ? { destinationAddress: destAddress.trim() } : {}),
          ...(destPin ? { destinationLat: destPin.lat, destinationLng: destPin.lng } : {}),
          passengerCount: passengers,
          scheduledAt: scheduledAt.toISOString(),
          ...(mobility.trim() ? { mobilityNeeds: mobility.trim() } : {}),
          ...(companion.trim() ? { companionName: companion.trim() } : {}),
          contactPhone: phone.trim(),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(acknowledged ? { acknowledgedNotEmergency: true } : {}),
        },
        idemKey
      );
      setEmergency(null);
      setDone(data?.trip ?? {});
    } catch (err) {
      if (err.code === 'EMERGENCY_DETECTED') {
        setEmergency(err.message);
      } else {
        setError(err.message);
        if (STEP_FOR_ERROR[err.code] != null) setStep(STEP_FOR_ERROR[err.code]);
      }
    } finally {
      setBusy(false);
    }
  }

  const canContinue = [
    Boolean(memberId),
    pickup.trim().length >= 3,
    destName.trim().length >= 2,
    /^\+?[0-9]{9,15}$/.test(phone.trim()),
    true,
  ][step];

  if (done) {
    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <Ionicons name="car" size={34} color={colors.onPrimary} />
        </View>
        <Text style={styles.doneTitle}>{tx('Ombi la usafiri limepokelewa')}</Text>
        {done.bookingReference ? <Text style={styles.reference}>{done.bookingReference}</Text> : null}
        <Text style={styles.doneBody}>
          {tx('Tutapitia ombi lako na kukutumia bei. Gari halitapangwa mpaka ukubali bei hiyo.')}
        </Text>
        <ActionButton
          title={tx('Fuatilia ombi')}
          icon="navigate-outline"
          onPress={() => router.replace({ pathname: '/track', params: { kind: 'transport', id: done.id } })}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.stepBar}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepTick, i <= step && styles.stepTickOn]} />
            <Text numberOfLines={1} style={[styles.stepLabel, i === step && styles.stepLabelOn]}>
              {tx(label)}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={careStyles.content} keyboardShouldPersistTaps="handled">
        <ErrorBox error={error} />

        {emergency ? (
          <Card style={styles.emergency}>
            <View style={careStyles.row}>
              <Ionicons name="warning" size={22} color={colors.danger} />
              <Text style={styles.emergencyTitle}>{tx('Hii inaweza kuwa dharura')}</Text>
            </View>
            <Text style={styles.emergencyBody}>{emergency}</Text>
            <View style={careStyles.actions}>
              <ActionButton title={tx('Piga 112 sasa')} icon="call" danger onPress={() => Linking.openURL('tel:112')} />
            </View>
            <Pressable onPress={() => submit({ acknowledged: true })} disabled={busy} style={styles.notEmergency}>
              <Text style={styles.notEmergencyText}>{tx('Si dharura — tuma ombi la usafiri uliopangwa')}</Text>
            </Pressable>
          </Card>
        ) : null}

        {step === 0 ? (
          <>
            <Text style={styles.title}>{tx('Usafiri ni kwa ajili ya nani')}</Text>
            <View style={careStyles.chips}>
              {members.map((m) => (
                <Chip
                  key={m.id}
                  label={m.relationship === 'SELF' ? `${m.name} (${tx('wewe')})` : m.name}
                  icon="person-outline"
                  selected={m.id === memberId}
                  onPress={() => setMemberId(m.id)}
                />
              ))}
            </View>

            <Text style={styles.title}>{tx('Siku gani')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscrollView} contentContainerStyle={styles.hscroll}>
              {days.map((d, i) => (
                <Chip key={d.sub} label={`${d.label} · ${d.sub}`} selected={i === dayIndex} onPress={() => setDayIndex(i)} />
              ))}
            </ScrollView>

            <Text style={styles.title}>{tx('Saa ya kuchukuliwa')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscrollView} contentContainerStyle={styles.hscroll}>
              {HOURS.map((h) => (
                <Chip key={h} label={`${String(h).padStart(2, '0')}:00`} selected={h === hour} onPress={() => setHour(h)} />
              ))}
            </ScrollView>
            <Text style={careStyles.muted}>{dateTimeSw(scheduledAt)}</Text>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.title}>{tx('Tukuchukue wapi')}</Text>
            {places.length ? (
              <View style={careStyles.chips}>
                {places.map((p) => (
                  <Chip key={p.id} label={p.label} icon={p.isDefault ? 'home' : 'bookmark-outline'} selected={pickup === p.address} onPress={() => usePlace(p)} />
                ))}
              </View>
            ) : null}
            <Field label={tx('Mahali pa kuchukuliwa')} placeholder={tx('mfano: Sinza Mori, karibu na kituo cha mafuta')} value={pickup} onChangeText={setPickup} />
            <Field label={tx('Alama ya karibu (hiari)')} value={landmark} onChangeText={setLandmark} />
            <MapView
              height={220}
              markers={pin ? [{ ...pin, label: tx('Kuchukuliwa'), colour: colors.primary, pick: true }] : []}
              circles={zoneCircles(zones.filter((z) => z.transport), colors.primary)}
              zoom={pin ? 16 : 11}
              onPick={setPin}
              fallbackCentre={zones[0] ? { lat: zones[0].centerLat, lng: zones[0].centerLng } : null}
            />
            <View style={{ height: spacing.sm }} />
            <View style={careStyles.actions}>
              <ActionButton
                variant="ghost"
                icon={pin ? 'location' : 'locate'}
                title={pin ? tx('Pini imewekwa') : locating ? tx('Inatafuta…') : tx('Tumia mahali nilipo')}
                onPress={locate}
                busy={locating}
              />
              {pin ? <ActionButton variant="ghost" icon="close" title={tx('Ondoa')} onPress={() => setPin(null)} /> : null}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>{tx('Unaenda wapi')}</Text>
            <View style={careStyles.chips}>
              {DESTINATION_TYPES.map((d) => (
                <Chip key={d.value} label={tx(d.label)} icon={d.icon} selected={d.value === destType} onPress={() => setDestType(d.value)} />
              ))}
            </View>
            <Field label={tx('Jina la mahali')} placeholder={tx('mfano: Hospitali ya Taifa Muhimbili')} value={destName} onChangeText={setDestName} />
            <Field label={tx('Anwani (hiari)')} value={destAddress} onChangeText={setDestAddress} />
            <Text style={styles.label}>{tx('Weka pini ya unakoenda (hiari)')}</Text>
            <MapView
              height={200}
              markers={[
                ...(pin ? [{ ...pin, label: tx('Kuchukuliwa'), colour: colors.muted }] : []),
                ...(destPin ? [{ ...destPin, label: tx('Kwenda'), colour: colors.primary, pick: true }] : []),
              ]}
              zoom={13}
              onPick={setDestPin}
              fallbackCentre={zones[0] ? { lat: zones[0].centerLat, lng: zones[0].centerLng } : null}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.title}>{tx('Msaada unaohitajika')}</Text>
            <Field
              label={tx('Mahitaji ya mwendo (hiari)')}
              placeholder={tx('mfano: Anatumia kiti cha magurudumu; anahitaji kusaidiwa kupanda')}
              value={mobility}
              onChangeText={setMobility}
              multiline
              style={styles.textarea}
            />
            <Text style={styles.label}>{tx('Idadi ya wasafiri')}</Text>
            <View style={careStyles.chips}>
              {[1, 2, 3].map((n) => (
                <Chip key={n} label={String(n)} selected={n === passengers} onPress={() => setPassengers(n)} />
              ))}
            </View>
            <Field label={tx('Jina la msindikizaji (hiari)')} value={companion} onChangeText={setCompanion} />
            <Field label={tx('Simu ya kuwasiliana siku hiyo')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <Field label={tx('Maelezo mengine (hiari)')} value={notes} onChangeText={setNotes} multiline style={styles.textarea} />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={styles.title}>{tx('Thibitisha ombi la usafiri')}</Text>
            <Card>
              <InfoLine icon="person-outline" label={tx('Msafiri')} value={member?.name} />
              <InfoLine icon="calendar-outline" label={tx('Lini')} value={dateTimeSw(scheduledAt)} />
              <InfoLine icon="radio-button-on-outline" label={tx('Kuchukuliwa')} value={`${pickup.trim()}${pin ? ` · ${tx('pini imewekwa')}` : ''}`} />
              <InfoLine icon="flag-outline" label={tx('Kwenda')} value={[destName.trim(), destAddress.trim()].filter(Boolean).join(', ')} />
              <InfoLine icon="accessibility-outline" label={tx('Msaada')} value={mobility.trim()} />
              <InfoLine icon="people-outline" label={tx('Wasafiri')} value={String(passengers)} />
              <InfoLine icon="call-outline" label={tx('Simu')} value={phone.trim()} />
            </Card>
            <Card style={styles.note}>
              <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              <Text style={styles.noteText}>
                {tx('Bei itatumwa kwako baada ya ombi kupitiwa. Hakuna gari litakalopangwa mpaka ukubali bei.')}
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? <ActionButton variant="ghost" icon="arrow-back" title={tx('Rudi')} onPress={() => setStep(step - 1)} /> : null}
        <ActionButton
          title={step === STEPS.length - 1 ? tx('Tuma ombi') : tx('Endelea')}
          icon={step === STEPS.length - 1 ? 'send' : 'arrow-forward'}
          disabled={!canContinue}
          busy={busy}
          onPress={() => (step === STEPS.length - 1 ? submit() : setStep(step + 1))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  title: { ...type.section, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.xs },
  label: { ...type.label, color: colors.text, marginBottom: spacing.xs },
  textarea: { minHeight: 76, textAlignVertical: 'top' },
  // A horizontal ScrollView stretches its children to its own height
  // unless told otherwise, which turned each chip into a tall pill.
  hscroll: { gap: spacing.xs, paddingBottom: spacing.sm, alignItems: 'flex-start' },
  hscrollView: { flexGrow: 0 },

  stepBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: { flex: 1 },
  stepTick: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  stepTickOn: { backgroundColor: colors.primary },
  stepLabel: { fontSize: fs(9.5), color: colors.subtle, marginTop: 4 },
  stepLabelOn: { color: colors.primary, fontFamily: font.bold },

  emergency: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  emergencyTitle: { ...type.section, color: colors.danger, flex: 1 },
  emergencyBody: { ...type.body, color: colors.danger, marginTop: spacing.xs },
  notEmergency: { paddingVertical: spacing.sm, alignItems: 'center' },
  notEmergencyText: { ...type.small, color: colors.muted, textDecorationLine: 'underline' },

  note: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
  noteText: { flex: 1, ...type.small, color: colors.text },

  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.bg },
  doneIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  doneTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  reference: {
    fontSize: fs(22),
    fontFamily: font.extrabold,
    color: colors.primaryDark,
    letterSpacing: 1.5,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  doneBody: { ...type.body, color: colors.muted, textAlign: 'center', marginBottom: spacing.lg },
});
