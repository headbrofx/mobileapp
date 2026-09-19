import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { afyaAi } from '../../../lib/api';
import { MenuButton } from '../../../lib/ui';
import { colors, font, radius, shadow, spacing, type } from '../../../lib/theme';
import { tx, useI18n } from '../../../lib/i18n';

// Afya AI, as a conversation.
//
// This used to be a form: one box, one button, one answer that replaced
// the last one. People do not ask a nurse a single question and leave —
// they ask a second one about the first answer, and a form throws the
// first answer away the moment they do. A thread keeps it.
//
// The presentation carries real weight here. When the API returns
// redFlag true it is telling somebody to go to hospital now, and that
// cannot look like an ordinary reply — same bubble, same colour, same
// weight would bury it. The emergency style is the only place in the app
// that uses the danger colour, so red means one thing and cannot be read
// as decoration.
//
// Nothing here invents an answer. The server replies out of signed-off
// writing or it says it has none, and NO_ANSWER is shown as plainly as
// an answer is. An AI that guesses about somebody's health is worse than
// one that admits it does not know.

const SUGGESTIONS = [
  'Bei ya huduma ya uuguzi nyumbani ni ngapi?',
  'Mnatoa huduma gani kwa wazee?',
  'Naweza kuomba muuguzi wa kubadilisha bandeji?',
  'Huduma ya baada ya kujifungua inahusisha nini?',
];

export default function Ask() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const insets = useSafeAreaInsets();
  const scroller = useRef(null);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const toBottom = useCallback(() => {
    // The layout has not settled on the frame the message is added, so
    // the scroll has to wait for it or it lands short.
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (text) => {
      const asked = (typeof text === 'string' ? text : question).trim();
      if (asked.length < 3 || busy) return;

      setQuestion('');
      setMessages((prev) => [...prev, { id: `q${Date.now()}`, role: 'user', text: asked }]);
      setBusy(true);
      toBottom();

      try {
        const data = await afyaAi.ask(asked);
        setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: 'ai', data }]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: `e${Date.now()}`, role: 'error', text: err.message },
        ]);
      } finally {
        setBusy(false);
        toBottom();
      }
    },
    [question, busy, toBottom]
  );

  const empty = messages.length === 0 && !busy;
  const canSend = !busy && question.trim().length >= 3;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      {/* Afya AI is a tab now, so the header is part of the screen. It
          sits outside the ScrollView: a chat header that scrolls away
          takes the way out of the conversation with it. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <MenuButton />
        <Text style={styles.headerTitle}>Afya AI</Text>
        <Pressable
          onPress={() => setMessages([])}
          disabled={messages.length === 0}
          accessibilityRole="button"
          accessibilityLabel={tx('Anza mazungumzo mapya')}
          hitSlop={8}
          style={({ pressed }) => [pressed && styles.pressed, messages.length === 0 && styles.faded]}
        >
          <Ionicons name="create-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        style={styles.flex}
        contentContainerStyle={[styles.thread, empty && styles.threadEmpty]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={toBottom}
      >
        {empty ? <Welcome onPick={send} /> : null}

        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {busy ? <Thinking /> : null}
      </ScrollView>

      {/* The composer is pinned to the foot of the screen rather than
          sitting in the scroll, so the place you type never moves and
          never scrolls away mid-conversation. */}
      <View style={[styles.composerBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.composer}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={tx('Uliza swali lolote la afya…')}
            placeholderTextColor={colors.subtle}
            style={styles.input}
            multiline
            maxLength={500}
            onSubmitEditing={() => send()}
            blurOnSubmit={false}
            accessibilityLabel={tx('Swali lako')}
          />

          <Pressable
            onPress={() => send()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={tx('Tuma swali')}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendButtonOff,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
            )}
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>{tx('Afya AI hujibu kutoka maandishi yaliyothibitishwa tu. Si mbadala wa daktari.')}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- The empty state --------------------------------------------------
//
// Four real questions rather than a blank page. A chat box with nothing
// in it asks the user to guess what it is allowed to be asked, and most
// people guess wrong once and never come back.

function Welcome({ onPick }) {
  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeBadge}>
        <Ionicons name="sparkles" size={26} color={colors.primary} />
      </View>
      <Text style={styles.welcomeTitle}>Afya AI</Text>
      <Text style={styles.welcomeBody}>{tx('Uliza kuhusu afya yako au huduma zetu. Majibu yanatoka kwenye maandishi yaliyopitiwa na mtaalamu — hakuna kubahatisha.')}</Text>

      <View style={styles.chips}>
        {SUGGESTIONS.map((text) => (
          <Pressable
            key={text}
            onPress={() => onPick(text)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>{tx(text)}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Thinking() {
  return (
    <View style={styles.aiRow}>
      <Avatar />
      <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Text style={styles.thinkingText}>{tx('Inatafuta jibu…')}</Text>
      </View>
    </View>
  );
}

function Avatar() {
  return (
    <View style={styles.avatar}>
      <Ionicons name="sparkles" size={15} color={colors.primary} />
    </View>
  );
}

function Message({ message }) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  if (message.role === 'error') {
    return (
      <View style={styles.aiRow}>
        <Avatar />
        <View style={[styles.bubble, styles.aiBubble]}>
          <Text style={styles.errorText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  const { data } = message;

  // The one reply that does not get a bubble. It gets the full width, a
  // red rule and a heading, because somebody reading this quickly on a
  // phone needs to know inside a second that it is different.
  if (data.redFlag) {
    return (
      <View style={styles.emergency}>
        <View style={styles.emergencyHead}>
          <Ionicons name="warning" size={18} color={colors.danger} />
          <Text style={styles.emergencyHeading}>{tx('DHARURA')}</Text>
        </View>
        <Text style={styles.emergencyBody}>{data.answer}</Text>
        {data.redFlagCategories?.length ? (
          <Text style={styles.emergencyMeta}>Imegundua: {data.redFlagCategories.join(', ')}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.aiRow}>
      <Avatar />
      <View style={[styles.bubble, styles.aiBubble]}>
        <Text style={styles.aiText}>{data.answer}</Text>

        {data.outcome === 'ANSWERED' ? (
          <View style={styles.source}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.success} />
            <Text style={styles.sourceText}>{tx('Limetoka kwenye maandishi yaliyosainiwa na mtaalamu')}</Text>
          </View>
        ) : null}

        {data.outcome === 'NO_ANSWER' ? (
          <View style={styles.source}>
            <Ionicons name="help-circle-outline" size={13} color={colors.muted} />
            <Text style={styles.sourceText}>{tx('Hakuna jibu lililothibitishwa kwa swali hili bado')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...type.section, color: colors.text, flex: 1 },
  faded: { opacity: 0.3 },
  thread: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  threadEmpty: { flexGrow: 1, justifyContent: 'center' },

  // --- Empty state ---
  welcome: { alignItems: 'center', paddingHorizontal: spacing.xs },
  welcomeBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  welcomeTitle: { ...type.title, color: colors.text },
  welcomeBody: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  chips: { alignSelf: 'stretch', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  chipText: { ...type.bodyStrong, color: colors.text, flex: 1 },

  // --- Bubbles ---
  userRow: { alignItems: 'flex-end' },
  aiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: { maxWidth: '84%', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  userBubble: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
  },
  userText: { ...type.body, color: colors.onPrimary },
  aiBubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 1,
    ...shadow.card,
  },
  aiText: { ...type.body, color: colors.text, lineHeight: 22 },
  errorText: { ...type.body, color: colors.danger },

  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  sourceText: { ...type.tiny, color: colors.muted, flex: 1 },

  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  thinkingText: { ...type.small, color: colors.muted },

  // --- Emergency ---
  emergency: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  emergencyHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  emergencyHeading: {
    fontSize: 13,
    fontFamily: font.extrabold,
    color: colors.danger,
    letterSpacing: 1.2,
  },
  emergencyBody: { fontSize: 17, color: colors.danger, lineHeight: 25, fontFamily: font.semibold },
  emergencyMeta: { ...type.small, color: colors.danger, marginTop: spacing.sm, opacity: 0.85 },

  // --- Composer ---
  composerBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    // Bottom, not centre: the send button stays level with the last line
    // of a question that has grown to three, rather than drifting up the
    // middle of the box.
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingLeft: spacing.md,
    paddingRight: 5,
    paddingVertical: 5,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.text,
    maxHeight: 120,
    minHeight: 38,
    paddingTop: 9,
    paddingBottom: 9,
    // Web draws its own focus ring on top of the rounded box.
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  sendButtonOff: {
    backgroundColor: colors.subtle,
    ...Platform.select({ ios: { shadowOpacity: 0 }, default: { elevation: 0 } }),
  },
  pressed: { opacity: 0.85 },

  disclaimer: {
    ...type.tiny,
    color: colors.subtle,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
