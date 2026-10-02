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
import { colors, font, fs, radius, scale, shadow, spacing, type } from '../../../lib/theme';
import { tx, useI18n } from '../../../lib/i18n';

// Afya AI, in the same theme as every other screen.
//
// It used to be the one screen on navy, with glass cards, a glowing orb
// and its own tab bar colour. The owner found that busy and out of step
// with the rest of the app, so it now uses the app's own surfaces: the
// page background, white cards, and the theme's primary for anything
// that is the user's or is a control.
//
// What the look does not change is the substance. The server answers
// out of writing somebody signed off, or it says it has none, and
// NO_ANSWER is shown as plainly as an answer is. An AI that guesses
// about somebody's health is worse than one that admits it does not
// know. The emergency reply still breaks out of the bubbles entirely,
// in the theme's reserved danger red.

const SUGGESTIONS = [
  { icon: 'help-circle-outline', text: 'Bei ya huduma ya uuguzi nyumbani ni ngapi?' },
  { icon: 'medical-outline', text: 'Mnatoa huduma gani kwa wazee?' },
  { icon: 'bandage-outline', text: 'Naweza kuomba muuguzi wa kubadilisha bandeji?' },
  { icon: 'heart-outline', text: 'Huduma ya baada ya kujifungua inahusisha nini?' },
];

export default function Ask() {
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
        setMessages((prev) => [...prev, { id: `e${Date.now()}`, role: 'error', text: err.message }]);
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
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      {/* Outside the scroll: a chat header that scrolls away takes the
          way out of the conversation with it. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <MenuButton />

        <View style={styles.headerMark}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Afya AI</Text>
          <Text style={styles.headerSub}>{tx('Majibu yaliyothibitishwa na mtaalamu')}</Text>
        </View>

        <Pressable
          onPress={() => setMessages([])}
          disabled={messages.length === 0}
          accessibilityRole="button"
          accessibilityLabel={tx('Anza mazungumzo mapya')}
          hitSlop={8}
          style={({ pressed }) => [styles.newChat, pressed && styles.pressed, messages.length === 0 && styles.faded]}
        >
          <Ionicons name="create-outline" size={19} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        style={styles.flex}
        contentContainerStyle={styles.thread}
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
            style={({ pressed }) => [styles.send, !canSend && styles.sendOff, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
            )}
          </Pressable>
        </View>

        <View style={styles.disclaimerRow}>
          <Ionicons name="shield-checkmark-outline" size={12} color={colors.muted} />
          <Text style={styles.disclaimer}>
            {tx('Afya AI hujibu kutoka maandishi yaliyothibitishwa tu. Si mbadala wa daktari.')}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- The empty state --------------------------------------------------

function Welcome({ onPick }) {
  return (
    <View>
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeIcon}>
          <Ionicons name="sparkles" size={24} color={colors.onPrimary} />
        </View>
        <Text style={styles.welcomeTitle}>{tx('Uliza Afya AI')}</Text>
        <Text style={styles.welcomeBody}>
          {tx(
            'Uliza kuhusu afya yako au huduma zetu. Majibu yanatoka kwenye maandishi yaliyopitiwa na mtaalamu — hakuna kubahatisha.'
          )}
        </Text>
      </View>

      <Text style={styles.chipsHead}>{tx('Maswali ya mfano')}</Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((item) => (
          <Pressable
            key={item.text}
            onPress={() => onPick(item.text)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <View style={styles.chipIcon}>
              <Ionicons name={item.icon} size={18} color={colors.primary} />
            </View>
            <Text style={styles.chipText}>{tx(item.text)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
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
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.thinkingText}>{tx('Inatafuta jibu…')}</Text>
      </View>
    </View>
  );
}

function Avatar() {
  return (
    <View style={styles.avatar}>
      <Ionicons name="sparkles" size={13} color={colors.primary} />
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

  // The one reply that does not get a bubble. It takes the full width, a
  // red border and a heading, because somebody reading this quickly on a
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
          <Text style={styles.emergencyMeta}>
            {tx('Imegundua:')} {data.redFlagCategories.join(', ')}
          </Text>
        ) : null}
      </View>
    );
  }

  const sections = data.sections ?? null;

  return (
    <View style={styles.aiRow}>
      <Avatar />
      <View style={[styles.bubble, styles.aiBubble, sections && styles.aiBubbleWide]}>
        {/* The opening line, always. When sections exist this is the
            summary above them; when they do not, it is the answer. */}
        <Text style={styles.aiText}>{data.answer}</Text>

        {sections ? <Sections sections={sections} /> : null}

        {/* A weak match says so in a sentence, not as a percentage. A
            number beside a health answer reads as "probably true" when
            what it measures is word overlap. */}
        {data.confidence === 'LOW' ? (
          <View style={styles.caution}>
            <Ionicons name="alert-circle-outline" size={13} color={colors.caution} />
            <Text style={styles.cautionText}>
              {tx('Jibu hili halilingani vizuri na swali lako. Kama halikujibu, muulize muuguzi.')}
            </Text>
          </View>
        ) : null}

        {data.references?.length ? <References items={data.references} /> : null}

        {data.outcome === 'ANSWERED' && !data.references?.length ? (
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

// --- The six-part answer ----------------------------------------------
//
// Written by whoever reviewed the entry, not assembled here. Vetted
// clinical text is set apart from the conversational line above it, so
// a reader can see which part of the bubble somebody qualified actually
// signed. "When it is urgent" carries the danger colour: it is the one
// section that is about leaving the app.

const SECTION_ORDER = [
  { key: 'whatMayBeHappening', label: 'Kinachoweza kuwa kinatokea', icon: 'information-circle-outline' },
  { key: 'whatToMonitor', label: 'Cha kufuatilia', icon: 'eye-outline' },
  { key: 'selfCare', label: 'Unachoweza kufanya', icon: 'leaf-outline' },
  { key: 'whenToSeekAdvice', label: 'Lini kuona mtaalamu', icon: 'medkit-outline' },
  { key: 'whenUrgent', label: 'Lini ni dharura', icon: 'warning-outline', urgent: true },
];

function Sections({ sections }) {
  const present = SECTION_ORDER.filter((s) => sections[s.key]);
  if (present.length === 0) return null;

  return (
    <View style={styles.sections}>
      {present.map((section) => (
        <View key={section.key} style={[styles.section, section.urgent && styles.sectionUrgent]}>
          <View style={styles.sectionHead}>
            <Ionicons name={section.icon} size={13} color={section.urgent ? colors.danger : colors.primary} />
            <Text style={[styles.sectionLabel, section.urgent && styles.sectionLabelUrgent]}>{tx(section.label)}</Text>
          </View>
          <Text style={[styles.sectionBody, section.urgent && styles.sectionBodyUrgent]}>{sections[section.key]}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Where it came from -----------------------------------------------
//
// Titles, sources and the date a professional signed them off. A reader
// who cannot see where an answer came from has no way to weigh it.

function References({ items }) {
  return (
    <View style={styles.refs}>
      <Text style={styles.refsHead}>{tx('Chanzo')}</Text>
      {items.map((ref) => (
        <View key={ref.id} style={styles.ref}>
          <Ionicons
            name={ref.reviewed ? 'shield-checkmark' : 'shield-outline'}
            size={12}
            color={ref.reviewed ? colors.success : colors.subtle}
          />
          <View style={styles.refText}>
            <Text style={styles.refTitle}>{ref.title}</Text>
            {ref.source ? <Text style={styles.refSource}>{ref.source}</Text> : null}
            {ref.reviewedAt ? (
              <Text style={styles.refMeta}>
                {tx('Ilipitiwa')} {String(ref.reviewedAt).slice(0, 10)} · v{ref.contentVersion}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  faded: { opacity: 0.35 },

  // --- Header: the same white bar as the booking screen ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: fs(16), fontFamily: font.bold, color: colors.text },
  headerSub: { ...type.tiny, fontSize: fs(10), color: colors.muted },
  newChat: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Thread ---
  thread: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },

  // --- Welcome ---
  welcomeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.card,
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  welcomeTitle: { ...type.title, color: colors.text },
  welcomeBody: { ...type.body, color: colors.muted, textAlign: 'center', marginTop: spacing.xs, lineHeight: scale(21) },

  chipsHead: { ...type.section, color: colors.text, marginBottom: spacing.sm },
  chips: { gap: spacing.xs + 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    ...shadow.card,
  },
  chipPressed: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...type.body, color: colors.text, flex: 1 },

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
  userBubble: { backgroundColor: colors.primary, borderRadius: radius.lg, borderBottomRightRadius: radius.sm / 2 },
  userText: { ...type.body, color: colors.onPrimary },
  aiBubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm / 2,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexShrink: 1,
    ...shadow.card,
  },
  aiBubbleWide: { maxWidth: '96%' },
  aiText: { ...type.body, color: colors.text, lineHeight: scale(22) },

  sections: { marginTop: spacing.sm, gap: spacing.xs },
  section: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sectionUrgent: { borderLeftColor: colors.danger, backgroundColor: colors.dangerBg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionLabel: { ...type.label, fontSize: fs(11.5), color: colors.primary },
  sectionLabelUrgent: { color: colors.danger },
  sectionBody: { ...type.small, color: colors.text, lineHeight: scale(19), marginTop: 2 },
  sectionBodyUrgent: { color: colors.danger },

  caution: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: spacing.sm,
    backgroundColor: colors.cautionBg,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  cautionText: { ...type.tiny, color: colors.caution, flex: 1, lineHeight: scale(15) },

  refs: { marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.hairline, gap: spacing.xs },
  refsHead: { ...type.tiny, fontFamily: font.bold, color: colors.muted },
  ref: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  refText: { flex: 1 },
  refTitle: { ...type.tiny, fontFamily: font.semibold, color: colors.text },
  refSource: { ...type.tiny, fontSize: fs(9.5), color: colors.muted },
  refMeta: { ...type.tiny, fontSize: fs(9.5), color: colors.subtle },
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
  emergencyHeading: { fontSize: fs(13), fontFamily: font.extrabold, color: colors.danger, letterSpacing: 1.2 },
  emergencyBody: { fontSize: fs(16), color: colors.danger, lineHeight: fs(24), fontFamily: font.semibold },
  emergencyMeta: { ...type.small, color: colors.danger, marginTop: spacing.sm, opacity: 0.85 },

  // --- Composer ---
  composerBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composer: {
    flexDirection: 'row',
    // Bottom, not centre: the send button stays level with the last line
    // of a question that has grown to three.
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
    minHeight: 40,
    paddingTop: 10,
    paddingBottom: 10,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },

  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  disclaimer: { ...type.tiny, fontSize: fs(10), color: colors.muted, flexShrink: 1 },
});
