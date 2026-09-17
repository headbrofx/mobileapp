import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { bookings as bookingsApi, services as servicesApi } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { Card, ErrorBox } from '../../../lib/ui';
import { colors, radius, shadow, spacing, tileColors } from '../../../lib/theme';

// The home screen, built to the design the owner supplied.
//
// That design leads with a photograph of a nurse sitting with a
// patient. There is none to use, so the hero is the brand green with
// the wordmark on it: the layout is identical and a real photograph
// drops straight in when there is one. A stock photo of somebody else's
// nurses on a Tanzanian home-care app would be worse than no photo.

const STATUS_SW = {
  REQUESTED: 'Imeombwa',
  ASSIGNED: 'Amepangiwa',
  ACCEPTED: 'Amekubali',
  ON_THE_WAY: 'Yupo njiani',
  ARRIVED: 'Amefika',
  IN_PROGRESS: 'Inaendelea',
  COMPLETED: 'Imekamilika',
  CANCELLED: 'Imeghairiwa',
  REJECTED: 'Imekataliwa',
  RESCHEDULED: 'Imehairishwa',
};

// The catalogue comes from the server, so icons are matched by name
// rather than stored beside it. An unrecognised service still gets a
// sensible one instead of a blank tile.
const ICONS = {
  'Home Nursing': 'medkit-outline',
  'Elderly Care': 'people-outline',
  Physiotherapy: 'fitness-outline',
  'Wound Care': 'bandage-outline',
  'Postnatal Care': 'heart-outline',
  'Health Education': 'school-outline',
  'Follow-up Visit': 'repeat-outline',
  'Medication Administration': 'medical-outline',
};

const iconFor = (name) => ICONS[name] ?? 'ellipse-outline';

export default function Home() {
  const router = useRouter();
  const { user } = useSession();

  const [services, setServices] = useState([]);
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [serviceData, bookingData] = await Promise.all([
        servicesApi.list(),
        bookingsApi.list(),
      ]);
      setServices(serviceData?.services ?? []);
      setVisits(bookingData?.bookings ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // The next visit that has not finished — the one somebody opens the
  // app to check on.
  const upcoming = visits.find(
    (visit) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(visit.status)
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <Image
          source={require('../../../assets/wordmark.png')}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="Afya Nyumbani"
        />
        <Text style={styles.greeting}>Habari, {user?.name?.split(' ')[0] ?? 'karibu'}</Text>
        <Text style={styles.tagline}>Huduma bora ya afya, nyumbani kwako.</Text>

        <Pressable
          onPress={() => router.push('/book')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Ionicons name="calendar" size={20} color={colors.onPrimary} />
          <Text style={styles.ctaText}>Omba muuguzi aje nyumbani</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <ErrorBox error={error} />

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Huduma zetu</Text>
          <Pressable onPress={() => router.push('/book')}>
            <Text style={styles.link}>Zote</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {services.slice(0, 6).map((service, index) => {
            const tile = tileColors[index % tileColors.length];
            return (
              <Pressable
                key={service.id}
                onPress={() => router.push('/book')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                <View style={[styles.tileIcon, { backgroundColor: tile.bg }]}>
                  <Ionicons name={iconFor(service.name)} size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.tileText} numberOfLines={2}>
                  {service.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Ziara inayofuata</Text>
        {upcoming ? (
          <Pressable onPress={() => router.push('/appointments')}>
            <Card style={styles.upcoming}>
              <View style={styles.upcomingIcon}>
                <Ionicons name="medkit" size={20} color={colors.primary} />
              </View>
              <View style={styles.upcomingText}>
                <Text style={styles.upcomingTitle} numberOfLines={1}>
                  {upcoming.locationAddress}
                </Text>
                <Text style={styles.muted}>
                  {new Date(upcoming.scheduledAt).toLocaleString('sw-TZ')}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {STATUS_SW[upcoming.status] ?? upcoming.status}
                </Text>
              </View>
            </Card>
          </Pressable>
        ) : (
          <Card>
            <Text style={styles.muted}>Huna ziara inayokuja. Omba muuguzi hapo juu.</Text>
          </Card>
        )}

        <View style={styles.quickRow}>
          <QuickAction
            icon="chatbubble-ellipses-outline"
            title="Afya AI"
            subtitle="Uliza swali"
            onPress={() => router.push('/ask')}
          />
          <QuickAction
            icon="pulse-outline"
            title="Ripoti dalili"
            subtitle="Andika unavyojisikia"
            onPress={() => router.push('/symptoms')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function QuickAction({ icon, title, subtitle, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.quick, pressed && styles.tilePressed]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  wordmark: { width: 150, height: 61, marginBottom: spacing.sm },
  greeting: { color: colors.onPrimary, fontSize: 22, fontWeight: '700' },
  tagline: { color: colors.onPrimary, fontSize: 14, opacity: 0.9, marginTop: 2 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700', flex: 1 },

  body: { padding: spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  link: { color: colors.primary, fontWeight: '600', marginTop: spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  tile: { width: '33.333%', paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
  tilePressed: { opacity: 0.7 },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileText: { fontSize: 12, color: colors.text, fontWeight: '600', lineHeight: 16 },

  upcoming: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...shadow.card },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingText: { flex: 1 },
  upcomingTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },

  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quick: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  quickTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  quickSubtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
});
