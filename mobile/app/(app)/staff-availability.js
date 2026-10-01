import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { care } from '../../lib/api';
import { Card, ErrorBox, Field } from '../../lib/ui';
import { ActionButton, Chip, careStyles } from '../../lib/care-ui';
import { currentPosition, dateTimeSw } from '../../lib/care';
import { colors, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// A nurse's availability: whether they are working now, the hours they
// work, a "back on" date for leave, the areas they cover and where they
// usually start from. The dispatcher's recommendations read every one
// of these, and the server refuses to book someone marked away.
//
// Hours are East Africa time. One set of hours for the chosen days is
// enough for nearly everyone; split shifts can be added later without
// changing what is stored.

const DAYS = [
  { key: 'mon', label: 'Jtatu' },
  { key: 'tue', label: 'Jnne' },
  { key: 'wed', label: 'Jtano' },
  { key: 'thu', label: 'Alh' },
  { key: 'fri', label: 'Ijm' },
  { key: 'sat', label: 'Jmos' },
  { key: 'sun', label: 'Jpili' },
];
const STATUS = [
  { value: 'AVAILABLE', label: 'Nipo kazini', icon: 'checkmark-circle-outline' },
  { value: 'BUSY', label: 'Nina kazi', icon: 'time-outline' },
  { value: 'OFFLINE', label: 'Sipo', icon: 'moon-outline' },
];
const AWAY = [
  { days: 0, label: 'Sijaenda popote' },
  { days: 1, label: 'Hadi kesho' },
  { days: 3, label: 'Siku 3' },
  { days: 7, label: 'Wiki 1' },
  { days: 14, label: 'Wiki 2' },
];

const hhmm = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export default function StaffAvailability() {
  useI18n();
  const [loaded, setLoaded] = useState(false);
  const [availability, setAvailability] = useState('OFFLINE');
  const [days, setDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [from, setFrom] = useState('08:00');
  const [to, setTo] = useState('17:00');
  const [awayUntil, setAwayUntil] = useState(null);
  const [areas, setAreas] = useState('');
  const [base, setBase] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await care.myStaffProfile();
        const s = data?.staff ?? {};
        setAvailability(s.availability ?? 'OFFLINE');
        if (s.workingHours && Object.keys(s.workingHours).length) {
          const keys = Object.keys(s.workingHours).filter((k) => s.workingHours[k]?.length);
          setDays(keys);
          const first = s.workingHours[keys[0]]?.[0];
          if (first) {
            setFrom(first.from);
            setTo(first.to);
          }
        }
        setAwayUntil(s.unavailableUntil && new Date(s.unavailableUntil) > new Date() ? s.unavailableUntil : null);
        setAreas((s.serviceAreas ?? []).join(', '));
        if (s.baseLat != null) setBase({ lat: s.baseLat, lng: s.baseLng });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function toggleDay(key) {
    setDays((d) => (d.includes(key) ? d.filter((x) => x !== key) : [...d, key]));
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (!hhmm.test(from) || !hhmm.test(to) || from >= to) {
      setError(tx('Andika saa kwa mtindo wa 08:00 na 17:00, mwanzo kabla ya mwisho.'));
      return;
    }
    setBusy(true);
    try {
      await care.setAvailability({
        availability,
        workingHours: Object.fromEntries(DAYS.map((d) => [d.key, days.includes(d.key) ? [{ from, to }] : []])),
        unavailableUntil: awayUntil,
        serviceAreas: areas
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        baseLat: base ? base.lat : null,
        baseLng: base ? base.lng : null,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <Text style={[careStyles.muted, { padding: spacing.md }]}>{tx('Inapakia…')}</Text>;

  return (
    <ScrollView contentContainerStyle={careStyles.content} keyboardShouldPersistTaps="handled">
      <ErrorBox error={error} />
      {saved ? <Text style={styles.saved}>{tx('Imehifadhiwa.')}</Text> : null}

      <Text style={careStyles.section}>{tx('Hali yangu sasa')}</Text>
      <View style={careStyles.chips}>
        {STATUS.map((s) => (
          <Chip key={s.value} label={tx(s.label)} icon={s.icon} selected={availability === s.value} onPress={() => setAvailability(s.value)} />
        ))}
      </View>

      <Text style={careStyles.section}>{tx('Siku na saa za kazi')}</Text>
      <View style={careStyles.chips}>
        {DAYS.map((d) => (
          <Chip key={d.key} label={tx(d.label)} selected={days.includes(d.key)} onPress={() => toggleDay(d.key)} />
        ))}
      </View>
      <View style={styles.hours}>
        <View style={styles.flex}>
          <Field label={tx('Kuanzia')} value={from} onChangeText={setFrom} placeholder="08:00" />
        </View>
        <View style={styles.flex}>
          <Field label={tx('Hadi')} value={to} onChangeText={setTo} placeholder="17:00" />
        </View>
      </View>

      <Text style={careStyles.section}>{tx('Likizo au kutokuwepo')}</Text>
      <View style={careStyles.chips}>
        {AWAY.map((a) => {
          const until = a.days ? new Date(Date.now() + a.days * 24 * 3600 * 1000).toISOString() : null;
          const selected = a.days === 0 ? !awayUntil : false;
          return <Chip key={a.label} label={tx(a.label)} selected={selected} onPress={() => setAwayUntil(until)} />;
        })}
      </View>
      {awayUntil ? <Text style={careStyles.muted}>{tx('Hutapangiwa kazi hadi')} {dateTimeSw(awayUntil)}</Text> : null}

      <Text style={careStyles.section}>{tx('Maeneo ninayohudumia')}</Text>
      <Field label={tx('Tenganisha kwa koma')} value={areas} onChangeText={setAreas} placeholder={tx('mfano: Sinza, Mikocheni, Kinondoni')} />

      <Card>
        <Text style={styles.baseTitle}>{tx('Mahali ninapoanzia kazi')}</Text>
        <Text style={careStyles.muted}>
          {base
            ? `${base.lat.toFixed(4)}, ${base.lng.toFixed(4)} — ${tx('ofisi tu ndiyo inaona hili, kupima umbali')}`
            : tx('Hiari. Ofisi inaitumia kupima umbali tu; mteja hapaoni kamwe.')}
        </Text>
        <View style={careStyles.actions}>
          <ActionButton
            variant="ghost"
            icon="locate"
            title={base ? tx('Weka upya') : tx('Tumia mahali nilipo')}
            onPress={async () => {
              try {
                setBase(await currentPosition());
              } catch (err) {
                setError(err.message);
              }
            }}
          />
          {base ? <ActionButton variant="ghost" icon="close" title={tx('Ondoa')} onPress={() => setBase(null)} /> : null}
        </View>
      </Card>

      <View style={styles.save}>
        <ActionButton title={tx('Hifadhi')} icon="save-outline" busy={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hours: { flexDirection: 'row', gap: spacing.sm },
  baseTitle: { ...type.bodyStrong, color: colors.text, marginBottom: 2 },
  saved: { ...type.small, color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: 12, marginBottom: spacing.sm },
  save: { marginTop: spacing.md },
});
