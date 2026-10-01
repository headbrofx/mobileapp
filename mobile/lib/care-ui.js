import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, fs, radius, shadow, spacing, type } from './theme';
import { dateTimeSw, statusInfo, toneColours, tzs } from './care';
import { tx } from './i18n';

// The building blocks every Care Mobility screen shares: client,
// staff and dispatcher alike. Same pill, same card, same timeline,
// drawn from the theme, so the feature reads as part of the app rather
// than a second one bolted on.

export function StatusPill({ kind, status, raw = false }) {
  const info = statusInfo(kind, status);
  const { fg, bg } = toneColours(info.tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Ionicons name={info.icon} size={11} color={fg} />
      <Text style={[styles.pillText, { color: fg }]} numberOfLines={1}>
        {raw ? status : tx(info.sw)}
      </Text>
    </View>
  );
}

export function Segmented({ options, value, onChange, counts }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        const n = counts?.[o.value];
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.segment, on && styles.segmentOn, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
              {tx(o.label)}
            </Text>
            {n ? (
              <View style={[styles.count, on && styles.countOn]}>
                <Text style={[styles.countText, on && styles.countTextOn]}>{n}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// One request in a list: what, for whom, when, and its state.
export function RequestCard({ item, onPress, right }) {
  const isTrip = item.kind === 'TRANSPORT';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <View style={[styles.kindIcon, { backgroundColor: isTrip ? colors.surfaceAlt : colors.primaryLight }]}>
          <Ionicons name={isTrip ? 'car' : 'home'} size={18} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title || (isTrip ? tx('Usafiri') : tx('Ziara ya nyumbani'))}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.reference} · {dateTimeSw(item.scheduledAt)}
          </Text>
        </View>
        {right ?? <Ionicons name="chevron-forward" size={17} color={colors.subtle} />}
      </View>
      <View style={styles.cardBottom}>
        <StatusPill kind={item.kind} status={item.status} />
        {item.patient?.name || item.patientName ? (
          <Text style={styles.cardMeta} numberOfLines={1}>
            <Ionicons name="person-outline" size={11} color={colors.muted} /> {item.patient?.name ?? item.patientName}
          </Text>
        ) : null}
        {item.priceTzs != null || item.fareTzs != null ? (
          <Text style={styles.cardMeta}>{tzs(item.priceTzs ?? item.fareTzs)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// The status history, top to bottom, with the time of each step. Only
// steps that actually happened are drawn; nothing is projected.
export function Timeline({ kind, entries }) {
  if (!entries?.length) return null;
  return (
    <View>
      {entries.map((e, i) => {
        const info = statusInfo(kind, e.toStatus);
        const { fg, bg } = toneColours(info.tone);
        const last = i === entries.length - 1;
        return (
          <View key={`${e.toStatus}-${e.at}`} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlDot, { backgroundColor: last ? fg : bg, borderColor: fg }]}>
                <Ionicons name={info.icon} size={12} color={last ? colors.onPrimary : fg} />
              </View>
              {!last ? <View style={styles.tlLine} /> : null}
            </View>
            <View style={styles.tlBody}>
              <Text style={[styles.tlTitle, last && { color: fg }]}>{tx(info.sw)}</Text>
              <Text style={styles.tlTime}>{dateTimeSw(e.at)}</Text>
              {e.note ? <Text style={styles.tlNote}>{e.note}</Text> : null}
              {e.actor ? <Text style={styles.tlTime}>{e.actor.name} · {e.actor.role}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function ActionButton({ title, icon, onPress, busy, disabled, variant = 'primary', danger = false }) {
  const ghost = variant === 'ghost';
  const fg = ghost ? (danger ? colors.danger : colors.primary) : colors.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        ghost ? [styles.actionGhost, danger && { borderColor: colors.danger }] : { backgroundColor: danger ? colors.danger : colors.primary },
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
          <Text style={[styles.actionText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, icon, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={13} color={selected ? colors.onPrimary : colors.primary} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function InfoLine({ icon, label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export function Empty({ icon = 'file-tray-outline', title, body, children }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {children}
    </View>
  );
}

export const careStyles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xxl },
  section: { ...type.section, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  muted: { ...type.small, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: { fontSize: fs(10.5), fontFamily: font.bold },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingVertical: 8,
  },
  segmentOn: { backgroundColor: colors.surface, ...shadow.card },
  segmentText: { fontSize: fs(11.5), fontFamily: font.semibold, color: colors.muted },
  segmentTextOn: { color: colors.primary, fontFamily: font.bold },
  count: { minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countOn: { backgroundColor: colors.primary },
  countText: { fontSize: fs(9.5), fontFamily: font.bold, color: colors.muted },
  countTextOn: { color: colors.onPrimary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kindIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...type.bodyStrong, fontFamily: font.bold, color: colors.text },
  cardSub: { ...type.small, color: colors.muted, marginTop: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  cardMeta: { ...type.tiny, color: colors.muted },

  tlRow: { flexDirection: 'row', gap: spacing.sm },
  tlRail: { alignItems: 'center', width: 26 },
  tlDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2, minHeight: 18 },
  tlBody: { flex: 1, paddingBottom: spacing.md },
  tlTitle: { ...type.bodyStrong, color: colors.text },
  tlTime: { ...type.tiny, color: colors.muted, marginTop: 1 },
  tlNote: { ...type.small, color: colors.text, marginTop: 3, fontStyle: 'italic' },

  action: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  actionGhost: { borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent' },
  actionText: { ...type.label },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fs(12.5), fontFamily: font.semibold, color: colors.text },
  chipTextOn: { color: colors.onPrimary },

  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 7 },
  infoLabel: { ...type.tiny, color: colors.muted },
  infoValue: { ...type.body, color: colors.text, marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...type.section, color: colors.text, textAlign: 'center' },
  emptyBody: { ...type.small, color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: spacing.md },
});
