import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { services as servicesApi } from '../../lib/api';
import { Card, ErrorBox } from '../../lib/ui';
import { colors, radius, shadow, spacing } from '../../lib/theme';

// The design's "Select a Service" screen: the whole catalogue, one row
// each, readable before anything is chosen.
//
// The design puts a photograph on every row. There is none for any
// service, so each row carries its colour block and icon at the same
// size and radius — a real photograph replaces it without the row
// changing shape.

const ICONS = {
  'Home Nursing': 'medkit',
  'Elderly Care': 'people',
  Physiotherapy: 'fitness',
  'Wound Care': 'bandage',
  'Postnatal Care': 'heart',
  'Health Education': 'school',
  'Follow-up Visit': 'repeat',
  'Medication Administration': 'medical',
};
const iconFor = (name) => ICONS[name] ?? 'ellipse';

const TILES = ['#3B82F6', '#0E9B77', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EC4899'];

const tzs = (amount) => `TZS ${Number(amount).toLocaleString('en-US')}`;

export default function Services() {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await servicesApi.list();
        setList(data?.services ?? []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ErrorBox error={error} />

      {loading ? (
        <Card>
          <Text style={styles.muted}>Inapakia…</Text>
        </Card>
      ) : (
        list.map((service, index) => (
          <Pressable
            key={service.id}
            onPress={() => router.push('/book')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.thumb, { backgroundColor: TILES[index % TILES.length] }]}>
              <Ionicons name={iconFor(service.name)} size={26} color="#FFFFFF" />
            </View>

            <View style={styles.rowText}>
              <Text style={styles.name}>{service.name}</Text>
              {service.description ? (
                <Text style={styles.muted} numberOfLines={2}>
                  {service.description}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                {service.basePriceTzs ? (
                  <Text style={styles.price}>Kuanzia {tzs(service.basePriceTzs)}</Text>
                ) : null}
                {service.durationMinutes ? (
                  <Text style={styles.duration}>· dakika {service.durationMinutes}</Text>
                ) : null}
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.subtle} />
          </Pressable>
        ))
      )}

      {/* The design closes with a note about a service that might be
          available on request. Which service that is depends on what the
          business actually offers, so this points at a person instead of
          naming one. */}
      <Card style={styles.note}>
        <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
        <View style={styles.rowText}>
          <Text style={styles.noteTitle}>Hujaona unayoitaka?</Text>
          <Text style={styles.muted}>
            Uliza Afya AI, au wasiliana nasi. Baadhi ya huduma zinaweza kupangwa kwa maombi
            maalum.
          </Text>
        </View>
      </Card>

      <Pressable
        onPress={() => router.push('/ask')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.askButton, pressed && styles.pressed]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
        <Text style={styles.askText}>Uliza Afya AI</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  pressed: { opacity: 0.75 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  thumb: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  price: { fontSize: 12, fontWeight: '700', color: colors.primary },
  duration: { fontSize: 12, color: colors.subtle },

  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
    marginTop: spacing.sm,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: colors.text },

  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.xs,
  },
  askText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
