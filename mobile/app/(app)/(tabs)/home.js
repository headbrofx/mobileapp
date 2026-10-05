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
import {
  bookings as bookingsApi,
  content as contentApi,
  notifications as notificationsApi,
  services as servicesApi,
} from '../../../lib/api';
import { tx, useI18n } from '../../../lib/i18n';
import { useSession } from '../../../lib/session';
import { ErrorBox, MenuButton } from '../../../lib/ui';
import { Wordmark } from '../../../lib/brand';
import { accentAt, colors, font, fs, radius, scale, shadow, spacing, textScale, type } from '../../../lib/theme';
import { serviceColour, serviceIcon, serviceImage, servicePrice } from '../../../lib/services-meta';

// The home screen, element for element from the design.
//
// It sits on the page background, not on a green hero. The earlier
// version filled the top third with a gradient, which read as a
// dashboard; the design opens on the brand in small type and then a
// photograph, so the first thing a person meets is a face.
//
// The service tiles are flat colour with a white icon, and that is the
// design, not a fallback. There are photographs for every service now
// and they are deliberately not used here — eight photographs shrunk to
// a 100pt tile become eight brown smudges and the grid stops being
// scannable. Photographs belong where they are big enough to read: the
// hero, the featured card, and the service browser.

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

// "Kesho, saa 10:00" reads better than a date somebody has to decode.
const when = (value) => {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const time = date.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });

  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return `Leo, saa ${time}`;
  if (sameDay(date, tomorrow)) return `Kesho, saa ${time}`;
  return `${date.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })}, saa ${time}`;
};

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const { t, language } = useI18n();
  // Four services on Home; "Zote" opens the whole catalogue, so
  // nothing is hidden, only held back.
  const shown = 4;

  const [services, setServices] = useState([]);
  const [visits, setVisits] = useState([]);
  const [unread, setUnread] = useState(0);
  const [tip, setTip] = useState(null);
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

      // The tip is decoration. It must never be the reason the rest of
      // the screen fails to load.
      try {
        const library = await contentApi.list('tip');
        const all = library?.items ?? library?.content ?? [];
        const mine = all.filter((item) => (item.tags ?? []).includes(language));
        if (mine.length > 0) {
          // The same tip for everybody on a given day, and a different
          // one tomorrow. A random pick would change on every refresh,
          // which is not a daily tip.
          const day = Math.floor(Date.now() / 86400000);
          setTip(mine[day % mine.length]);
        }
      } catch {
        setTip(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [language]);

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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.topBar}>
        <View style={styles.brandText}>
          <Wordmark size={21} />
          <Text style={styles.brandTag}>{t('home.brandTag')}</Text>
        </View>

        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `${tx('Taarifa')} ${unread}` : tx('Taarifa')}
          hitSlop={8}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Ionicons name="notifications-outline" size={23} color={colors.text} />
          {unread > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellCount}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>

        <MenuButton />
      </View>

      {/* The one coloured block on the screen: who this is for, and the
          one thing most people open the app to do. Everything below it
          is white, so the eye has a single place to land. */}
      <View style={styles.gutter}>
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={styles.heroHello}>{t('home.greeting')},</Text>
            <Text style={styles.heroName} numberOfLines={1}>
              {user?.name?.split(' ')[0] ?? tx('Karibu')}
            </Text>
            <Text style={styles.heroTag} numberOfLines={2}>
              {t('home.tagline')}
            </Text>
          </View>
          <Image source={require('../../../assets/hero.png')} style={styles.heroPhoto} resizeMode="cover" />
          <Pressable
            onPress={() => router.push('/book')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
          >
            <Text style={styles.heroButtonText}>{tx('Omba huduma')}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.gutter}>
        <ErrorBox error={error} />

        <View style={styles.mobilityRow}>
          <Pressable
            onPress={() => router.push('/transport')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.mobility, pressed && styles.pressed]}
          >
            <Ionicons name="car-outline" size={22} color={colors.accent} />
            <Text style={styles.mobilityTitle}>{tx('Usafiri')}</Text>
            <Text style={styles.mobilySub} numberOfLines={1}>{tx('Hadi hospitali au kliniki')}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/care')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.mobility, pressed && styles.pressed]}
          >
            <Ionicons name="location-outline" size={22} color={colors.accent} />
            <Text style={styles.mobilityTitle}>{tx('Karibu nawe')}</Text>
            <Text style={styles.mobilySub} numberOfLines={1}>{tx('Ramani ya maeneo yetu')}</Text>
          </Pressable>
        </View>

        <SectionHeader title={t('home.ourServices')} label={t('common.all')} onPress={() => router.push('/services')} />

        {/* A list, not a grid of coloured blocks. Every row is the same
            white card with the theme's own tint behind its icon, so the
            catalogue reads as one thing and the names get the width. */}
        <View style={styles.list}>
          {services.slice(0, shown).map((service) => {
            const price = servicePrice(service);
            return (
              <Pressable
                key={service.id}
                onPress={() => router.push('/book')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.serviceRow, pressed && styles.pressed]}
              >
                <View style={styles.serviceIcon}>
                  <Ionicons name={serviceIcon(service.name)} size={18} color={colors.primary} />
                </View>
                <Text style={styles.serviceName} numberOfLines={1}>
                  {service.name}
                </Text>
                {price ? <Text style={styles.servicePrice}>{price.free ? price.text : price.text.replace(`${tx('Kuanzia')} `, '')}</Text> : null}
                <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
              </Pressable>
            );
          })}
        </View>

        {featured ? (
          <Pressable
            onPress={() => router.push('/services')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
          >
            {serviceImage(featured.name) ? (
              <Image
                source={serviceImage(featured.name)}
                style={styles.featuredImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.featuredImage,
                  styles.featuredFallback,
                  { backgroundColor: serviceColour(featured.name) },
                ]}
              >
                <Ionicons name={serviceIcon(featured.name)} size={28} color="#FFFFFF" />
              </View>
            )}

            <View style={styles.featuredText}>
              <Text style={styles.featuredLabel}>{t('home.featured')}</Text>
              <Text style={styles.featuredTitle}>{featured.name}</Text>
              <Text style={styles.featuredBody} numberOfLines={2}>
                {featured.description ?? 'Huduma ya karibu, nyumbani kwako.'}
              </Text>
            </View>

            <View style={styles.featuredArrow}>
              <Ionicons name="arrow-forward" size={17} color={colors.onPrimary} />
            </View>
          </Pressable>
        ) : null}

        {tip ? (
          <Pressable
            onPress={() => router.push({ pathname: '/article', params: { slug: tip.slug } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.tipCard, pressed && styles.pressed]}
          >
            <View style={styles.tipIcon}>
              <Ionicons name="bulb-outline" size={19} color={colors.brandOrange} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.tipLabel}>{t('home.tip')}</Text>
              <Text style={styles.tipTitle} numberOfLines={2}>
                {tip.title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
          </Pressable>
        ) : null}

        <SectionHeader title={t('home.nextVisit')} label={t('common.all')} onPress={() => router.push('/appointments')} />

        {upcoming ? (
          <Pressable
            onPress={() => router.push('/appointments')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.visitCard, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.visitIcon,
                { backgroundColor: `${serviceColour(upcoming.service?.name)}1A` },
              ]}
            >
              <Ionicons
                name={serviceIcon(upcoming.service?.name)}
                size={19}
                color={serviceColour(upcoming.service?.name)}
              />
            </View>

            <View style={styles.visitText}>
              <Text style={styles.visitTitle} numberOfLines={1}>
                {upcoming.service?.name ?? 'Ziara ya nyumbani'}
              </Text>
              <Text style={styles.muted}>{when(upcoming.scheduledAt)}</Text>
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tx(STATUS_SW[upcoming.status] ?? upcoming.status)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        ) : (
          <View style={styles.visitCard}>
            <View style={[styles.visitIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={19} color={colors.primary} />
            </View>
            <View style={styles.visitText}>
              <Text style={styles.visitTitle}>{t('home.noVisit')}</Text>
              <Text style={styles.muted}>{t('home.noVisitHint')}</Text>
            </View>
          </View>
        )}

        <View style={styles.quickRow}>
          <QuickCard
            icon="calendar-outline"
            tint={accentAt(2)}
            title={t('home.myVisits')}
            hint={t('home.myVisitsHint')}
            onPress={() => router.push('/appointments')}
          />
          <QuickCard
            icon="headset-outline"
            tint={colors.primary}
            title={t('home.support')}
            hint={t('home.supportHint')}
            onPress={() => router.push('/ask')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, label, onPress }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{title}</Text>
      <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
        <View style={styles.viewAll}>
          <Text style={styles.viewAllText}>{label}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primary} />
        </View>
      </Pressable>
    </View>
  );
}

function QuickCard({ icon, tint, title, hint, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.quickText}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickHint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: spacing.md, paddingBottom: spacing.xl },
  gutter: { paddingHorizontal: spacing.md },
  pressed: { opacity: 0.75 },
  muted: { ...type.small, color: colors.muted, marginTop: 2 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  brandText: { flex: 1 },
  brandTag: { ...type.tiny, fontSize: fs(10), color: colors.muted, marginTop: 1 },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellCount: { color: '#FFFFFF', fontSize: fs(10), fontFamily: font.bold },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: 'hidden',
    ...shadow.lifted,
  },
  heroText: { paddingRight: 96 },
  heroHello: { ...type.small, color: colors.onPrimary, opacity: 0.85 },
  heroName: { fontSize: fs(22), lineHeight: fs(28), fontFamily: font.extrabold, color: colors.onPrimary },
  heroTag: { ...type.small, color: colors.onPrimary, opacity: 0.85, marginTop: 2 },
  heroPhoto: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  heroButtonText: { ...type.bodyStrong, fontFamily: font.bold, color: colors.primary },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  section: { ...type.section, color: colors.text },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { ...type.label, color: colors.primary },

  list: { gap: spacing.xs + 2 },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  serviceIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: { flex: 1, ...type.bodyStrong, color: colors.text },
  servicePrice: { ...type.label, color: colors.primary },

  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  featuredImage: { width: 76, height: 76, borderRadius: radius.md },
  featuredFallback: { alignItems: 'center', justifyContent: 'center' },
  featuredText: { flex: 1 },
  featuredLabel: { ...type.tiny, fontSize: fs(9), color: colors.muted, letterSpacing: 0.8 },
  featuredTitle: { ...type.bodyStrong, fontFamily: font.bold, color: colors.text, marginTop: 1 },
  featuredBody: { ...type.small, color: colors.muted, marginTop: 1 },
  featuredArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    ...shadow.card,
  },
  visitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitText: { flex: 1 },
  visitTitle: { ...type.bodyStrong, color: colors.text },
  badge: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { ...type.tiny, fontSize: fs(10), fontFamily: font.bold, color: colors.primary },

  rowText: { flex: 1 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Was a hardcoded orange wash, which stayed orange on the green
    // and blue themes — the daily tip was the one card on Home that
    // belonged to a different app.
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLabel: { ...type.tiny, fontSize: fs(9), color: colors.primaryDark, letterSpacing: 0.6 },
  tipTitle: { ...type.bodyStrong, color: colors.text, marginTop: 1 },

  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  quickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    ...shadow.card,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: { flex: 1 },
  quickTitle: { ...type.label, color: colors.text },
  quickHint: { ...type.tiny, fontSize: fs(10), color: colors.muted, marginTop: 1 },
  mobilityRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mobility: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm + 2,
    gap: 2,
  },
  mobilityTitle: { ...type.bodyStrong, color: colors.text, marginTop: 4 },
  mobilySub: { ...type.tiny, color: colors.muted },
});
