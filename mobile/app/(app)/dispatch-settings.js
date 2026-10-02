import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { dispatch } from '../../lib/api';
import { Card, ErrorBox, Field } from '../../lib/ui';
import { ActionButton, Empty, careStyles } from '../../lib/care-ui';
import { useSession } from '../../lib/session';
import MapView from '../../lib/MapView';
import { zoneCircles } from '../../lib/care';
import { colors, font, fs, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// The dispatcher's back office: figures from the real rows, the
// operational rules, and the areas served.
//
// Every figure here is counted from bookings, trips, the status
// history and the audit log. Where a number rests on few rows, it says
// how few, so a median of two is not read as a trend.

const LABELS = {
  'dispatch.visitDurationMinutes': 'Muda wa ziara moja (dakika)',
  'dispatch.travelBufferMinutes': 'Muda wa safari kati ya ziara (dakika)',
  'booking.minLeadMinutes': 'Muda wa chini kabla ya ziara (dakika)',
  'booking.maxAdvanceDays': 'Siku za juu za kuomba mapema',
  'dispatch.expireAfterMinutes': 'Ombi lisilopangwa linaisha baada ya (dakika)',
  'transport.enabled': 'Huduma ya usafiri iko wazi',
  'transport.maxPassengers': 'Wasafiri wa juu kwa ombi',
};

const STATUS_SW = {
  REQUESTED: 'Imepokelewa',
  UNDER_REVIEW: 'Inapitiwa',
  ASSIGNED: 'Imepangwa',
  ACCEPTED: 'Imekubaliwa',
  QUOTED: 'Bei imetumwa',
  COMPLETED: 'Imekamilika',
  CANCELLED: 'Imesitishwa',
  FAILED: 'Haikufanyika',
  EXPIRED: 'Muda umepita',
  REJECTED: 'Imekataliwa',
};

const EMPTY_ZONE = { name: '', region: '', centerLat: '', centerLng: '', radiusKm: '' };

export default function DispatchSettings() {
  useI18n();
  const { user } = useSession();
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [zones, setZones] = useState([]);
  const [zoneForm, setZoneForm] = useState(EMPTY_ZONE);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, s, z] = await Promise.all([dispatch.analytics(), dispatch.settings(), dispatch.zones()]);
      setAnalytics(a);
      setSettings(s?.settings ?? {});
      setDraft(Object.fromEntries(Object.entries(s?.settings ?? {}).map(([k, v]) => [k, v.value])));
      setZones(z?.zones ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function run(key, fn, message) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (user && user.role !== 'ADMIN') {
    return <Empty icon="lock-closed-outline" title={tx('Ukurasa huu ni wa msimamizi tu')} />;
  }

  // Only what changed is sent, and the server checks each value.
  const changes = settings
    ? Object.fromEntries(Object.entries(draft).filter(([k, v]) => settings[k] && settings[k].value !== v))
    : {};

  const zoneValid =
    zoneForm.name.trim().length >= 2 &&
    zoneForm.region.trim().length >= 2 &&
    [zoneForm.centerLat, zoneForm.centerLng, zoneForm.radiusKm].every((v) => v !== '' && Number.isFinite(Number(v)));

  return (
    <ScrollView contentContainerStyle={careStyles.content} keyboardShouldPersistTaps="handled">
      <ErrorBox error={error} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Text style={careStyles.section}>{tx('Takwimu za siku 30')}</Text>
      {analytics ? (
        <>
          <View style={styles.tiles}>
            <Tile label={tx('Ziara')} value={analytics.homeVisits.total} />
            <Tile label={tx('Safari')} value={analytics.transport.total} />
            <Tile label={tx('Wahudumu kazini sasa')} value={analytics.staffOnDutyNow} />
          </View>
          <View style={styles.tiles}>
            <Tile label={tx('Zilizokamilika')} value={analytics.homeVisits.completionRate == null ? '—' : `${analytics.homeVisits.completionRate}%`} />
            <Tile label={tx('Zilizositishwa')} value={analytics.homeVisits.cancellationRate == null ? '—' : `${analytics.homeVisits.cancellationRate}%`} />
            <Tile
              label={tx('Muda hadi kupangwa (wastani wa kati)')}
              value={analytics.homeVisits.medianMinutesToAssign == null ? '—' : `${analytics.homeVisits.medianMinutesToAssign} ${tx('dk')}`}
              sub={`${tx('kutoka maombi')} ${analytics.homeVisits.medianBasedOn}`}
            />
          </View>
          <Card>
            <Text style={styles.cardTitle}>{tx('Ziara kwa hali')}</Text>
            {Object.entries(analytics.homeVisits.byStatus).map(([k, v]) => (
              <Row key={k} label={tx(STATUS_SW[k] ?? k)} value={v} />
            ))}
            <Text style={[styles.cardTitle, styles.gap]}>{tx('Safari kwa hali')}</Text>
            {Object.entries(analytics.transport.byStatus).map(([k, v]) => (
              <Row key={k} label={tx(STATUS_SW[k] ?? k)} value={v} />
            ))}
            <Text style={[styles.cardTitle, styles.gap]}>{tx('Maamuzi ya dispatcher')}</Text>
            <Row label={tx('Upangaji wote')} value={analytics.dispatch.assignments} />
            <Row label={tx('Hawakufuata pendekezo la kwanza')} value={analytics.dispatch.overrodeRecommendation} />
          </Card>
        </>
      ) : (
        <Text style={careStyles.muted}>{tx('Inapakia…')}</Text>
      )}

      <Text style={careStyles.section}>{tx('Mipangilio ya uendeshaji')}</Text>
      {settings ? (
        <Card>
          {Object.entries(settings).map(([key, def]) =>
            def.type === 'boolean' ? (
              <View key={key} style={styles.switchRow}>
                <Text style={styles.switchLabel}>{tx(LABELS[key] ?? key)}</Text>
                <Switch
                  value={Boolean(draft[key])}
                  onValueChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            ) : (
              <Field
                key={key}
                label={tx(LABELS[key] ?? key)}
                hint={`${def.min} – ${def.max} · ${tx('chaguo-msingi')} ${def.default}`}
                keyboardType="number-pad"
                value={String(draft[key] ?? '')}
                onChangeText={(text) =>
                  setDraft((d) => ({ ...d, [key]: text === '' ? '' : Number.parseInt(text.replace(/\D/g, ''), 10) }))
                }
              />
            )
          )}
          <ActionButton
            icon="save-outline"
            title={tx('Hifadhi mipangilio')}
            disabled={Object.keys(changes).length === 0}
            busy={busy === 'settings'}
            onPress={() => run('settings', () => dispatch.saveSettings(changes), tx('Mipangilio imehifadhiwa.'))}
          />
        </Card>
      ) : null}

      <Text style={careStyles.section}>{tx('Maeneo ya huduma')}</Text>
      {zones.length ? (
        <MapView height={220} circles={zoneCircles(zones.filter((z) => z.isActive), colors.primary)} zoom={9} />
      ) : null}
      {zones.map((z) => (
        <Card key={z.id} style={styles.zone}>
          <Text style={styles.cardTitle}>
            {z.name} · {z.region}
          </Text>
          <Text style={careStyles.muted}>
            {z.centerLat.toFixed(4)}, {z.centerLng.toFixed(4)} · km {z.radiusKm}
          </Text>
          {[
            ['isActive', 'Linatumika'],
            ['homeVisits', 'Ziara za nyumbani'],
            ['transport', 'Usafiri'],
          ].map(([field, label]) => (
            <View key={field} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{tx(label)}</Text>
              <Switch
                value={Boolean(z[field])}
                disabled={busy === `zone-${z.id}`}
                onValueChange={(v) => run(`zone-${z.id}`, () => dispatch.saveZone(z.id, { [field]: v }), tx('Eneo limesasishwa.'))}
                trackColor={{ true: colors.primary }}
              />
            </View>
          ))}
        </Card>
      ))}

      <Card>
        <Text style={styles.cardTitle}>{tx('Ongeza eneo jipya')}</Text>
        <Text style={[careStyles.muted, styles.gapBottom]}>
          {tx('Mji mpya ni safu mpya hapa, si toleo jipya la app.')}
        </Text>
        <Field label={tx('Jina')} value={zoneForm.name} onChangeText={(v) => setZoneForm((f) => ({ ...f, name: v }))} placeholder="Arusha" />
        <Field label={tx('Mkoa')} value={zoneForm.region} onChangeText={(v) => setZoneForm((f) => ({ ...f, region: v }))} placeholder="Arusha" />
        <View style={styles.inline}>
          <View style={styles.flex}>
            <Field label={tx('Latitudo ya kitovu')} value={zoneForm.centerLat} onChangeText={(v) => setZoneForm((f) => ({ ...f, centerLat: v }))} placeholder="-3.3869" />
          </View>
          <View style={styles.flex}>
            <Field label={tx('Longitudo ya kitovu')} value={zoneForm.centerLng} onChangeText={(v) => setZoneForm((f) => ({ ...f, centerLng: v }))} placeholder="36.6830" />
          </View>
        </View>
        <Field label={tx('Upana (km)')} keyboardType="decimal-pad" value={zoneForm.radiusKm} onChangeText={(v) => setZoneForm((f) => ({ ...f, radiusKm: v }))} placeholder="20" />
        <ActionButton
          icon="add"
          title={tx('Ongeza eneo')}
          disabled={!zoneValid}
          busy={busy === 'zone-new'}
          onPress={() =>
            run(
              'zone-new',
              async () => {
                await dispatch.saveZone(null, {
                  name: zoneForm.name.trim(),
                  region: zoneForm.region.trim(),
                  centerLat: Number(zoneForm.centerLat),
                  centerLng: Number(zoneForm.centerLng),
                  radiusKm: Number(zoneForm.radiusKm),
                });
                setZoneForm(EMPTY_ZONE);
              },
              tx('Eneo limeongezwa.')
            )
          }
        />
      </Card>
    </ScrollView>
  );
}

function Tile({ label, value, sub }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: { ...type.small, color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: 12, marginBottom: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm,
  },
  tileValue: { fontSize: fs(20), fontFamily: font.extrabold, color: colors.text },
  tileLabel: { ...type.tiny, color: colors.muted, marginTop: 2 },
  tileSub: { fontSize: fs(9.5), color: colors.subtle, marginTop: 2 },
  cardTitle: { ...type.bodyStrong, fontFamily: font.bold, color: colors.text, marginBottom: 4 },
  gap: { marginTop: spacing.md },
  gapBottom: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { ...type.small, color: colors.text },
  rowValue: { ...type.label, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: spacing.sm },
  switchLabel: { ...type.body, color: colors.text, flex: 1 },
  zone: { marginTop: spacing.sm },
  inline: { flexDirection: 'row', gap: spacing.sm },
});
