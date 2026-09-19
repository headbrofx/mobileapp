import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { clientProfile, familyMembers, healthProfile, BASE_URL } from '../lib/api';
import { ErrorBox } from '../lib/ui';
import { BrandFooter, BrandHeader, CheckBox, GradientButton, IconField, Stepper } from '../lib/auth-ui';
import { colors, font, radius, spacing } from '../lib/theme';
import { tx, useI18n } from '../lib/i18n';

// Sign-up as the design lays it out: four steps, one thing at a time.
//
// The steps are not decoration over a single form — each one writes
// somewhere real. Personal details create the account, the address goes
// to the client profile, and the health details go to the health
// profile of the SELF family member the backend creates on
// registration. A step that had nowhere to save would have been left
// out rather than collected and dropped.
//
// Only the first step is required. Somebody who wants a nurse tonight
// can skip the rest and fill it in later from their profile; making a
// person type their allergies before they can ask for help would be the
// form serving itself.

const STEPS = ['Taarifa zako', 'Anwani', 'Afya', 'Tayari'];

const PRIVACY_URL = `${BASE_URL}/privacy`;

export default function Register() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const router = useRouter();
  const { register } = useSession();

  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Step 2
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Dar es Salaam');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Step 3
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [bloodType, setBloodType] = useState('');

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmitStepOne =
    name.trim().length >= 2 && phone.trim().length >= 10 && password.length >= 8 && passwordsMatch && agreed;

  // The account has to exist before there is a profile to write to, so
  // step 1 is the one that registers. Steps 2 and 3 then patch.
  async function createAccount() {
    setError(null);
    setBusy(true);
    try {
      await register({
        name: name.trim(),
        phone: phone.replace(/\s/g, ''),
        email: email.trim() || undefined,
        password,
      });
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress() {
    setError(null);
    setBusy(true);
    try {
      if (address.trim() || emergencyName.trim() || emergencyPhone.trim()) {
        await clientProfile.update({
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          emergencyContactName: emergencyName.trim() || undefined,
          emergencyContactPhone: emergencyPhone.replace(/\s/g, '') || undefined,
        });
      }
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveHealth() {
    setError(null);
    setBusy(true);
    try {
      const hasSomething = conditions.trim() || allergies.trim() || bloodType.trim();
      if (hasSomething) {
        const me = await familyMembers.self();
        if (me) {
          await healthProfile.update(me.id, {
            conditions: splitList(conditions),
            allergies: splitList(allergies),
            bloodType: bloodType.trim() || undefined,
          });
        }
      }
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader onBack={step === 0 ? () => router.back() : undefined} />

        <Text style={styles.title}>{tx('Fungua akaunti')}</Text>
        <Text style={styles.subtitle}>{tx('Jiunge na Afya Nyumbani upate huduma ya afya mlangoni kwako.')}</Text>

        <Stepper steps={STEPS} current={step} />

        <ErrorBox error={error} />

        {step === 0 ? (
          <>
            <IconField
              label={tx('Jina lako kamili')}
              icon="person-outline"
              placeholder={tx('Andika jina lako')}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <IconField
              label={tx('Namba ya simu')}
              icon="call-outline"
              placeholder="k.m. 0712 345 678"
              hint={tx('Tutaitumia kuwasiliana nawe')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <IconField
              label={tx('Barua pepe (si lazima)')}
              icon="mail-outline"
              placeholder={tx('jina@mfano.com')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <IconField
              label={tx('Nenosiri')}
              icon="lock-closed-outline"
              placeholder={tx('Herufi 8 au zaidi')}
              value={password}
              onChangeText={setPassword}
              secure
              autoCapitalize="none"
            />
            <IconField
              label={tx('Thibitisha nenosiri')}
              icon="lock-closed-outline"
              placeholder={tx('Andika tena')}
              value={confirm}
              onChangeText={setConfirm}
              secure
              autoCapitalize="none"
              error={confirm.length > 0 && !passwordsMatch ? 'Manenosiri hayafanani' : null}
            />

            <View style={styles.agreeRow}>
              <CheckBox checked={agreed} onToggle={() => setAgreed((on) => !on)}>
                <Text style={styles.agreeText}>
                  Nakubali{' '}
                  <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>{tx('Sera ya Faragha')}</Text>
                  .
                </Text>
              </CheckBox>
            </View>

            <GradientButton
              title={tx('Endelea')}
              onPress={createAccount}
              loading={busy}
              disabled={!canSubmitStepOne}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <IconField
              label={tx('Anwani ya nyumbani')}
              icon="location-outline"
              placeholder={tx('Mtaa, nyumba namba')}
              hint={tx('Hapa ndipo muuguzi atakapokuja')}
              value={address}
              onChangeText={setAddress}
            />
            <IconField
              label={tx('Mji')}
              icon="business-outline"
              placeholder="Dar es Salaam"
              value={city}
              onChangeText={setCity}
            />
            <IconField
              label={tx('Mtu wa dharura')}
              icon="people-outline"
              placeholder={tx('Jina lake')}
              value={emergencyName}
              onChangeText={setEmergencyName}
              autoCapitalize="words"
            />
            <IconField
              label={tx('Simu ya mtu wa dharura')}
              icon="call-outline"
              placeholder="0712 345 678"
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              keyboardType="phone-pad"
            />

            <GradientButton title={tx('Endelea')} onPress={saveAddress} loading={busy} />
            <SkipLink onPress={() => setStep(2)} disabled={busy} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={styles.note}>
              <Ionicons name="lock-closed" size={16} color={colors.primary} />
              <Text style={styles.noteText}>{tx('Haya ni yako peke yako. Muuguzi anayekuja kwako ndiye pekee atayaona.')}</Text>
            </View>

            <IconField
              label={tx('Magonjwa uliyonayo')}
              icon="medkit-outline"
              placeholder={tx('k.m. kisukari, shinikizo la damu')}
              hint={tx('Tenganisha kwa koma')}
              value={conditions}
              onChangeText={setConditions}
            />
            <IconField
              label={tx('Vitu unavyoathiriwa navyo')}
              icon="alert-circle-outline"
              placeholder={tx('k.m. penicillin')}
              hint={tx('Tenganisha kwa koma')}
              value={allergies}
              onChangeText={setAllergies}
            />
            <IconField
              label={tx('Aina ya damu')}
              icon="water-outline"
              placeholder="k.m. O+"
              value={bloodType}
              onChangeText={setBloodType}
              autoCapitalize="characters"
            />

            <GradientButton title={tx('Endelea')} onPress={saveHealth} loading={busy} />
            <SkipLink onPress={() => setStep(3)} disabled={busy} />
          </>
        ) : null}

        {step === 3 ? (
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={34} color={colors.onPrimary} />
            </View>
            <Text style={styles.doneTitle}>Karibu, {name.split(' ')[0] || 'rafiki'}!</Text>
            <Text style={styles.doneText}>{tx('Akaunti yako iko tayari. Sasa unaweza kuomba muuguzi aje nyumbani kwako.')}</Text>
            <View style={styles.doneAction}>
              <GradientButton title={tx('Anza')} onPress={() => router.replace('/home')} icon="home" />
            </View>
          </View>
        ) : null}

        {step === 0 ? (
          <View style={styles.loginRow}>
            <Text style={styles.muted}>{tx('Una akaunti tayari?')}</Text>
            <Pressable onPress={() => router.replace('/login')} accessibilityRole="button" hitSlop={8}>
              <View style={styles.linkRow}>
                <Text style={styles.link}>{tx('Ingia')}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </View>
            </Pressable>
          </View>
        ) : null}

        <BrandFooter words={['Afya', 'kwa', 'kila nyumba']} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SkipLink({ onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
    >
      <Text style={styles.skipText}>{tx('Ruka kwa sasa')}</Text>
    </Pressable>
  );
}

// "kisukari, shinikizo la damu" -> ['kisukari', 'shinikizo la damu']
function splitList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  pressed: { opacity: 0.75 },

  title: { fontSize: 26, fontFamily: font.extrabold, color: colors.text, marginTop: spacing.lg },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 3, marginBottom: spacing.lg, lineHeight: 19 },

  agreeRow: { marginBottom: spacing.lg },
  agreeText: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  link: { color: colors.primary, fontFamily: font.bold, fontSize: 13 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  noteText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },

  skip: { alignItems: 'center', paddingVertical: spacing.md },
  skipText: { color: colors.muted, fontSize: 13, fontFamily: font.semibold },

  done: { alignItems: 'center', paddingVertical: spacing.md },
  doneIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  doneTitle: { fontSize: 20, fontFamily: font.extrabold, color: colors.text },
  doneText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  doneAction: { alignSelf: 'stretch' },

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  muted: { color: colors.muted, fontSize: 13 },
});
