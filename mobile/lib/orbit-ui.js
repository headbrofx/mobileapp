import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { accentAt, colors, font, fs, radius, scale, shadow, spacing, type } from './theme';

// Orbit's own surface.
//
// Orbit is a module inside Afya Nyumbani, not a second app, so it takes
// the app's spacing, typeface and radii unchanged. What it does not
// take is the brand colour: this is the one part of the product a woman
// may open on a crowded daladala, and it is built quiet — deep plum and
// a soft rose, no red, no alarm colours, nothing that reads across a
// carriage as a period tracker.
//
// Plum rather than pink is a decision, not a hedge. The brief asked for
// feminine without childish; saturated pink on white is the visual
// signature of exactly the category this is trying not to be, and it
// also happens to be the hardest palette to read outdoors.

export const orbit = {
  // Neutral ink, so the reading surface is the same temperature as the
  // rest of the app.
  ink: '#241B2F',
  inkSoft: '#5E5470',
  inkFaint: '#9A91A8',

  // These were a plum chosen for Orbit alone — a fourth colour system
  // in an app that already had three. Orbit is a module inside Afya
  // Nyumbani, not a second app, and it now says so in colour as well
  // as in layout: the accent is the active theme's, so Orbit is green
  // on the green theme and blue on the blue one.
  //
  // The names stay `plum` because every screen references them and a
  // rename would be churn for nothing. They are simply not plum any
  // more unless the theme is.
  plum: colors.primary,
  plumDeep: colors.primaryDark,
  plumSoft: colors.primaryLight,
  plumLine: colors.border,

  rose: accentAt(4),
  roseSoft: colors.primaryLight,

  // Four steps for the ring. They were four unrelated hues; they are
  // four steps of the theme's family now, still separated in lightness
  // as well as hue so the ring reads in greyscale and for anyone who
  // does not distinguish these hues.
  phase: {
    MENSTRUAL: accentAt(0),
    FOLLICULAR: accentAt(2),
    OVULATORY: accentAt(3),
    LUTEAL: accentAt(5),
  },

  surface: colors.surface,
  page: colors.bg,
};

// --- The cycle ring ---------------------------------------------------
//
// An arc for the days recorded and a marker for today. It is drawn with
// SVG rather than stacked Views because a real arc needs a stroke
// offset, and faking one with borders produces the segmented pie every
// other tracker has.
//
// The ring shows what is known and marks the rest as estimate. A solid
// ring all the way round would say Orbit knows where the cycle ends,
// and it does not — it has an average of what happened before.

export function CycleRing({ day, length, phase, size = 240, label, sublabel }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // Guard the maths rather than the caller: a first-ever user has no
  // length, and a ring that divides by zero renders as nothing at all.
  const total = Number.isFinite(length) && length > 0 ? length : 28;
  const progress = Number.isFinite(day) && day > 0 ? Math.min(day / total, 1) : 0;
  const colour = orbit.phase[phase] ?? orbit.plum;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="orbitArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colour} stopOpacity="1" />
            <Stop offset="1" stopColor={orbit.plum} stopOpacity="0.85" />
          </SvgGradient>
        </Defs>

        {/* The whole cycle, as a faint track. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={orbit.plumLine}
          strokeWidth={stroke}
          fill="none"
        />
        {/* The part that has happened. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#orbitArc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.ringCentre}>
        <Text style={styles.ringLabel}>{label}</Text>
        {sublabel ? <Text style={styles.ringSub}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

// --- Cards ------------------------------------------------------------

export function OrbitCard({ children, style, tone = 'plain' }) {
  return (
    <View
      style={[
        styles.card,
        tone === 'soft' && styles.cardSoft,
        tone === 'rose' && styles.cardRose,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

// --- Status pill ------------------------------------------------------
//
// Three words and no score. A number out of a hundred invites somebody
// to feel they are failing at having a body, and there is nothing behind
// it — no scale of wellness exists that five sliders can compute.
//
// MONITORING is not a hedge, it is the honest reading of "not enough
// days yet", and it is styled as neutral rather than as a warning.

const STATUS_TONE = {
  STABLE: { bg: colors.successBg, fg: colors.success },
  CHANGING: { bg: colors.cautionBg, fg: colors.caution },
  MONITORING: { bg: orbit.plumSoft, fg: orbit.inkSoft },
};

export function StatusPill({ status }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.MONITORING;
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{status}</Text>
    </View>
  );
}

// --- Empty and not-yet states ----------------------------------------
//
// "No data" is a fact about the database. This is a screen for a person,
// so it says what Orbit is waiting for and what happens when it arrives.

export function NotYet({ icon = 'sparkles-outline', title, body, children }) {
  return (
    <OrbitCard tone="soft" style={styles.notYet}>
      <View style={styles.notYetIcon}>
        <Ionicons name={icon} size={20} color={orbit.plum} />
      </View>
      <Text style={styles.notYetTitle}>{title}</Text>
      <Text style={styles.notYetBody}>{body}</Text>
      {children}
    </OrbitCard>
  );
}

// --- A 1–5 scale, as a row of taps ------------------------------------
//
// Taps rather than a drag. A slider on a phone needs a deliberate grab
// and gives a number nobody can feel the difference between; five
// targets are one thumb movement each and the whole check-in is done in
// about the twenty seconds it was asked to take.

export function ScaleRow({ value, onChange, min = 1, max = 5, lowLabel, highLabel, tint }) {
  const steps = [];
  for (let i = min; i <= max; i += 1) steps.push(i);
  const colour = tint ?? orbit.plum;

  return (
    <View>
      <View style={styles.scaleRow}>
        {steps.map((step) => {
          const on = value === step;
          return (
            <View key={step} style={styles.scaleCell}>
              <Text
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onChange(on ? null : step)}
                style={[
                  styles.scaleDot,
                  on && { backgroundColor: colour, borderColor: colour, color: '#FFFFFF' },
                ]}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>
      {lowLabel || highLabel ? (
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLabel}>{lowLabel}</Text>
          <Text style={styles.scaleLabel}>{highLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ringCentre: { position: 'absolute', alignItems: 'center' },
  ringLabel: {
    fontSize: fs(34),
    lineHeight: fs(38),
    fontFamily: font.extrabold,
    color: orbit.ink,
    textAlign: 'center',
  },
  ringSub: {
    ...type.small,
    color: orbit.inkSoft,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 150,
  },

  card: {
    backgroundColor: orbit.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: orbit.plumLine,
    padding: spacing.md,
    ...shadow.card,
  },
  cardSoft: { backgroundColor: orbit.plumSoft, borderColor: 'transparent' },
  cardRose: { backgroundColor: orbit.roseSoft, borderColor: 'transparent' },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fs(17),
    fontFamily: font.extrabold,
    color: orbit.ink,
    letterSpacing: -0.2,
  },

  pill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: fs(9), fontFamily: font.bold, letterSpacing: 0.6 },

  notYet: { alignItems: 'center' },
  notYetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  notYetTitle: {
    fontSize: fs(15),
    fontFamily: font.bold,
    color: orbit.ink,
    textAlign: 'center',
  },
  notYetBody: {
    ...type.small,
    color: orbit.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: scale(18),
  },

  scaleRow: { flexDirection: 'row', gap: spacing.xs },
  scaleCell: { flex: 1 },
  scaleDot: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: orbit.plumLine,
    backgroundColor: '#FFFFFF',
    color: orbit.inkSoft,
    fontFamily: font.bold,
    fontSize: fs(15),
    overflow: 'hidden',
  },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  scaleLabel: { ...type.tiny, fontSize: fs(10), color: orbit.inkFaint },
});
