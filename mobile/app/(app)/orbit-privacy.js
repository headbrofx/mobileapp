import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { familyMembers, orbit as orbitApi } from '../../lib/api';
import { ErrorBox } from '../../lib/ui';
import { tx, useI18n } from '../../lib/i18n';
import { NotYet, OrbitCard, SectionTitle, orbit } from '../../lib/orbit-ui';
import { colors, font, fs, radius, scale, spacing, type } from '../../lib/theme';

// The Privacy Centre.
//
// The privacy policy already promised four rights — to see what is
// held, to correct it, to have a copy, and to ask for deletion — and
// the only way to use any of them was to email the business and wait.
// For a module that knows when somebody bleeds, that is the wrong way
// round: the more intimate the data, the less its control should
// depend on somebody answering an email.
//
// The screen is deliberately plain. No reassuring illustration, no
// "your data is safe with us" banner. Numbers she can check against
// her own memory, the fields named in her words, and two buttons that
// do exactly what they say.

export default function OrbitPrivacy() {
  useI18n();
  const router = useRouter();

  const [memberId, setMemberId] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const members = await familyMembers.list();
      const list = members?.familyMembers ?? [];
      const self = list.find((m) => m.relationship === 'SELF') ?? list[0];
      if (!self) return;
      setMemberId(self.id);

      const data = await orbitApi.privacy(self.id);
      setPrivacy(data?.privacy ?? null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function takeCopy() {
    if (!memberId) return;
    setBusy('export');
    setError(null);
    try {
      const text = await orbitApi.exportRaw(memberId);
      const filename = `orbit-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === 'web') {
        // A real file on disk. A copy of somebody's periods should not
        // be left sitting in a browser tab on a shared phone.
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // No file library ships with this app, so the share sheet is
        // the honest option: she chooses where it goes, and nothing is
        // written anywhere she did not pick.
        await Share.share({ title: filename, message: text });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function forget(scope) {
    if (!memberId) return;
    setBusy(scope);
    setError(null);
    try {
      await orbitApi.forget(memberId, scope);
      setConfirming(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const nothingYet = privacy && privacy.deletable === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ErrorBox error={error} />

      <OrbitCard>
        <SectionTitle title={tx('Orbit inakumbuka nini')} />
        {privacy ? (
          <View style={styles.rows}>
            <Held
              label={tx('Uchunguzi wa kila siku')}
              held={privacy.dailyCheckins}
              fields={privacy.fields.dailyCheckins}
            />
            <Held
              label={tx('Kumbukumbu za mzunguko')}
              held={privacy.cycleRecords}
              fields={privacy.fields.cycleRecords}
            />
          </View>
        ) : (
          <NotYet text={tx('Inapakia…')} />
        )}
      </OrbitCard>

      {privacy?.notKept?.length ? (
        <OrbitCard>
          <SectionTitle title={tx('Hatuhifadhi')} />
          {privacy.notKept.map((line) => (
            <View key={line} style={styles.notKeptRow}>
              <Ionicons name="close-circle" size={15} color={orbit.inkFaint} />
              <Text style={styles.notKeptText}>{line}</Text>
            </View>
          ))}
        </OrbitCard>
      ) : null}

      <OrbitCard>
        <SectionTitle title={tx('Chukua nakala yako')} />
        <Text style={styles.body}>
          {tx('Utapata safu zako zilivyo, si muhtasari wake — kila ulichoandika mwenyewe.')}
        </Text>
        <Pressable
          onPress={takeCopy}
          disabled={busy !== null || nothingYet}
          style={({ pressed }) => [
            styles.action,
            (busy !== null || nothingYet) && styles.actionOff,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="download-outline" size={17} color={orbit.plum} />
          <Text style={styles.actionText}>
            {busy === 'export' ? tx('Inaandaa…') : tx('Pakua nakala')}
          </Text>
        </Pressable>
      </OrbitCard>

      <OrbitCard>
        <SectionTitle title={tx('Futa ulichoandika')} />
        <Text style={styles.body}>
          {tx('Hiki ni chako — uliandika mwenyewe, na unaweza kukiondoa. Hakuna kurudisha baadaye.')}
        </Text>

        <Forget
          scope="CHECKINS"
          label={tx('Futa uchunguzi wa kila siku')}
          count={privacy?.dailyCheckins?.count ?? 0}
          {...{ confirming, setConfirming, busy, forget }}
        />
        <Forget
          scope="CYCLES"
          label={tx('Futa kumbukumbu za mzunguko')}
          count={privacy?.cycleRecords?.count ?? 0}
          {...{ confirming, setConfirming, busy, forget }}
        />
        <Forget
          scope="ORBIT"
          label={tx('Futa kila kitu cha Orbit')}
          count={privacy?.deletable ?? 0}
          {...{ confirming, setConfirming, busy, forget }}
        />

        {/* Said here rather than left for somebody to discover after
            pressing a button. What the business is obliged to keep is
            not hers to delete, and pretending otherwise would be the
            worse promise. */}
        <View style={styles.kept}>
          <Ionicons name="information-circle-outline" size={15} color={orbit.inkSoft} />
          <Text style={styles.keptText}>
            {tx(
              'Ziara, ankara na kumbukumbu za matibabu hazifutwi hapa. Hizo ni nyaraka za huduma tuliyokupa na sheria inatutaka tuzitunze. Ukitaka kufuta akaunti yako yote, wasiliana nasi.'
            )}
          </Text>
        </View>
      </OrbitCard>

      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{tx('Rudi')}</Text>
      </Pressable>
    </ScrollView>
  );
}

// One kind of record: how much, since when, and exactly which fields.
//
// The count is the point. "Umeandika mara 43 tangu 12 Julai" is
// something she can check against her own memory; "tunahifadhi taarifa
// zako kwa usalama" is a sentence that cannot be checked at all.
function Held({ label, held, fields }) {
  return (
    <View style={styles.held}>
      <View style={styles.heldHead}>
        <Text style={styles.heldLabel}>{label}</Text>
        <Text style={styles.heldCount}>{held.count}</Text>
      </View>
      {held.count > 0 ? (
        <Text style={styles.heldRange}>
          {tx('Tangu')} {String(held.firstRecorded).slice(0, 10)} {tx('hadi')}{' '}
          {String(held.lastRecorded).slice(0, 10)}
        </Text>
      ) : (
        <Text style={styles.heldRange}>{tx('Hujaandika chochote bado')}</Text>
      )}
      <View style={styles.fields}>
        {fields.map((f) => (
          <Text key={f} style={styles.field}>
            · {f}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Two taps, never one.
//
// The second tap is not a dialog asking "are you sure" — it is the
// button itself changing to say what is about to be destroyed and how
// much of it. A confirmation that repeats the number is harder to
// press by accident than one that says "confirm".
function Forget({ scope, label, count, confirming, setConfirming, busy, forget }) {
  const armed = confirming === scope;
  const disabled = count === 0 || busy !== null;

  if (armed) {
    return (
      <View style={styles.armedRow}>
        <Pressable
          onPress={() => forget(scope)}
          style={({ pressed }) => [styles.armed, pressed && styles.pressed]}
        >
          <Ionicons name="trash" size={16} color="#FFFFFF" />
          <Text style={styles.armedText}>
            {busy === scope ? tx('Inafuta…') : `${tx('Futa')} ${count} — ${tx('kabisa')}`}
          </Text>
        </Pressable>
        <Pressable onPress={() => setConfirming(null)} style={styles.cancel}>
          <Text style={styles.cancelText}>{tx('Acha')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setConfirming(scope)}
      disabled={disabled}
      style={({ pressed }) => [styles.danger, disabled && styles.actionOff, pressed && styles.pressed]}
    >
      <Ionicons name="trash-outline" size={16} color={disabled ? orbit.inkFaint : colors.danger} />
      <Text style={[styles.dangerText, disabled && styles.dangerTextOff]}>{label}</Text>
      <Text style={[styles.dangerCount, disabled && styles.dangerTextOff]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: orbit.page },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  pressed: { opacity: 0.85 },

  rows: { gap: spacing.md, marginTop: spacing.xs },
  held: { gap: 2 },
  heldHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heldLabel: { fontSize: fs(14), fontFamily: font.semibold, color: orbit.ink },
  heldCount: { fontSize: fs(20), fontFamily: font.extrabold, color: orbit.plum },
  heldRange: { ...type.tiny, color: orbit.inkSoft },
  fields: { marginTop: 4, gap: 1 },
  field: { fontSize: fs(11), color: orbit.inkFaint, lineHeight: scale(16) },

  notKeptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  notKeptText: { ...type.small, color: orbit.inkSoft, flex: 1 },

  body: { ...type.small, color: orbit.inkSoft, lineHeight: scale(19), marginTop: 2 },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: spacing.sm,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: orbit.plumLine,
    backgroundColor: orbit.plumSoft,
  },
  actionOff: { opacity: 0.45 },
  actionText: { fontSize: fs(14), fontFamily: font.semibold, color: orbit.plum },

  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerText: { flex: 1, fontSize: fs(13), fontFamily: font.semibold, color: colors.danger },
  dangerCount: { fontSize: fs(13), fontFamily: font.bold, color: colors.danger },
  dangerTextOff: { color: orbit.inkFaint },

  armedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  armed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  armedText: { fontSize: fs(13), fontFamily: font.bold, color: '#FFFFFF' },
  cancel: { paddingHorizontal: spacing.md, paddingVertical: 12 },
  cancelText: { fontSize: fs(13), fontFamily: font.semibold, color: orbit.inkSoft },

  kept: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: orbit.plumLine,
  },
  keptText: { ...type.tiny, color: orbit.inkSoft, flex: 1, lineHeight: scale(16) },

  back: { alignSelf: 'center', paddingVertical: spacing.sm },
  backText: { fontSize: fs(14), fontFamily: font.semibold, color: orbit.plum },
});
