import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { afyaAi } from '../../lib/api';
import { Button, Card, ErrorBox, Field } from '../../lib/ui';
import { colors, font, radius, spacing } from '../../lib/theme';

// Afya AI.
//
// The one screen in this app where the presentation carries real
// weight. When the API comes back with redFlag true it is telling the
// user to go to hospital now, and that has to look nothing like an
// ordinary answer — same colour, same card, same weight would bury it.
//
// The emergency panel is the only place in the app that uses the danger
// colour, so turning red means one thing and cannot be confused with
// decoration.

export default function Ask() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setAnswer(null);
    setBusy(true);
    try {
      const data = await afyaAi.ask(question.trim());
      setAnswer(data);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Uliza swali kuhusu afya au huduma zetu. Afya AI hujibu kutoka maandishi
          yaliyothibitishwa tu — haikisii.
        </Text>

        <ErrorBox error={error} />

        <Field
          label="Swali lako"
          placeholder="mfano: bei ya huduma ya uuguzi nyumbani"
          value={question}
          onChangeText={setQuestion}
          multiline
          numberOfLines={3}
          style={styles.textarea}
        />

        <Button
          title="Uliza"
          onPress={submit}
          loading={busy}
          disabled={question.trim().length < 3}
        />

        {answer ? <Answer answer={answer} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Answer({ answer }) {
  if (answer.redFlag) {
    return (
      <View style={styles.emergency}>
        <Text style={styles.emergencyHeading}>DHARURA</Text>
        <Text style={styles.emergencyBody}>{answer.answer}</Text>
        {answer.redFlagCategories?.length ? (
          <Text style={styles.emergencyMeta}>
            Imegundua: {answer.redFlagCategories.join(', ')}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Card style={styles.answerCard}>
      <Text style={styles.answerBody}>{answer.answer}</Text>
      {answer.outcome === 'NO_ANSWER' ? (
        <Text style={styles.answerMeta}>
          Hakuna jibu lililothibitishwa kwa swali hili bado.
        </Text>
      ) : null}
      {answer.outcome === 'ANSWERED' ? (
        <Text style={styles.answerMeta}>
          Jibu hili limetoka kwenye maandishi yaliyosainiwa na mtaalamu.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  intro: { fontSize: 14, color: colors.muted, marginBottom: spacing.lg, lineHeight: 20 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  answerCard: { marginTop: spacing.lg },
  answerBody: { fontSize: 16, color: colors.text, lineHeight: 24 },
  answerMeta: { fontSize: 12, color: colors.muted, marginTop: spacing.sm },

  emergency: {
    marginTop: spacing.lg,
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  emergencyHeading: {
    fontSize: 13,
    fontFamily: font.extrabold,
    color: colors.danger,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  emergencyBody: { fontSize: 17, color: colors.danger, lineHeight: 25, fontFamily: font.semibold },
  emergencyMeta: { fontSize: 12, color: colors.danger, marginTop: spacing.sm, opacity: 0.8 },
});
