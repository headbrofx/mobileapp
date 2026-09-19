import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { services as servicesApi } from '../../lib/api';
import { Card, ErrorBox } from '../../lib/ui';
import { colors, font, radius, shadow, spacing } from '../../lib/theme';
import { serviceColour, serviceIcon, serviceImage } from '../../lib/services-meta';
import { tx, useI18n } from '../../lib/i18n';

// The design's "Select a Service" screen: the whole catalogue, one row
// each, readable before anything is chosen.
//
// The design puts a photograph on every row, and now most of them have
// one. A service still waiting for its picture keeps the colour block
// and icon at exactly the same size and radius, so a row looks
// deliberate either way rather than broken.


const tzs = (amount) => `TZS ${Number(amount).toLocaleString('en-US')}`;

export default function Services() {
  // Subscribes this screen to the chosen language. The tx() calls
  // below read it from a module variable, which cannot re-render
  // anything on its own, and a screen sits behind the navigator's
  // memo. Reading the context is what gets past that.
  useI18n();
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
          <Text style={styles.muted}>{tx('Inapakia…')}</Text>
        </Card>
      ) : (
        list.map((service, index) => (
          <Pressable
            key={service.id}
            onPress={() => router.push('/book')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {serviceImage(service.name) ? (
              <Image source={serviceImage(service.name)} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: serviceColour(service.name) }]}>
                <Ionicons name={serviceIcon(service.name)} size={26} color="#FFFFFF" />
              </View>
            )}

            <View style={styles.rowText}>
              <Text style={styles.name}>{service.name}</Text>
              {service.description ? (
                <Text style={styles.muted} numberOfLines={2}>
                  {service.description}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                {service.basePriceTzs ? (
                  <Text style={styles.price}>{tx('Kuanzia')} {tzs(service.basePriceTzs)}</Text>
                ) : null}
                {service.durationMinutes ? (
                  <Text style={styles.duration}>· {tx('Dakika')} {service.durationMinutes}</Text>
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
          <Text style={styles.noteTitle}>{tx('Hujaona unayoitaka?')}</Text>
          <Text style={styles.muted}>{tx('Uliza Afya AI, au wasiliana nasi. Baadhi ya huduma zinaweza kupangwa kwa maombi maalum.')}</Text>
        </View>
      </Card>

      <Pressable
        onPress={() => router.push('/ask')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.askButton, pressed && styles.pressed]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
        <Text style={styles.askText}>{tx('Uliza Afya AI')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
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
    width: 74,
    height: 74,
    borderRadius: radius.md,
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontFamily: font.bold, color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  price: { fontSize: 12, fontFamily: font.bold, color: colors.primary },
  duration: { fontSize: 12, color: colors.subtle },

  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
    marginTop: spacing.sm,
  },
  noteTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },

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
  askText: { color: colors.primary, fontFamily: font.bold, fontSize: 15 },
});
