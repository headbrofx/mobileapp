import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  bookings,
  care,
  familyMembers,
  newIdempotencyKey,
  services as servicesApi,
} from '../../../lib/api';
import { Card, ErrorBox, Field, MenuButton, PriceTag } from '../../../lib/ui';
import { colors, font, fs, radius, scale, shadow, spacing, type } from '../../../lib/theme';
import { serviceColour, serviceIcon, serviceImage } from '../../../lib/services-meta';
import { TIME_WINDOWS, atHour, currentPosition, mapLink, nextDays } from '../../../lib/care';
import { tx, useI18n } from '../../../lib/i18n';

// Requesting a home visit, one question per step: service, who, when,
// where, how to get in, what is needed, confirm.
//
// One step at a time is not decoration. The API wants a serviceId, a
// familyMemberId, an address and an ISO timestamp; a person has a
// nurse, a mother, a neighbourhood and "tomorrow morning". Asking one
// thing per screen is what turns the second into the first without
// presenting a wall of fields.
//
// The "how to get in" step exists because an address line is how a
// nurse ends up phoning from the wrong gate: house, floor, a landmark
// and who to call are what actually get someone through the door.

const STEPS = ['Huduma', 'Nani', 'Lini', 'Mahali', 'Kufika', 'Mahitaji', 'Thibitisha'];
const LAST = STEPS.length - 1;

// Where the form goes back to when the server refuses something.
const STEP_FOR_ERROR = { OUT_OF_SERVICE_AREA: 3, TOO_SOON: 2, TOO_FAR_AHEAD: 2 };

// The three things the welcome card promises. Kept to what the business
// actually does rather than invented selling points.
const PROMISES = [
  { icon: 'shield-checkmark-outline', label: 'Huduma Salama' },
  { icon: 'time-outline', label: 'Wakati wako' },
  { icon: 'home-outline', label: 'Nyumbani kwako' },
];

const SORT_LABEL = { none: 'Vichujio', price: 'Bei', duration: 'Muda' };
const NEXT_SORT = { none: 'price', price: 'duration', duration: 'none' };

export default function Book() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [catalogue, setCatalogue] = useState([]);
  const [members, setMembers] = useState([]);
  const [places, setPlaces] = useState([]);
  const [days] = useState(() => nextDays(7));

  const [service, setService] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [windowValue, setWindowValue] = useState(TIME_WINDOWS[0].value);
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState(null);
  const [locating, setLocating] = useState(false);
  const [savePlace, setSavePlace] = useState(false);
  const [placeLabel, setPlaceLabel] = useState('');
  const [house, setHouse] = useState('');
  const [floor, setFloor] = useState('');
  const [landmark, setLandmark] = useState('');
  const [contactInstructions, setContactInstructions] = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [notes, setNotes] = useState('');

  // One key for this form. Pressing "confirm" twice, or again after a
  // timeout, returns the same booking rather than sending two nurses.
  const [idemKey] = useState(newIdempotencyKey);

  const [sort, setSort] = useState('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [serviceData, memberData, placeData] = await Promise.all([
          servicesApi.list(),
          familyMembers.list(),
          care.locations().catch(() => null),
        ]);
        setCatalogue(serviceData?.services ?? []);
        const list = memberData?.familyMembers ?? [];
        setMembers(list);
        if (list.length) setMemberId(list[0].id);
        const saved = placeData?.locations ?? [];
        setPlaces(saved);
        const home = saved.find((p) => p.isDefault);
        if (home) usePlace(home);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timeWindow = TIME_WINDOWS.find((w) => w.value === windowValue) ?? TIME_WINDOWS[0];
  const scheduledAt = atHour(days[dayIndex].date, timeWindow.hour);

  function usePlace(place) {
    setAddress(place.address);
    setPin(place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null);
    setHouse(place.details?.house ?? '');
    setFloor(place.details?.floor ?? '');
    setLandmark(place.details?.landmark ?? '');
    setContactInstructions(place.details?.contactInstructions ?? '');
    setSavePlace(false);
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

  const details = Object.fromEntries(
    Object.entries({
      house: house.trim(),
      floor: floor.trim(),
      landmark: landmark.trim(),
      contactInstructions: contactInstructions.trim(),
    }).filter(([, v]) => v)
  );

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const data = await bookings.create(
        {
          familyMemberId: memberId,
          serviceId: service.id,
          locationAddress: address.trim(),
          ...(pin ? { locationLat: pin.lat, locationLng: pin.lng } : {}),
          ...(Object.keys(details).length ? { locationDetails: details } : {}),
          ...(accessibility.trim() ? { accessibilityNotes: accessibility.trim() } : {}),
          timeWindow: windowValue,
          scheduledAt: scheduledAt.toISOString(),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        idemKey
      );

      if (savePlace && placeLabel.trim()) {
        // A convenience. If it fails the booking still stands, so it
        // does not get to turn a success into an error.
        care
          .saveLocation({
            label: placeLabel.trim(),
            address: address.trim(),
            ...(pin ? { lat: pin.lat, lng: pin.lng } : {}),
            ...(Object.keys(details).length ? { details } : {}),
          })
          .catch(() => {});
      }
      setDone(data?.booking ?? {});
    } catch (err) {
      setError(err.message);
      // Back to the step most likely at fault, rather than stranding
      // them on a confirmation screen that will not confirm.
      if (STEP_FOR_ERROR[err.code] != null) setStep(STEP_FOR_ERROR[err.code]);
    } finally {
      setBusy(false);
    }
  }

  const member = members.find((m) => m.id === memberId);

  // Sorted, not filtered: nothing is ever hidden from the catalogue,
  // because a service somebody cannot see is a service they cannot buy.
  const unknownLast = (value) => (value ?? Number.POSITIVE_INFINITY);
  const sorted =
    sort === 'none'
      ? catalogue
      : [...catalogue].sort((a, b) =>
          sort === 'price'
            ? unknownLast(a.basePriceTzs) - unknownLast(b.basePriceTzs)
            : unknownLast(a.durationMinutes) - unknownLast(b.durationMinutes)
        );

  const canContinue = [
    Boolean(service),
    Boolean(memberId),
    Boolean(windowValue),
    address.trim().length >= 3 && (!savePlace || placeLabel.trim().length > 0),
    true,
    true,
    true,
  ][step];

  if (done) return <Done router={router} booking={done} />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <MenuButton />

          <View style={styles.headerMiddle}>
            <View style={styles.headerMark}>
              <Ionicons name="home" size={16} color={colors.primary} />
            </View>
            <View style={styles.headerTitles}>
              <Text style={styles.title} numberOfLines={1}>
                {tx('Omba ziara ya nyumbani')}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {tx('Huduma bora ya afya, karibu nawe')}
              </Text>
            </View>
          </View>

          {/* Transport sits one tap away from here, because "get me to
              care" is the other half of the same need. */}
          <Pressable
            onPress={() => router.push('/transport')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.trust, pressed && styles.pressed]}
          >
            <Ionicons name="car-outline" size={12} color={colors.success} />
            <Text style={styles.trustText}>{tx('Usafiri')}</Text>
          </Pressable>
        </View>
        <Stepper step={step} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBox error={error} />

        {loading ? (
          <Card>
            <Text style={styles.muted}>{tx('Inapakia…')}</Text>
          </Card>
        ) : (
          <>
            {step === 0 ? (
              <>
                <Welcome />

                <View style={styles.sectionRow}>
                  <View style={styles.rowText}>
                    <Text style={styles.sectionTitle}>{tx('Huduma Zilizopo')}</Text>
                    <Text style={styles.sectionHint}>{tx('Chagua huduma unayohitaji')}</Text>
                  </View>

                  {/* The design draws a filter control here. Rather
                      than a chip that opens nothing, it sorts the list
                      — and says which sort is on, so it is never a
                      dead control. */}
                  <Pressable
                    onPress={() => setSort(NEXT_SORT[sort])}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.filter, pressed && styles.pressed]}
                  >
                    <Ionicons name="options-outline" size={14} color={colors.muted} />
                    <Text style={styles.filterText}>{tx(SORT_LABEL[sort])}</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.subtle} />
                  </Pressable>
                </View>

                {sorted.map((item) => (
                  <ServiceRow
                    key={item.id}
                    service={item}
                    selected={service?.id === item.id}
                    onPress={() => setService(item)}
                  />
                ))}
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.stepTitle}>{tx('Ni kwa ajili ya nani')}</Text>
                <Text style={styles.stepHint}>{tx('Unaweza kuomba kwa ajili ya mtu yeyote wa familia unayemhudumia')}</Text>

                {members.map((m) => (
                  <Choice
                    key={m.id}
                    title={m.relationship === 'SELF' ? `${m.name} (${tx('wewe')})` : m.name}
                    subtitle={m.relationship === 'SELF' ? null : m.relationship}
                    selected={m.id === memberId}
                    onPress={() => setMemberId(m.id)}
                  />
                ))}

                <Pressable onPress={() => router.push('/family')} style={styles.addLink}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.addLinkText}>{tx('Ongeza mtu mwingine wa familia')}</Text>
                </Pressable>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.stepTitle}>{tx('Lini')}</Text>
                <Text style={styles.stepHint}>{tx('Chagua siku na sehemu ya siku. Muuguzi atathibitisha saa kamili.')}</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
                  {days.map((d, i) => (
                    <Pressable
                      key={d.sub}
                      onPress={() => setDayIndex(i)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: i === dayIndex }}
                      style={({ pressed }) => [styles.day, i === dayIndex && styles.daySelected, pressed && styles.pressed]}
                    >
                      <Text style={[styles.dayLabel, i === dayIndex && styles.dayLabelSelected]}>{d.label}</Text>
                      <Text style={[styles.daySub, i === dayIndex && styles.dayLabelSelected]}>{d.sub}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.label}>{tx('Sehemu ya siku')}</Text>
                {TIME_WINDOWS.map((w) => (
                  <Choice
                    key={w.value}
                    title={tx(w.label)}
                    subtitle={w.hint}
                    selected={w.value === windowValue}
                    onPress={() => setWindowValue(w.value)}
                  />
                ))}
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Text style={styles.stepTitle}>{tx('Muuguzi aje wapi')}</Text>
                <Text style={styles.stepHint}>{tx('Andika mahali pa kufikika kwa urahisi')}</Text>

                {places.length ? (
                  <View style={styles.placeChips}>
                    {places.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => usePlace(p)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.placeChip,
                          address === p.address && styles.placeChipOn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons name={p.isDefault ? 'home' : 'bookmark-outline'} size={13} color={colors.primary} />
                        <Text style={styles.placeChipText}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <Field
                  label={tx('Mahali')}
                  placeholder={tx('mfano: Kariakoo, karibu na soko')}
                  value={address}
                  onChangeText={setAddress}
                />

                {/* A pin is optional and only taken when asked for. It
                    lets the office check the area is covered and gives
                    the nurse somewhere exact to aim for. No map is drawn
                    here until a maps provider is connected; the link
                    opens the phone's own map instead of a pretend one. */}
                <Card style={styles.pinCard}>
                  <View style={styles.pinRow}>
                    <View style={[styles.pinIcon, pin && styles.pinIconOn]}>
                      <Ionicons name={pin ? 'location' : 'location-outline'} size={18} color={pin ? colors.onPrimary : colors.primary} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.pinTitle}>{pin ? tx('Pini imewekwa') : tx('Weka pini ya mahali (hiari)')}</Text>
                      <Text style={styles.muted}>
                        {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : tx('Inasaidia muuguzi kukufikia moja kwa moja')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pinActions}>
                    <Pressable onPress={locate} disabled={locating} style={({ pressed }) => [styles.pinButton, pressed && styles.pressed]}>
                      <Ionicons name="locate" size={15} color={colors.primary} />
                      <Text style={styles.pinButtonText}>{locating ? tx('Inatafuta…') : tx('Tumia mahali nilipo')}</Text>
                    </Pressable>
                    {pin ? (
                      <>
                        <Pressable onPress={() => Linking.openURL(mapLink(pin.lat, pin.lng))} style={({ pressed }) => [styles.pinButton, pressed && styles.pressed]}>
                          <Ionicons name="map-outline" size={15} color={colors.primary} />
                          <Text style={styles.pinButtonText}>{tx('Angalia ramani')}</Text>
                        </Pressable>
                        <Pressable onPress={() => setPin(null)} style={({ pressed }) => [styles.pinButton, pressed && styles.pressed]}>
                          <Ionicons name="close" size={15} color={colors.muted} />
                          <Text style={[styles.pinButtonText, { color: colors.muted }]}>{tx('Ondoa')}</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </Card>

                <View style={styles.saveRow}>
                  <Text style={styles.saveText}>{tx('Hifadhi mahali hapa kwa ajili ya baadaye')}</Text>
                  <Switch value={savePlace} onValueChange={setSavePlace} trackColor={{ true: colors.primary }} />
                </View>
                {savePlace ? (
                  <Field label={tx('Jina la mahali')} placeholder={tx('mfano: Nyumbani, Kwa mama')} value={placeLabel} onChangeText={setPlaceLabel} />
                ) : null}
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Text style={styles.stepTitle}>{tx('Muuguzi atakufikiaje')}</Text>
                <Text style={styles.stepHint}>{tx('Haya yanamsaidia asipotee getini. Yote ni hiari.')}</Text>
                <Field label={tx('Nyumba / jengo')} placeholder={tx('mfano: Nyumba namba 14, geti jeusi')} value={house} onChangeText={setHouse} />
                <Field label={tx('Ghorofa / chumba')} placeholder={tx('mfano: Ghorofa ya 2, mlango 5')} value={floor} onChangeText={setFloor} />
                <Field label={tx('Alama ya karibu')} placeholder={tx('mfano: Nyuma ya msikiti, karibu na duka la dawa')} value={landmark} onChangeText={setLandmark} />
                <Field
                  label={tx('Maelekezo ya kufika')}
                  placeholder={tx('mfano: Piga simu ukifika getini, mlinzi atakufungulia')}
                  value={contactInstructions}
                  onChangeText={setContactInstructions}
                />
                <Field
                  label={tx('Mahitaji ya ufikiaji')}
                  placeholder={tx('mfano: Ngazi tu, hakuna lifti; mgonjwa yuko kitandani')}
                  value={accessibility}
                  onChangeText={setAccessibility}
                  multiline
                  style={styles.textarea}
                />
              </>
            ) : null}

            {step === 5 ? (
              <>
                <Text style={styles.stepTitle}>{tx('Unahitaji nini')}</Text>
                <Text style={styles.stepHint}>{tx('Chochote muuguzi anapaswa kujua kabla hajafika')}</Text>
                <Field
                  label={tx('Maelezo (hiari)')}
                  placeholder={tx('mfano: Kubadilisha bendeji ya kidonda cha mguu')}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  style={styles.textarea}
                />
                <Card style={styles.emergency}>
                  <Ionicons name="warning-outline" size={18} color={colors.danger} />
                  <Text style={styles.emergencyText}>
                    {tx('Ziara ya nyumbani si huduma ya dharura. Kama mgonjwa hapumui vizuri, amepoteza fahamu au anavuja damu nyingi, piga 112 au nenda hospitali sasa.')}
                  </Text>
                </Card>
              </>
            ) : null}

            {step === LAST ? (
              <>
                <Text style={styles.stepTitle}>{tx('Thibitisha ombi lako')}</Text>
                <Text style={styles.stepHint}>{tx('Angalia kila kitu kabla ya kutuma')}</Text>

                <Card style={styles.summary}>
                  <View style={styles.summaryHead}>
                    <View style={[styles.rowIcon, { backgroundColor: serviceColour(service?.name) }]}>
                      <Ionicons name={serviceIcon(service?.name)} size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.summaryTitle}>{service?.name}</Text>
                      {service?.description ? (
                        <Text style={styles.muted} numberOfLines={2}>
                          {service.description}
                        </Text>
                      ) : null}
                      <PriceTag service={service} size={13} />
                    </View>
                  </View>

                  <Line icon="person-outline" label={tx('Mgonjwa')} value={member?.name} />
                  <Line
                    icon="calendar-outline"
                    label={tx('Tarehe na muda')}
                    value={`${days[dayIndex].label}, ${days[dayIndex].sub} · ${tx(timeWindow.label)} (${timeWindow.hint})`}
                  />
                  <Line
                    icon="location-outline"
                    label={tx('Mahali')}
                    value={`${address.trim()}${pin ? ` · ${tx('pini imewekwa')}` : ''}`}
                  />
                  {Object.keys(details).length ? (
                    <Line icon="navigate-outline" label={tx('Kufika')} value={Object.values(details).join(' · ')} />
                  ) : null}
                  {accessibility.trim() ? (
                    <Line icon="accessibility-outline" label={tx('Ufikiaji')} value={accessibility.trim()} />
                  ) : null}
                  {notes.trim() ? (
                    <Line icon="document-text-outline" label={tx('Maelezo')} value={notes.trim()} />
                  ) : null}
                </Card>

                {/* Nobody has been assigned at this point — the office
                    does that once the request arrives — so this says
                    what happens next instead of showing a nurse who has
                    not agreed to come. */}
                <Card style={styles.pending}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <Text style={styles.pendingText}>{tx('Ombi litapitiwa na mtaalamu wetu, kisha muuguzi atapangiwa. Utaona kila hatua kwenye "Huduma zangu".')}</Text>
                </Card>

                <Pressable
                  onPress={() => setStep(0)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <Ionicons name="create-outline" size={17} color={colors.primary} />
                  <Text style={styles.editText}>{tx('Badilisha maelezo')}</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep(step - 1)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={18} color={colors.primary} />
            <Text style={styles.backText}>{tx('Rudi')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => (step === LAST ? submit() : setStep(step + 1))}
          disabled={!canContinue || busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.next,
            (!canContinue || busy) && styles.nextDisabled,
            pressed && canContinue && styles.pressed,
          ]}
        >
          <Text style={styles.nextText}>
            {busy ? tx('Inatuma…') : step === LAST ? tx('Thibitisha ombi') : tx('Endelea')}
          </Text>
          {!busy ? <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} /> : null}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Stepper({ step }) {
  return (
    <View style={styles.stepper}>
      {STEPS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={styles.stepTop}>
              <View
                style={[styles.stepLine, index === 0 && styles.invisible, done && styles.stepLineDone]}
              />
              <View style={[styles.stepDot, (done || current) && styles.stepDotActive]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.stepNum, current && styles.stepNumActive]}>{index + 1}</Text>
                )}
              </View>
              <View
                style={[
                  styles.stepLine,
                  index === STEPS.length - 1 && styles.invisible,
                  done && styles.stepLineDone,
                ]}
              />
            </View>
            <Text numberOfLines={1} style={[styles.stepLabel, (done || current) && styles.stepLabelActive]}>
              {tx(label)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// The welcome card at the head of step one.
//
// The design pairs it with a photograph of a nurse holding a clipboard.
// That photograph does not exist in this project — the owner has sent
// eight service photographs and one of a nurse with a patient — so the
// one that does exist is used, rather than a stock face standing in for
// somebody who works here.
function Welcome() {
  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeTop}>
        <View style={styles.welcomeText}>
          <View style={styles.welcomeBadge}>
            <Text style={styles.welcomeBadgeText}>{tx('KARIBU!')}</Text>
          </View>

          <Text style={styles.welcomeTitle}>{tx('Chagua huduma yako ya afya nyumbani')}</Text>

          {/* The gold rule the design draws under the heading. */}
          <View style={styles.welcomeRule} />

          <Text style={styles.welcomeBody}>
            {tx('Daktari, muuguzi na huduma nyingine za afya — tunakuja nyumbani kwako.')}
          </Text>
        </View>

        <View style={styles.welcomeArt}>
          <Image
            source={require('../../../assets/hero.png')}
            style={styles.welcomeImage}
            resizeMode="cover"
            accessible={false}
          />
          {/* The design sets this in a handwriting face. This app ships
              one typeface, so it is italic rather than a second font
              downloaded for four words. */}
          <Text style={styles.script}>Afya ni maisha</Text>
        </View>
      </View>

      {/* Across the whole card, the way the design runs it — under the
          picture rather than squeezed into the column beside it. Three
          chips in half a card is three truncated chips. */}
      <View style={styles.promises}>
        {PROMISES.map((promise) => (
          <View key={promise.label} style={styles.promise}>
            <Ionicons name={promise.icon} size={12} color={colors.primary} />
            <Text style={styles.promiseText} numberOfLines={1}>
              {tx(promise.label)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ServiceRow({ service, selected, onPress }) {
  const colour = serviceColour(service.name);
  const photo = serviceImage(service.name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.serviceRow,
        { backgroundColor: `${colour}0F`, borderColor: `${colour}2E` },
        selected && { borderColor: colour, borderWidth: 2 },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colour }]}>
        <Ionicons name={serviceIcon(service.name)} size={20} color="#FFFFFF" />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {service.name}
        </Text>
        <PriceTag service={service} colour={colour} />
        {service.durationMinutes ? (
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={11} color={colors.muted} />
            <Text style={styles.duration}>
              {tx('Dakika')} {service.durationMinutes}
            </Text>
          </View>
        ) : null}
      </View>

      {photo ? <Image source={photo} style={styles.rowPhoto} resizeMode="cover" accessible={false} /> : null}

      <View style={[styles.rowGo, { backgroundColor: colour }]}>
        <Ionicons name={selected ? 'checkmark' : 'arrow-forward'} size={15} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

function Choice({ title, subtitle, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? colors.primary : colors.border}
      />
    </Pressable>
  );
}

function Line({ icon, label, value }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={17} color={colors.muted} />
      <View style={styles.rowText}>
        <Text style={styles.lineLabel}>{label}</Text>
        <Text style={styles.lineValue}>{value}</Text>
      </View>
    </View>
  );
}

function Done({ router, booking }) {
  return (
    <View style={styles.doneWrap}>
      <View style={styles.doneIcon}>
        <Ionicons name="checkmark" size={38} color={colors.onPrimary} />
      </View>
      <Text style={styles.doneTitle}>{tx('Ombi limepokelewa')}</Text>
      {booking?.bookingReference ? (
        <View style={styles.reference}>
          <Text style={styles.referenceLabel}>{tx('Namba ya kumbukumbu')}</Text>
          <Text style={styles.referenceValue} selectable>
            {booking.bookingReference}
          </Text>
        </View>
      ) : null}
      <Text style={styles.doneBody}>{tx('Tutakupangia muuguzi na utaona kila hatua ya ombi lako kwenye "Huduma zangu".')}</Text>
      <Pressable
        onPress={() =>
          booking?.id
            ? router.replace({ pathname: '/track', params: { kind: 'home-visit', id: booking.id } })
            : router.replace('/appointments')
        }
        accessibilityRole="button"
        style={({ pressed }) => [styles.next, styles.doneButton, pressed && styles.pressed]}
      >
        <Text style={styles.nextText}>{tx('Fuatilia ombi')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.8 },
  invisible: { opacity: 0 },

  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  header: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerMiddle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerMark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: { flex: 1 },
  title: { fontSize: fs(15), fontFamily: font.bold, color: colors.text },
  subtitle: { ...type.tiny, fontSize: fs(10), color: colors.muted },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trustText: { fontSize: fs(9), lineHeight: fs(11), fontFamily: font.semibold, color: colors.success },

  // --- The welcome card at the head of step one ---
  welcome: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  welcomeTop: { flexDirection: 'row' },
  welcomeText: { flex: 1, padding: spacing.md, paddingRight: spacing.sm, paddingBottom: spacing.sm },
  welcomeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  welcomeBadgeText: {
    fontSize: fs(9),
    fontFamily: font.extrabold,
    letterSpacing: 0.7,
    color: colors.onPrimary,
  },
  welcomeTitle: {
    fontSize: scale(17),
    lineHeight: scale(22),
    fontFamily: font.extrabold,
    color: colors.primaryDark,
  },
  welcomeRule: {
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brandOrange,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  welcomeBody: { ...type.small, color: colors.muted },
  // One row, never wrapped. Three chips stacked into three lines is
  // what the narrow text column does by default, and it turns a tidy
  // strip into a list.
  promises: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  promise: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  promiseText: { fontSize: fs(9), fontFamily: font.semibold, color: colors.text },
  welcomeArt: { width: '38%' },
  welcomeImage: { width: '100%', height: '100%' },
  script: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.xs,
    fontSize: fs(11),
    fontStyle: 'italic',
    fontFamily: font.semibold,
    color: colors.onPrimary,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },

  // --- Section header above the catalogue ---
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: scale(17), fontFamily: font.extrabold, color: colors.text },
  sectionHint: { ...type.small, color: colors.muted },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterText: { fontSize: fs(11), fontFamily: font.semibold, color: colors.muted },

  stepper: { flexDirection: 'row', marginTop: spacing.md },
  stepItem: { flex: 1, alignItems: 'center' },
  stepTop: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: colors.primary },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum: { fontSize: fs(12), fontFamily: font.bold, color: colors.subtle },
  stepNumActive: { color: colors.onPrimary },
  // Seven steps across a phone: small, one line each.
  stepLabel: { fontSize: fs(9), color: colors.subtle, marginTop: 4 },
  stepLabelActive: { color: colors.primary, fontFamily: font.semibold },

  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  stepTitle: { fontSize: fs(17), fontFamily: font.bold, color: colors.text },
  stepHint: { fontSize: fs(14), color: colors.muted, marginBottom: spacing.md },
  label: {
    fontSize: fs(14),
    fontFamily: font.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  muted: { fontSize: fs(13), color: colors.muted, marginTop: 2 },
  textarea: { minHeight: 84, textAlignVertical: 'top' },

  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  serviceName: { fontSize: fs(14), fontFamily: font.bold, color: colors.text },

  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  duration: { fontSize: fs(10), color: colors.muted },
  // The photograph sits between the words and the arrow, as the design
  // has it. It is decoration, so it never takes space the name needs:
  // a fixed strip, and the text column keeps flex.
  rowPhoto: { width: 58, height: 46, borderRadius: radius.sm },
  rowGo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  statusIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: { ...type.tiny, color: colors.muted },
  statusValue: { ...type.label, color: colors.primary },

  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm + 3,
  },
  editText: { ...type.label, color: colors.primary },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  choiceSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
  },
  choiceTitle: { fontSize: fs(15), fontFamily: font.semibold, color: colors.text },
  choiceTitleSelected: { color: colors.primary },

  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addLinkText: { color: colors.primary, fontFamily: font.semibold, fontSize: fs(14) },

  summary: { ...shadow.card },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  summaryTitle: { fontSize: fs(16), fontFamily: font.bold, color: colors.text },

  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  lineLabel: { fontSize: fs(12), color: colors.muted },
  lineValue: { fontSize: fs(14), color: colors.text, fontFamily: font.medium, marginTop: 1 },

  pending: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  pendingText: { flex: 1, fontSize: fs(13), color: colors.text, lineHeight: fs(19) },

  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.primary, fontFamily: font.semibold },
  next: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  nextDisabled: { opacity: 0.45 },
  nextText: { color: colors.onPrimary, fontSize: fs(15), fontFamily: font.bold },

  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  doneIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  doneTitle: { fontSize: fs(21), fontFamily: font.bold, color: colors.text, marginBottom: spacing.xs },
  doneBody: {
    fontSize: fs(15),
    color: colors.muted,
    textAlign: 'center',
    lineHeight: fs(22),
    marginBottom: spacing.lg,
  },
  doneButton: { flex: 0, alignSelf: 'stretch' },
  reference: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  referenceLabel: { ...type.tiny, color: colors.muted },
  referenceValue: { fontSize: fs(22), fontFamily: font.extrabold, color: colors.primaryDark, letterSpacing: 1.5 },

  // Day picker: a strip of chips, the next seven days.
  dayRow: { gap: spacing.xs, paddingBottom: spacing.xs },
  day: {
    minWidth: 86,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayLabel: { fontSize: fs(13), fontFamily: font.bold, color: colors.text },
  daySub: { fontSize: fs(11), color: colors.muted, marginTop: 2 },
  dayLabelSelected: { color: colors.onPrimary },

  placeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  placeChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  placeChipText: { fontSize: fs(12), fontFamily: font.semibold, color: colors.text },

  pinCard: { marginBottom: spacing.md },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pinIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIconOn: { backgroundColor: colors.primary },
  pinTitle: { ...type.bodyStrong, color: colors.text },
  pinActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  pinButtonText: { fontSize: fs(12), fontFamily: font.semibold, color: colors.primary },

  saveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  saveText: { flex: 1, fontSize: fs(13), color: colors.text },

  emergency: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBg,
  },
  emergencyText: { flex: 1, fontSize: fs(12), lineHeight: fs(17), color: colors.danger },
});
