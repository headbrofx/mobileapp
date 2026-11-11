import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { dispatch } from '../../lib/api';
import { ErrorBox } from '../../lib/ui';
import { Empty, careStyles } from '../../lib/care-ui';
import { useSession } from '../../lib/session';
import { colors, font, radius, spacing, type } from '../../lib/theme';
import { tx, useI18n } from '../../lib/i18n';

// Every visit report, for the office: newest first, searchable by the
// patient's name or the booking reference (AN-…). Opening one shows the
// full report with its print button.

export default function VisitReports() {
  useI18n();
  const router = useRouter();
  const { user } = useSession();
  const [q, setQ] = useState('');
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (term) => {
    setError(null);
    try {
      const data = await dispatch.visitReports(term);
      setReports(data?.reports ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(q.trim());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  // Search as she types, but not on every key.
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q, load]);

  if (user && user.role !== 'ADMIN') {
    return <Empty icon="lock-closed-outline" title={tx('Ukurasa huu ni wa msimamizi tu')} />;
  }

  return (
    <ScrollView
      contentContainerStyle={careStyles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(q.trim());
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={tx('Jina la mgonjwa au namba (AN-…)')}
          placeholderTextColor={colors.subtle}
          style={styles.searchInput}
          autoCapitalize="characters"
        />
      </View>

      <ErrorBox error={error} />

      {loaded && reports.length === 0 ? (
        <Empty
          icon="document-text-outline"
          title={q ? tx('Hakuna ripoti inayolingana') : tx('Bado hakuna ripoti za ziara')}
          body={q ? null : tx('Muuguzi akianza huduma, ripoti yake itaonekana hapa.')}
        />
      ) : (
        reports.map((r) => (
          <Pressable
            key={r.visitId}
            onPress={() => router.push({ pathname: '/track', params: { kind: 'home-visit', id: r.bookingId } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {r.patient?.name ?? '—'}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {r.reference} · {r.service ?? ''} ·{' '}
                {r.checkInAt ? new Date(r.checkInAt).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {tx('Muuguzi')}: {r.nurse?.name ?? '—'}
              </Text>
            </View>
            <View style={[styles.badge, r.status !== 'FINAL' && styles.badgeDraft]}>
              <Text style={[styles.badgeText, r.status !== 'FINAL' && styles.badgeTextDraft]}>
                {r.status === 'FINAL' ? tx('Imekamilika') : tx('Rasimu')}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, minHeight: 46, ...type.body, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
  },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.bodyStrong, color: colors.text },
  meta: { ...type.small, color: colors.muted },
  badge: { backgroundColor: colors.successBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDraft: { backgroundColor: colors.cautionBg },
  badgeText: { ...type.tiny, fontFamily: font.bold, color: colors.success },
  badgeTextDraft: { color: colors.caution },
});
