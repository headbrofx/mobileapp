import { colors } from './theme';

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

const META = {
  'Home Nursing': { icon: 'medkit', colour: '#3B82F6' },
  'Elderly Care': { icon: 'people', colour: '#0E9B77' },
  Physiotherapy: { icon: 'body', colour: '#F59E0B' },
  'Wound Care': { icon: 'bandage', colour: '#EF4444' },
  'Postnatal Care': { icon: 'heart', colour: '#EC4899' },
  'Health Education': { icon: 'school', colour: '#0EA5E9' },
  'Follow-up Visit': { icon: 'repeat', colour: '#8B5CF6' },
  'Medication Administration': { icon: 'medical', colour: '#14B8A6' },
};

// A service the catalogue gains before this map knows about it still
// gets a stable colour rather than a grey hole: the name itself picks
// one, so it does not change between screens or between launches.
const FALLBACK = ['#3B82F6', '#0E9B77', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EC4899'];

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

export function serviceImage(name) {
  return IMAGES[name] ?? null;
}

export function serviceMeta(name) {
  const known = META[name];
  if (known) return known;
  return { icon: 'ellipse', colour: FALLBACK[hash(name) % FALLBACK.length] };
}

export const serviceIcon = (name) => serviceMeta(name).icon;
export const serviceColour = (name) => serviceMeta(name).colour;

// The pale wash behind an icon when it sits on white rather than on the
// colour itself. Kept here so the two never drift apart.
export function serviceTint(name) {
  return `${serviceColour(name)}1A`;
}

export { colors };
