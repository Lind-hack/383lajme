/**
 * Kosova në xhep — the visitor's personal card, as a pure function.
 *
 *   cardArt(profile, { qrUrl, stamps, seed, lang }) → SVG string
 *
 * Same inputs always give byte-identical SVG (no Date, no Math.random), so a
 * card can be regenerated anywhere from the profile alone: on the device, on
 * a friend's phone after a scan, or on the server for a share image.
 *
 * The card is a woven Dukagjin kilim (chosen by Lind at Checkpoint A,
 * 2026-10-03). The whole card is the weave, on a 10 px cell grid:
 *   - a band of lozenges, one per city on the visitor's route
 *   - the QR as the rug's central medallion, one module per woven cell,
 *     woven in chevron bands of the visitor's dark colours on a light
 *     cloth (every pair kept at a scannable contrast), finders as kilim eyes
 *   - a sewn-on label with the trip
 * Interests pick the ground, accent and module colours; the seed varies the
 * border pattern and the frame teeth.
 */
import { QR_QUIET_MODULES, mixHex, normalizeQrUrl, scannableDarks, wovenQr } from "./qr-art.mjs";

/** Below this a phone camera struggles to resolve modules off another screen. */
const QR_MIN_MODULE_PX = 6;

const W = 600;
const H = 900;
const CELL = 10;
const COLS = W / CELL;
const ROWS = H / CELL;
const BORDER = 4;
const FIELD_TOP = 8; // rows 0-3 fringe, 4-7 border
const FIELD_BOTTOM = ROWS - 2 - BORDER; // first row of the bottom border
const QR_TOP_PX = 190;

export const DEFAULT_QR_URL = "https://383ks.com/visit";

/** Material colours from Kosovo itself, one per interest. */
export const INTEREST_MATERIALS = {
  nature: { name: "Rugova pine", hex: "#1F5140", light: "#6FA58C" },
  history: { name: "Prizren roof", hex: "#8E3B24", light: "#D9876A" },
  food: { name: "Speca red", hex: "#B8301C", light: "#EE7A5E" },
  coffee: { name: "Espresso", hex: "#55361F", light: "#B98A62" },
  nightlife: { name: "Prishtina night", hex: "#232A55", light: "#8D97D8" },
  skiing: { name: "Brezovica ice", hex: "#25617E", light: "#8CC3DB" },
};

/** Gold thread for places the visitor has actually stood at. */
const STAMP_GOLD = "#D2A949";

/** City of a stamp ("<placeId>.<issued>.<sig>"; place ids start with their city). */
function stampCity(stamp) {
  const city = /^([a-z]+)-/.exec(String(stamp))?.[1];
  return city && Object.hasOwn(CITY_NAMES, city) ? city : null;
}

export const BASE = {
  cream: "#F4EBDD",
  paper: "#FBF6EE",
  ink: "#17130E",
  kilimRed: "#9E2A1E",
  kilimBlack: "#1E1712",
};

export const CITY_NAMES = {
  prishtine: "Prishtinë",
  prizren: "Prizren",
  peje: "Pejë",
  gjakove: "Gjakovë",
  mitrovice: "Mitrovicë",
  gjilan: "Gjilan",
  ferizaj: "Ferizaj",
};

const CROSSINGS = ["kulle", "merdare", "hani-i-elezit", "vermice-morine"];

const TEXT = {
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    headline: (name) => (name ? `${name}${/s$/i.test(name) ? "’" : "’s"} Kosovo` : "My Kosovo"),
    days: (n) => `${n} ${n === 1 ? "day" : "days"}`,
    type: { first: "First time in Kosovo", diaspora: "Coming home", family: "Family trip" },
    interests: { nature: "Mountains", history: "History", food: "Food", coffee: "Coffee", nightlife: "Nights out", skiing: "Skiing" },
    stamps: (n) => `${n} ${n === 1 ? "stamp" : "stamps"}`,
  },
  sq: {
    months: ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"],
    headline: (name) => (name ? `Kosova · ${name}` : "Kosova ime"),
    days: (n) => `${n} ditë`,
    type: { first: "Herën e parë në Kosovë", diaspora: "Po kthehem në shtëpi", family: "Udhëtim familjar" },
    interests: { nature: "Male", history: "Histori", food: "Ushqim", coffee: "Kafe", nightlife: "Natë", skiing: "Ski" },
    stamps: (n) => `${n} vula`,
  },
};

/* ------------------------------------------------------------------ utils */

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/** Rough Manrope advance per character in em; capitals run wider. */
function emWidth(value, weight = 800) {
  const chars = [...String(value)];
  const caps = chars.filter((ch) => ch !== ch.toLowerCase()).length;
  const per = weight >= 700 ? 0.6 : 0.55;
  return chars.length * per + caps * 0.14;
}

/** Largest size in [min, base] that fits; may still overflow at `min` (see fitLine). */
function fitSize(value, maxWidth, base, min, weight = 800) {
  const fitted = maxWidth / Math.max(1, emWidth(value, weight));
  return Math.max(min, Math.min(base, Math.floor(fitted)));
}

/**
 * Joins segments into one line that fits `maxWidth` at `min` or larger,
 * dropping trailing segments and finally truncating the first with "…".
 */
function fitLine(segments, sep, maxWidth, base, min, weight = 800) {
  const parts = segments.filter(Boolean);
  while (parts.length > 1 && emWidth(parts.join(sep), weight) * min > maxWidth) parts.pop();
  let line = parts.join(sep);
  if (emWidth(line, weight) * min > maxWidth) {
    const chars = [...line];
    while (chars.length > 1 && emWidth(`${chars.join("")}…`, weight) * min > maxWidth) chars.pop();
    line = `${chars.join("").trimEnd()}…`;
  }
  return { line, size: fitSize(line, maxWidth, base, min, weight) };
}

function text(x, y, value, { size, weight = 700, fill, tracking = 0, opacity } = {}) {
  const attrs = [`x="${x}"`, `y="${y}"`, `font-family="Manrope, Arial, sans-serif"`, `font-size="${size}"`, `font-weight="${weight}"`, `fill="${fill}"`];
  if (tracking) attrs.push(`letter-spacing="${tracking}"`);
  if (opacity !== undefined) attrs.push(`opacity="${opacity}"`);
  return `<text ${attrs.join(" ")}>${esc(value)}</text>`;
}

/* --------------------------------------------------------------- profile */

const INTEREST_KEYS = Object.keys(INTEREST_MATERIALS);

/**
 * Defensive normalization: profiles come from localStorage and may predate
 * the schema, so every field is optional and clamped.
 */
export function normalizeCardProfile(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  // Cut by code point (never half an emoji), then drop characters XML cannot
  // carry: C0/C1 controls and any lone surrogate left in the source string.
  const name =
    typeof p.name === "string"
      ? [...p.name.replace(/\s+/g, " ").trim()]
          .filter((ch) => !/[\u0000-\u001F\u007F-\u009F]/.test(ch) && !/^[\uD800-\uDFFF]$/.test(ch))
          .slice(0, 18)
          .join("")
          .trim()
      : "";
  const interests = Array.isArray(p.interests)
    ? [...new Set(p.interests.filter((key) => INTEREST_KEYS.includes(key)))].slice(0, 4)
    : [];
  const cities = Array.isArray(p.cities)
    ? [...new Set(p.cities.filter((id) => typeof id === "string" && Object.hasOwn(CITY_NAMES, id)))].slice(0, 6)
    : [];
  const num = (value) => (typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN);
  const daysRaw = num(p.days);
  const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(1, Math.round(daysRaw))) : 5;
  const monthRaw = num(p.month);
  const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : null;
  return {
    name,
    travellerType: ["first", "diaspora", "family"].includes(p.travellerType) ? p.travellerType : "first",
    arrival: p.arrival === "drive" ? "drive" : "fly",
    crossing: CROSSINGS.includes(p.crossing) ? p.crossing : null,
    interests: interests.length ? interests : ["history"],
    cities: cities.length ? cities : ["prishtine"],
    days,
    month,
    budget: ["easy", "mid", "treat"].includes(p.budget) ? p.budget : "mid",
  };
}

/* ---------------------------------------------------------------- weave */

/** Colour of one border cell for the seed-chosen border pattern. */
function borderCell(kind, c, r, { dark, light, ground }) {
  if (kind === "zigzag") {
    const k = (c + r) % 6;
    return k < 2 ? dark : k < 3 ? light : ground;
  }
  if (kind === "lozenge") {
    const d = Math.abs((c % 6) - 2.5) + Math.abs((r % 6) - 2.5);
    return d <= 1.5 ? light : d <= 3 ? dark : ground;
  }
  const k = (Math.floor(c / 2) + Math.floor(r / 2)) % 3;
  return k === 0 ? dark : k === 1 ? ground : light;
}

/** The weave grid: border, ground, and a band of lozenges, one per city (gold once stamped there). */
function weaveGrid(profile, colors, rng, stampedCities = new Set()) {
  const { ground, dark, light, accent } = colors;
  const borderKind = ["lozenge", "hook", "zigzag"][Math.floor(rng() * 3)];
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(ground));
  const n = profile.cities.length;
  const fieldW = COLS - BORDER * 2;
  const slot = fieldW / n;
  const bandMid = FIELD_TOP + 5;
  const ry = 4;
  const rx = Math.min(slot / 2 - 1, 10);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (r < FIELD_TOP - BORDER || r >= ROWS - 2) {
        grid[r][c] = null; // fringe rows, drawn as threads
        continue;
      }
      const inBorder = c < BORDER || c >= COLS - BORDER || r < FIELD_TOP || r >= FIELD_BOTTOM;
      if (inBorder) {
        grid[r][c] = borderCell(borderKind, c, r, colors);
        if ((c === BORDER - 1 || c === COLS - BORDER) && r >= FIELD_TOP && r < FIELD_BOTTOM) grid[r][c] = light;
        continue;
      }
      const dy = Math.abs(r + 0.5 - bandMid);
      if (dy > ry + 0.5) continue;
      const li = Math.min(n - 1, Math.floor((c - BORDER) / slot));
      const cx = BORDER + (li + 0.5) * slot;
      const d = Math.abs(c + 0.5 - cx) / rx + dy / ry;
      if (d <= 1) {
        const ring = Math.floor((1 - d) * 4);
        const rings = stampedCities.has(profile.cities[li]) ? [dark, STAMP_GOLD, accent, STAMP_GOLD, STAMP_GOLD] : [dark, light, accent, light, dark];
        grid[r][c] = rings[ring % 5];
      }
    }
  }
  return grid;
}

function gridToPaths(grid) {
  const byColor = new Map();
  for (let r = 0; r < ROWS; r += 1) {
    let c = 0;
    while (c < COLS) {
      const color = grid[r][c];
      let run = 1;
      while (c + run < COLS && grid[r][c + run] === color) run += 1;
      if (color) byColor.set(color, (byColor.get(color) ?? "") + `M${c * CELL} ${r * CELL}h${run * CELL}v${CELL}h${-run * CELL}z`);
      c += run;
    }
  }
  return [...byColor].map(([color, d]) => `<path d="${d}" fill="${color}"/>`).join("");
}

/** A stepped kilim frame around the QR medallion: a dark ring, then light teeth. */
function medallionFrame(x, y, span, { dark, light }, rng) {
  const ring = `<rect x="${x - CELL / 2}" y="${y - CELL / 2}" width="${span + CELL}" height="${span + CELL}" fill="none" stroke="${dark}" stroke-width="${CELL}"/>`;
  const every = 2 + Math.floor(rng() * 2);
  const outer = span + CELL * 4;
  const ox = x - CELL * 2;
  const oy = y - CELL * 2;
  const count = Math.round(outer / CELL);
  let teeth = "";
  for (let i = 0; i < count; i += every) {
    const t = i * CELL;
    teeth += `M${ox + t} ${oy}h${CELL}v${CELL}h${-CELL}z`;
    teeth += `M${ox + t} ${oy + outer - CELL}h${CELL}v${CELL}h${-CELL}z`;
    teeth += `M${ox} ${oy + t}h${CELL}v${CELL}h${-CELL}z`;
    teeth += `M${ox + outer - CELL} ${oy + t}h${CELL}v${CELL}h${-CELL}z`;
  }
  return ring + `<path d="${teeth}" fill="${light}"/>`;
}

/* ---------------------------------------------------------------- api */

/**
 * @param {object} rawProfile  quiz answers (any shape; normalized defensively)
 * @param {{ qrUrl?: string, stamps?: string[], seed?: string, lang?: "en"|"sq" }} options
 * @returns {string} a standalone SVG document string, 600×900
 */
export function cardArt(rawProfile, options = {}) {
  const profile = normalizeCardProfile(rawProfile);
  const lang = options.lang === "sq" ? "sq" : "en";
  const t = TEXT[lang];
  const qrUrl = normalizeQrUrl(typeof options.qrUrl === "string" && options.qrUrl ? options.qrUrl : DEFAULT_QR_URL);
  const stamps = Array.isArray(options.stamps) ? [...new Set(options.stamps.filter((id) => typeof id === "string"))] : [];
  const seed = typeof options.seed === "string" || typeof options.seed === "number" ? String(options.seed) : "";
  const rng = mulberry32(fnv1a(`qilim|${seed}|${JSON.stringify(profile)}|${JSON.stringify(stamps)}`));

  const primary = INTEREST_MATERIALS[profile.interests[0]];
  const secondary = INTEREST_MATERIALS[profile.interests[1] ?? profile.interests[0]];
  const ground = profile.interests.includes("food") || profile.interests.includes("history") ? BASE.kilimRed : primary.hex;
  const colors = { ground, dark: BASE.kilimBlack, light: BASE.cream, accent: secondary.light };

  let s = `<rect width="${W}" height="${H}" fill="${BASE.paper}"/>`;
  const stampedCities = new Set(stamps.map(stampCity).filter(Boolean));
  s += gridToPaths(weaveGrid(profile, colors, rng, stampedCities));

  // Weft texture over the weave.
  let weft = "";
  for (let r = FIELD_TOP - BORDER; r < ROWS - 2; r += 1) weft += `M0 ${r * CELL + 5}H${W}`;
  s += `<path d="${weft}" stroke="#000" stroke-width="1" opacity="0.06"/>`;

  // Fringe threads.
  let fringe = "";
  for (let c = 1; c < COLS; c += 1) {
    const x = c * CELL;
    const top = (FIELD_TOP - BORDER) * CELL;
    const bottom = (ROWS - 2) * CELL;
    fringe += `M${x} ${top}V${top - (26 + (c % 3) * 4)}M${x} ${bottom}V${bottom + 14}`;
  }
  s += `<path d="${fringe}" stroke="${BASE.cream}" stroke-width="2.4" stroke-linecap="round"/>`;
  s += `<path d="${fringe}" stroke="${BASE.kilimBlack}" stroke-width="2.4" stroke-linecap="round" opacity="0.18"/>`;

  // The woven QR medallion: one module per cell while it fits the field.
  // Light cloth: cream plus a pale tint of the accent. Dark threads: kilim
  // black, the visitor's interest colours and a deepened ground — each kept
  // only if it clears the scan contrast against every light thread.
  const lights = [BASE.cream, mixHex(BASE.cream, secondary.light, 0.22)];
  const darks = scannableDarks(
    [...profile.interests.map((key) => INTEREST_MATERIALS[key].hex), mixHex(ground, BASE.kilimBlack, 0.35)],
    lights,
    BASE.kilimBlack,
  );
  const eye = darks[1] ?? BASE.kilimBlack;
  const qrStyle = { darks, lights, eye, period: 5 + Math.floor(rng() * 3) };
  const probe = wovenQr(qrUrl, { x: 0, y: 0, module: CELL, ...qrStyle });
  const fieldPx = (COLS - BORDER * 2) * CELL;
  const maxSpan = fieldPx - CELL * 6; // leave room for the frame
  const module = probe.span <= maxSpan ? CELL : Math.floor(maxSpan / (probe.size + QR_QUIET_MODULES * 2));
  if (module < QR_MIN_MODULE_PX) {
    throw new Error(`QR needs ${probe.size} modules; at ${module}px each it would not scan off a phone screen`);
  }
  const span = (probe.size + QR_QUIET_MODULES * 2) * module;
  // Snap to the weave grid so modules sit on whole cells, never on a half pixel.
  const qx = BORDER * CELL + Math.round((fieldPx - span) / 2 / CELL) * CELL;
  const qr = wovenQr(qrUrl, { x: qx, y: QR_TOP_PX, module, ...qrStyle });
  s += medallionFrame(qx, QR_TOP_PX, span, colors, rng);
  s += qr.svg;

  // The sewn-on label.
  const lx = BORDER * CELL + 16;
  const ly = QR_TOP_PX + span + CELL * 2 + 14;
  const lw = W - lx * 2;
  const lh = FIELD_BOTTOM * CELL - 12 - ly;
  const when = [t.days(profile.days), profile.month ? t.months[profile.month - 1] : null].filter(Boolean).join(" · ");
  const headline = t.headline(profile.name);
  const line3 = `${t.type[profile.travellerType]} · ${when}`;
  const line4Parts = [
    profile.cities.map((id) => CITY_NAMES[id]).join(" → "),
    profile.interests.map((key) => t.interests[key]).join(" · "),
    stamps.length ? t.stamps(stamps.length) : null,
  ];
  const tw = lw - 52;
  const tx = lx + 26;
  s += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="6" fill="${BASE.paper}"/>`;
  s += `<rect x="${lx + 7}" y="${ly + 7}" width="${lw - 14}" height="${lh - 14}" rx="3" fill="none" stroke="${ground}" stroke-width="2" stroke-dasharray="7 6"/>`;
  s += text(tx, ly + 34, "383 · KOSOVA NË XHEP", { size: 11, weight: 800, fill: ground, tracking: 2.2 });
  // One small woven star per stamp, top right of the label (up to 12 shown).
  const shown = stamps.filter((st) => stampCity(st)).slice(0, 12);
  shown.forEach((_, i) => {
    const cx = lx + lw - 30 - (i % 6) * 18;
    const cy = ly + 26 + Math.floor(i / 6) * 18;
    s += `<path d="M${cx - 2} ${cy - 7}h4v5h5v4h-5v5h-4v-5h-5v-4h5z" fill="${STAMP_GOLD}" stroke="${BASE.kilimBlack}" stroke-width="0.8"/>`;
  });
  s += text(tx, ly + 74, headline, { size: fitSize(headline, tw, 36, 22), weight: 800, fill: BASE.ink, tracking: -1 });
  s += text(tx, ly + 102, line3, { size: fitSize(line3, tw, 16, 11, 700), weight: 700, fill: BASE.ink, opacity: 0.78 });
  if (lh >= 180) {
    // Room for the route and the interests on lines of their own, anchored to the label's foot.
    const route = fitLine([line4Parts[0]], "", tw, 17, 10, 800);
    const rest = fitLine([line4Parts[1], line4Parts[2]], "  ·  ", tw, 14, 10, 700);
    s += text(tx, ly + lh - 52, route.line, { size: route.size, weight: 800, fill: ground });
    s += text(tx, ly + lh - 26, rest.line, { size: rest.size, weight: 700, fill: BASE.ink, opacity: 0.7 });
  } else {
    const line4 = fitLine(line4Parts, "  ·  ", tw, 14, 9, 800);
    s += text(tx, ly + 126, line4.line, { size: line4.size, weight: 800, fill: ground });
  }

  const title = `${headline} — Kosova në xhep`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${s}</svg>`;
}
