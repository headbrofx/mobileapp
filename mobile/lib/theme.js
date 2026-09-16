// Afya Nyumbani's colours, sampled from the logo rather than invented.
// The first version of this file called #0E7A5F "Afya Nyumbani's green",
// which it never was — the brand is orange and blue, and I had written
// a palette before looking at the logo at all.
//
// Blue leads rather than orange, and that is a safety decision as much
// as a visual one. The emergency panel on the Afya AI screen is red,
// and red beside large areas of orange is a far weaker signal than red
// beside blue — hues that close are exactly what somebody with colour
// blindness cannot separate. Orange stays an accent for small things,
// so nothing competes with the one colour that means "go to hospital
// now".
//
// Colour is never the only carrier anyway: the emergency panel also has
// a heavy border, an uppercase heading and heavier type.

export const colors = {
  bg: '#F6F4F1',
  surface: '#FFFFFF',
  border: '#E4DED7',
  text: '#16211D',
  muted: '#6B6560',

  // The stethoscope in the logo.
  primary: '#0D408F',
  primaryDark: '#072E6B',
  onPrimary: '#FFFFFF',

  // The house. Accents only — never a large filled surface.
  accent: '#FD6000',

  // The logo's own warm off-white, which sits behind the mark.
  cream: '#EFE8E0',

  // Reserved for emergencies. Nothing decorative uses this, so when a
  // screen turns this colour it means one thing only.
  danger: '#9B1C1C',
  dangerBg: '#FCEFEE',
};

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 12, lg: 16 };
