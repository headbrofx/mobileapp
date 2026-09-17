// The palette, taken from the design the owner supplied.
//
// A note on how this got here, because it changed twice. The first
// version used a green I had picked before looking at anything. The
// logo turned out to be orange and blue, so it moved to those. Then the
// design arrived and it is green after all — so green it is, and the
// logo's colours stay as accents on the service tiles where they came
// from.
//
// Green happens to be the safest of the three for this app. The
// emergency panel is red, and red beside green is as far apart as this
// palette gets; red beside orange is the pair somebody with colour
// blindness cannot separate.
//
// Sampled by eye from the mockup rather than from a file, so these are
// close rather than exact. Say the word and they can be matched to a
// hex you give.

export const colors = {
  bg: '#F4F7F6',
  surface: '#FFFFFF',
  border: '#E3EAE7',
  text: '#16211D',
  muted: '#6B7B76',
  subtle: '#95A5A0',

  primary: '#0E7A5F',
  primaryDark: '#0A5C47',
  primaryLight: '#E6F2EE',
  onPrimary: '#FFFFFF',

  // The logo's own colours, kept for accents.
  brandOrange: '#FD6000',
  brandBlue: '#0D408F',
  cream: '#EFE8E0',

  // Reserved for emergencies. Nothing decorative uses this, so when a
  // screen turns this colour it means one thing only.
  danger: '#B3261E',
  dangerBg: '#FDEDEC',

  success: '#0E7A5F',
  successBg: '#E6F2EE',
};

// One colour per service, so a tile is recognisable before it is read.
// Mirrors the six-tile grid in the design.
export const tileColors = [
  { bg: '#3B82F6', tint: '#EAF2FE' },
  { bg: '#0E9B77', tint: '#E6F5F1' },
  { bg: '#F59E0B', tint: '#FEF4E6' },
  { bg: '#8B5CF6', tint: '#F1EBFE' },
  { bg: '#0EA5E9', tint: '#E6F5FD' },
  { bg: '#EC4899', tint: '#FDEBF4' },
];

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const shadow = {
  card: {
    shadowColor: '#0E2A22',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
