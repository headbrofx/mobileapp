import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  content as contentApi,
  cycles as cyclesApi,
  familyMembers,
  orbit as orbitApi,
} from '../../../lib/api';
import { ErrorBox, GenderChips, MenuButton } from '../../../lib/ui';
import { showsOrbit, useSession } from '../../../lib/session';
import { tx, useI18n } from '../../../lib/i18n';
import {
  CycleRing,
  NotYet,
  OrbitCard,
  SectionTitle,
  StatusPill,
  orbit,
} from '../../../lib/orbit-ui';
import { font, fs, radius, scale, spacing, type } from '../../../lib/theme';

// Orbit — the women's health module's home.
//
// The order of this screen is the product's argument: where you are in
// your cycle, then the one thing Orbit has actually noticed, then the
// twenty-second check-in that earns the next observation, then what the
// recorded days add up to, then something to read, then a person to
// talk to. Track, understand, monitor, learn, act.
//
// Two rules run through all of it.
//
// Nothing is asserted that the row count does not support. Every card
// reads a status from the server — NO_DATA, INSUFFICIENT_DATA, STEADY
// or OBSERVED — and renders that status rather than rendering an empty
// object as though it were a finding. A blank card looks unfinished,
// and that pressure is exactly what turns four data points into "your
// hormones are unbalanced", so the not-yet states are designed as
// carefully as the full ones.
//
// And nothing here diagnoses. Orbit can see what somebody typed; it
// cannot see them. So it counts, it compares, and when something is
// worth a professional's eye it says so and offers the nurse.

const PHASE_LABEL = {
  MENSTRUAL: 'Hedhi',
  FOLLICULAR: 'Baada ya hedhi',
  OVULATORY: 'Karibu na yai',
  LUTEAL: 'Kabla ya hedhi',
};

const REGULARITY_LABEL = {
  REGULAR: 'Thabiti',
  SOMEWHAT_REGULAR: 'Wastani',
  IRREGULAR: 'Inatofautiana',
  UNKNOWN: '—',
};

const FIELD_LABEL = {
  energy: 'Nguvu',
  mood: 'Hisia',
  sleep: 'Usingizi',
  appetite: 'Hamu ya kula',
  pain: 'Maumivu',
};

const SNAPSHOT_ROWS = [
  { key: 'cycle', label: 'Mzunguko' },
  { key: 'energy', label: 'Nguvu' },
  { key: 'mood', label: 'Hisia' },
  { key: 'sleep', label: 'Usingizi' },
  { key: 'symptoms', label: 'Dalili' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Named from the day count alone, and only when a cycle length is
// known. These are the conventional windows — not a measurement of
// anything. Orbit cannot measure a hormone and must not imply it can.
function phaseFor(day, length) {
  if (!day || !length) return null;
  if (day <= 5) return 'MENSTRUAL';
  const ovulation = Math.round(length - 14);
  if (day < ovulation - 1) return 'FOLLICULAR';
  if (day <= ovulation + 1) return 'OVULATORY';
  return 'LUTEAL';
}

function dayOfCycle(lastStart) {
  if (!lastStart) return null;
  const [y, m, d] = String(lastStart).split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const t = new Date();
  const now = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const diff = Math.round((now - start) / DAY_MS) + 1;
  return diff > 0 ? diff : null;
}

// Shown once, to anyone whose gender was never recorded — which is
// everybody who registered before the sign-up form began asking.
//
// It asks the real question with the real three answers, rather than
// "is this for you?" with a yes and a no. A yes/no would have to write
// a gender it never actually asked for, and that value is used by more
// than this screen.
function AskGender({ onPick }) {
  const [saving, setSaving] = useState(false);

  return (
    <OrbitCard>
      <SectionTitle title={tx('Kabla hujaanza')} />
      <Text style={styles.askBody}>
        {tx('Orbit ni sehemu ya afya ya mwanamke. Tuambie jinsia yako ili tukuonyeshe sehemu inayokuhusu.')}
      </Text>
      <View style={styles.askChips}>
        <GenderChips
          value={null}
          clearable={false}
          onChange={async (gender) => {
            if (!gender || saving) return;
            setSaving(true);
            try {
              await onPick(gender);
            } finally {
              setSaving(false);
            }
          }}
        />
      </View>
      <Text style={styles.askFoot}>
        {tx('Unaweza kuibadilisha wakati wowote kwenye wasifu wako.')}
      </Text>
    </OrbitCard>
  );
}

// Reached only by someone who had the address but not the module —
// a deep link, or a tab that was open when the answer changed.
//
// It says what this is and points at the way back. It does not say
// "denied": nothing here was taken from them, and the profile is one
// tap away if the answer on file is simply wrong.
function NotForYou({ onLeave }) {
  return (
    <View style={[styles.screen, styles.notForYou]}>
      <Ionicons name="flower-outline" size={40} color={orbit.plum} />
      <Text style={styles.notForYouTitle}>{tx('Orbit ni kwa afya ya mwanamke')}</Text>
      <Text style={styles.notForYouBody}>
        {tx('Sehemu hii haipo kwenye akaunti yako. Kama jinsia iliyohifadhiwa si sahihi, ibadilishe kwenye wasifu wako.')}
      </Text>
      <Pressable onPress={onLeave} style={styles.notForYouButton}>
        <Text style={styles.notForYouButtonText}>{tx('Rudi mwanzo')}</Text>
      </Pressable>
    </View>
  );
}

export default function OrbitHome() {
  useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, self, refresh } = useSession();

  const [insights, setInsights] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [insight, setInsight] = useState(null);
  const [streak, setStreak] = useState(null);
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const members = await familyMembers.list();
      const list = members?.familyMembers ?? [];
      const self = list.find((m) => m.relationship === 'SELF') ?? list[0];
      if (!self) return;

      // All at once: a dashboard that paints in five steps reads as
      // broken even when every step is fast.
      const [cycleData, patternData, insightData, todayData] = await Promise.all([
        cyclesApi.insights(self.id),
        orbitApi.patterns(self.id),
        orbitApi.insight(self.id),
        orbitApi.today(self.id),
      ]);

      setInsights(cycleData?.insights ?? null);
      setPatterns(patternData?.patterns ?? null);
      setInsight(insightData?.insight ?? null);
      setStreak(todayData?.streak ?? null);
    } catch (err) {
      setError(err.message);
    }

    // The library is a nice-to-have here. If it fails the cycle card
    // should still be on screen.
    try {
      const library = await contentApi.list('orbit');
      setArticles((library?.content ?? []).slice(0, 3));
    } catch {
      setArticles([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const day = dayOfCycle(insights?.lastCycleStart);
  const length = insights?.averageCycleLength ? Math.round(insights.averageCycleLength) : null;
  const phase = phaseFor(day, length);
  const firstName = user?.name?.split(' ')[0];

  // The tab and the menu entry are already gone for anyone Orbit is
  // not for. This is the third door: a deep link, a bookmarked URL on
  // web, or a back-button return to a screen that was open when the
  // answer changed. None of those pass through a navigator that could
  // have hidden it.
  if (!showsOrbit(self)) {
    return <NotForYou onLeave={() => router.replace('/home')} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xs }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={orbit.plum}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.header}>
          <MenuButton tint={orbit.ink} />
          <View style={styles.headerText}>
            <Text style={styles.wordmark}>ORBIT</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {firstName ? `${tx('Habari')}, ${firstName}` : tx('Habari')}
            </Text>
          </View>
          {/* Said on the screen, not buried in a policy page. This is
              the part of the app somebody may open in public. */}
          <View style={styles.privacy}>
            <Ionicons name="lock-closed" size={11} color={orbit.plum} />
            <Text style={styles.privacyText}>{tx('Faragha')}</Text>
          </View>
        </View>

        <ErrorBox error={error} />

        {self && self.gender == null ? (
          <AskGender
            onPick={async (gender) => {
              await familyMembers.update(self.id, { gender });
              // Refresh rather than set locally: this answer decides
              // the tab bar and the menu as well, and they read the
              // session, not this screen.
              await refresh();
            }}
          />
        ) : null}

        <CycleCard
          insights={insights}
          day={day}
          length={length}
          phase={phase}
          onPress={() => router.push('/orbit-cycle')}
        />

        <InsightCard insight={insight} onCheckIn={() => router.push('/orbit-checkin')} />

        <CheckInCard streak={streak} onPress={() => router.push('/orbit-checkin')} />

        <SnapshotCard patterns={patterns} onPress={() => router.push('/orbit-patterns')} />

        <Pressable
          onPress={() => router.push('/orbit-report')}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <OrbitCard style={styles.reportRow}>
            <View style={styles.learnIcon}>
              <Ionicons name="document-text-outline" size={17} color={orbit.plum} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.learnTitle}>{tx('Ripoti ya mwezi')}</Text>
              <Text style={styles.checkinBody}>{tx('Muhtasari wa kushiriki na mtaalamu')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={orbit.inkFaint} />
          </OrbitCard>
        </Pressable>

        <LearnCard articles={articles} router={router} />

        {/* The last step of the flow, and deliberately the last card.
            Orbit is not a replacement for a professional and the screen
            should not pretend the question ends here. */}
        <Pressable
          onPress={() => router.push('/book')}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[orbit.plum, orbit.plumDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.talk}
          >
            <View style={styles.talkIcon}>
              <Ionicons name="medkit-outline" size={19} color="#FFFFFF" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.talkTitle}>{tx('Zungumza na mtaalamu')}</Text>
              <Text style={styles.talkBody}>
                {tx('Orbit si mbadala wa mtaalamu wa afya. Unaweza kuomba muuguzi wakati wowote.')}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>

        <Text style={styles.footer}>
          {tx('Makadirio yote yanatokana na ulichoandika mwenyewe. Si uchunguzi wa kitabibu.')}
        </Text>
      </ScrollView>
    </View>
  );
}

// --- Where you are ----------------------------------------------------

function CycleCard({ insights, day, length, phase, onPress }) {
  const cyclesLogged = insights?.cyclesLogged ?? 0;
  const prediction = insights?.prediction;

  if (cyclesLogged === 0) {
    return (
      <OrbitCard tone="soft" style={styles.cycleCard}>
        <CycleRing day={0} length={28} label="—" sublabel={tx('Bado hakuna mzunguko')} />
        <Text style={styles.cycleEmpty}>
          {tx(
            'Orbit yako ndio kwanza inaanza. Andika tarehe ya hedhi yako ya mwisho ili ianze kujifunza mzunguko wako.'
          )}
        </Text>
        <Pressable onPress={onPress} accessibilityRole="button" style={styles.notYetCta}>
          <Text style={styles.notYetCtaText}>{tx('Andika hedhi')}</Text>
        </Pressable>
      </OrbitCard>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <OrbitCard style={styles.cycleCard}>
        <CycleRing
          day={day}
          length={length}
          phase={phase}
          label={day ? String(day) : '—'}
          sublabel={day ? tx('Siku ya mzunguko') : tx('Bado hakuna mzunguko')}
        />

        {phase ? (
          <View style={[styles.phasePill, { backgroundColor: `${orbit.phase[phase]}18` }]}>
            <View style={[styles.phaseDot, { backgroundColor: orbit.phase[phase] }]} />
            <Text style={[styles.phaseText, { color: orbit.phase[phase] }]}>
              {tx(PHASE_LABEL[phase])}
            </Text>
          </View>
        ) : null}

        <View style={styles.cycleStats}>
          <Stat
            label={tx('Inakadiriwa')}
            value={
              prediction
                ? prediction.daysUntil > 0
                  ? `~${prediction.daysUntil}`
                  : prediction.daysUntil === 0
                    ? tx('Leo')
                    : `+${Math.abs(prediction.daysUntil)}`
                : '—'
            }
          />
          <Stat label={tx('Wastani')} value={length ? `${length}` : '—'} />
          <Stat
            label={tx('Uthabiti')}
            value={tx(REGULARITY_LABEL[insights?.regularity] ?? '—')}
          />
        </View>

        {/* Every prediction carries where it came from. "Based on your
            previous cycles" is not a disclaimer bolted on — it is the
            only true description of what this number is. */}
        {prediction ? (
          <Text style={styles.estimate}>
            {tx('Kutokana na mizunguko yako')} {prediction.basedOnIntervals}{' '}
            {tx('iliyopita. Ni makadirio, si uhakika.')}
          </Text>
        ) : (
          <Text style={styles.estimate}>
            {tx('Orbit inahitaji angalau mizunguko miwili kabla ya kukadiria ujao.')}
          </Text>
        )}
      </OrbitCard>
    </Pressable>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

// --- The one thing Orbit noticed --------------------------------------

function InsightCard({ insight, onCheckIn }) {
  if (!insight || insight.status === 'NO_DATA') {
    return (
      <NotYet
        title={tx('Orbit yako ndio kwanza inaanza')}
        body={tx('Fanya uchunguzi mfupi wa kila siku ili Orbit ianze kuona mwenendo wako binafsi.')}
      >
        <Pressable onPress={onCheckIn} accessibilityRole="button" style={styles.notYetCta}>
          <Text style={styles.notYetCtaText}>{tx('Anza kufuatilia')}</Text>
        </Pressable>
      </NotYet>
    );
  }

  if (insight.status === 'INSUFFICIENT_DATA') {
    return (
      <NotYet
        icon="hourglass-outline"
        title={tx('Bado tunahitaji siku chache zaidi')}
        body={`${tx('Umeandika siku')} ${insight.daysRecorded}/${insight.daysNeeded}. ${tx(
          'Orbit haitasema mwenendo wako kabla ya kuwa na uhakika.'
        )}`}
      />
    );
  }

  if (insight.status === 'STEADY') {
    return (
      <OrbitCard tone="soft">
        <SectionTitle>{tx('Orbit leo')}</SectionTitle>
        <Text style={styles.insightBody}>
          {tx('Hakuna mabadiliko makubwa kwenye ulichoandika siku hizi za karibuni.')}
        </Text>
        <Text style={styles.insightMeta}>
          {tx('Kutokana na siku')} {insight.daysRecorded} {tx('ulizoandika.')}
        </Text>
      </OrbitCard>
    );
  }

  const { field, direction, recentAverage, earlierAverage, daysCompared } = insight.insight;

  return (
    <OrbitCard tone="soft">
      <SectionTitle>{tx('Orbit leo')}</SectionTitle>
      <Text style={styles.insightBody}>
        {tx(FIELD_LABEL[field] ?? field)}{' '}
        {direction === 'DOWN' ? tx('zimekuwa chini kidogo') : tx('zimekuwa juu kidogo')}{' '}
        {tx('kuliko siku zako za awali.')}
      </Text>
      <Text style={styles.insightMeta}>
        {tx('Karibuni')} {recentAverage} · {tx('awali')} {earlierAverage} · {tx('siku')}{' '}
        {daysCompared}
      </Text>
      <Text style={styles.insightNote}>
        {tx('Huu ni mwenendo wa kufuatilia, si uchunguzi wa ugonjwa.')}
      </Text>
    </OrbitCard>
  );
}

// --- The twenty-second check-in ---------------------------------------

function CheckInCard({ streak, onPress }) {
  const done = streak?.doneToday;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <OrbitCard tone={done ? 'plain' : 'rose'} style={styles.checkin}>
        <View style={[styles.checkinIcon, done && styles.checkinIconDone]}>
          <Ionicons
            name={done ? 'checkmark' : 'add'}
            size={20}
            color={done ? '#1F6B4F' : orbit.rose}
          />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.checkinTitle}>
            {done ? tx('Umeandika leo') : tx('Uchunguzi wa leo')}
          </Text>
          <Text style={styles.checkinBody}>
            {done
              ? tx('Gusa kubadilisha ulichoandika.')
              : tx('Sekunde 20 — hisia, nguvu, maumivu, usingizi.')}
          </Text>
        </View>
        {streak ? (
          <View style={styles.streak}>
            <Text style={styles.streakNum}>{streak.daysInLastWeek}/7</Text>
            <Text style={styles.streakLabel}>{tx('wiki hii')}</Text>
          </View>
        ) : null}
      </OrbitCard>
    </Pressable>
  );
}

// --- Wellness snapshot ------------------------------------------------

function SnapshotCard({ patterns, onPress }) {
  if (!patterns) return null;

  return (
    <View>
      <SectionTitle
        right={
          <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>{tx('Ona zaidi')} →</Text>
          </Pressable>
        }
      >
        {tx('Hali kwa ujumla')}
      </SectionTitle>

      <OrbitCard style={styles.snapshot}>
        {SNAPSHOT_ROWS.map((row, index) => (
          <View
            key={row.key}
            style={[
              styles.snapshotRow,
              index < SNAPSHOT_ROWS.length - 1 && styles.snapshotDivider,
            ]}
          >
            <Text style={styles.snapshotLabel}>{tx(row.label)}</Text>
            <StatusPill status={patterns.snapshot?.[row.key] ?? 'MONITORING'} />
          </View>
        ))}
        {/* Says what MONITORING means, once, rather than leaving three
            of them on screen looking like a warning. */}
        <Text style={styles.snapshotNote}>
          {tx('MONITORING inamaanisha bado hakuna siku za kutosha kusema, si kwamba kuna tatizo.')}
        </Text>
      </OrbitCard>
    </View>
  );
}

// --- Learn ------------------------------------------------------------

function LearnCard({ articles, router }) {
  return (
    <View>
      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/ask')} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>{tx('Uliza Orbit')} →</Text>
          </Pressable>
        }
      >
        {tx('Jifunze')}
      </SectionTitle>

      {articles.length === 0 ? (
        <NotYet
          icon="book-outline"
          title={tx('Maktaba inakuja')}
          body={tx(
            'Makala za afya ya uzazi zinasubiri kupitiwa na mtaalamu kabla hazijachapishwa.'
          )}
        />
      ) : (
        <View style={styles.learnList}>
          {articles.map((article) => (
            <Pressable
              key={article.id ?? article.slug}
              onPress={() => router.push({ pathname: '/article', params: { slug: article.slug } })}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <OrbitCard style={styles.learnRow}>
                <View style={styles.learnIcon}>
                  <Ionicons name="book-outline" size={17} color={orbit.plum} />
                </View>
                <Text style={styles.learnTitle} numberOfLines={2}>
                  {article.title}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={orbit.inkFaint} />
              </OrbitCard>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.page },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1 },

  askBody: { ...type.small, color: orbit.inkSoft, lineHeight: scale(19), marginTop: 2 },
  askChips: { marginTop: spacing.sm },
  askFoot: { fontSize: fs(11), color: orbit.inkFaint, marginTop: spacing.sm },

  notForYou: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  notForYouTitle: {
    fontSize: fs(18),
    fontFamily: font.extrabold,
    color: orbit.ink,
    textAlign: 'center',
  },
  notForYouBody: {
    ...type.small,
    color: orbit.inkSoft,
    textAlign: 'center',
    lineHeight: scale(20),
  },
  notForYouButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: orbit.plum,
  },
  notForYouButtonText: { fontSize: fs(14), fontFamily: font.semibold, color: '#FFFFFF' },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerText: { flex: 1 },
  wordmark: { fontSize: fs(13), fontFamily: font.extrabold, letterSpacing: 3, color: orbit.plum },
  greeting: { fontSize: fs(20), fontFamily: font.bold, color: orbit.ink, marginTop: -2 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: orbit.plumSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  privacyText: { fontSize: fs(10), fontFamily: font.semibold, color: orbit.plum },

  cycleCard: { alignItems: 'center' },
  cycleEmpty: {
    ...type.small,
    color: orbit.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: scale(19),
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  phaseDot: { width: 7, height: 7, borderRadius: 4 },
  phaseText: { fontSize: fs(11), fontFamily: font.bold },

  cycleStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: orbit.plumLine,
    paddingTop: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statValue: { fontSize: fs(16), fontFamily: font.bold, color: orbit.ink },
  statLabel: {
    ...type.tiny,
    fontSize: fs(9),
    color: orbit.inkFaint,
    textAlign: 'center',
    marginTop: 2,
  },
  estimate: {
    ...type.tiny,
    color: orbit.inkFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: scale(15),
  },

  insightBody: { ...type.body, color: orbit.ink, lineHeight: scale(21) },
  insightMeta: { ...type.tiny, color: orbit.inkSoft, marginTop: spacing.xs },
  insightNote: { ...type.tiny, color: orbit.inkFaint, marginTop: 2, fontStyle: 'italic' },

  notYetCta: {
    marginTop: spacing.sm,
    backgroundColor: orbit.plum,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  notYetCtaText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: fs(13) },

  checkin: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkinIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinIconDone: { backgroundColor: '#E8F3EE' },
  checkinTitle: { fontSize: fs(15), fontFamily: font.bold, color: orbit.ink },
  checkinBody: { ...type.tiny, color: orbit.inkSoft, marginTop: 1 },
  streak: { alignItems: 'center' },
  streakNum: { fontSize: fs(14), fontFamily: font.extrabold, color: orbit.plum },
  streakLabel: { ...type.tiny, fontSize: fs(9), color: orbit.inkFaint },

  snapshot: { paddingVertical: spacing.xs },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  snapshotDivider: { borderBottomWidth: 1, borderBottomColor: orbit.plumLine },
  snapshotLabel: { ...type.bodyStrong, color: orbit.ink },
  snapshotNote: {
    ...type.tiny,
    color: orbit.inkFaint,
    marginTop: spacing.xs,
    lineHeight: scale(15),
  },

  link: { fontSize: fs(12), fontFamily: font.bold, color: orbit.plum },

  learnList: { gap: spacing.xs },
  learnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  learnIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: orbit.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnTitle: { flex: 1, ...type.bodyStrong, color: orbit.ink },

  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  talkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkTitle: { fontSize: fs(15), fontFamily: font.bold, color: '#FFFFFF' },
  talkBody: { ...type.tiny, color: 'rgba(255,255,255,0.85)', marginTop: 1, lineHeight: scale(15) },

  footer: {
    ...type.tiny,
    color: orbit.inkFaint,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: scale(15),
  },
});
