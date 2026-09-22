import { accentAt, accents, colors } from './theme';
import { tx } from './i18n';

// One icon and one colour per service, for the whole app.
//
// This exists because there were three copies of it — home, the booking
// wizard and the service browser each kept their own map, and each
// picked the colour by the service's position in the list. Two screens
// that fetched the catalogue in a different order gave the same service
// two different colours, and adding a service to the catalogue
// reshuffled every colour after it.
//
// Keying on the name fixes both: Home Nursing is this blue and this
// icon everywhere, today and after the catalogue changes.
//
// Colours are the design's. Icons are the nearest Ionicon to what the
// design draws — it uses a custom set this app does not ship.

// Icons are the design's. Colours are no longer: they were eight hues
// picked by hand, which ignored the theme completely — so the
// catalogue looked identical whichever theme was chosen, and matched
// none of them.
//
// Each service now takes a step of the theme's own family, by a fixed
// index so a service keeps its place when the theme changes. One of
// the old hues was #EF4444 on Wound Care, which is red — the colour
// this app reserves for "go to hospital". A wound dressing is not an
// emergency, and it should never have been wearing that.
const META = {
  'Home Nursing': { icon: 'medkit', step: 0 },
  'Elderly Care': { icon: 'people', step: 1 },
  Physiotherapy: { icon: 'body', step: 2 },
  'Wound Care': { icon: 'bandage', step: 3 },
  'Postnatal Care': { icon: 'heart', step: 4 },
  'Health Education': { icon: 'school', step: 5 },
  'Follow-up Visit': { icon: 'repeat', step: 2 },
  'Medication Administration': { icon: 'medical', step: 1 },
};

// A service the catalogue gains before this map knows about it still
// gets a stable colour rather than a grey hole: the name itself picks
// one, so it does not change between screens or between launches.
// Same family, so a service the map has never heard of still looks
// like it belongs here.

function hash(text = '') {
  let total = 0;
  for (let i = 0; i < text.length; i += 1) total = (total + text.charCodeAt(i)) % 997;
  return total;
}

// Photographs, where there is one.
//
// require() paths have to be static — the bundler resolves them at
// build time, so a path built from a variable resolves to nothing. A
// map it is.
//
// All eight services have one. A service the catalogue gains later
// returns null and the screen falls back to its colour and icon, which
// is why that path stays.
const IMAGES = {
  'Home Nursing': require('../assets/services/home-nursing.jpg'),
  'Elderly Care': require('../assets/services/elderly-care.jpg'),
  Physiotherapy: require('../assets/services/physiotherapy.jpg'),
  'Wound Care': require('../assets/services/wound-care.jpg'),
  'Postnatal Care': require('../assets/services/postnatal-care.jpg'),
  'Health Education': require('../assets/services/health-education.jpg'),
  'Follow-up Visit': require('../assets/services/follow-up-visit.jpg'),
  'Medication Administration': require('../assets/services/medication-administration.jpg'),
};

// The raised icons, one per service.
//
// Made by scripts/make-brand-art.py from the same Ionicon the flat map
// above names, put through the treatment the wordmark gets: extruded,
// lit from the top left, glossed. The owner asked for 3-D icons on the
// tiles and these are them.
//
// They are not illustrations. The design that prompted this has a nurse
// character and a pill bottle drawn by hand; that is artwork this
// project does not own, and inventing it is not mine to do. If it ever
// arrives, the PNGs drop into assets/icons3d/ under these same names
// and nothing else changes.
//
// Static require() paths again: the bundler resolves them at build
// time, so a path built from a variable resolves to nothing.
const ICONS_3D = {
  'Home Nursing': require('../assets/icons3d/home-nursing.png'),
  'Elderly Care': require('../assets/icons3d/elderly-care.png'),
  Physiotherapy: require('../assets/icons3d/physiotherapy.png'),
  'Wound Care': require('../assets/icons3d/wound-care.png'),
  'Postnatal Care': require('../assets/icons3d/postnatal-care.png'),
  'Health Education': require('../assets/icons3d/health-education.png'),
  'Follow-up Visit': require('../assets/icons3d/follow-up-visit.png'),
  'Medication Administration': require('../assets/icons3d/medication-administration.png'),
};

// A service the catalogue gains before this map knows about it returns
// null, and the screen falls back to the flat icon in its colour —
// which is why that path stays.
export function serviceIcon3d(name) {
  return ICONS_3D[name] ?? null;
}

export function serviceImage(name) {
  return IMAGES[name] ?? null;
}

export function serviceMeta(name) {
  const known = META[name];
  if (known) return { icon: known.icon, colour: accentAt(known.step) };
  return { icon: 'ellipse', colour: accentAt(hash(name) % accents.length) };
}

export const serviceIcon = (name) => serviceMeta(name).icon;
export const serviceColour = (name) => serviceMeta(name).colour;

// The pale wash behind an icon when it sits on white rather than on the
// colour itself. Kept here so the two never drift apart.
export function serviceTint(name) {
  return `${serviceColour(name)}1A`;
}

// What a service costs, as one line of text.
//
// This exists because three screens wrote `service.basePriceTzs ? ... :
// null`, and zero is falsy. A service the business gives away would
// have rendered with no price at all — indistinguishable from one whose
// price nobody has filled in yet, and read by a client as an oversight
// rather than an offer.
//
// So the three states are kept apart deliberately:
//   null / undefined -> no price is known, say nothing
//   0                -> free, and say so plainly
//   anything else     -> "from", because a visit's real cost depends on
//                        what it turns out to involve
export function servicePrice(service) {
  const price = service?.basePriceTzs;
  if (price === null || price === undefined) return null;
  if (Number(price) === 0) return { free: true, text: tx('Bure') };
  return {
    free: false,
    text: `${tx('Kuanzia')} TZS ${Number(price).toLocaleString('en-US')}`,
  };
}

export { colors };
