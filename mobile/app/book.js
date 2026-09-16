import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { bookings, familyMembers, services as servicesApi } from '../lib/api';
import { Button, Card, ErrorBox, Field } from '../lib/ui';
import { colors, radius, spacing } from '../lib/theme';

// Requesting a home visit.
//
// The API wants a serviceId, a familyMemberId and an ISO timestamp. A
// person has none of those, so this screen's whole job is turning
// "nurse, for my mother, tomorrow morning" into them.

const WHEN_OPTIONS = [
  { label: 'Kesho asubuhi', hoursAhead: 24, hour: 9 },
  { label: 'Kesho jioni', hoursAhead: 24, hour: 16 },
  { label: 'Keshokutwa asubuhi', hoursAhead: 48, hour: 9 },
];

function toScheduledAt({ hoursAhead, hour }) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  // Times are chosen in the user's own clock, which is what they mean
  // by "tomorrow morning". The API stores the instant.
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export default function Book() {
  const router = useRouter();

  const [members, setMembers] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [memberId, setMemberId] = useState(null);
  const [serviceId, setServiceId] = useState(null);
  const [when, setWhen] = useState(WHEN_OPTIONS[0]);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [memberData, serviceData] = await Promise.all([
          familyMembers.list(),
          servicesApi.list(),
        ]);
        const list = memberData?.familyMembers ?? [];
        const cat = serviceData?.services ?? [];
        setMembers(list);
        setCatalogue(cat);
        // Most requests are for the account holder and the commonest
        // service, so pre-select both rather than making every booking
        // start with two taps.
        if (list.length) setMemberId(list[0].id);
        if (cat.length) setServiceId(cat[0].id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await bookings.create({
        familyMemberId: memberId,
        serviceId,
        locationAddress: address.trim(),
        scheduledAt: toScheduledAt(when),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <View style={styles.doneWrap}>
        <Text style={styles.doneTitle}>Ombi limepokelewa</Text>
        <Text style={styles.doneBody}>
          Tutakupangia muuguzi na utaona hali ya ombi lako kwenye ukurasa wa mwanzo.
        </Text>
        <Button title="Rudi mwanzo" onPress={() => router.replace('/home')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBox error={error} />

        {loading ? (
          <Card>
            <Text style={styles.muted}>Inapakia…</Text>
          </Card>
        ) : (
          <>
            <Text style={styles.heading}>Huduma</Text>
            {catalogue.map((service) => (
              <Choice
                key={service.id}
                selected={service.id === serviceId}
                onPress={() => setServiceId(service.id)}
                title={service.name}
                subtitle={
                  service.basePriceTzs
                    ? `Kuanzia TZS ${service.basePriceTzs.toLocaleString('en-US')}`
                    : service.description
                }
              />
            ))}

            <Text style={styles.heading}>Ni kwa ajili ya nani</Text>
            {members.map((member) => (
              <Choice
                key={member.id}
                selected={member.id === memberId}
                onPress={() => setMemberId(member.id)}
                title={member.fullName ?? member.name}
                subtitle={member.relationship === 'SELF' ? 'Wewe mwenyewe' : member.relationship}
              />
            ))}

            <Text style={styles.heading}>Lini</Text>
            {WHEN_OPTIONS.map((option) => (
              <Choice
                key={option.label}
                selected={option.label === when.label}
                onPress={() => setWhen(option)}
                title={option.label}
              />
            ))}

            <View style={styles.spacer} />

            <Field
              label="Mahali"
              placeholder="mfano: Masaki, karibu na shule ya msingi"
              value={address}
              onChangeText={setAddress}
            />
            <Field
              label="Maelezo (hiari)"
              placeholder="Chochote muuguzi anapaswa kujua kabla hajafika"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.textarea}
            />

            <Button
              title="Tuma ombi"
              onPress={submit}
              loading={busy}
              disabled={!memberId || !serviceId || address.trim().length < 3}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Choice({ selected, onPress, title, subtitle }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  choice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  choiceSelected: { borderColor: colors.primary, borderWidth: 2 },
  choiceTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  choiceTitleSelected: { color: colors.primary },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  spacer: { height: spacing.md },

  doneWrap: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  doneTitle: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  doneBody: { fontSize: 15, color: colors.muted, lineHeight: 22, marginBottom: spacing.lg },
});
