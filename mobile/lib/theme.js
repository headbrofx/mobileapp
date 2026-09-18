import { Dimensions, Platform } from 'react-native';

// The palette.
//
// A note on how this got here, because it has changed three times. The
// first version used a green I had picked before looking at anything.
// The logo turned out to be orange and blue, so it moved to those. Then
// the design arrived and it was green, so green it was. Now the owner
// has asked to see orange, which is where the logo started.
//
// Orange costs something, and the cost is paid here rather than on the
// screens. Red beside orange is the pair somebody with colour blindness
// cannot separate, and the emergency panel is red. So two things
// changed alongside the brand colour:
//
//   - danger is darker than it was. Against this orange it is a
//     difference in lightness, not only in hue, which is the part that
//     survives colour blindness and a phone in the sun.
//   - success is no longer the brand colour. While the brand was green,
//     "done" and "ours" were the same green and nobody noticed. With an
//     orange brand, green is free to mean one thing: this went through.
//
// The orange itself is a deeper cut of the logo's #FD6000. The logo
// colour reads at 3.07:1 against white, which is below the floor for
// text; this one reads at 5.09:1, near enough the green it replaces
// (5.29:1) that nothing on any screen gets harder to read.
//
// Service colours live in services-meta.js, keyed by name, which is why
// the same service is the same colour on every screen.

export const colors = {
  bg: '#F7F5F3',
  surface: '#FFFFFF',
  // A second surface, so a white card has something to sit on rather
  // than dissolving into the page behind it.
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

  // The logo's own colours, kept for accents.
  brandOrange: '#FD6000',
  brandBlue: '#0D408F',
  cream: '#EFE8E0',

  // Reserved for emergencies. Nothing decorative uses this, so when a
  // screen turns this colour it means one thing only. Darker than the
  // brand orange on purpose — see the note above.
  danger: '#8A1008',
  dangerBg: '#FCEAE8',

  // Green now means finished, and nothing else.
  success: '#0E7A5F',
  successBg: '#E6F2EE',
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

const BASE_WIDTH = 375;
const { width: INITIAL_WIDTH } = Dimensions.get('window');

function factorFor(width) {
  const raw = 1 + ((width - BASE_WIDTH) / BASE_WIDTH) * 0.34;
  return Math.min(1.12, Math.max(0.92, raw));
}

export const scaleFactor = factorFor(INITIAL_WIDTH);
export const scale = (size) => Math.round(size * scaleFactor);

export const type = {
  display: { fontFamily: font.extrabold, fontSize: scale(28), lineHeight: scale(34) },
  title: { fontFamily: font.bold, fontSize: scale(21), lineHeight: scale(27) },
  section: { fontFamily: font.bold, fontSize: scale(16), lineHeight: scale(21) },
  body: { fontFamily: font.regular, fontSize: scale(14), lineHeight: scale(20) },
  bodyStrong: { fontFamily: font.semibold, fontSize: scale(14), lineHeight: scale(20) },
  label: { fontFamily: font.semibold, fontSize: scale(13), lineHeight: scale(17) },
  small: { fontFamily: font.regular, fontSize: scale(12), lineHeight: scale(16) },
  tiny: { fontFamily: font.medium, fontSize: scale(11), lineHeight: scale(14) },
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
// either flat or muddy.
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#2B1A10',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
    },
    default: { elevation: 2, shadowColor: '#2B1A10' },
  }),
  lifted: Platform.select({
    ios: {
      shadowColor: '#1C0F07',
      shadowOpacity: 0.16,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
    },
    default: { elevation: 8, shadowColor: '#1C0F07' },
  }),
};
