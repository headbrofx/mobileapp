import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { notifications as api } from '../../lib/api';
import { Card, ErrorBox } from '../../lib/ui';
import { colors, font, radius, spacing } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// What the bell on the home screen is counting.
//
// Nothing is pushed to the phone — there is no gateway and no push
// credential — so these are rows the app reads when it opens. The
// server says as much rather than letting the app assume a message went
// out.

const ICONS = {
  BOOKING: 'calendar-outline',
  HEALTH: 'pulse-outline',
  REMINDER: 'alarm-outline',
  SYSTEM: 'information-circle-outline',
  MARKETING: 'megaphone-outline',
};

export default function Notifications() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
  const router = useRouter();
  const [list, setList] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.list();
      setList(data?.notifications ?? []);
      setUnread(data?.unread ?? 0);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function open(item) {
    if (item.status !== 'READ') {
      try {
        await api.markRead(item.id);
      } catch {
        // Opening it matters more than recording that it was opened.
      }
    }
    if (item.data?.bookingId) router.push('/appointments');
    else load();
  }

  async function readAll() {
    try {
      await api.markAllRead();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }} />}
    >
      <ErrorBox error={error} />

      {unread > 0 ? (
        <Pressable onPress={readAll} style={styles.readAll}>
          <Text style={styles.readAllText}>Soma zote ({unread})</Text>
        </Pressable>
      ) : null}

      {list.length === 0 ? (
        <Card>
          <Text style={styles.muted}>{tx('Hakuna taarifa bado.')}</Text>
        </Card>
      ) : (
        list.map((item) => (
          <Pressable key={item.id} onPress={() => open(item)}>
            <Card style={[styles.row, item.status !== 'READ' && styles.rowUnread]}>
              <View style={styles.icon}>
                <Ionicons
                  name={ICONS[item.type] ?? 'notifications-outline'}
                  size={19}
                  color={colors.primary}
                />
              </View>
              <View style={styles.text}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.muted}>{item.message}</Text>
                <Text style={styles.when}>
                  {new Date(item.createdAt).toLocaleString('sw-TZ')}
                </Text>
              </View>
              {item.status !== 'READ' ? <View style={styles.dot} /> : null}
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  readAll: { alignSelf: 'flex-end', paddingVertical: spacing.sm },
  readAllText: { color: colors.primary, fontFamily: font.semibold },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowUnread: { borderColor: colors.primary },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontFamily: font.semibold, color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 19 },
  when: { fontSize: 11, color: colors.subtle, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});
