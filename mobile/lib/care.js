import * as Location from 'expo-location';
import { care } from './api';
import { colors } from './theme';
import { tx } from './i18n';

// Shared words and helpers for Care Mobility: home visits and transport
// to care. One place for what a status is called, so the request list,
// the tracking screen and the Dispatch Center never disagree.

// What a status means to the person waiting, not to the database. A
// nurse declining (REJECTED) is, from the client's side, "we are
// finding someone else" — the dispatcher sees the raw word.
export const BOOKING_STATUS = {
  REQUESTED: { sw: 'Imepokelewa', tone: 'info', icon: 'mail-unread-outline' },
  UNDER_REVIEW: { sw: 'Inapitiwa', tone: 'info', icon: 'eye-outline' },
  ASSIGNED: { sw: 'Muuguzi amepangiwa', tone: 'info', icon: 'person-add-outline' },
  ACCEPTED: { sw: 'Imethibitishwa', tone: 'success', icon: 'checkmark-circle-outline' },
  ON_THE_WAY: { sw: 'Yupo njiani', tone: 'info', icon: 'navigate-outline' },
  ARRIVED: { sw: 'Amefika', tone: 'success', icon: 'home-outline' },
  IN_PROGRESS: { sw: 'Huduma inaendelea', tone: 'info', icon: 'medkit-outline' },
  COMPLETED: { sw: 'Imekamilika', tone: 'success', icon: 'checkmark-done-outline' },
  REJECTED: { sw: 'Tunatafuta muuguzi mwingine', tone: 'caution', icon: 'refresh-outline' },
  RESCHEDULED: { sw: 'Imepangwa upya', tone: 'caution', icon: 'calendar-outline' },
  CANCELLED: { sw: 'Imesitishwa', tone: 'muted', icon: 'close-circle-outline' },
  FAILED: { sw: 'Haikufanyika', tone: 'danger', icon: 'alert-circle-outline' },
  EXPIRED: { sw: 'Muda umepita', tone: 'muted', icon: 'hourglass-outline' },
};

export const TRANSPORT_STATUS = {
  REQUESTED: { sw: 'Imepokelewa', tone: 'info', icon: 'mail-unread-outline' },
  UNDER_REVIEW: { sw: 'Tunapanga usafiri', tone: 'info', icon: 'eye-outline' },
  QUOTED: { sw: 'Bei iko tayari — jibu', tone: 'caution', icon: 'pricetag-outline' },
  ACCEPTED: { sw: 'Umekubali bei', tone: 'info', icon: 'thumbs-up-outline' },
  ASSIGNED: { sw: 'Gari limepangwa', tone: 'success', icon: 'car-outline' },
  EN_ROUTE: { sw: 'Gari liko njiani', tone: 'info', icon: 'navigate-outline' },
  ARRIVED_PICKUP: { sw: 'Gari limefika', tone: 'success', icon: 'location-outline' },
  IN_TRIP: { sw: 'Safarini', tone: 'info', icon: 'car-sport-outline' },
  ARRIVED_DESTINATION: { sw: 'Mmefika', tone: 'success', icon: 'flag-outline' },
  COMPLETED: { sw: 'Imekamilika', tone: 'success', icon: 'checkmark-done-outline' },
  CANCELLED: { sw: 'Imesitishwa', tone: 'muted', icon: 'close-circle-outline' },
  REJECTED: { sw: 'Haikukubaliwa', tone: 'danger', icon: 'close-circle-outline' },
  FAILED: { sw: 'Haikufanyika', tone: 'danger', icon: 'alert-circle-outline' },
  EXPIRED: { sw: 'Muda umepita', tone: 'muted', icon: 'hourglass-outline' },
};

export function statusInfo(kind, status) {
  const table = kind === 'TRANSPORT' ? TRANSPORT_STATUS : BOOKING_STATUS;
  return table[status] ?? { sw: status, tone: 'muted', icon: 'ellipse-outline' };
}

// Tones map onto the theme's reserved states, so a status never
// invents a colour of its own.
export function toneColours(tone) {
  switch (tone) {
    case 'success':
      return { fg: colors.success, bg: colors.successBg };
    case 'caution':
      return { fg: colors.caution, bg: colors.cautionBg };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerBg };
    case 'muted':
      return { fg: colors.muted, bg: colors.surfaceAlt };
    default:
      return { fg: colors.primary, bg: colors.primaryLight };
  }
}

export const DESTINATION_TYPES = [
  { value: 'HOSPITAL', label: 'Hospitali', icon: 'business-outline' },
  { value: 'CLINIC', label: 'Kliniki', icon: 'medkit-outline' },
  { value: 'FACILITY', label: 'Kituo cha afya', icon: 'home-outline' },
  { value: 'PHARMACY', label: 'Duka la dawa', icon: 'bandage-outline' },
  { value: 'OTHER', label: 'Kwingine', icon: 'flag-outline' },
];

export const TIME_WINDOWS = [
  { value: 'MORNING', label: 'Asubuhi', hint: '08:00 – 12:00', hour: 9 },
  { value: 'AFTERNOON', label: 'Mchana', hint: '12:00 – 16:00', hour: 13 },
  { value: 'EVENING', label: 'Jioni', hint: '16:00 – 19:00', hour: 16 },
];

const DAY_SW = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];

// The next `count` days, starting tomorrow. Today is left out on
// purpose: a same-day visit needs a phone call, not a form, and the
// server refuses anything inside its lead time anyway.
export function nextDays(count = 7) {
  const out = [];
  for (let i = 1; i <= count; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    out.push({
      date: d,
      label: i === 1 ? tx('Kesho') : i === 2 ? tx('Keshokutwa') : tx(DAY_SW[d.getDay()]),
      sub: d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' }),
    });
  }
  return out;
}

export function atHour(date, hour, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export const dateTimeSw = (value) =>
  `${new Date(value).toLocaleDateString('sw-TZ', { weekday: 'short', day: 'numeric', month: 'short' })} · ${new Date(
    value
  ).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}`;

export const tzs = (n) => (n == null ? null : `TZS ${Number(n).toLocaleString('en-US')}`);

// The device's position, only when the person asks for it, and only
// "while using". Returns { lat, lng } or throws a readable error.
//
// `approximate` is for Find Care Near You, which only needs to know the
// neighbourhood: the server rounds it again anyway.
export async function currentPosition({ approximate = false } = {}) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(tx('Ruhusa ya mahali haikutolewa. Unaweza kuandika anwani badala yake.'));
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: approximate ? Location.Accuracy.Low : Location.Accuracy.High,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

// A link that opens the device's own map app at a point. No map is
// drawn inside this app until a maps provider is configured; this is
// the honest alternative to a fake one.
export function mapLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// The business's service zones, fetched once per app session. Maps
// start at the first zone and draw every zone's circle, so a new
// region is a row on the server, not a change here.
let zonesPromise = null;
export function serviceZones() {
  if (!zonesPromise) {
    zonesPromise = care
      .discover()
      .then((d) => d?.zones ?? [])
      .catch(() => {
        zonesPromise = null;
        return [];
      });
  }
  return zonesPromise;
}

export function zoneCircles(zones, colour) {
  return zones.map((z) => ({ lat: z.centerLat, lng: z.centerLng, radiusKm: z.radiusKm, colour }));
}
