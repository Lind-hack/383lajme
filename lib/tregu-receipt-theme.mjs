/**
 * The colour a buy receipt is painted in.
 *
 * The receipt used to read near-black for every league match — Barcelona came
 * out dark brown — because four separate stages each took light out of the team
 * colour and none put any back. This module is the one place that decides, and
 * it works the opposite way to `contrastSafeTeamColor` in tregu-hub-market.mjs:
 * that one exists to make a 1px chart stroke legible on a cream card and only
 * ever marches channels toward black, which desaturates as a side effect. Here
 * the colour IS the surface, so hue and saturation are preserved and only
 * lightness moves.
 *
 * Pure and dependency-free on purpose: no category import, no DOM. The caller
 * resolves the non-sport fallback pair and passes it in, which is what finally
 * gives CATEGORY_GRADIENTS in lib/category-colors.ts a consumer.
 */

const WHITE_INK = { ink: "#FFFFFF", onInk: "#111317", veil: "#090B0E" };
const DARK_INK = { ink: "#0E1013", onInk: "#FFFFFF", veil: "#F7F4EF" };

/** Alphas tried, in order, when solving for the scrim behind the receipt copy. */
const SCRIM_STEPS = [0, 0.1, 0.16, 0.22, 0.28, 0.34, 0.4, 0.46, 0.52, 0.58];

/** Below this the body rows stop being readable; WCAG AA for normal text. */
const TARGET_CONTRAST = 4.5;

export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.split("").map((c) => c + c).join("")}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

function toRgb(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex([r, g, b]) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function relativeLuminance(hex) {
  const channel = (value) => {
    const n = value / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHsl(hex) {
  const [r255, g255, b255] = toRgb(hex);
  const r = r255 / 255, g = g255 / 255, b = b255 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  const hue = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = l * 255;
    return toHex([v, v, v]);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const k = hue / 360;
  return toHex([channel(k + 1 / 3) * 255, channel(k) * 255, channel(k - 1 / 3) * 255]);
}

/**
 * A colour no receipt can stand on: essentially white. Several clubs publish a
 * white kit colour (Real Madrid, Valencia), and a white ground cannot carry
 * white text. Deliberately narrow — Dortmund's #FDE100 is fully saturated and
 * must not be caught by this.
 */
export function isAchromaticPale(hex) {
  const { s, l } = rgbToHsl(hex);
  return s < 0.12 && l > 0.82;
}

/**
 * Build a partner stop from a single colour. Always darker and a touch more
 * saturated — going lighter would drift toward white, which is the pale-kit
 * problem in reverse. The hue shift keeps narrow-lightness clubs from reading
 * as a flat rectangle; it stays small on dark-ink themes because a larger one
 * swings Dortmund's yellow into orange.
 */
export function deepenStop(hex, darkInk, strength = 1) {
  const { h, s, l } = rgbToHsl(hex);
  if (s < 0.12) {
    // Achromatic primaries (Juventus black, a white already swapped out) get a
    // cool graphite partner so the ramp still has a direction.
    const target = l > 0.5 ? Math.max(0.06, l - 0.17) : Math.min(0.94, l + 0.17);
    return hslToHex({ h: 216, s: 0.13, l: target });
  }
  // The deep stop stays a colour. A floor near zero lets an already-dark club
  // bottom out at near-black, which is the look this module was written to end —
  // Real Madrid's blue ramped to #001A1C before this floor existed.
  const floor = darkInk ? 0.4 : 0.13;
  const drop = Math.min(0.26, Math.max(0.12, (l - floor) * 0.55) * strength);
  const lowered = Math.max(floor, Math.min(l - 0.06, l - drop));
  return hslToHex({ h: h - (darkInk ? 6 : 12) * strength, s: Math.min(1, s * 1.05), l: lowered });
}

/** Two stops this close read as one flat rectangle rather than a ramp. */
const FLAT_GRADIENT_DELTA = 0.045;
/** …unless they are far enough apart around the wheel to read as two colours. */
const DISTINCT_HUE_DEGREES = 24;

function hueDistance(a, b) {
  const d = Math.abs(rgbToHsl(a).h - rgbToHsl(b).h) % 360;
  return d > 180 ? 360 - d : d;
}

/** A pair reads as a ramp if it separates by lightness OR by hue. */
function isFlatSafe(a, b) {
  return (
    Math.abs(relativeLuminance(a) - relativeLuminance(b)) >= FLAT_GRADIENT_DELTA ||
    hueDistance(a, b) >= DISTINCT_HUE_DEGREES
  );
}

export function compositeOver(topHex, bottomHex, alpha) {
  const top = toRgb(topHex);
  const bottom = toRgb(bottomHex);
  return toHex(bottom.map((b, i) => b * (1 - alpha) + top[i] * alpha));
}

/**
 * @param {{ primary?: string|null, alternate?: string|null, fallback?: [string, string]|null }} input
 * @returns {{
 *   from: string, to: string, ink: string, onInk: string,
 *   scrim: string, scrimAlpha: number, accent: string|null,
 *   source: "alternate"|"synthesized"|"fallback",
 *   contrast: { from: number, to: number },
 * } | null}
 */
export function receiptTheme({ primary, alternate, fallback } = {}) {
  let base = normalizeHex(primary);
  let partner = normalizeHex(alternate);
  let accent = null;
  let source = "synthesized";

  // A white kit is not a ground. Swap in the club's second colour and keep the
  // white as an accent — Real Madrid then reads royal blue with crisp white
  // rules, which is its graphic identity, rather than a grey slab. Darkening
  // the white instead would just reproduce the bug this module exists to fix.
  if (base && isAchromaticPale(base)) {
    if (partner && !isAchromaticPale(partner)) {
      accent = base;
      base = partner;
      partner = null;
    } else {
      accent = base;
      base = null;
    }
  }
  if (partner && isAchromaticPale(partner) && !accent) {
    accent = partner;
    partner = null;
  }

  if (!base) {
    const pair = Array.isArray(fallback) ? fallback : null;
    base = (pair && normalizeHex(pair[0])) || null;
    partner = (pair && normalizeHex(pair[1])) || null;
    source = "fallback";
    if (!base) return null;
  }

  // Elect the ink from the primary alone. Electing it from the pair lets a
  // bright secondary (Liverpool's teal) win the "light" slot and flips the
  // whole receipt to a colour the club is not known by.
  const darkInk = contrastRatio(DARK_INK.ink, base) > contrastRatio(WHITE_INK.ink, base);
  const palette = darkInk ? DARK_INK : WHITE_INK;

  // Accept the second colour only if it can carry the elected ink too, and is
  // not so much weaker than the primary that it would force a heavy scrim.
  const baseContrast = contrastRatio(palette.ink, base);
  let to;
  if (
    partner &&
    partner !== base &&
    contrastRatio(palette.ink, partner) >= 3 &&
    contrastRatio(palette.ink, partner) >= 0.62 * baseContrast
  ) {
    to = partner;
    if (source !== "fallback") source = "alternate";
  } else {
    to = deepenStop(base, darkInk);
  }

  // A club whose synthesized partner lands in the same narrow lightness band
  // (Napoli, Man City) would otherwise produce a ramp you cannot see. Push it
  // further rather than shipping a flat rectangle and calling it a gradient.
  //
  // This must never touch a real second club colour. Barcelona's garnet and blue
  // sit within 0.02 of each other in luminance and are still the most obvious
  // gradient in football — separation is carried by hue, not lightness. Widening
  // there would throw the blue away and hand back a near-black maroon, which is
  // the exact defect this module exists to remove.
  if (source === "synthesized" && !isFlatSafe(base, to)) {
    const widened = deepenStop(base, darkInk, 2.1);
    if (Math.abs(relativeLuminance(base) - relativeLuminance(widened)) >
        Math.abs(relativeLuminance(base) - relativeLuminance(to))) {
      to = widened;
    }
  }

  // Solve the scrim rather than guess it: the first alpha at which the ink
  // clears AA over BOTH stops, because the copy column spans the whole ramp.
  let scrimAlpha = 0;
  for (const alpha of SCRIM_STEPS) {
    const overFrom = compositeOver(palette.veil, base, alpha);
    const overTo = compositeOver(palette.veil, to, alpha);
    if (
      contrastRatio(palette.ink, overFrom) >= TARGET_CONTRAST &&
      contrastRatio(palette.ink, overTo) >= TARGET_CONTRAST
    ) {
      scrimAlpha = alpha;
      break;
    }
    scrimAlpha = alpha;
  }

  return {
    from: base,
    to,
    ink: palette.ink,
    onInk: palette.onInk,
    scrim: palette.veil,
    scrimAlpha,
    accent,
    source,
    contrast: {
      from: Number(contrastRatio(palette.ink, base).toFixed(2)),
      to: Number(contrastRatio(palette.ink, to).toFixed(2)),
    },
  };
}
