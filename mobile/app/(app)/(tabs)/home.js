import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { colors, font, radius, scale, shadow, spacing, type } from '../../../lib/theme';
import { serviceColour, serviceIcon, serviceImage } from '../../../lib/services-meta';

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
  const { width, height } = useWindowDimensions();
  // The service tiles come first, and the picture takes what is left.
  //
  // This used to be the other way round — the hero took a fixed share of
  // the screen and the tiles went wherever they landed. On a 640-tall
  // Android that put the bottom row twelve pixels under the tab bar:
  // half the catalogue was invisible unless you knew to scroll. Sizing
  // the picture from the room left over fixes both complaints at once,
  // because a tall phone has room to spare and the hero grows into it
  // while a short one gives the room to the tiles.
  // Two across, not three. Three fitted six services into two rows but
  // gave each one a 107-point column, which is narrower than the names
  // are: "Medication Administration" came out as three stacked
  // fragments in ten-point type. Two across doubles the width, so the
  // icon and the name both get room, and the third row is paid for out
  // of the picture above rather than out of the fold.
  const tileWidth = (width - spacing.md * 2 - spacing.sm) / 2;
  const tileHeight = Math.round(Math.min(Math.max(height * 0.1, 62), 96));

  // Everything above the grid that is not the picture: the top bar, the
  // greeting, the tagline, the button hanging off the hero and the
  // section heading. Measured, not guessed, and scaled with the width
  // because the type and the spacing are. BREATH is the slack that
  // covers a greeting long enough to wrap onto a second line.
  const ABOVE_GRID = scale(240);
  const TAB_BAR = 62;
  const BREATH = 16;
  const gridHeight = tileHeight * 3 + spacing.sm * 2;
  const room = height - TAB_BAR - ABOVE_GRID - gridHeight - BREATH;
  const heroHeight = Math.round(Math.min(Math.max(room, 120), 300));

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

      <View style={styles.gutter}>
        <Text style={styles.greeting}>{t('home.greeting')}, {user?.name?.split(' ')[0] ?? tx('Karibu')}!</Text>
        <Text style={styles.tagline}>{t('home.tagline')}</Text>
      </View>

      <View style={styles.heroWrap}>
        <Image
          source={require('../../../assets/hero.png')}
          style={[styles.hero, { height: heroHeight }]}
          resizeMode="cover"
        />

        {/* The design hangs the button off the foot of the picture,
            which is what stops the two reading as separate blocks. */}
        <Pressable
          onPress={() => router.push('/book')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <View style={styles.ctaIcon}>
              <Ionicons name="calendar" size={18} color={colors.onPrimary} />
            </View>
            <Text style={styles.ctaText}>{t('home.book')}</Text>
            <Ionicons name="arrow-forward" size={19} color={colors.onPrimary} />
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.gutter}>
        <ErrorBox error={error} />

        <SectionHeader title={t('home.ourServices')} label={t('common.all')} onPress={() => router.push('/services')} />

        <View style={styles.grid}>
          {services.slice(0, 6).map((service) => (
            <Pressable
              key={service.id}
              onPress={() => router.push('/book')}
              accessibilityRole="button"
              style={({ pressed }) => [{ width: tileWidth }, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.tile,
                  { height: tileHeight, backgroundColor: serviceColour(service.name) },
                ]}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={serviceIcon(service.name)} size={21} color="#FFFFFF" />
                </View>
                <Text style={styles.tileText} numberOfLines={2}>
                  {service.name}
                </Text>
              </View>
            </Pressable>
          ))}
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
            tint="#3B82F6"
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
  brandTag: { ...type.tiny, fontSize: 10, color: colors.muted, marginTop: 1 },
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
  bellCount: { color: '#FFFFFF', fontSize: 10, fontFamily: font.bold },

  greeting: { ...type.title, fontFamily: font.extrabold, fontSize: type.display.fontSize - 5, color: colors.text },
  tagline: { ...type.body, color: colors.muted, marginTop: 2 },

  // The button hangs below the picture, so the wrapper leaves room for
  // the half that overlaps.
  heroWrap: { marginTop: spacing.md, marginBottom: spacing.xxl },
  hero: { width: '100%', borderRadius: radius.xl },
  ctaWrap: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: -26 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    ...shadow.lifted,
  },
  ctaIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, ...type.bodyStrong, color: colors.onPrimary },

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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { ...type.tiny, fontSize: 12, lineHeight: 15, fontFamily: font.bold, color: '#FFFFFF' },

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
  featuredLabel: { ...type.tiny, fontSize: 9, color: colors.muted, letterSpacing: 0.8 },
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
  badgeText: { ...type.tiny, fontSize: 10, fontFamily: font.bold, color: colors.primary },

  rowText: { flex: 1 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF6EE',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FFE6D2',
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBDA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLabel: { ...type.tiny, fontSize: 9, color: colors.brandOrange, letterSpacing: 0.6 },
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
  quickHint: { ...type.tiny, fontSize: 10, color: colors.muted, marginTop: 1 },
});
