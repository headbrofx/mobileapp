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
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  bookings as bookingsApi,
  notifications as notificationsApi,
  services as servicesApi,
} from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { ErrorBox, MenuButton } from '../../../lib/ui';
import { colors, font, radius, shadow, spacing } from '../../../lib/theme';
import { serviceColour, serviceIcon } from '../../../lib/services-meta';

// The home screen, matched to the supplied design element for element:
// gradient hero with logo, tagline and bell; the full-width booking
// button; six filled service cards; a featured service; the next
// appointment with its status pill; and the two shortcut cards.
//
// The one thing that cannot be copied is the photography. The design
// puts a photo behind the hero and another on the featured card. There
// are none, so those places hold a gradient and the service's own
// colour — the layout, sizes and radii are the design's, so real
// photographs drop in without moving anything.

const STATUS_SW = {
  REQUESTED: 'Imeombwa',
  ASSIGNED: 'Amepangiwa',
  ACCEPTED: 'Amethibitishwa',
  ON_THE_WAY: 'Yupo njiani',
  ARRIVED: 'Amefika',
  IN_PROGRESS: 'Inaendelea',
  COMPLETED: 'Imekamilika',
  CANCELLED: 'Imeghairiwa',
  REJECTED: 'Imekataliwa',
  RESCHEDULED: 'Imehairishwa',
};


export default function Home() {
  const router = useRouter();
  const { user } = useSession();

  const [services, setServices] = useState([]);
  const [visits, setVisits] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [serviceData, bookingData, notificationData] = await Promise.all([
        servicesApi.list(),
        bookingsApi.list(),
        notificationsApi.list(),
      ]);
      setServices(serviceData?.services ?? []);
      setVisits(bookingData?.bookings ?? []);
      setUnread(notificationData?.unread ?? 0);
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

  const upcoming = visits.find(
    (visit) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(visit.status)
  );

  // The design's featured slot. Elderly Care if it is on the books,
  // otherwise whatever is — rather than a hardcoded name that could
  // outlive the service it points at.
  const featured =
    services.find((service) => service.name === 'Elderly Care') ?? services[0] ?? null;
  const featuredColour = featured ? serviceColour(featured.name) : colors.primary;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <LinearGradient
        colors={['#0E7A5F', '#0A5C47']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <MenuButton tint={colors.onPrimary} />
          <View style={styles.brand}>
            <Image
              source={require('../../../assets/wordmark.png')}
              style={styles.wordmark}
              resizeMode="contain"
              accessibilityLabel="Afya Nyumbani"
            />
            <Text style={styles.brandTag}>Huduma ya afya mlangoni kwako</Text>
          </View>

          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Taarifa ${unread} mpya` : 'Taarifa'}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onPrimary} />
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellCount}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Text style={styles.greeting}>Habari, {user?.name?.split(' ')[0] ?? 'Karibu'}!</Text>
        <Text style={styles.tagline}>Huduma bora ya afya, ukiwa nyumbani kwako.</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Pressable
          onPress={() => router.push('/book')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={['#0E7A5F', '#0A5C47']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <View style={styles.ctaIcon}>
              <Ionicons name="calendar" size={19} color={colors.onPrimary} />
            </View>
            <Text style={styles.ctaText}>Omba ziara ya nyumbani</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onPrimary} />
          </LinearGradient>
        </Pressable>

        <ErrorBox error={error} />

        <SectionHeader title="Huduma zetu" onPress={() => router.push('/services')} />

        <View style={styles.grid}>
          {services.slice(0, 6).map((service, index) => (
            <Pressable
              key={service.id}
              onPress={() => router.push('/book')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}
            >
              <View style={[styles.tile, { backgroundColor: serviceColour(service.name) }]}>
                <View style={styles.tileIcon}>
                  <Ionicons name={serviceIcon(service.name)} size={19} color="#FFFFFF" />
                </View>
                <Text style={styles.tileText} numberOfLines={3}>
                  {service.name}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {featured ? (
          <Pressable
            onPress={() => router.push('/book')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
          >
            {/* The design has a photograph here. Until there is one, the
                service's own tile colour fills the same shape. */}
            <View style={[styles.featuredImage, { backgroundColor: featuredColour }]}>
              <Ionicons name={serviceIcon(featured.name)} size={30} color="#FFFFFF" />
            </View>

            <View style={styles.featuredText}>
              <Text style={styles.featuredLabel}>Huduma maalum</Text>
              <Text style={styles.featuredTitle}>{featured.name}</Text>
              <Text style={styles.featuredBody} numberOfLines={2}>
                {featured.description ??
                  (featured.basePriceTzs
                    ? `Kuanzia TZS ${Number(featured.basePriceTzs).toLocaleString('en-US')}`
                    : 'Huduma ya karibu, nyumbani kwako.')}
              </Text>
            </View>

            <View style={styles.featuredArrow}>
              <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
            </View>
          </Pressable>
        ) : null}

        <SectionHeader title="Ziara inayofuata" onPress={() => router.push('/appointments')} />

        {upcoming ? (
          <Pressable
            onPress={() => router.push('/appointments')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.appointment, pressed && styles.pressed]}
          >
            <View style={styles.appointmentIcon}>
              <Ionicons name="medkit" size={20} color="#3B82F6" />
            </View>
            <View style={styles.appointmentText}>
              <Text style={styles.appointmentTitle} numberOfLines={1}>
                {upcoming.locationAddress}
              </Text>
              <Text style={styles.appointmentWhen}>
                {new Date(upcoming.scheduledAt).toLocaleString('sw-TZ')}
              </Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{STATUS_SW[upcoming.status] ?? upcoming.status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
          </Pressable>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Huna ziara inayokuja. Omba muuguzi kwa kitufe hapo juu.
            </Text>
          </View>
        )}

        <View style={styles.shortcutRow}>
          <Shortcut
            icon="calendar-outline"
            tint="#EAF2FE"
            colour="#3B82F6"
            title="Ziara zangu"
            subtitle="Ona ziara zote"
            onPress={() => router.push('/appointments')}
          />
          <Shortcut
            icon="headset-outline"
            tint="#E6F2EE"
            colour={colors.primary}
            title="Msaada"
            subtitle="Una swali? Uliza"
            onPress={() => router.push('/ask')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, onPress }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{title}</Text>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.viewAll}>
        <Text style={styles.viewAllText}>Zote</Text>
        <Ionicons name="arrow-forward" size={13} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function Shortcut({ icon, tint, colour, title, subtitle, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
    >
      <View style={[styles.shortcutIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={colour} />
      </View>
      <View style={styles.shortcutText}>
        <Text style={styles.shortcutTitle}>{title}</Text>
        <Text style={styles.shortcutSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl, backgroundColor: colors.bg },
  pressed: { opacity: 0.8 },

  hero: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  brand: { flex: 1 },
  wordmark: { width: 118, height: 48 },
  brandTag: { color: colors.onPrimary, fontSize: 11, opacity: 0.85, marginTop: 0 },
  bell: { padding: spacing.xs },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.brandOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellCount: { color: '#FFFFFF', fontSize: 10, fontFamily: font.extrabold },

  greeting: { color: colors.onPrimary, fontSize: 23, fontFamily: font.extrabold, marginTop: spacing.md },
  tagline: { color: colors.onPrimary, fontSize: 13, opacity: 0.9, marginTop: 4, lineHeight: 18 },

  body: { paddingHorizontal: spacing.md, marginTop: -spacing.lg - spacing.xs },

  ctaWrap: { borderRadius: radius.lg, ...shadow.card, marginBottom: spacing.md },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  ctaIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, color: colors.onPrimary, fontSize: 16, fontFamily: font.bold },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  section: { fontSize: 18, fontFamily: font.extrabold, color: colors.text },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { color: colors.primary, fontFamily: font.semibold, fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs / 2 },
  tileWrap: { width: '33.333%', paddingHorizontal: spacing.xs / 2, marginBottom: spacing.sm },
  tile: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { color: '#FFFFFF', fontSize: 12, fontFamily: font.bold, lineHeight: 15 },

  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: spacing.xs,
    ...shadow.card,
  },
  featuredImage: {
    width: 74,
    height: 74,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredText: { flex: 1 },
  featuredLabel: { fontSize: 11, color: colors.primary, fontFamily: font.bold },
  featuredTitle: { fontSize: 16, fontFamily: font.extrabold, color: colors.text, marginTop: 1 },
  featuredBody: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  featuredArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  appointment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    ...shadow.card,
  },
  appointmentIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: '#EAF2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentText: { flex: 1 },
  appointmentTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  appointmentWhen: { fontSize: 12, color: colors.muted, marginTop: 1 },
  pill: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pillText: { color: colors.primary, fontSize: 11, fontFamily: font.bold },

  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  emptyText: { fontSize: 13, color: colors.muted, lineHeight: 19 },

  shortcutRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  shortcut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: { flex: 1 },
  shortcutTitle: { fontSize: 13, fontFamily: font.bold, color: colors.text },
  shortcutSubtitle: { fontSize: 11, color: colors.muted, marginTop: 1 },
});
