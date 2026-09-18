import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { bookings as bookingsApi } from '../../../lib/api';
import { Card, ErrorBox } from '../../../lib/ui';
import { colors, radius, shadow, spacing } from '../../../lib/theme';

// "My Care" from the design: what is coming, who is coming, how far
// along it is, and what has already happened.
//
// The timeline is drawn from the booking state machine rather than a
// fixed list of four steps, so it cannot claim a stage the backend does
// not actually have. A cancelled or rejected visit gets no timeline at
// all — showing progress towards something that is not going to happen
// would be a lie told in pictures.
//
// The design dates every timeline stage. The backend stores no
// per-stage timestamps, only created_at, updated_at and scheduled_at,
// so a date appears where one is real and nowhere else. Inventing
// "Assigned — 21 Sep" would look better and be false.

const STATUS_SW = {
  REQUESTED: 'Imeombwa',
  ASSIGNED: 'Amepangiwa',
  ACCEPTED: 'Amekubali',
  ON_THE_WAY: 'Yupo njiani',
  ARRIVED: 'Amefika',
  IN_PROGRESS: 'Inaendelea',
  COMPLETED: 'Imekamilika',
  CANCELLED: 'Imeghairiwa',
  REJECTED: 'Imekataliwa',
  RESCHEDULED: 'Imehairishwa',
};

// The path a visit actually walks, in order.
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
  { key: 'REQUESTED', label: 'Ombi limetumwa', note: 'Umeomba ziara' },
  { key: 'ASSIGNED', label: 'Muuguzi amepangiwa', note: 'Tumempangia muuguzi' },
  { key: 'ON_THE_WAY', label: 'Yupo njiani', note: 'Anakuja kwako' },
  { key: 'COMPLETED', label: 'Ziara imekamilika', note: 'Huduma imetolewa' },
];

const SPECIALTY_SW = {
  NURSE: 'Muuguzi',
  DOCTOR: 'Daktari',
  PHYSIOTHERAPIST: 'Mtaalamu wa viungo',
  CAREGIVER: 'Mlezi',
  MIDWIFE: 'Mkunga',
};

const dateSw = (value) =>
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
      `Ziara ya ${dateSw(visit.scheduledAt)} saa ${timeSw(visit.scheduledAt)} itaghairiwa.`,
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
      <Text style={styles.title}>Ziara zangu</Text>
      <Text style={styles.subtitle}>Huduma zako na safari ya matibabu</Text>

      <ErrorBox error={error} />

      {featured ? (
        <>
          <FeaturedVisit
            visit={featured}
            busy={busy}
            onSupport={() => router.push('/ask')}
            onCancel={() => confirmCancel(featured)}
          />

          <Text style={styles.section}>Ratiba ya ziara</Text>
          <Card style={styles.card}>
            <Timeline visit={featured} />
          </Card>
        </>
      ) : (
        <Card style={styles.card}>
          <View style={styles.emptyRow}>
            <View style={styles.icon}>
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.cardTitle}>Huna ziara inayokuja</Text>
              <Text style={styles.muted}>Omba muuguzi aje nyumbani kwako.</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/book')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryButtonText}>Omba ziara</Text>
          </Pressable>
        </Card>
      )}

      {others.length > 0 ? (
        <>
          <Text style={styles.section}>Nyingine zinazokuja</Text>
          {others.map((visit) => (
            <CompactVisit key={visit.id} visit={visit} />
          ))}
        </>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Ziara zilizopita</Text>
        {past.length > 3 ? (
          <Pressable onPress={() => setShowAllPast((value) => !value)} accessibilityRole="button">
            <Text style={styles.link}>{showAllPast ? 'Punguza' : `Zote (${past.length}) →`}</Text>
          </Pressable>
        ) : null}
      </View>

      {past.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Bado hakuna ziara iliyokamilika.</Text>
        </Card>
      ) : (
        pastShown.map((visit) => <CompactVisit key={visit.id} visit={visit} past />)
      )}
    </ScrollView>
  );
}

function FeaturedVisit({ visit, busy, onSupport, onCancel }) {
  const nurse = visit.staff?.user?.name;
  const specialty = SPECIALTY_SW[visit.staff?.specialty] ?? 'Mtoa huduma';

  return (
    <Card style={[styles.card, styles.featured]}>
      <View style={styles.featuredHead}>
        <Text style={styles.featuredLabel}>Ziara ijayo nyumbani</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{STATUS_SW[visit.status] ?? visit.status}</Text>
        </View>
      </View>

      <DetailRow
        icon="medkit"
        tint="#3B82F6"
        title={visit.service?.name ?? 'Huduma ya nyumbani'}
        sub={`${dateSw(visit.scheduledAt)} · saa ${timeSw(visit.scheduledAt)}`}
      />

      <DetailRow
        icon="person"
        tint="#0E9B77"
        title={visit.patient?.name ?? 'Mgonjwa'}
        sub="Anayepata huduma"
      />

      {/* The nurse's name only. A client is entitled to know who is
          coming into their house; a personal phone number is a
          different thing, and the API deliberately does not send one. */}
      {nurse ? (
        <View style={styles.detailRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(nurse)}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.detailTitle}>{nurse}</Text>
            <Text style={styles.muted}>{specialty}</Text>
          </View>
        </View>
      ) : (
        <DetailRow
          icon="time-outline"
          tint={colors.subtle}
          title="Muuguzi hajapangiwa bado"
          sub="Tutakujulisha atakapopangiwa"
        />
      )}

      <DetailRow
        icon="location"
        tint="#F59E0B"
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
          <Ionicons name="chatbubble-ellipses" size={17} color={colors.onPrimary} />
          <Text style={styles.actionPrimaryText}>Pata msaada</Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.actionGhost, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Ionicons name="close-circle-outline" size={17} color={colors.danger} />
          <Text style={styles.actionGhostText}>Ghairi ziara</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function DetailRow({ icon, tint, title, sub }) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.detailTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
    </View>
  );
}

function CompactVisit({ visit, past }) {
  const done = visit.status === 'COMPLETED';
  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, past && styles.iconMuted]}>
          <Ionicons
            name={past ? (done ? 'checkmark' : 'close') : 'medkit'}
            size={18}
            color={past && !done ? colors.muted : colors.primary}
          />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {visit.service?.name ?? visit.locationAddress}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {dateSw(visit.scheduledAt)}
            {visit.staff?.user?.name ? ` · ${visit.staff.user.name}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, past && !done && styles.badgeMuted]}>
          <Text style={[styles.badgeText, past && !done && styles.badgeTextMuted]}>
            {STATUS_SW[visit.status] ?? visit.status}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function Timeline({ visit }) {
  const { status } = visit;

  // Nothing to show progress towards once a visit has been called off.
  if (['CANCELLED', 'REJECTED'].includes(status)) return null;

  const reached = FLOW.indexOf(status);
  if (reached < 0) return null;

  // Only the dates the backend genuinely knows.
  const stampFor = (key) => {
    if (key === 'REQUESTED' && visit.createdAt) return dateSw(visit.createdAt);
    if (key === FLOW[reached] && visit.updatedAt && key !== 'REQUESTED') {
      return dateSw(visit.updatedAt);
    }
    if (key === 'COMPLETED' && status !== 'COMPLETED') return dateSw(visit.scheduledAt);
    return null;
  };

  // The stage the visit is standing on: the last one it has reached.
  const activeIndex = STAGES.reduce(
    (last, stage, index) => (reached >= FLOW.indexOf(stage.key) ? index : last),
    0
  );

  return (
    <View>
      {STAGES.map((stage, index) => {
        const done = reached >= FLOW.indexOf(stage.key);
        const active = index === activeIndex;
        const stamp = stampFor(stage.key);
        const last = index === STAGES.length - 1;

        return (
          <View key={stage.key} style={styles.stageRow}>
            <View style={styles.stageRail}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                {done ? <Ionicons name="checkmark" size={12} color={colors.onPrimary} /> : null}
              </View>
              {!last ? <View style={[styles.rail, done && styles.railDone]} /> : null}
            </View>

            <View style={[styles.stageText, last && styles.stageTextLast]}>
              <Text style={[styles.stageLabel, done && styles.stageLabelDone]}>{stage.label}</Text>
              <Text style={styles.muted}>{stamp ? `${stage.note} · ${stamp}` : stage.note}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },

  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  card: { ...shadow.card },
  featured: { borderColor: colors.primaryLight, borderWidth: 1.5 },
  featuredHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  featuredLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rowText: { flex: 1 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMuted: { backgroundColor: colors.bg },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  notes: {
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.sm,
    lineHeight: 19,
    fontStyle: 'italic',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimary, fontWeight: '800', fontSize: 14 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  actionPrimaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  actionGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm + 2,
  },
  actionGhostText: { color: colors.danger, fontWeight: '700', fontSize: 14 },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  primaryButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },

  badge: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeMuted: { backgroundColor: colors.bg },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  badgeTextMuted: { color: colors.muted },

  stageRow: { flexDirection: 'row', gap: spacing.sm },
  stageRail: { alignItems: 'center', width: 22 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primary },
  dotActive: { borderWidth: 3, borderColor: colors.primaryLight },
  rail: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  railDone: { backgroundColor: colors.primary },
  stageText: { flex: 1, paddingBottom: spacing.md },
  stageTextLast: { paddingBottom: 0 },
  stageLabel: { fontSize: 14, fontWeight: '600', color: colors.subtle },
  stageLabelDone: { color: colors.text, fontWeight: '700' },
});
