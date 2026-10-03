/**
 * The woven QR: a real QR matrix drawn as kilim cloth.
 *
 * Phone cameras binarize by brightness, not hue, so the code is woven from a
 * family of dark colours and a family of light ones laid in kilim chevron
 * bands, with the finder patterns drawn as kilim "eyes" (syri). Nothing sits
 * in a flat box: the quiet zone is woven from the light family too.
 *
 * Scannability is enforced here, not hoped for: every dark colour must reach
 * a minimum contrast against every light colour, and the quiet zone is a
 * fixed number of light modules on every side.
 */
import qrcode from "./vendor/qrcode.mjs";

/** Error correction Q (25%): modules are drawn crisp with nothing laid over them. */
export const QR_LEVEL = "Q";
export const QR_QUIET_MODULES = 4;
export const QR_MIN_CONTRAST = 7;

/** Longest URL a card will encode; longer links belong on the server, not in the weave. */
export const QR_MAX_URL_LENGTH = 300;

/**
 * Only absolute http(s) URLs, percent-encoded by the URL parser so every
 * character is ASCII (the encoder keeps just the low byte of each char).
 */
export function normalizeQrUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error("QR target is not a valid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("QR target must be http(s)");
  if (url.href.length > QR_MAX_URL_LENGTH) throw new Error(`QR target is longer than ${QR_MAX_URL_LENGTH} characters`);
  return url.href;
}

export function qrMatrix(text, level = QR_LEVEL) {
  const qr = qrcode(0, level);
  try {
    qr.addData(String(text));
    qr.make();
  } catch (error) {
    // The vendored encoder throws plain strings ("code length overflow...").
    throw error instanceof Error ? error : new Error(`QR encoding failed: ${String(error)}`);
  }
  const size = qr.getModuleCount();
  return { size, isDark: (row, col) => qr.isDark(row, col) };
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix two #rrggbb colours; t = 0 gives a, t = 1 gives b. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0").toUpperCase()}`;
}

/** The weakest dark/light pair across both families. */
export function weakestContrast(darks, lights) {
  let min = Infinity;
  for (const d of darks) for (const l of lights) min = Math.min(min, contrastRatio(d, l));
  return min;
}

/**
 * Keep only the dark candidates that clear the threshold against every light
 * colour, always keeping `anchorDark`, which must clear it on its own.
 */
export function scannableDarks(candidates, lights, anchorDark) {
  if (weakestContrast([anchorDark], lights) < QR_MIN_CONTRAST) {
    throw new Error(`anchor ${anchorDark} is below ${QR_MIN_CONTRAST}:1 against the light family`);
  }
  const kept = candidates.filter((hex) => hex !== anchorDark && weakestContrast([hex], lights) >= QR_MIN_CONTRAST);
  return [anchorDark, ...new Set(kept)];
}

/** Kilim chevron band index for a module, shared by dark and light weaving. */
function chevron(row, col, period) {
  const zig = Math.abs((col % (period * 2)) - period);
  return Math.floor((row + zig) / 3);
}

function isFinder(r, c, size) {
  const inBox = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
  return inBox(0, 0) || inBox(0, size - 7) || inBox(size - 7, 0);
}

function isFinderCore(r, c, size) {
  const core = (r0, c0) => r >= r0 + 2 && r < r0 + 5 && c >= c0 + 2 && c < c0 + 5;
  return core(0, 0) || core(0, size - 7) || core(size - 7, 0);
}

/**
 * SVG for a QR woven at `module` px per cell, top-left of the quiet zone at
 * (x, y). `darks[0]` weaves the finder rings; `eye` colours their cores.
 */
export function wovenQr(text, { x, y, module, darks, lights, eye = darks[0], period = 6 }) {
  const weakest = weakestContrast([...darks, eye], lights);
  if (weakest < QR_MIN_CONTRAST) {
    throw new Error(`QR contrast ${weakest.toFixed(2)}:1 is below ${QR_MIN_CONTRAST}:1`);
  }
  const { size, isDark } = qrMatrix(text);
  const total = size + QR_QUIET_MODULES * 2;
  const span = total * module;
  const paths = new Map();
  const add = (color, px, py, w) => paths.set(color, (paths.get(color) ?? "") + `M${px} ${py}h${w}v${module}h${-w}z`);

  for (let gr = 0; gr < total; gr += 1) {
    let gc = 0;
    while (gc < total) {
      const colorAt = (cc) => {
        const r = gr - QR_QUIET_MODULES;
        const c = cc - QR_QUIET_MODULES;
        const inside = r >= 0 && r < size && c >= 0 && c < size;
        if (inside && isDark(r, c)) {
          if (isFinder(r, c, size)) return isFinderCore(r, c, size) ? eye : darks[0];
          return darks[chevron(r, c, period) % darks.length];
        }
        return lights[chevron(gr, cc, period) % lights.length];
      };
      const color = colorAt(gc);
      let run = 1;
      while (gc + run < total && colorAt(gc + run) === color) run += 1;
      add(color, x + gc * module, y + gr * module, run * module);
      gc += run;
    }
  }
  // A solid light base under the runs keeps anti-aliased run edges from
  // bleeding the dark weave beneath into light modules at fractional scales.
  const svg =
    `<g data-zone="qr" data-modules="${size}" shape-rendering="crispEdges">` +
    `<rect x="${x}" y="${y}" width="${span}" height="${span}" fill="${lights[0]}"/>` +
    [...paths].map(([color, d]) => `<path d="${d}" fill="${color}"/>`).join("") +
    `</g>`;
  return { svg, span, size };
}
