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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { afyaAi } from '../../../lib/api';
import { MenuButton } from '../../../lib/ui';
import { dark, font, radius, scale, spacing, type } from '../../../lib/theme';
import { tx, useI18n } from '../../../lib/i18n';

// Afya AI, on the dark screen the owner asked for.
//
// This is the one place in the app that does not follow the theme
// picker, and lib/theme.js says why: it is built from the blue and the
// orange in the business's own logo, so it reads as the same company
// whichever theme is on. Everything here — the glass cards, the orb,
// the glow under the composer — is those two colours at different
// strengths against navy.
//
// What the dark does not change is the substance. The server answers
// out of writing somebody signed off, or it says it has none, and
// NO_ANSWER is shown as plainly as an answer is. An AI that guesses
// about somebody's health is worse than one that admits it does not
// know. The emergency reply still breaks out of the bubbles entirely,
// in a red lifted off the light theme's, because a dark screen
// swallows the darker one.

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
    <View style={styles.screen}>
      <Backdrop />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        {/* Outside the scroll: a chat header that scrolls away takes the
            way out of the conversation with it. */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
          <View style={styles.iconButton}>
            <MenuButton tint={dark.text} />
          </View>

          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>
              Afya <Text style={styles.headerTitleAccent}>AI</Text>
            </Text>
            <Text style={styles.headerSub}>Afya Nyumbani</Text>
          </View>

          <Pressable
            onPress={() => setMessages([])}
            disabled={messages.length === 0}
            accessibilityRole="button"
            accessibilityLabel={tx('Anza mazungumzo mapya')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              styles.iconButtonAccent,
              pressed && styles.pressed,
              messages.length === 0 && styles.faded,
            ]}
          >
            <Ionicons name="create-outline" size={20} color={dark.accent} />
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

        <View style={[styles.composerBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <View style={styles.composer}>
            <View style={styles.composerSpark}>
              <Ionicons name="sparkles" size={15} color={dark.glow} />
            </View>

            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder={tx('Uliza swali lolote la afya…')}
              placeholderTextColor={dark.subtle}
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
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <View style={[styles.sendHalo, !canSend && styles.sendHaloOff]}>
                <LinearGradient
                  colors={canSend ? ['#4E97FF', dark.glow] : ['#243350', '#1B2740']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.send}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </View>
            </Pressable>
          </View>

          <View style={styles.disclaimerRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={dark.accent} />
            <Text style={styles.disclaimer}>
              {tx('Afya AI hujibu kutoka maandishi yaliyothibitishwa tu. Si mbadala wa daktari.')}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// --- The backdrop -----------------------------------------------------
//
// The design has a caduceus, an ECG trace and a molecular lattice
// printed faintly behind everything. Those are drawings this project
// does not own, so the same job is done with icons the app already
// ships, at an opacity where they are texture rather than pictures —
// and at that opacity nothing here competes with a word on the screen.

function Backdrop() {
  return (
    <View style={styles.backdrop} pointerEvents="none">
      <Ionicons name="medkit-outline" size={150} color="#FFFFFF" style={styles.dropLeft} />
      <Ionicons name="pulse-outline" size={170} color="#FFFFFF" style={styles.dropRight} />
      <Ionicons name="git-network-outline" size={130} color="#FFFFFF" style={styles.dropTop} />
      <Ionicons name="apps-outline" size={110} color="#FFFFFF" style={styles.dropBottom} />
    </View>
  );
}

// --- The empty state --------------------------------------------------

function Welcome({ onPick }) {
  return (
    <View>
      <Orb />

      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>
          Afya <Text style={styles.headerTitleAccent}>AI</Text>
        </Text>
        <Text style={styles.welcomeBody}>
          {tx(
            'Uliza kuhusu afya yako au huduma zetu. Majibu yanatoka kwenye maandishi yaliyopitiwa na mtaalamu — hakuna kubahatisha.'
          )}
        </Text>
        {/* The lit edge the design runs under this card. */}
        <View style={styles.cardGlow} />
      </View>

      <View style={styles.chips}>
        {SUGGESTIONS.map((item) => (
          <Pressable
            key={item.text}
            onPress={() => onPick(item.text)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <View style={styles.chipIcon}>
              <Ionicons name={item.icon} size={19} color={dark.accent} />
            </View>
            <Text style={styles.chipText}>{tx(item.text)}</Text>
            <Ionicons name="arrow-forward" size={17} color={dark.accent} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// The glowing sphere.
//
// React Native has no blur and no radial gradient, so the halo is built
// the way it would have been before either existed: circles inside
// circles, each a little more opaque than the one around it. Three
// rings is where it stops reading as steps and starts reading as light.
function Orb() {
  return (
    <View style={styles.orbWrap}>
      <View style={[styles.ring, styles.ring4]} />
      <View style={[styles.ring, styles.ring3]} />
      <View style={[styles.ring, styles.ring2]} />
      <LinearGradient
        colors={['#3E8BFF', '#1B4FD0', '#0A1F52']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.orb}
      >
        <Ionicons name="sparkles" size={34} color="#FFFFFF" />
      </LinearGradient>
      {/* The lit plinth it sits on. */}
      <View style={styles.plinth} />
    </View>
  );
}

function Thinking() {
  return (
    <View style={styles.aiRow}>
      <Avatar />
      <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
        <ActivityIndicator size="small" color={dark.glow} />
        <Text style={styles.thinkingText}>{tx('Inatafuta jibu…')}</Text>
      </View>
    </View>
  );
}

function Avatar() {
  return (
    <View style={styles.avatar}>
      <Ionicons name="sparkles" size={14} color={dark.glow} />
    </View>
  );
}

function Message({ message }) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <LinearGradient
          colors={['#3E8BFF', dark.glow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <Text style={styles.userText}>{message.text}</Text>
        </LinearGradient>
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
  // red rule and a heading, because somebody reading this quickly on a
  // phone needs to know inside a second that it is different.
  if (data.redFlag) {
    return (
      <View style={styles.emergency}>
        <View style={styles.emergencyHead}>
          <Ionicons name="warning" size={18} color={dark.danger} />
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

  return (
    <View style={styles.aiRow}>
      <Avatar />
      <View style={[styles.bubble, styles.aiBubble]}>
        <Text style={styles.aiText}>{data.answer}</Text>

        {data.outcome === 'ANSWERED' ? (
          <View style={styles.source}>
            <Ionicons name="shield-checkmark-outline" size={13} color={dark.accent} />
            <Text style={styles.sourceText}>
              {tx('Limetoka kwenye maandishi yaliyosainiwa na mtaalamu')}
            </Text>
          </View>
        ) : null}

        {data.outcome === 'NO_ANSWER' ? (
          <View style={styles.source}>
            <Ionicons name="help-circle-outline" size={13} color={dark.muted} />
            <Text style={styles.sourceText}>
              {tx('Hakuna jibu lililothibitishwa kwa swali hili bado')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  faded: { opacity: 0.35 },

  backdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  dropLeft: { position: 'absolute', top: 120, left: -46, opacity: 0.05 },
  dropRight: { position: 'absolute', top: 210, right: -54, opacity: 0.05 },
  dropTop: { position: 'absolute', top: -18, right: -22, opacity: 0.04 },
  dropBottom: { position: 'absolute', bottom: 120, left: -30, opacity: 0.04 },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: dark.glass,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonAccent: { borderColor: dark.accentLine, backgroundColor: dark.accentSoft },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: scale(21), fontFamily: font.extrabold, color: dark.text },
  headerTitleAccent: { color: dark.accent },
  headerSub: { ...type.tiny, color: dark.subtle, marginTop: -2 },

  // --- Thread ---
  thread: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  // flexGrow without justifyContent: 'center'. Centring works only
  // while the content is shorter than the scroll area — once the orb,
  // the card and four suggestions are taller than the screen, centring
  // pushes the top of the orb above the scroll origin, where it cannot
  // be reached by scrolling at all. That is how it was clipped.
  threadEmpty: { flexGrow: 1, justifyContent: 'flex-start' },

  // --- Orb ---
  orbWrap: { alignItems: 'center', justifyContent: 'center', height: 168, marginBottom: -14 },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  ring2: {
    width: 126,
    height: 126,
    backgroundColor: dark.glowSoft,
    borderColor: 'rgba(78,151,255,0.35)',
  },
  ring3: {
    width: 150,
    height: 150,
    backgroundColor: dark.glowFaint,
    borderColor: 'rgba(78,151,255,0.18)',
  },
  ring4: {
    width: 176,
    height: 176,
    backgroundColor: 'rgba(46,123,255,0.05)',
    borderColor: 'rgba(78,151,255,0.10)',
  },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(160,200,255,0.55)',
  },
  plinth: {
    position: 'absolute',
    bottom: 16,
    width: 118,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(120,180,255,0.55)',
  },

  // --- Welcome card ---
  welcomeCard: {
    backgroundColor: dark.glass,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  welcomeTitle: { fontSize: scale(23), fontFamily: font.extrabold, color: dark.text },
  welcomeBody: {
    ...type.body,
    color: dark.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: scale(21),
  },
  cardGlow: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: dark.accentLine,
  },

  // --- Suggestions ---
  chips: { gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: dark.glass,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  chipPressed: { backgroundColor: dark.glassStrong, borderColor: dark.accentLine },
  chipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,138,61,0.10)',
    borderWidth: 1,
    borderColor: dark.accentLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...type.body, color: dark.text, flex: 1, lineHeight: scale(20) },

  // --- Bubbles ---
  userRow: { alignItems: 'flex-end' },
  aiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: dark.glowSoft,
    borderWidth: 1,
    borderColor: 'rgba(78,151,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: { maxWidth: '84%', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  userBubble: { borderRadius: radius.lg, borderBottomRightRadius: radius.sm },
  userText: { ...type.body, color: '#FFFFFF' },
  aiBubble: {
    backgroundColor: dark.glass,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: dark.border,
    flexShrink: 1,
  },
  aiText: { ...type.body, color: dark.text, lineHeight: scale(22) },
  errorText: { ...type.body, color: dark.danger },

  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  sourceText: { ...type.tiny, color: dark.muted, flex: 1 },

  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  thinkingText: { ...type.small, color: dark.muted },

  // --- Emergency ---
  emergency: {
    backgroundColor: dark.dangerBg,
    borderColor: dark.dangerBorder,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  emergencyHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  emergencyHeading: {
    fontSize: 13,
    fontFamily: font.extrabold,
    color: dark.danger,
    letterSpacing: 1.2,
  },
  emergencyBody: { fontSize: 17, color: dark.danger, lineHeight: 25, fontFamily: font.semibold },
  emergencyMeta: { ...type.small, color: dark.danger, marginTop: spacing.sm, opacity: 0.85 },

  // --- Composer ---
  composerBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  composer: {
    flexDirection: 'row',
    // Bottom, not centre: the send button stays level with the last line
    // of a question that has grown to three.
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: dark.glass,
    borderWidth: 1,
    borderColor: dark.accentLine,
    borderRadius: radius.xxl,
    paddingLeft: spacing.xs,
    paddingRight: 6,
    paddingVertical: 6,
  },
  composerSpark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: dark.glowSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  input: {
    flex: 1,
    ...type.body,
    color: dark.text,
    maxHeight: 120,
    minHeight: 40,
    paddingTop: 10,
    paddingBottom: 10,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
  sendHalo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: dark.glowSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendHaloOff: { backgroundColor: 'transparent' },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  disclaimer: { ...type.tiny, fontSize: 10, color: dark.subtle, flexShrink: 1 },
});
