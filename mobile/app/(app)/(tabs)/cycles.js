import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { content as contentApi, cycles as cyclesApi, familyMembers } from '../../../lib/api';
import { Card, ErrorBox, ScreenHeader } from '../../../lib/ui';
import { colors, font, radius, shadow, spacing } from '../../../lib/theme';
import { tx, useI18n } from '../../../lib/i18n';

// Orbit — period tracking, on a calendar.
//
// The API is careful never to claim certainty, and this screen has to be
// equally careful not to undo that. A calendar is the easiest place in
// the world to turn an estimate into a fact: a day filled in solid
// looks like something that happened. So logged days and predicted days
// are drawn differently and the key says which is which — filled for
// what was recorded, outlined for what is only arithmetic.
//
// There is no fertile window here, and that is deliberate rather than
// missing. The backend leaves those columns unused on purpose: shown a
// fertile window, some people will use it as birth control, and
// calendar prediction is nowhere near reliable enough to carry that.
// Adding it to the screen would walk around a decision the API made on
// purpose.

const CONFIDENCE_SW = {
  LOW: 'Uhakika mdogo',
  MEDIUM: 'Uhakika wa kadiri',
  HIGH: 'Uhakika mkubwa',
};

const REGULARITY_SW = {
  REGULAR: 'Unakaribiana',
  SOMEWHAT_IRREGULAR: 'Unatofautiana kidogo',
  IRREGULAR: 'Unatofautiana sana',
  UNKNOWN: 'Bado hakuna cha kusema',
};

const FLOW_SW = { LIGHT: 'Kidogo', MEDIUM: 'Wastani', HEAVY: 'Nyingi' };

const SYMPTOMS = [
  'maumivu ya tumbo',
  'maumivu ya mgongo',
  'kichwa',
  'uchovu',
  'kuvimbiwa',
  'matiti kuuma',
  'kichefuchefu',
];

const MOODS = ['shwari', 'hamaki', 'huzuni', 'wasiwasi', 'nguvu'];

const MONTHS_SW = [
  'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
  'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba',
];
const WEEKDAYS_SW = ['J2', 'J3', 'J4', 'J5', 'Ij', 'J7', 'J1'];

const DAY_MS = 24 * 60 * 60 * 1000;

// Dates are handled as YYYY-MM-DD strings in UTC throughout, the same
// way the API does, so nothing shifts by a day depending on the phone's
// timezone.
const iso = (utcMs) => new Date(utcMs).toISOString().slice(0, 10);
const parse = (dateOnly) => {
  const [y, m, d] = String(dateOnly).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const todayIso = () => iso(Date.now());

export default function Cycles() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const router = useRouter();
  const [memberId, setMemberId] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [insights, setInsights] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const member = await familyMembers.self();
      if (!member) return;
      setMemberId(member.id);

      const [insightData, listData] = await Promise.all([
        cyclesApi.insights(member.id),
        cyclesApi.list(member.id),
      ]);
      setInsights(insightData);
      setHistory(listData?.cycles ?? []);

      // Education is separate from the cycle data and must never block
      // it: a person opening Orbit to log a period should still see
      // their calendar if the library is empty or unreachable.
      try {
        const library = await contentApi.list('orbit');
        setLessons(library?.items ?? library?.content ?? []);
      } catch {
        setLessons([]);
      }
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

  async function saveCycle(payload) {
    setError(null);
    setBusy(true);
    try {
      await cyclesApi.log(memberId, payload);
      setLogOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Every day that was actually bled on, from start to end. A cycle with
  // no end date marks its start day only — the app does not get to
  // decide how long it lasted.
  const loggedDays = useMemo(() => {
    const days = new Map();
    history.forEach((cycle) => {
      const start = parse(cycle.cycleStartDate);
      const end = cycle.cycleEndDate ? parse(cycle.cycleEndDate) : start;
      for (let day = start; day <= end; day += DAY_MS) {
        days.set(iso(day), { flow: cycle.flow, isStart: day === start });
      }
    });
    return days;
  }, [history]);

  const predictedStart = insights?.prediction?.nextStart ?? null;

  // The estimate is drawn across the average period length when one is
  // known, so it reads as a window rather than a single certain day.
  const predictedDays = useMemo(() => {
    if (!predictedStart) return new Set();
    const span = Math.max(1, Math.round(insights?.averagePeriodLength ?? 1));
    const start = parse(predictedStart);
    const out = new Set();
    for (let i = 0; i < span; i += 1) out.add(iso(start + i * DAY_MS));
    return out;
  }, [predictedStart, insights]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Orbit is a tab now, so it carries its own header: the stack
          header that used to sit above it is gone. */}
      <ScreenHeader title="Orbit" subtitle={tx('Mzunguko wako na elimu ya afya ya uzazi')} />

      <ErrorBox error={error} />

      <CountdownCard insights={insights} />

      <MonthCalendar
        offset={monthOffset}
        onOffset={setMonthOffset}
        loggedDays={loggedDays}
        predictedDays={predictedDays}
      />

      <Legend />

      <Pressable
        onPress={() => setLogOpen(true)}
        disabled={!memberId}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed, !memberId && styles.disabled]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.logButton}
        >
          <Ionicons name="add-circle-outline" size={19} color={colors.onPrimary} />
          <Text style={styles.logButtonText}>{tx('Andika hedhi')}</Text>
        </LinearGradient>
      </Pressable>

      {insights ? <StatsGrid insights={insights} /> : null}

      {insights?.notes?.length ? (
        <Card style={styles.noteCard}>
          {insights.notes.map((note) => (
            <View key={note} style={styles.noteRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Text style={styles.section}>{tx('Elimu ya afya ya uzazi')}</Text>
      {lessons.length === 0 ? (
        <Card>
          <Text style={styles.muted}>{tx('Makala za uzazi wa mpango na afya ya ngono zinakuja hivi karibuni.')}</Text>
        </Card>
      ) : (
        lessons.map((lesson) => (
          <Pressable
            key={lesson.slug}
            onPress={() => router.push({ pathname: '/article', params: { slug: lesson.slug } })}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Card>
              <View style={styles.lessonRow}>
                <View style={styles.lessonIcon}>
                  <Ionicons name="book-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.historyText}>
                  <Text style={styles.historyTitle}>{lesson.title}</Text>
                  {lesson.tags?.length ? (
                    <Text style={styles.muted} numberOfLines={1}>
                      {lesson.tags.filter((tag) => tag !== 'orbit').join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <Text style={styles.section}>{tx('Kumbukumbu')}</Text>
      {history.length === 0 ? (
        <Card>
          <Text style={styles.muted}>{tx('Bado hujaandika chochote.')}</Text>
        </Card>
      ) : (
        history.slice(0, 12).map((cycle) => <HistoryRow key={cycle.id} cycle={cycle} />)
      )}

      <LogSheet
        open={logOpen}
        busy={busy}
        onClose={() => setLogOpen(false)}
        onSave={saveCycle}
      />
    </ScrollView>
  );
}

function CountdownCard({ insights }) {
  const prediction = insights?.prediction;

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.countdown}
    >
      <Text style={styles.countdownLabel}>ORBIT</Text>

      {prediction ? (
        <>
          <Text style={styles.countdownBig}>
            {prediction.daysUntil > 0
              ? `Siku ${prediction.daysUntil}`
              : prediction.daysUntil === 0
                ? 'Leo'
                : `Imechelewa siku ${Math.abs(prediction.daysUntil)}`}
          </Text>
          <Text style={styles.countdownText}>
            {prediction.daysUntil >= 0 ? 'hadi hedhi inayokadiriwa' : 'kuliko makadirio'}
          </Text>

          <View style={styles.countdownMeta}>
            <View style={styles.chip}>
              <Ionicons name="calendar-outline" size={13} color={colors.onPrimary} />
              <Text style={styles.chipText}>{formatDate(prediction.nextStart)}</Text>
            </View>
            <View style={styles.chip}>
              <Ionicons name="analytics-outline" size={13} color={colors.onPrimary} />
              <Text style={styles.chipText}>{CONFIDENCE_SW[prediction.confidence]}</Text>
            </View>
          </View>

          {/* Said on the card itself, not only in a note further down.
              A big number with a date under it is exactly the thing
              people remember, so the caveat travels with it. */}
          <Text style={styles.countdownCaveat}>
            Makadirio kutokana na mizunguko {prediction.basedOnIntervals} uliyoandika — si uhakika
            wa kitabibu.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.countdownBig}>{tx('Bado')}</Text>
          <Text style={styles.countdownText}>{tx('Orbit inahitaji angalau mizunguko miwili kabla ya kukadiria ujao.')}</Text>
        </>
      )}
    </LinearGradient>
  );
}

function MonthCalendar({ offset, onOffset, loggedDays, predictedDays }) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();

  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = todayIso();

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(iso(Date.UTC(year, month, day)));

  return (
    <Card style={styles.calendar}>
      <View style={styles.calendarHead}>
        <Pressable
          onPress={() => onOffset(offset - 1)}
          accessibilityRole="button"
          accessibilityLabel={tx('Mwezi uliopita')}
          hitSlop={10}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>

        <Pressable onPress={() => onOffset(0)} accessibilityRole="button">
          <Text style={styles.calendarTitle}>
            {MONTHS_SW[month]} {year}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onOffset(offset + 1)}
          accessibilityRole="button"
          accessibilityLabel={tx('Mwezi ujao')}
          hitSlop={10}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS_SW.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={styles.cell} />;

          const logged = loggedDays.get(date);
          const predicted = predictedDays.has(date);
          const isToday = date === today;

          return (
            <View key={date} style={styles.cell}>
              <View
                style={[
                  styles.day,
                  logged && styles.dayLogged,
                  !logged && predicted && styles.dayPredicted,
                  isToday && styles.dayToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    logged && styles.dayTextLogged,
                    !logged && predicted && styles.dayTextPredicted,
                  ]}
                >
                  {Number(date.slice(8, 10))}
                </Text>
              </View>
              {logged?.isStart ? <View style={styles.startDot} /> : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, styles.dayLogged]} />
        <Text style={styles.legendText}>{tx('Uliyoandika')}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, styles.dayPredicted]} />
        <Text style={styles.legendText}>{tx('Makadirio')}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendSwatch, styles.dayToday]} />
        <Text style={styles.legendText}>{tx('Leo')}</Text>
      </View>
    </View>
  );
}

function StatsGrid({ insights }) {
  const stats = [
    {
      icon: 'repeat-outline',
      label: 'Wastani wa mzunguko',
      value: insights.averageCycleLength ? `siku ${insights.averageCycleLength}` : '—',
    },
    {
      icon: 'water-outline',
      label: 'Wastani wa hedhi',
      value: insights.averagePeriodLength ? `siku ${insights.averagePeriodLength}` : '—',
    },
    {
      icon: 'pulse-outline',
      label: 'Mwenendo',
      value: REGULARITY_SW[insights.regularity] ?? '—',
    },
    {
      icon: 'list-outline',
      label: 'Umeandika',
      value: `mizunguko ${insights.cyclesLogged}`,
    },
  ];

  return (
    <View style={styles.stats}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <Ionicons name={stat.icon} size={17} color={colors.primary} />
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

function HistoryRow({ cycle }) {
  const length = cycle.cycleEndDate
    ? Math.round((parse(cycle.cycleEndDate) - parse(cycle.cycleStartDate)) / DAY_MS) + 1
    : null;

  return (
    <Card>
      <View style={styles.historyRow}>
        <View style={styles.historyIcon}>
          <Ionicons name="water" size={17} color={colors.primary} />
        </View>
        <View style={styles.historyText}>
          <Text style={styles.historyTitle}>{formatDate(cycle.cycleStartDate)}</Text>
          <Text style={styles.muted}>
            {length ? `siku ${length}` : 'haijafungwa'}
            {cycle.flow ? ` · ${FLOW_SW[cycle.flow]}` : ''}
            {cycle.mood ? ` · ${cycle.mood}` : ''}
          </Text>
          {cycle.symptoms?.length ? (
            <View style={styles.tagRow}>
              {cycle.symptoms.map((symptom) => (
                <View key={symptom} style={styles.tag}>
                  <Text style={styles.tagText}>{symptom}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function LogSheet({ open, busy, onClose, onSave }) {
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState('');
  const [flow, setFlow] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [mood, setMood] = useState(null);
  const [notes, setNotes] = useState('');

  function toggleSymptom(symptom) {
    setSymptoms((list) =>
      list.includes(symptom) ? list.filter((item) => item !== symptom) : [...list, symptom]
    );
  }

  function submit() {
    onSave({
      cycleStartDate: start,
      cycleEndDate: end || undefined,
      flow: flow || undefined,
      symptoms: symptoms.length ? symptoms : undefined,
      mood: mood || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{tx('Andika hedhi')}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetLabel}>{tx('Ilianza lini')}</Text>
            <TextInput
              style={styles.sheetInput}
              value={start}
              onChangeText={setStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtle}
              autoCapitalize="none"
            />

            <Text style={styles.sheetLabel}>{tx('Iliisha lini (si lazima)')}</Text>
            <TextInput
              style={styles.sheetInput}
              value={end}
              onChangeText={setEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtle}
              autoCapitalize="none"
            />

            <Text style={styles.sheetLabel}>{tx('Kiasi')}</Text>
            <View style={styles.chipRow}>
              {Object.entries(FLOW_SW).map(([key, label]) => (
                <Choice
                  key={key}
                  label={label}
                  on={flow === key}
                  onPress={() => setFlow(flow === key ? null : key)}
                />
              ))}
            </View>

            <Text style={styles.sheetLabel}>{tx('Dalili')}</Text>
            <View style={styles.chipRow}>
              {SYMPTOMS.map((symptom) => (
                <Choice
                  key={symptom}
                  label={symptom}
                  on={symptoms.includes(symptom)}
                  onPress={() => toggleSymptom(symptom)}
                />
              ))}
            </View>

            <Text style={styles.sheetLabel}>{tx('Hisia')}</Text>
            <View style={styles.chipRow}>
              {MOODS.map((item) => (
                <Choice
                  key={item}
                  label={item}
                  on={mood === item}
                  onPress={() => setMood(mood === item ? null : item)}
                />
              ))}
            </View>

            <Text style={styles.sheetLabel}>{tx('Maelezo (si lazima)')}</Text>
            <TextInput
              style={[styles.sheetInput, styles.sheetArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={tx('Chochote unachotaka kukumbuka')}
              placeholderTextColor={colors.subtle}
              multiline
            />

            <Pressable
              onPress={submit}
              disabled={busy || !start}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.pressed, (busy || !start) && styles.disabled]}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sheetSave}
              >
                <Text style={styles.logButtonText}>{busy ? 'Inahifadhi…' : 'Hifadhi'}</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Choice({ label, on, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
    >
      <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

function formatDate(dateOnly) {
  const ms = parse(dateOnly);
  const date = new Date(ms);
  return `${date.getUTCDate()} ${MONTHS_SW[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}`;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  section: {
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  countdown: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  countdownLabel: {
    color: colors.onPrimary,
    fontSize: 11,
    fontFamily: font.extrabold,
    letterSpacing: 2,
    opacity: 0.8,
  },
  countdownBig: { color: colors.onPrimary, fontSize: 34, fontFamily: font.extrabold, marginTop: spacing.xs },
  countdownText: { color: colors.onPrimary, fontSize: 14, opacity: 0.9 },
  countdownMeta: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipText: { color: colors.onPrimary, fontSize: 12, fontFamily: font.semibold },
  countdownCaveat: {
    color: colors.onPrimary,
    fontSize: 11,
    opacity: 0.85,
    marginTop: spacing.sm,
    lineHeight: 16,
  },

  calendar: { ...shadow.card },
  calendarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  arrow: { padding: 4 },
  calendarTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.subtle,
    marginBottom: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLogged: { backgroundColor: '#EC4899' },
  // Outlined, never filled: this day is arithmetic, not a record.
  dayPredicted: { borderWidth: 1.5, borderColor: '#EC4899', borderStyle: 'dashed' },
  dayToday: { borderWidth: 2, borderColor: colors.primary },
  dayText: { fontSize: 13, color: colors.text },
  dayTextLogged: { color: '#FFFFFF', fontFamily: font.bold },
  dayTextPredicted: { color: '#EC4899', fontFamily: font.semibold },
  startDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EC4899', marginTop: 2 },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 15, height: 15, borderRadius: 8 },
  legendText: { fontSize: 11, color: colors.muted },

  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  logButtonText: { color: colors.onPrimary, fontSize: 15, fontFamily: font.bold },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  statValue: { fontSize: 15, fontFamily: font.bold, color: colors.text, marginTop: 4 },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 1 },

  noteCard: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight, marginTop: spacing.md },
  noteRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', marginBottom: 4 },
  noteText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },

  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lessonIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyText: { flex: 1 },
  historyTitle: { fontSize: 15, fontFamily: font.semibold, color: colors.text },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, color: colors.muted },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 18, fontFamily: font.extrabold, color: colors.text },
  sheetLabel: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  sheetInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  sheetArea: { minHeight: 76, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
  },
  choiceOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  choiceText: { fontSize: 12, color: colors.muted },
  choiceTextOn: { color: colors.primary, fontFamily: font.bold },
  sheetSave: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
});
