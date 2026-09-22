import { Dimensions, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { onDarkFor, rampFor, wash } from './colour';

// The palette — three of them, and the one in use is chosen in Settings.
//
// A note on how this got here, because it changed four times: a green I
// picked before seeing anything, then the logo's orange and blue, then
// green because the supplied design was green, then orange because the
// owner asked to see it. Rather than a fifth round of guessing, all
// three now ship and the choice belongs to whoever is looking at it.
//
// Two rules every palette obeys, because they are not matters of taste:
//
//   1. The brand colour reads at 5:1 or better against white. The logo's
//      own #FD6000 reads at 3.07:1, which is below the floor for text,
//      so the orange here is a deeper cut of it at 5.09:1. Green is
//      5.29:1, blue 5.45:1 — nothing gets harder to read when you
//      switch.
//   2. Danger is never close to the brand colour. Red beside orange is
//      the pair somebody with colour blindness cannot separate, so the
//      orange palette carries a much darker red: against that brand the
//      difference is in lightness, not only hue, and lightness is what
//      survives colour blindness and a phone held in the sun. Green and
//      blue sit far enough from red to keep the ordinary one.
//
// Success is green in all three. While the brand was green, "done" and
// "ours" were the same green and nobody noticed. Now green means one
// thing: this went through.
//
// Service colours are not here. They live in services-meta.js keyed by
// name, which is why a service is the same colour on every screen and
// does not change when the catalogue does.

const THEME_KEY = 'afya.theme';

const PALETTES = {
  green: {
    label: 'Kijani',
    swatch: '#0E7A5F',
    bg: '#F4F7F6',
    surface: '#FFFFFF',
    surfaceAlt: '#FBFCFC',
    border: '#E6ECEA',
    hairline: '#F0F4F3',
    text: '#101A17',
    muted: '#64766F',
    subtle: '#9AA8A3',
    primary: '#0E7A5F',
    primaryDark: '#09563F',
    primaryLight: '#E6F2EE',
    onPrimary: '#FFFFFF',
    danger: '#B3261E',
    dangerBg: '#FDEDEC',
    shadowNear: '#0A2A22',
    shadowFar: '#062018',
  },
  orange: {
    label: 'Chungwa',
    swatch: '#C44200',
    bg: '#F7F5F3',
    surface: '#FFFFFF',
    surfaceAlt: '#FDFBFA',
    border: '#ECE6E1',
    hairline: '#F5F0EC',
    text: '#1A120D',
    muted: '#76685F',
    subtle: '#A89B92',
    primary: '#C44200',
    primaryDark: '#933000',
    primaryLight: '#FDEDE3',
    onPrimary: '#FFFFFF',
    // Darker than the other two on purpose — see rule 2 above.
    danger: '#8A1008',
    dangerBg: '#FCEAE8',
    shadowNear: '#2B1A10',
    shadowFar: '#1C0F07',
  },
  blue: {
    label: 'Buluu',
    swatch: '#0D6EAD',
    bg: '#F3F6F9',
    surface: '#FFFFFF',
    surfaceAlt: '#FAFCFD',
    border: '#E3EAF0',
    hairline: '#EFF4F8',
    text: '#0F1A22',
    muted: '#61727E',
    subtle: '#96A5B0',
    primary: '#0D6EAD',
    primaryDark: '#0A5586',
    primaryLight: '#E4F1FA',
    onPrimary: '#FFFFFF',
    danger: '#B3261E',
    dangerBg: '#FDEDEC',
    shadowNear: '#0A2333',
    shadowFar: '#06161F',
  },
};

export const DEFAULT_THEME = 'orange';

export const THEMES = Object.entries(PALETTES).map(([name, entry]) => ({
  name,
  label: entry.label,
  swatch: entry.swatch,
}));

// Read synchronously, at module load, before a single StyleSheet is
// built.
//
// This is the whole reason the theme can be a real choice rather than a
// setting that needs the app rebuilt. StyleSheet.create freezes the
// colours it is handed — on web it compiles them to CSS classes there
// and then — and every screen calls it while its module is being
// imported. An async read finishes long after that, so by the time the
// answer arrived every style on every screen would already be the old
// colour.
//
// Both platforms happen to offer a synchronous reader: localStorage on
// web, SecureStore.getItem (not getItemAsync) on native. Wrapped,
// because storage can be blocked, cleared or unavailable, and a theme
// preference is never worth failing a launch over.
function readPref(key, allowed, fallback) {
  try {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(key)
        : SecureStore.getItem(key);
    return raw && allowed[raw] ? raw : fallback;
  } catch {
    return fallback;
  }
}

async function writePref(key, value) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    return false;
  }

  if (Platform.OS === 'web') {
    // The root, not a reload of wherever we happen to be. This is a
    // single-page build and the host has no rewrite rule, so asking the
    // server for /settings directly returns a 404 — reloading in place
    // would turn every change into a broken page. The root always
    // exists, and the app sends you on from there.
    globalThis.location?.assign('/');
    return true;
  }

  return false;
}

export const themeName = readPref(THEME_KEY, PALETTES, DEFAULT_THEME);

const palette = PALETTES[themeName];

export const colors = {
  bg: palette.bg,
  surface: palette.surface,
  // A second surface, so a white card has something to sit on rather
  // than dissolving into the page behind it.
  surfaceAlt: palette.surfaceAlt,
  border: palette.border,
  hairline: palette.hairline,
  text: palette.text,
  muted: palette.muted,
  subtle: palette.subtle,

  primary: palette.primary,
  primaryDark: palette.primaryDark,
  primaryLight: palette.primaryLight,
  onPrimary: palette.onPrimary,

  // The logo's own colours, kept for accents and for the wordmark. These
  // do not follow the theme — the business has one logo.
  brandOrange: '#FD6000',
  brandBlue: '#0D408F',
  cream: '#EFE8E0',

  // Reserved for emergencies. Nothing decorative uses this, so when a
  // screen turns this colour it means one thing only.
  danger: palette.danger,
  dangerBg: palette.dangerBg,

  // Green in every theme: finished, and nothing else.
  success: '#0E7A5F',
  successBg: '#E6F2EE',

  // Amber in every theme: worth a second look, but not an emergency.
  // The third and last reserved state. It was living as a loose
  // #8A5A16 in four separate files, which is how a meaning drifts —
  // one of them changes and nobody notices the other three did not.
  caution: '#8A5A16',
  cautionBg: '#FBF0E4',
};

// Saving is the easy half. The hard half is that the styles already
// built cannot be repainted, so the app has to start again — instantly
// and invisibly on web, and on the next launch on a phone, which the
// Settings screen says out loud rather than leaving somebody tapping a
// colour that appears to do nothing.
//
// Returns true when the change is already on screen.
export async function saveTheme(name) {
  if (!PALETTES[name]) return false;
  return writePref(THEME_KEY, name);
}

export async function saveTextSize(name) {
  if (!TEXT_SIZES[name]) return false;
  return writePref(TEXT_KEY, name);
}

// --- The dark screen -------------------------------------------------
//
// Afya AI is drawn on navy rather than on the page colour, at the
// owner's request. The surface stays; the hue no longer does.
//
// It used to be argued the other way here — that this screen should
// keep the logo's own orange and blue whatever theme was chosen, so it
// read as the same company. In practice it read as a different app:
// pick the green theme and one screen in five glowed orange. The owner
// called it what it was.
//
// So the navy, the glass and the greys are fixed — they are the
// surface, not a colour choice — and everything that sits on them is
// the active theme's own hue, lifted for legibility. A light theme's
// primary is dark on purpose: #C44200 on this navy reads 3.2:1, under
// the floor for text, so the accents here are solved to 7:1 and better
// rather than picked. See colour.js.
//
// --- One family of colours, from the theme's own hue -----------------
//
// The app had four independent colour systems: this palette, a fixed
// orange accent for Afya AI, a plum for Orbit, and six unrelated hues
// in the menu. Switching the theme moved one of the four; the other
// three stayed put, which is how one app ends up looking like three
// stitched together.
//
// Everything now derives from the active primary. The maths lives in
// colour.js, pure and measurable — see the note there on why the ramp
// solves for contrast instead of picking a lightness.

const RAMP = rampFor(palette.primary, 6);
const DARK_ACCENTS = onDarkFor(palette.primary);

// Accent n of the family, for a light surface. Wraps, so a caller with
// more items than steps keeps getting family members.
export const accentAt = (index, count = RAMP.length) => RAMP[index % RAMP.length] ?? RAMP[0];
export const accents = RAMP;

export const onDark = DARK_ACCENTS.accent;
export const onDarkAlt = DARK_ACCENTS.alt;

export { wash };

// rgba() from a hex, for the translucent fills on the dark surface.
function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const dark = {
  bg: '#050B18',
  bgDeep: '#02060F',
  // Glass: a white veil rather than a solid, so the backdrop shows
  // through and the cards read as one surface at different depths.
  glass: 'rgba(255,255,255,0.045)',
  glassStrong: 'rgba(255,255,255,0.075)',
  border: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  muted: '#A8B8D0',
  // 5.1:1 against the navy. The obvious slate grey for this job
  // sits at 4.1:1, which is under the floor — and the text that uses
  // it is the ten-point line saying this is not a doctor.
  subtle: '#74839B',

  // Afya AI keeps its own dark surface — it is the one screen with a
  // reason to — but it no longer keeps its own hue. These were a fixed
  // orange and a fixed blue, so on the green or blue theme this one
  // screen stayed orange and belonged to a different app. They are the
  // active theme's colour now, lifted to 7:1 and 8.5:1 against the
  // navy, because a light theme's primary is dark on purpose and would
  // be dark on dark here.
  accent: onDark,
  accentSoft: alpha(onDark, 0.16),
  accentLine: alpha(onDark, 0.45),

  glow: onDarkAlt,
  glowSoft: alpha(onDarkAlt, 0.22),
  glowFaint: alpha(onDarkAlt, 0.1),

  // Gradient steps, light to dark, for the orb and the two buttons.
  glowLift: DARK_ACCENTS.lift,
  glowMid: DARK_ACCENTS.mid,
  glowDeep: DARK_ACCENTS.deep,

  // Still the one colour that means go to hospital. Lifted off the
  // light-theme red because a dark screen swallows it.
  danger: '#FF6B5E',
  dangerBg: 'rgba(255,107,94,0.12)',
  dangerBorder: 'rgba(255,107,94,0.55)',
};

// --- Type ------------------------------------------------------------
//
// Plus Jakarta Sans, loaded at launch.
//
// The weights are named rather than numbered because React Native will
// not synthesise a weight for a custom family: asking for fontWeight
// '700' on a file that is not the bold cut silently gives you the
// regular one, and every heading on the screen goes flat without a
// single error. Anything that wants bold names the bold file.

export const font = {
  regular: 'Jakarta_400Regular',
  medium: 'Jakarta_500Medium',
  semibold: 'Jakarta_600SemiBold',
  bold: 'Jakarta_700Bold',
  extrabold: 'Jakarta_800ExtraBold',
};

// --- Scale -----------------------------------------------------------
//
// Sizes follow the width of the phone, gently. A 360-wide budget
// Android and a 430-wide iPhone Pro Max should both look composed
// rather than one being a blown-up copy of the other, so the factor is
// clamped: a third of the difference, never below 0.92 or above 1.12.
// Unclamped scaling makes small phones cramped and large ones look like
// a children's book.

// --- Text size -------------------------------------------------------
//
// Read at module load for the same reason the palette is: the sizes
// below are baked into StyleSheets during import, and an async answer
// would arrive after every screen had already been built.
//
// The range is deliberately narrow. Type carries layout with it — a
// name that fits a tile at one size wraps at another — and this app has
// grids and a five-item tab bar that a 1.5x jump would break. Three
// steps eight points apart is enough to help somebody who is squinting
// without turning the catalogue into a list of fragments. Anyone who
// needs more than this needs their phone's own accessibility zoom,
// which works on top of it.
const TEXT_KEY = 'afya.textSize';

const TEXT_SIZES = { small: 0.92, normal: 1, large: 1.12 };

export const DEFAULT_TEXT_SIZE = 'normal';

export const TEXT_SIZE_OPTIONS = [
  { name: 'small', label: 'Madogo' },
  { name: 'normal', label: 'Ya kawaida' },
  { name: 'large', label: 'Makubwa' },
];

export const textSizeName = readPref(TEXT_KEY, TEXT_SIZES, DEFAULT_TEXT_SIZE);
export const textScale = TEXT_SIZES[textSizeName];

const BASE_WIDTH = 375;
const { width: INITIAL_WIDTH } = Dimensions.get('window');

function factorFor(width) {
  const raw = 1 + ((width - BASE_WIDTH) / BASE_WIDTH) * 0.34;
  return Math.min(1.12, Math.max(0.92, raw));
}

export const scaleFactor = factorFor(INITIAL_WIDTH);
export const scale = (size) => Math.round(size * scaleFactor);

// Type only. Spacing keeps plain scale(), because the reader asked for
// bigger words, not a looser page — and the grids are sized from the
// screen, so widening every gap would push rows under the fold.
const textScaleSize = (size) => Math.round(size * scaleFactor * textScale);
const ts = textScaleSize;

// The same thing, exported, for the places that write a size straight
// into a StyleSheet instead of taking a token. Without it "Text size:
// Large" would move half the app and leave the rest, which looks broken
// rather than absent.
export const fs = textScaleSize;

export const type = {
  display: { fontFamily: font.extrabold, fontSize: ts(28), lineHeight: ts(34) },
  title: { fontFamily: font.bold, fontSize: ts(21), lineHeight: ts(27) },
  section: { fontFamily: font.bold, fontSize: ts(16), lineHeight: ts(21) },
  body: { fontFamily: font.regular, fontSize: ts(14), lineHeight: ts(20) },
  bodyStrong: { fontFamily: font.semibold, fontSize: ts(14), lineHeight: ts(20) },
  label: { fontFamily: font.semibold, fontSize: ts(13), lineHeight: ts(17) },
  small: { fontFamily: font.regular, fontSize: ts(12), lineHeight: ts(16) },
  tiny: { fontFamily: font.medium, fontSize: ts(11), lineHeight: ts(14) },
};

export const spacing = {
  xs: scale(6),
  sm: scale(10),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(44),
};

export const radius = { sm: 10, md: 16, lg: 20, xl: 26, xxl: 34, pill: 999 };

// Two shadows rather than one. A card at rest barely lifts; something
// meant to feel raised — a hero, a primary button — gets the deeper
// one. A single shadow everywhere is what makes an interface look
// either flat or muddy. The tint follows the theme: a green-black cast
// under an orange interface reads as grime.
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: palette.shadowNear,
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
    },
    default: { elevation: 2, shadowColor: palette.shadowNear },
  }),
  lifted: Platform.select({
    ios: {
      shadowColor: palette.shadowFar,
      shadowOpacity: 0.16,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
    },
    default: { elevation: 8, shadowColor: palette.shadowFar },
  }),
};
