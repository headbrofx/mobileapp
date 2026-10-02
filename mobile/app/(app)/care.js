import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { care } from '../../lib/api';
import { Card, ErrorBox } from '../../lib/ui';
import { ActionButton, careStyles } from '../../lib/care-ui';
import { currentPosition, tzs, zoneCircles } from '../../lib/care';
import MapView from '../../lib/MapView';
import { serviceColour, serviceIcon } from '../../lib/services-meta';
import { colors, font, fs, radius, shadow, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// Find Care Near You.
//
// Works without a location: it lists what the business offers and
// where. With one, asked for by a button and never on its own, it says
// whether that place is covered. The position is taken at low accuracy,
// rounded again by the server to about a kilometre, and not stored.
//
// No nurse is ever placed on a map here. "Three nurses on duty" is
// useful to a client; where those three people are is nobody's
// business but the dispatcher's.

const COVERAGE = {
  COVERED: { icon: 'checkmark-circle', tone: colors.success, bg: colors.successBg, text: 'Eneo lako linahudumiwa' },
  OUTSIDE: { icon: 'close-circle', tone: colors.caution, bg: colors.cautionBg, text: 'Eneo hili bado haliko kwenye maeneo tunayohudumia' },
  UNKNOWN: { icon: 'help-circle', tone: colors.primary, bg: colors.primaryLight, text: 'Tuambie uko wapi kuona kama tunakufikia' },
};

export default function FindCare() {
  useI18n();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (at) => {
    setError(null);
    try {
      setData(await care.discover(at));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(coords);
    }, [load, coords])
  );

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const at = await currentPosition({ approximate: true });
      setCoords(at);
    } catch (err) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  }

  const cov = COVERAGE[data?.coverage ?? 'UNKNOWN'];

  return (
    <ScrollView contentContainerStyle={careStyles.content}>
      <Text style={styles.lead}>{tx('Huduma za afya nyumbani kwako, na usafiri wa kukufikisha kwenye huduma.')}</Text>
      <ErrorBox error={error} />

      <Card style={[styles.coverage, { backgroundColor: cov.bg, borderColor: cov.bg }]}>
        <View style={careStyles.row}>
          <Ionicons name={cov.icon} size={22} color={cov.tone} />
          <View style={styles.flex}>
            <Text style={[styles.coverageTitle, { color: cov.tone }]}>{tx(cov.text)}</Text>
            {data?.zone ? <Text style={careStyles.muted}>{data.zone.name}, {data.zone.region}</Text> : null}
            {data?.coverage === 'OUTSIDE' && data?.zones?.length ? (
              <Text style={careStyles.muted}>
                {tx('Tunahudumia')}: {data.zones.map((z) => z.name).join(', ')}
              </Text>
            ) : null}
          </View>
        </View>
        {!coords ? (
          <View style={styles.locateRow}>
            <ActionButton variant="ghost" icon="locate" title={tx('Tumia mahali nilipo')} busy={locating} onPress={locate} />
          </View>
        ) : (
          <Text style={styles.approx}>{tx('Tunatumia mahali pa takriban tu (karibu km 1), na hapahifadhiwi.')}</Text>
        )}
      </Card>

      {data?.zones?.length ? (
        <View style={styles.map}>
          {/* The coverage map: the zones the business serves, and the
              client's own rough position if they shared it. Never a
              nurse. */}
          <MapView
            height={200}
            circles={zoneCircles(data.zones, colors.primary)}
            markers={data.location ? [{ lat: data.location.lat, lng: data.location.lng, label: tx('Uko hapa (takriban)'), colour: colors.primary }] : []}
            zoom={data.location ? 12 : 10}
          />
        </View>
      ) : null}

      <View style={styles.bigRow}>
        <BigAction
          icon="home"
          title={tx('Ziara ya nyumbani')}
          body={tx('Muuguzi au mtaalamu aje kwako')}
          disabled={data && !data.homeVisits?.available}
          onPress={() => router.push('/book')}
        />
        <BigAction
          icon="car"
          title={tx('Nipeleke kwenye huduma')}
          body={tx('Usafiri hadi hospitali, kliniki au duka la dawa')}
          disabled={data && !data.transport?.available}
          onPress={() => router.push('/transport')}
        />
      </View>

      <Text style={careStyles.section}>{tx('Huduma zilizopo')}</Text>
      {(data?.homeVisits?.services ?? []).map((s) => (
        <Pressable key={s.id} onPress={() => router.push('/book')} style={({ pressed }) => [styles.service, pressed && styles.pressed]}>
          <View style={[styles.serviceIcon, { backgroundColor: serviceColour(s.name) }]}>
            <Ionicons name={serviceIcon(s.name)} size={18} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.serviceName}>{s.name}</Text>
            <Text style={careStyles.muted}>
              {s.basePriceTzs === 0 ? tx('Bure') : s.basePriceTzs != null ? `${tx('Kuanzia')} ${tzs(s.basePriceTzs)}` : tx('Bei kwa makubaliano')}
              {s.durationMinutes ? ` · ${tx('dakika')} ${s.durationMinutes}` : ''}
            </Text>
          </View>
          {/* A count of people on duty now, not a promise of who comes
              or when. Zero is said plainly: the request still goes to
              the office, who will arrange someone. */}
          <View style={[styles.duty, s.onDutyNow ? styles.dutyOn : null]}>
            <Text style={[styles.dutyText, s.onDutyNow ? styles.dutyTextOn : null]}>
              {s.onDutyNow ? `${s.onDutyNow} ${tx('kazini')}` : tx('tutapanga')}
            </Text>
          </View>
        </Pressable>
      ))}

      {data?.payments && !data.payments.online ? (
        <Text style={styles.footnote}>
          {tx('Malipo: kwa sasa ni taslimu au simu (M-Pesa, Tigo Pesa, Airtel Money) moja kwa moja kwa Afya Nyumbani. Malipo ndani ya app yanakuja.')}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function BigAction({ icon, title, body, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.big, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.bigIcon}>
        <Ionicons name={icon} size={24} color={colors.onPrimary} />
      </View>
      <Text style={styles.bigTitle}>{title}</Text>
      <Text style={styles.bigBody}>{disabled ? tx('Haipatikani eneo hili') : body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  lead: { ...type.small, color: colors.muted, marginBottom: spacing.md },

  coverage: { borderWidth: 1 },
  coverageTitle: { ...type.bodyStrong },
  locateRow: { flexDirection: 'row', marginTop: spacing.sm },
  approx: { ...type.tiny, color: colors.muted, marginTop: spacing.sm },

  bigRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  map: { marginTop: spacing.sm, marginBottom: spacing.xs },
  big: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    ...shadow.card,
  },
  bigIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  bigTitle: { ...type.bodyStrong, fontFamily: font.bold, color: colors.text },
  bigBody: { ...type.small, color: colors.muted, marginTop: 2 },

  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  serviceIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  serviceName: { ...type.bodyStrong, color: colors.text },
  duty: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surfaceAlt },
  dutyOn: { backgroundColor: colors.successBg },
  dutyText: { fontSize: fs(10), fontFamily: font.bold, color: colors.muted },
  dutyTextOn: { color: colors.success },

  footnote: { ...type.tiny, color: colors.muted, marginTop: spacing.md, lineHeight: fs(16) },
});
