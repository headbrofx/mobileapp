// Colour algebra. No react-native, no storage, no theme — just maths.
//
// It lives apart from theme.js for two reasons. It has no business
// importing Platform to work out a contrast ratio; and kept pure it can
// be loaded and measured by a plain node script, which is how the ramp
// below was actually checked rather than eyeballed.

export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s, l };
}

export function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];

  const to = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Flatten a colour laid over a background at some alpha, so a wash can
// be measured rather than assumed.
export function flatten(hex, alpha, background = '#FFFFFF') {
  const fg = parseInt(hex.slice(1), 16);
  const bg = parseInt(background.slice(1), 16);
  const mix = (shift) =>
    Math.round((((fg >> shift) & 255) * alpha) + (((bg >> shift) & 255) * (1 - alpha)));
  const to = (v) => v.toString(16).padStart(2, '0');
  return `#${to(mix(16))}${to(mix(8))}${to(mix(0))}`;
}

// Find the lightness that puts this hue at `target` contrast against
// `against`.
//
// This solves rather than guesses because equal lightness is not equal
// contrast. The first version of the ramp fixed every step at the same
// HSL lightness and measured 2.93:1 on the greens against 11:1 on the
// blues — the eye weights green far above blue, so a number that works
// for one theme fails the next. Contrast is monotonic in lightness, so
// twenty bisections land close enough.
export function atContrast(hue, sat, target, against, { lighter = false } = {}) {
  let lo = lighter ? 0.3 : 0.02;
  let hi = lighter ? 0.97 : 0.6;

  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    const ratio = contrast(hslToHex(hue, sat, mid), against);
    if (ratio > target) {
      if (lighter) hi = mid;
      else lo = mid;
    } else if (lighter) lo = mid;
    else hi = mid;
  }
  return hslToHex(hue, sat, (lo + hi) / 2);
}

export const SURFACE = '#FFFFFF';
export const DARK_SURFACE = '#050B18';

// One family of accents from a single hue.
//
// The app used to carry four unrelated colour systems — the theme, a
// fixed orange for Afya AI, a plum for Orbit, six arbitrary hues in the
// menu — so changing the theme moved one quarter of the app. These all
// come from the active primary instead: the hue fans across a 48
// degree arc and the target ratio climbs from 4.8 to 7.2, so steps
// differ in weight as well as tone while every one stays above AA on
// the wash it is actually drawn on.
//
// Hue is fanned rather than held exactly because lightness alone is a
// weak signal at icon size; this much separates without leaving the
// family.
export function rampFor(primary, count = 6, washAlpha = 0.12) {
  const base = hexToHsl(primary);
  const span = Math.max(1, count - 1);
  const sat = Math.min(0.9, Math.max(0.4, base.s));

  return Array.from({ length: count }, (_, index) => {
    // Fanned asymmetrically, -8 to +40 degrees, rather than evenly
    // either side. An even fan on the orange theme put the first step
    // at hue 354 — pure red, which in this app means one thing only
    // and must not turn up behind a menu icon. Leaning the fan
    // "upward" in hue keeps every step clear of red in all three
    // themes while still spreading them apart.
    const spread = count > 1 ? (index / span) * 48 - 8 : 0;
    const target = 4.8 + (index / span) * 2.4;
    return atContrastOverOwnWash(base.h + spread, sat, target, washAlpha);
  });
}

// Solve against the colour's own wash rather than against white.
//
// These accents are drawn as a glyph on a tile tinted with the same
// colour, and that tile is darker than the page — so a step solved to
// 4.8:1 on white lands nearer 3.9:1 where it is actually used. Measured
// that way the first ramp failed on four steps while claiming to pass.
//
// Contrast against the wash still rises monotonically as the colour
// darkens (the wash darkens more slowly), so the same bisection works.
// Clearing the wash clears white automatically, white being the lighter
// of the two.
function atContrastOverOwnWash(hue, sat, target, alpha) {
  let lo = 0.02;
  let hi = 0.6;

  for (let i = 0; i < 22; i += 1) {
    const mid = (lo + hi) / 2;
    const colour = hslToHex(hue, sat, mid);
    if (contrast(colour, flatten(colour, alpha)) > target) lo = mid;
    else hi = mid;
  }
  return hslToHex(hue, sat, (lo + hi) / 2);
}

// The same family lightened for a dark surface. A light theme's primary
// is dark on purpose, so placing it on navy would be dark on dark —
// which is exactly what the hardcoded orange was papering over.
export function onDarkFor(primary) {
  const base = hexToHsl(primary);
  const sat = Math.min(0.92, base.s + 0.1);
  const altHue = base.h + 24;

  return {
    accent: atContrast(base.h, sat, 7, DARK_SURFACE, { lighter: true }),
    alt: atContrast(altHue, Math.min(0.92, base.s), 8.5, DARK_SURFACE, { lighter: true }),

    // Three steps of the same hue for the gradients on the dark
    // surface — the orb, the send button, the sent-message bubble.
    // Those were three hardcoded blues, so on the green theme the one
    // screen the owner asked about glowed blue over an orange app.
    // Ordered light to dark; a gradient reads from lift to deep.
    lift: atContrast(altHue, sat, 9.5, DARK_SURFACE, { lighter: true }),
    mid: atContrast(altHue, sat, 5.5, DARK_SURFACE, { lighter: true }),
    // Set by lightness rather than solved. Everything above is solved
    // to a ratio because it carries a glyph or a word; this one is the
    // far end of a gradient and carries nothing, so what it needs is
    // to be dark, not to hit a number.
    //
    // Solving it was in fact wrong: contrast against a near-black navy
    // falls as a colour darkens, which is the opposite of the
    // assumption the solver is built on, so it clamped at its own
    // lower bound and returned 4.03 on the green theme — a pale orb
    // with no depth in it at all.
    deep: hslToHex(altHue, sat, 0.2),
  };
}

// A wash of a colour, for a tile behind a glyph.
export const wash = (hex, alpha = '1F') => `${hex}${alpha}`;
