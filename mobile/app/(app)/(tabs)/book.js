import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { bookings, familyMembers, services as servicesApi } from '../../../lib/api';
import { Card, ErrorBox, Field, MenuButton } from '../../../lib/ui';
import { colors, font, radius, scale, shadow, spacing, type } from '../../../lib/theme';
import { serviceColour, serviceIcon, serviceImage } from '../../../lib/services-meta';
import { tx, useI18n } from '../../../lib/i18n';

// Requesting a home visit, as the design lays it out: four steps with a
// stepper across the top — service, details, location, confirm.
//
// One step at a time is not decoration. The API wants a serviceId, a
// familyMemberId, an address and an ISO timestamp; a person has a
// nurse, a mother, a neighbourhood and "tomorrow morning". Asking one
// thing per screen is what turns the second into the first without
// presenting a wall of fields.

const STEPS = ['Huduma', 'Maelezo', 'Mahali', 'Thibitisha'];

// The three things the welcome card promises. Kept to what the business
// actually does rather than invented selling points.
const PROMISES = [
  { icon: 'shield-checkmark-outline', label: 'Huduma Salama' },
  { icon: 'time-outline', label: 'Wakati wako' },
  { icon: 'home-outline', label: 'Nyumbani kwako' },
];

const SORT_LABEL = { none: 'Vichujio', price: 'Bei', duration: 'Muda' };
const NEXT_SORT = { none: 'price', price: 'duration', duration: 'none' };


const WHEN_OPTIONS = [
  { label: 'Kesho asubuhi', hoursAhead: 24, hour: 9 },
  { label: 'Kesho jioni', hoursAhead: 24, hour: 16 },
  { label: 'Keshokutwa asubuhi', hoursAhead: 48, hour: 9 },
  { label: 'Keshokutwa jioni', hoursAhead: 48, hour: 16 },
];

function toScheduledAt({ hoursAhead, hour }) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  // Chosen in the user's own clock, because that is what "tomorrow
  // morning" means to them. The API stores the instant.
  date.setHours(hour, 0, 0, 0);
  return date;
}

const tzs = (amount) => `TZS ${Number(amount).toLocaleString('en-US')}`;

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

  const [service, setService] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [when, setWhen] = useState(WHEN_OPTIONS[0]);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [sort, setSort] = useState('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [serviceData, memberData] = await Promise.all([
          servicesApi.list(),
          familyMembers.list(),
        ]);
        setCatalogue(serviceData?.services ?? []);
        const list = memberData?.familyMembers ?? [];
        setMembers(list);
        if (list.length) setMemberId(list[0].id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await bookings.create({
        familyMemberId: memberId,
        serviceId: service.id,
        locationAddress: address.trim(),
        scheduledAt: toScheduledAt(when).toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
      // Back to the step most likely at fault, rather than stranding
      // them on a confirmation screen that will not confirm.
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  const member = members.find((m) => m.id === memberId);

  // Sorted, not filtered: nothing is ever hidden from the catalogue,
  // because a service somebody cannot see is a service they cannot buy.
  const sorted =
    sort === 'none'
      ? catalogue
      : [...catalogue].sort((a, b) =>
          sort === 'price'
            ? (a.basePriceTzs ?? 0) - (b.basePriceTzs ?? 0)
            : (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0)
        );

  const canContinue = [
    Boolean(service),
    Boolean(memberId && when),
    address.trim().length >= 3,
    true,
  ][step];

  if (done) return <Done router={router} />;

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

          {/* The trust badge the design puts here. It claims only what
              the business can stand behind — no rating, no number of
              reviews, because there is no rating in the database to
              back one up. */}
          <View style={styles.trust}>
            <Ionicons name="shield-checkmark" size={11} color={colors.success} />
            <Text style={styles.trustText}>
              {tx('Salama')}
              {'\n'}
              {tx('Haraka')}
            </Text>
          </View>
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
                <Text style={styles.stepHint}>{tx('Na muda gani unakufaa')}</Text>

                {members.map((m) => (
                  <Choice
                    key={m.id}
                    title={m.relationship === 'SELF' ? `${m.name} (wewe)` : m.name}
                    subtitle={m.relationship === 'SELF' ? null : m.relationship}
                    selected={m.id === memberId}
                    onPress={() => setMemberId(m.id)}
                  />
                ))}

                <Pressable onPress={() => router.push('/family')} style={styles.addLink}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.addLinkText}>{tx('Ongeza mtu mwingine wa familia')}</Text>
                </Pressable>

                <Text style={styles.label}>{tx('Lini')}</Text>
                {WHEN_OPTIONS.map((option) => (
                  <Choice
                    key={option.label}
                    title={tx(option.label)}
                    subtitle={toScheduledAt(option).toLocaleString('sw-TZ')}
                    selected={option.label === when.label}
                    onPress={() => setWhen(option)}
                  />
                ))}
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.stepTitle}>{tx('Muuguzi aje wapi')}</Text>
                <Text style={styles.stepHint}>{tx('Andika mahali pa kufikika kwa urahisi')}</Text>

                <Field
                  label={tx('Mahali')}
                  placeholder={tx('mfano: Kariakoo, karibu na soko')}
                  value={address}
                  onChangeText={setAddress}
                />
                <Field
                  label={tx('Maelezo (hiari)')}
                  placeholder={tx('Chochote muuguzi anapaswa kujua kabla hajafika')}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  style={styles.textarea}
                />
              </>
            ) : null}

            {step === 3 ? (
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
                      {service?.basePriceTzs ? (
                        <Text style={styles.summaryPrice}>{tx('Kuanzia')} {tzs(service.basePriceTzs)}</Text>
                      ) : null}
                    </View>
                  </View>

                  <Line icon="person-outline" label={tx('Mgonjwa')} value={member?.name} />
                  <Line
                    icon="calendar-outline"
                    label={tx('Tarehe na muda')}
                    value={`${toScheduledAt(when).toLocaleDateString('sw-TZ', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })} · saa ${toScheduledAt(when).toLocaleTimeString('sw-TZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
                  />
                  <Line icon="location-outline" label={tx('Mahali')} value={address.trim()} />
                  {notes.trim() ? (
                    <Line icon="document-text-outline" label={tx('Maelezo')} value={notes.trim()} />
                  ) : null}
                </Card>

                {/* The design puts the assigned nurse here, with a
                    photo and a rating. Nobody has been assigned at this
                    point — the office does that once the request
                    arrives — so this says what happens next instead of
                    showing a nurse who has not agreed to come. */}
                <Card style={styles.pending}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <Text style={styles.pendingText}>{tx('Muuguzi atapangiwa baada ya kutuma ombi. Utaona jina lake na hali ya ziara kwenye "Ziara".')}</Text>
                </Card>

                <View style={styles.statusCard}>
                  <View style={styles.statusIcon}>
                    <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.statusLabel}>{tx('Hali ya ombi')}</Text>
                    <Text style={styles.statusValue}>{tx('Tayari kutumwa')}</Text>
                  </View>
                </View>

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
          onPress={() => (step === 3 ? submit() : setStep(step + 1))}
          disabled={!canContinue || busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.next,
            (!canContinue || busy) && styles.nextDisabled,
            pressed && canContinue && styles.pressed,
          ]}
        >
          <Text style={styles.nextText}>
            {busy ? tx('Inatuma…') : step === 3 ? tx('Thibitisha ombi') : tx('Endelea')}
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
            <Text style={[styles.stepLabel, (done || current) && styles.stepLabelActive]}>
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
        {service.basePriceTzs ? (
          <Text style={[styles.rowPrice, { color: colour }]}>
            {tx('Kuanzia')} {tzs(service.basePriceTzs)}
          </Text>
        ) : null}
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

function Done({ router }) {
  return (
    <View style={styles.doneWrap}>
      <View style={styles.doneIcon}>
        <Ionicons name="checkmark" size={38} color={colors.onPrimary} />
      </View>
      <Text style={styles.doneTitle}>{tx('Ombi limepokelewa')}</Text>
      <Text style={styles.doneBody}>{tx('Tutakupangia muuguzi na utaona hali ya ombi lako ikibadilika kwenye "Ziara".')}</Text>
      <Pressable
        onPress={() => router.replace('/appointments')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.next, styles.doneButton, pressed && styles.pressed]}
      >
        <Text style={styles.nextText}>{tx('Nenda kwenye ziara zangu')}</Text>
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
  title: { fontSize: 15, fontFamily: font.bold, color: colors.text },
  subtitle: { ...type.tiny, fontSize: 10, color: colors.muted },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trustText: { fontSize: 9, lineHeight: 11, fontFamily: font.semibold, color: colors.success },

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
    fontSize: 9,
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
  promiseText: { fontSize: 9, fontFamily: font.semibold, color: colors.text },
  welcomeArt: { width: '38%' },
  welcomeImage: { width: '100%', height: '100%' },
  script: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.xs,
    fontSize: 11,
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
  filterText: { fontSize: 11, fontFamily: font.semibold, color: colors.muted },

  stepper: { flexDirection: 'row', marginTop: spacing.md },
  stepItem: { flex: 1, alignItems: 'center' },
  stepTop: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: colors.primary },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum: { fontSize: 12, fontFamily: font.bold, color: colors.subtle },
  stepNumActive: { color: colors.onPrimary },
  stepLabel: { fontSize: 11, color: colors.subtle, marginTop: 4 },
  stepLabelActive: { color: colors.primary, fontFamily: font.semibold },

  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  stepTitle: { fontSize: 17, fontFamily: font.bold, color: colors.text },
  stepHint: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  label: {
    fontSize: 14,
    fontFamily: font.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
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
  serviceName: { fontSize: 14, fontFamily: font.bold, color: colors.text },

  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPrice: { ...type.tiny, fontSize: 12, fontFamily: font.bold, marginTop: 2 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  duration: { fontSize: 10, color: colors.muted },
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
  summaryPrice: { ...type.tiny, fontFamily: font.bold, color: colors.primary, marginTop: 3 },

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
  choiceTitle: { fontSize: 15, fontFamily: font.semibold, color: colors.text },
  choiceTitleSelected: { color: colors.primary },

  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addLinkText: { color: colors.primary, fontFamily: font.semibold, fontSize: 14 },

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
  summaryTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },

  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  lineLabel: { fontSize: 12, color: colors.muted },
  lineValue: { fontSize: 14, color: colors.text, fontFamily: font.medium, marginTop: 1 },

  pending: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  pendingText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },

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
  nextText: { color: colors.onPrimary, fontSize: 15, fontFamily: font.bold },

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
  doneTitle: { fontSize: 21, fontFamily: font.bold, color: colors.text, marginBottom: spacing.xs },
  doneBody: {
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  doneButton: { flex: 0, alignSelf: 'stretch' },
});
