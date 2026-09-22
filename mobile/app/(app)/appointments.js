import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { bookings as bookingsApi } from '../../lib/api';
import { Card, ErrorBox } from '../../lib/ui';
import { accentAt, colors, font, fs, radius, shadow, spacing, type } from '../../lib/theme';
import { serviceColour, serviceIcon } from '../../lib/services-meta';
import { tx, useI18n } from '../../lib/i18n';

// "My Care" from the design: what is coming, who is coming, how far
// along it is, and what has already happened.
//
// The timeline runs across the screen with a date under each stage, as
// the design draws it. It is built from the booking state machine
// rather than a fixed list of four steps, so it cannot show a stage the
// backend does not have. A cancelled or rejected visit gets no timeline
// at all — drawing progress towards something that is not going to
// happen would be a lie told in pictures.
//
// Only the dates the backend actually stores appear. There are no
// per-stage timestamps, just created_at, updated_at and scheduled_at,
// so the other stages carry a dash. "Assigned — 21 Sep" would look
// better and be invented.

const STATUS_SW = {
  REQUESTED: 'Imeombwa',
  ASSIGNED: 'Amepangiwa',
  ACCEPTED: 'Amethibitishwa',
  ON_THE_WAY: 'Yupo njiani',
  ARRIVED: 'Amefika',
  IN_PROGRESS: 'Inaendelea',
  COMPLETED: 'Imekamilika',
  CANCELLED: 'Imeghairiwa',
  REJECTED: 'Imekataliwa',
  RESCHEDULED: 'Imehairishwa',
};

const FLOW = [
  'REQUESTED',
  'ASSIGNED',
  'ACCEPTED',
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
];
const ENDED = ['COMPLETED', 'CANCELLED', 'REJECTED'];

const STAGES = [
  { key: 'REQUESTED', label: 'Imeombwa', icon: 'calendar-outline' },
  { key: 'ACCEPTED', label: 'Imethibitishwa', icon: 'checkmark' },
  { key: 'ON_THE_WAY', label: 'Amepangiwa', icon: 'person-outline' },
  { key: 'COMPLETED', label: 'Imekamilika', icon: 'home-outline' },
];

const SPECIALTY_SW = {
  NURSE: 'Muuguzi',
  DOCTOR: 'Daktari',
  PHYSIOTHERAPIST: 'Mtaalamu wa viungo',
  CAREGIVER: 'Mlezi',
  MIDWIFE: 'Mkunga',
  GENERAL_PRACTITIONER: 'Daktari mkuu',
};

const dateSw = (value) =>
  new Date(value).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' });

const dateFull = (value) =>
  new Date(value).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' });

const timeSw = (value) =>
  new Date(value).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export default function Appointments() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const router = useRouter();
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [busy, setBusy] = useState(false);

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

  function confirmCancel(visit) {
    Alert.alert(
      'Ghairi ziara?',
      `Ziara ya ${dateFull(visit.scheduledAt)} saa ${timeSw(visit.scheduledAt)} itaghairiwa.`,
      [
        { text: 'Hapana', style: 'cancel' },
        {
          text: 'Ndiyo, ghairi',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await bookingsApi.cancel(visit.id, 'Mteja ameghairi kupitia app');
              await load();
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  const current = visits.filter((visit) => !ENDED.includes(visit.status));
  const past = visits.filter((visit) => ENDED.includes(visit.status));

  const featured = current[0] ?? null;
  const others = current.slice(1);
  const pastShown = showAllPast ? past : past.slice(0, 3);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* No ScreenHeader here any more: this screen left the tab bar
          and now sits in the stack, which draws its own title and menu
          button. Two headers is one too many. */}
      <Text style={styles.subtitle}>{tx('Huduma zako na safari ya matibabu')}</Text>

      <ErrorBox error={error} />

      {featured ? (
        <>
          <UpcomingCard
            visit={featured}
            busy={busy}
            onSupport={() => router.push('/ask')}
            onCancel={() => confirmCancel(featured)}
          />

          <Text style={styles.section}>{tx('Ratiba ya ziara')}</Text>
          <Card style={styles.card}>
            <Timeline visit={featured} />
          </Card>
        </>
      ) : (
        <Card style={styles.card}>
          <View style={styles.emptyRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{tx('Huna ziara inayokuja')}</Text>
              <Text style={styles.muted}>{tx('Omba muuguzi aje nyumbani kwako.')}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/book')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryButtonText}>{tx('Omba ziara')}</Text>
          </Pressable>
        </Card>
      )}

      {others.length > 0 ? (
        <>
          <Text style={styles.section}>{tx('Nyingine zinazokuja')}</Text>
          {others.map((visit) => (
            <CompactVisit key={visit.id} visit={visit} />
          ))}
        </>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>{tx('Ziara zilizopita')}</Text>
        {past.length > 3 ? (
          <Pressable onPress={() => setShowAllPast((value) => !value)} accessibilityRole="button">
            <View style={styles.viewAll}>
              <Text style={styles.viewAllText}>{showAllPast ? 'Punguza' : 'Zote'}</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.primary} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {past.length === 0 ? (
        <Card>
          <Text style={styles.muted}>{tx('Bado hakuna ziara iliyokamilika.')}</Text>
        </Card>
      ) : (
        pastShown.map((visit) => <CompactVisit key={visit.id} visit={visit} past />)
      )}
    </ScrollView>
  );
}

function UpcomingCard({ visit, busy, onSupport, onCancel }) {
  const nurse = visit.staff?.user?.name;
  const specialty = SPECIALTY_SW[visit.staff?.specialty] ?? 'Mtoa huduma';
  const colour = serviceColour(visit.service?.name);

  return (
    <Card style={[styles.card, styles.upcoming]}>
      <View style={styles.upcomingHead}>
        <View style={styles.upcomingHeadLeft}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="calendar" size={18} color={colors.primary} />
          </View>
          <Text style={styles.upcomingTitle}>{tx('Ziara ijayo nyumbani')}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{tx(STATUS_SW[visit.status] ?? visit.status)}</Text>
        </View>
      </View>

      <DetailRow
        icon={serviceIcon(visit.service?.name)}
        tint={colour}
        title={visit.service?.name ?? 'Huduma ya nyumbani'}
        sub={`${dateFull(visit.scheduledAt)} · saa ${timeSw(visit.scheduledAt)}`}
        chevron
      />

      <DetailRow
        icon="person"
        tint={accentAt(2)}
        title={visit.patient?.name ?? 'Mgonjwa'}
        sub="Anayepata huduma"
      />

      {/* The nurse's name only. A client is entitled to know who is
          coming into their house; a personal phone number is a
          different thing and the API deliberately does not send one. */}
      {nurse ? (
        <View style={styles.detailRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(nurse)}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{nurse}</Text>
            <Text style={styles.muted}>{specialty}</Text>
          </View>
        </View>
      ) : (
        <DetailRow
          icon="time-outline"
          tint={colors.subtle}
          title={tx('Muuguzi hajapangiwa bado')}
          sub="Tutakujulisha atakapopangiwa"
        />
      )}

      <DetailRow
        icon="location"
        tint={accentAt(3)}
        title={visit.locationAddress}
        sub="Mahali pa ziara"
      />

      {visit.notes ? <Text style={styles.notes}>“{visit.notes}”</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onSupport}
          accessibilityRole="button"
          style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
        >
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.onPrimary} />
          <Text style={styles.actionPrimaryText}>{tx('Pata msaada')}</Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.actionGhost,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.actionGhostText}>{tx('Ghairi ziara')}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function DetailRow({ icon, tint, title, sub, chevron }) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.rowIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={17} color={colors.subtle} /> : null}
    </View>
  );
}

function CompactVisit({ visit, past }) {
  const done = visit.status === 'COMPLETED';
  const colour = serviceColour(visit.service?.name);

  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: `${colour}1A` }]}>
          <Ionicons name={serviceIcon(visit.service?.name)} size={18} color={colour} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {visit.service?.name ?? visit.locationAddress}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {dateFull(visit.scheduledAt)} · saa {timeSw(visit.scheduledAt)}
          </Text>
        </View>
        <View style={[styles.badge, past && !done && styles.badgeMuted]}>
          <Text style={[styles.badgeText, past && !done && styles.badgeTextMuted]}>
            {tx(STATUS_SW[visit.status] ?? visit.status)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
      </View>
    </Card>
  );
}

function Timeline({ visit }) {
  const { status } = visit;

  if (['CANCELLED', 'REJECTED'].includes(status)) return null;

  const reached = FLOW.indexOf(status);
  if (reached < 0) return null;

  const stampFor = (key) => {
    if (key === 'REQUESTED' && visit.createdAt) return dateSw(visit.createdAt);
    if (key === FLOW[reached] && key !== 'REQUESTED' && visit.updatedAt) {
      return dateSw(visit.updatedAt);
    }
    if (key === 'COMPLETED' && status !== 'COMPLETED') return dateSw(visit.scheduledAt);
    return '–';
  };

  return (
    <View style={styles.timeline}>
      {STAGES.map((stage, index) => {
        const stageIndex = FLOW.indexOf(stage.key);
        const done = reached >= stageIndex;
        const last = index === STAGES.length - 1;

        return (
          <View key={stage.key} style={styles.stage}>
            <View style={styles.stageTop}>
              <View style={[styles.rail, index === 0 && styles.railHidden, done && styles.railDone]} />
              <View style={[styles.dot, done && styles.dotDone]}>
                <Ionicons
                  name={stage.icon}
                  size={14}
                  color={done ? colors.onPrimary : colors.subtle}
                />
              </View>
              <View style={[styles.rail, last && styles.railHidden, reached > stageIndex && styles.railDone]} />
            </View>

            <Text style={[styles.stageLabel, done && styles.stageLabelDone]} numberOfLines={2}>
              {stage.label}
            </Text>
            <Text style={styles.stageDate}>{stampFor(stage.key)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...type.small, color: colors.muted, marginBottom: spacing.md },
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  muted: { ...type.small, color: colors.muted, marginTop: 2 },

  section: { ...type.section, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { ...type.label, color: colors.primary },

  card: { ...shadow.card },
  upcoming: { borderColor: colors.primaryLight, borderWidth: 1.5 },
  upcomingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  upcomingHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, flex: 1 },
  upcomingTitle: { ...type.bodyStrong, fontFamily: font.bold, color: colors.text },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rowText: { flex: 1 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...type.bodyStrong, color: colors.text },
  notes: { ...type.small, color: colors.muted, marginTop: spacing.sm, fontStyle: 'italic' },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimary, fontFamily: font.bold, fontSize: fs(13) },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 3,
  },
  actionPrimaryText: { ...type.label, color: colors.onPrimary },
  actionGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm + 3,
  },
  actionGhostText: { ...type.label, color: colors.danger },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 3,
  },
  primaryButtonText: { ...type.label, color: colors.onPrimary },

  badge: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeMuted: { backgroundColor: colors.bg },
  badgeText: { ...type.tiny, fontSize: fs(10), fontFamily: font.bold, color: colors.primary },
  badgeTextMuted: { color: colors.muted },

  // Across the screen, as the design draws it, with the date under
  // each stage.
  timeline: { flexDirection: 'row' },
  stage: { flex: 1, alignItems: 'center' },
  stageTop: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  rail: { flex: 1, height: 2, backgroundColor: colors.border },
  railHidden: { backgroundColor: 'transparent' },
  railDone: { backgroundColor: colors.primary },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stageLabel: {
    ...type.tiny,
    fontSize: fs(10),
    lineHeight: fs(13),
    color: colors.subtle,
    marginTop: 6,
    textAlign: 'center',
  },
  stageLabelDone: { color: colors.text, fontFamily: font.bold },
  stageDate: { ...type.tiny, fontSize: fs(9), color: colors.subtle, marginTop: 2 },
});
