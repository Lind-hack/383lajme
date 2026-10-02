/**
 * Kosova në xhep — the visitor's personal card, as a pure function.
 *
 *   cardArt(profile, { structure, stamps, seed, lang }) → SVG string
 *
 * Same inputs always give byte-identical SVG (no Date, no Math.random), so a
 * card can be regenerated anywhere from the profile alone: on the device, on
 * a friend's phone after a scan, or on the server for a share image.
 *
 * Three structures, each a real Kosovo object rather than a template:
 *   - "ticket":   a regional bus/rail ticket — colour block, route diagram, tear-off stub
 *   - "filigree": a Prizren filigree medallion in wire and beads on a dark ground
 *   - "qilim":    a woven Dukagjin kilim, the whole card a weave with a sewn-on label
 *
 * The visitor's answers drive everything visible: interests pick the material
 * colours and motifs, cities draw the route or the lozenges, trip length sets
 * the petals or the rows, and the seed varies the rest. The QR zone is a
 * clearly marked placeholder until the woven QR lands (Task 3).
 */

const W = 600;
const H = 900;

/** Material colours from Kosovo itself, one per interest. */
export const INTEREST_MATERIALS = {
  nature: { name: "Rugova pine", hex: "#1F5140", light: "#6FA58C" },
  history: { name: "Prizren roof", hex: "#8E3B24", light: "#D9876A" },
  food: { name: "Speca red", hex: "#B8301C", light: "#EE7A5E" },
  coffee: { name: "Espresso", hex: "#55361F", light: "#B98A62" },
  nightlife: { name: "Prishtina night", hex: "#232A55", light: "#8D97D8" },
  skiing: { name: "Brezovica ice", hex: "#25617E", light: "#8CC3DB" },
};

const BASE = {
  cream: "#F4EBDD",
  paper: "#FBF6EE",
  ink: "#17130E",
  orange: "#FF4422",
  silver: "#D8DCE0",
  silverDim: "#8E959C",
  gold: "#D2A949",
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

const CITY_CODES = {
  prishtine: "PRN",
  prizren: "PRZ",
  peje: "PEJ",
  gjakove: "GJK",
  mitrovice: "MIT",
  gjilan: "GJL",
  ferizaj: "FRZ",
};

const CROSSING_NAMES = {
  kulle: "Kullë",
  merdare: "Merdarë",
  "hani-i-elezit": "Hani i Elezit",
  "vermice-morine": "Vërmicë",
};

const TEXT = {
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    headline: (name) => (name ? `${name}${/s$/i.test(name) ? "’" : "’s"} Kosovo` : "My Kosovo"),
    days: (n) => `${n} ${n === 1 ? "day" : "days"}`,
    type: { first: "First time in Kosovo", diaspora: "Coming home", family: "Family trip" },
    interests: { nature: "Mountains", history: "History", food: "Food", coffee: "Coffee", nightlife: "Nights out", skiing: "Skiing" },
    fly: "Flying into Prishtina",
    drive: (crossing) => (crossing ? `Driving in via ${crossing}` : "Driving in"),
    budget: { easy: "Easy", mid: "Comfort", treat: "Treat" },
    class: "Class",
    route: "Route",
    passenger: "Traveller",
    when: "When",
    scan: "Scan to join",
    placeholder: "QR · Task 3",
    stamps: (n) => `${n} ${n === 1 ? "stamp" : "stamps"}`,
  },
  sq: {
    months: ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"],
    headline: (name) => (name ? `Kosova · ${name}` : "Kosova ime"),
    days: (n) => `${n} ${n === 1 ? "ditë" : "ditë"}`,
    type: { first: "Herën e parë në Kosovë", diaspora: "Po kthehem në shtëpi", family: "Udhëtim familjar" },
    interests: { nature: "Male", history: "Histori", food: "Ushqim", coffee: "Kafe", nightlife: "Natë", skiing: "Ski" },
    fly: "Me aeroplan në Prishtinë",
    drive: (crossing) => (crossing ? `Me makinë përmes ${crossing}` : "Me makinë"),
    budget: { easy: "Thjesht", mid: "Komoditet", treat: "Luks" },
    class: "Klasa",
    route: "Rruga",
    passenger: "Udhëtari",
    when: "Kur",
    scan: "Skano për t'u bashkuar",
    placeholder: "QR · Detyra 3",
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

const r2 = (n) => Math.round(n * 100) / 100;

/** Rough Manrope advance width, enough to keep text inside its box. */
function fitSize(text, maxWidth, base, min, weight = 800) {
  const per = weight >= 700 ? 0.6 : 0.55;
  const fitted = maxWidth / Math.max(1, String(text).length * per);
  return Math.max(min, Math.min(base, Math.floor(fitted)));
}

function text(x, y, value, { size, weight = 700, fill, anchor = "start", tracking = 0, family = "Manrope, Arial, sans-serif", opacity } = {}) {
  const attrs = [
    `x="${r2(x)}"`,
    `y="${r2(y)}"`,
    `font-family="${family}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
  ];
  if (anchor !== "start") attrs.push(`text-anchor="${anchor}"`);
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
  const name = typeof p.name === "string" ? p.name.trim().replace(/\s+/g, " ").slice(0, 18) : "";
  const interests = Array.isArray(p.interests)
    ? [...new Set(p.interests.filter((key) => INTEREST_KEYS.includes(key)))].slice(0, 4)
    : [];
  const cities = Array.isArray(p.cities) ? [...new Set(p.cities.filter((id) => id in CITY_NAMES))].slice(0, 6) : [];
  const days = Number.isFinite(Number(p.days)) ? Math.min(30, Math.max(1, Math.round(Number(p.days)))) : 5;
  const month = Number.isInteger(Number(p.month)) && Number(p.month) >= 1 && Number(p.month) <= 12 ? Number(p.month) : null;
  return {
    name,
    travellerType: ["first", "diaspora", "family"].includes(p.travellerType) ? p.travellerType : "first",
    arrival: p.arrival === "drive" ? "drive" : "fly",
    crossing: p.crossing in CROSSING_NAMES ? p.crossing : null,
    interests: interests.length ? interests : ["history"],
    cities: cities.length ? cities : ["prishtine"],
    days,
    month,
    budget: ["easy", "mid", "treat"].includes(p.budget) ? p.budget : "mid",
  };
}

function cardFacts(profile, lang) {
  const t = TEXT[lang] ?? TEXT.en;
  const primary = INTEREST_MATERIALS[profile.interests[0]];
  const secondary = INTEREST_MATERIALS[profile.interests[1] ?? profile.interests[0]];
  return {
    t,
    primary,
    secondary,
    headline: t.headline(profile.name),
    when: [t.days(profile.days), profile.month ? t.months[profile.month - 1] : null].filter(Boolean).join(" · "),
    type: t.type[profile.travellerType],
    interestLine: profile.interests.map((key) => t.interests[key]).join(" · "),
    arrival: profile.arrival === "fly" ? t.fly : t.drive(profile.crossing ? CROSSING_NAMES[profile.crossing] : null),
    cityNames: profile.cities.map((id) => CITY_NAMES[id]),
  };
}

/* ------------------------------------------------------- QR placeholder */

/**
 * A stand-in matrix with real finder patterns so the composition can be
 * judged at true size. Not scannable; Task 3 replaces it with a real encoder.
 */
function qrPlaceholder(x, y, size, rng, { style, fg, bg }) {
  const n = 25;
  const m = size / n;
  const finder = (cx, cy) => cx >= 0 && cx < 7 && cy >= 0 && cy < 7;
  const isFinderCell = (c, r) => finder(c, r) || finder(c - (n - 7), r) || finder(c, r - (n - 7));
  const finderOn = (c, r) => {
    const lc = c >= n - 7 ? c - (n - 7) : c;
    const lr = r >= n - 7 ? r - (n - 7) : r;
    const edge = lc === 0 || lc === 6 || lr === 0 || lr === 6;
    const core = lc >= 2 && lc <= 4 && lr >= 2 && lr <= 4;
    return edge || core;
  };
  let body = "";
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const on = isFinderCell(c, r) ? finderOn(c, r) : rng() > 0.52;
      if (!on) continue;
      const px = x + c * m;
      const py = y + r * m;
      if (style === "bead" && !isFinderCell(c, r)) {
        body += `<circle cx="${r2(px + m / 2)}" cy="${r2(py + m / 2)}" r="${r2(m * 0.42)}"/>`;
      } else if (style === "stitch" && !isFinderCell(c, r)) {
        body += `<path d="M${r2(px + m * 0.15)} ${r2(py + m * 0.15)}L${r2(px + m * 0.85)} ${r2(py + m * 0.85)}M${r2(px + m * 0.85)} ${r2(py + m * 0.15)}L${r2(px + m * 0.15)} ${r2(py + m * 0.85)}" stroke="${fg}" stroke-width="${r2(m * 0.28)}" stroke-linecap="round" fill="none"/>`;
      } else {
        body += `<rect x="${r2(px)}" y="${r2(py)}" width="${r2(m + 0.3)}" height="${r2(m + 0.3)}"/>`;
      }
    }
  }
  const pad = m * 2;
  return `<g data-zone="qr-placeholder"><rect x="${r2(x - pad)}" y="${r2(y - pad)}" width="${r2(size + pad * 2)}" height="${r2(size + pad * 2)}" rx="${r2(m * 1.5)}" fill="${bg}"/><g fill="${fg}">${body}</g></g>`;
}

/* ------------------------------------------------------------- motifs */

/** A one-row kilim strip (lozenge, hook, star, zigzag) used as a border band. */
function motifStrip(x, y, width, cell, colors, rng, kind) {
  const cols = Math.floor(width / cell);
  const rows = 7;
  const unit = 8 + Math.floor(rng() * 3) * 2;
  let out = "";
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u = c % unit;
      const mid = unit / 2;
      const d = Math.abs(u - mid) + Math.abs(r - 3);
      let fill = null;
      if (kind === "zigzag") {
        if ((c + r * 2) % unit < 2 || (c - r * 2 + unit * 4) % unit < 2) fill = colors[0];
      } else if (kind === "hook") {
        if (d === 3 || (d === 1 && r === 3)) fill = colors[0];
        else if (d === 0) fill = colors[1];
      } else {
        if (d === 3) fill = colors[0];
        else if (d <= 1) fill = colors[1];
      }
      if (fill) out += `<rect x="${r2(x + c * cell)}" y="${r2(y + r * cell)}" width="${cell}" height="${cell}" fill="${fill}"/>`;
    }
  }
  return out;
}

/* ------------------------------------------------------------- ticket */

function ticketCard(profile, facts, rng, stamps, uid) {
  const { t, primary, secondary } = facts;
  const headerH = 360;
  const tearY = 640;
  const ticketNo = `Nº ${String(Math.floor(rng() * 9000) + 1000)}-${CITY_CODES[profile.cities[0]]}`;
  const stripeAngle = [-24, -12, 12, 24][Math.floor(rng() * 4)];
  const stripeGap = 18 + Math.floor(rng() * 4) * 6;

  let s = `<defs><clipPath id="tk-clip-${uid}"><path d="M24 0H${W - 24}A24 24 0 0 1 ${W} 24V${tearY - 16}A16 16 0 0 0 ${W} ${tearY + 16}V${H - 24}A24 24 0 0 1 ${W - 24} ${H}H24A24 24 0 0 1 0 ${H - 24}V${tearY + 16}A16 16 0 0 0 0 ${tearY - 16}V24A24 24 0 0 1 24 0Z"/></clipPath>`;
  s += `<pattern id="tk-stripes-${uid}" width="${stripeGap}" height="${stripeGap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${stripeAngle})"><rect width="${stripeGap / 2}" height="${stripeGap}" fill="${secondary.hex}" opacity="0.28"/></pattern></defs>`;
  s += `<g clip-path="url(#tk-clip-${uid})">`;
  s += `<rect width="${W}" height="${H}" fill="${BASE.paper}"/>`;
  s += `<rect width="${W}" height="${headerH}" fill="${primary.hex}"/>`;
  s += `<rect width="${W}" height="${headerH}" fill="url(#tk-stripes-${uid})"/>`;
  // Brand block.
  s += `<rect x="36" y="36" width="92" height="44" rx="6" fill="${BASE.paper}"/>`;
  s += text(82, 68, "383", { size: 28, weight: 800, fill: BASE.ink, anchor: "middle", tracking: -1 });
  s += text(144, 54, "KOSOVA NË XHEP", { size: 12, weight: 800, fill: BASE.paper, tracking: 2.4 });
  s += text(144, 74, ticketNo, { size: 12, weight: 700, fill: BASE.paper, tracking: 1.2, opacity: 0.8 });
  s += text(W - 36, 68, facts.when.toUpperCase(), { size: 12, weight: 800, fill: BASE.paper, anchor: "end", tracking: 1.6 });
  // Headline.
  const hSize = fitSize(facts.headline, W - 72, 64, 34);
  s += text(36, 210, facts.headline, { size: hSize, weight: 800, fill: BASE.paper, tracking: -1.5 });
  s += text(36, 254, facts.type, { size: 20, weight: 700, fill: BASE.paper, opacity: 0.9 });
  s += text(36, 318, facts.interestLine.toUpperCase(), { size: 13, weight: 800, fill: BASE.paper, tracking: 2.2 });

  // Route diagram: a line through the visitor's cities.
  const cities = profile.cities;
  const left = 64;
  const right = W - 64;
  const lineY = 470;
  const step = cities.length > 1 ? (right - left) / (cities.length - 1) : 0;
  s += text(36, 410, t.route.toUpperCase(), { size: 11, weight: 800, fill: BASE.ink, tracking: 2, opacity: 0.55 });
  // One city still gets a line: arrival runs in from the left edge to it.
  const lineStart = cities.length > 1 ? left : 36;
  const lineEnd = cities.length > 1 ? right : W / 2;
  if (profile.arrival === "fly") {
    s += `<path d="M${lineStart} ${lineY}H${lineEnd}" stroke="${BASE.ink}" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M${lineStart} ${lineY}H${lineEnd}" stroke="${BASE.ink}" stroke-width="6" stroke-linecap="round"/>`;
  }
  cities.forEach((id, i) => {
    const cx = cities.length > 1 ? left + i * step : W / 2;
    const isEnd = i === 0 || i === cities.length - 1;
    s += `<circle cx="${r2(cx)}" cy="${lineY}" r="${isEnd ? 13 : 9}" fill="${isEnd ? BASE.orange : BASE.paper}" stroke="${BASE.ink}" stroke-width="3"/>`;
    const label = cities.length > 4 ? CITY_CODES[id] : CITY_NAMES[id];
    const above = i % 2 === 1 && cities.length > 3;
    s += text(cx, above ? lineY - 26 : lineY + 40, label, {
      size: cities.length > 4 ? 15 : 17,
      weight: 800,
      fill: BASE.ink,
      anchor: cities.length === 1 ? "middle" : i === 0 ? "start" : i === cities.length - 1 ? "end" : "middle",
    });
  });
  s += text(36, 584, facts.arrival, { size: 16, weight: 700, fill: BASE.ink, opacity: 0.75 });

  // Tear line.
  s += `<path d="M24 ${tearY}H${W - 24}" stroke="${BASE.ink}" stroke-width="2" stroke-dasharray="6 7" opacity="0.35"/>`;

  // Stub: QR + fields.
  s += qrPlaceholder(48, tearY + 46, 150, rng, { style: "square", fg: BASE.ink, bg: BASE.paper });
  const fx = 240;
  const field = (y, label, value) =>
    text(fx, y, label.toUpperCase(), { size: 10, weight: 800, fill: BASE.ink, tracking: 1.8, opacity: 0.5 }) +
    text(fx, y + 24, value, { size: fitSize(value, W - fx - 40, 19, 13), weight: 800, fill: BASE.ink });
  s += field(tearY + 56, t.passenger, profile.name || facts.type);
  s += field(tearY + 114, t.when, facts.when);
  s += field(tearY + 172, t.class, `${t.budget[profile.budget]}${stamps.length ? ` · ${t.stamps(stamps.length)}` : ""}`);
  // Kilim band along the stub foot — the card's own pattern.
  s += `<rect x="0" y="${H - 44}" width="${W}" height="44" fill="${primary.hex}"/>`;
  s += motifStrip(0, H - 37, W, 4.3, [BASE.paper, secondary.light], rng, ["lozenge", "hook", "zigzag"][Math.floor(rng() * 3)]);
  s += `</g>`;
  return s;
}

/* ----------------------------------------------------------- filigree */

function filigreeCard(profile, facts, rng, stamps, uid) {
  const { t, primary, secondary } = facts;
  const cx = W / 2;
  const cy = 372;
  const petals = Math.min(14, Math.max(5, profile.days + 3));
  const rings = profile.cities.length;
  const turn = rng() * Math.PI;
  const wire = BASE.silver;
  const accent = profile.travellerType === "diaspora" ? BASE.gold : primary.light;

  let s = `<defs><radialGradient id="fg-ground-${uid}" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${primary.hex}"/><stop offset="1" stop-color="${BASE.ink}"/></radialGradient></defs>`;
  s += `<rect width="${W}" height="${H}" rx="24" fill="url(#fg-ground-${uid})"/>`;
  s += `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="16" fill="none" stroke="${wire}" stroke-width="1.2" opacity="0.4"/>`;

  // Concentric bead rings: one per city.
  const maxR = 200;
  for (let i = 0; i < rings; i += 1) {
    const rr = 54 + ((maxR - 54) * (i + 1)) / (rings + 0.6);
    const beads = Math.round((2 * Math.PI * rr) / 13);
    s += `<circle cx="${cx}" cy="${cy}" r="${r2(rr)}" fill="none" stroke="${wire}" stroke-width="1.4" opacity="0.75"/>`;
    let dots = "";
    for (let b = 0; b < beads; b += 1) {
      const a = (b / beads) * Math.PI * 2 + turn * (i + 1);
      dots += `<circle cx="${r2(cx + Math.cos(a) * (rr + 6))}" cy="${r2(cy + Math.sin(a) * (rr + 6))}" r="${i === rings - 1 ? 2.6 : 1.8}"/>`;
    }
    s += `<g fill="${wire}">${dots}</g>`;
  }

  // Petals: one per trip day (plus three), each a wire teardrop with an inner curl.
  const petalLen = 168 + rng() * 22;
  for (let p = 0; p < petals; p += 1) {
    const a = turn + (p / petals) * Math.PI * 2;
    const spread = (Math.PI / petals) * 0.78;
    const tip = [cx + Math.cos(a) * petalLen, cy + Math.sin(a) * petalLen];
    const c1 = [cx + Math.cos(a - spread) * petalLen * 0.72, cy + Math.sin(a - spread) * petalLen * 0.72];
    const c2 = [cx + Math.cos(a + spread) * petalLen * 0.72, cy + Math.sin(a + spread) * petalLen * 0.72];
    const base = [cx + Math.cos(a) * 34, cy + Math.sin(a) * 34];
    s += `<path d="M${r2(base[0])} ${r2(base[1])}Q${r2(c1[0])} ${r2(c1[1])} ${r2(tip[0])} ${r2(tip[1])}Q${r2(c2[0])} ${r2(c2[1])} ${r2(base[0])} ${r2(base[1])}Z" fill="none" stroke="${wire}" stroke-width="2.2" stroke-linejoin="round"/>`;
    // Inner spiral curl — the filigree signature.
    const curlR = 15 + rng() * 6;
    const mid = [cx + Math.cos(a) * petalLen * 0.6, cy + Math.sin(a) * petalLen * 0.6];
    let curl = `M${r2(mid[0])} ${r2(mid[1])}`;
    for (let k = 1; k <= 22; k += 1) {
      const ang = a + k * 0.55;
      const rad = curlR * (1 - k / 24);
      curl += `L${r2(mid[0] + Math.cos(ang) * rad)} ${r2(mid[1] + Math.sin(ang) * rad)}`;
    }
    s += `<path d="${curl}" fill="none" stroke="${wire}" stroke-width="1.3" stroke-linecap="round"/>`;
    s += `<circle cx="${r2(tip[0])}" cy="${r2(tip[1])}" r="4.2" fill="${accent}"/>`;
  }
  // Interest lobes: small granulated clusters between petals.
  profile.interests.forEach((key, i) => {
    const a = turn + ((i + 0.5) / profile.interests.length) * Math.PI * 2;
    const rr = maxR + 20;
    const color = INTEREST_MATERIALS[key].light;
    for (let g = 0; g < 7; g += 1) {
      const ga = a + (g - 3) * 0.035;
      s += `<circle cx="${r2(cx + Math.cos(ga) * rr)}" cy="${r2(cy + Math.sin(ga) * rr)}" r="3.4" fill="${color}"/>`;
    }
  });
  // Centre boss.
  s += `<circle cx="${cx}" cy="${cy}" r="30" fill="${BASE.ink}" stroke="${wire}" stroke-width="2.4"/>`;
  s += text(cx, cy + 9, "383", { size: 24, weight: 800, fill: wire, anchor: "middle", tracking: -0.5 });

  // Type.
  const hSize = fitSize(facts.headline, W - 96, 50, 30);
  s += text(cx, 660, facts.headline, { size: hSize, weight: 800, fill: BASE.paper, anchor: "middle", tracking: -1 });
  s += text(cx, 698, `${facts.type} · ${facts.when}`, { size: 17, weight: 700, fill: BASE.paper, anchor: "middle", opacity: 0.82 });
  s += text(cx, 728, facts.cityNames.join("  ·  "), { size: fitSize(facts.cityNames.join("  ·  "), W - 96, 15, 11), weight: 800, fill: secondary.light, anchor: "middle", tracking: 1.4 });
  s += `<path d="M60 760H${W - 60}" stroke="${wire}" stroke-width="1" opacity="0.35"/>`;
  s += text(60, 806, "KOSOVA NË XHEP", { size: 12, weight: 800, fill: wire, tracking: 2.6 });
  s += text(60, 832, facts.interestLine, { size: 15, weight: 700, fill: BASE.paper, opacity: 0.85 });
  if (stamps.length) s += text(60, 856, t.stamps(stamps.length), { size: 13, weight: 800, fill: accent });
  s += qrPlaceholder(W - 60 - 98, 778, 98, rng, { style: "bead", fg: wire, bg: "rgba(0,0,0,0.0)" });
  return s;
}

/* -------------------------------------------------------------- qilim */

function qilimCard(profile, facts, rng, stamps) {
  const { t, primary, secondary } = facts;
  const cell = 10;
  const cols = W / cell;
  const rows = H / cell;
  const ground = profile.interests.includes("food") || profile.interests.includes("history") ? BASE.kilimRed : primary.hex;
  const dark = BASE.kilimBlack;
  const light = BASE.cream;
  const accent = secondary.light;
  const border = 4;
  const fieldTop = 4;
  const labelTop = 60;
  const lozenges = Math.min(4, Math.max(1, profile.cities.length));
  const fieldRows = labelTop - fieldTop - border * 2 - 1;
  const lozH = fieldRows / lozenges;
  const hookEvery = 2 + Math.floor(rng() * 2);
  const motifKind = ["lozenge", "hook", "zigzag"][Math.floor(rng() * 3)];

  const grid = Array.from({ length: rows }, () => Array(cols).fill(ground));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const inBorder = c < border || c >= cols - border || r < fieldTop + border || r >= rows - border - 2;
      if (r < fieldTop || r >= rows - 2) {
        grid[r][c] = null; // fringe rows, drawn as threads
        continue;
      }
      if (inBorder) {
        if (motifKind === "zigzag") {
          const k = (c + r) % 6;
          grid[r][c] = k < 2 ? dark : k < 3 ? light : ground;
        } else if (motifKind === "lozenge") {
          const d = Math.abs((c % 6) - 2.5) + Math.abs((r % 6) - 2.5);
          grid[r][c] = d <= 1.5 ? light : d <= 3 ? dark : ground;
        } else {
          const k = (Math.floor(c / 2) + Math.floor(r / 2)) % 3;
          grid[r][c] = k === 0 ? dark : k === 1 ? ground : light;
        }
        if ((c === border - 1 || c === cols - border) && r >= fieldTop + border) grid[r][c] = light;
        continue;
      }
      if (r >= labelTop) continue;
      // Stacked lozenges, one per city.
      const fr = r - (fieldTop + border);
      const li = Math.min(lozenges - 1, Math.floor(fr / lozH));
      const lcy = (li + 0.5) * lozH;
      const dy = Math.abs(fr + 0.5 - lcy);
      const dx = Math.abs(c + 0.5 - cols / 2);
      const radius = Math.min(lozH / 2 - 1, cols / 2 - border - 2);
      const d = dx * (lozH / 2 / (cols / 2 - border)) * 1.0 + dy;
      const ring = Math.floor((radius - d) / 1.6);
      if (d <= radius) {
        const palette = [dark, light, ground, accent, light, dark];
        grid[r][c] = palette[(ring + li) % palette.length];
        if (ring === 0 && Math.round(dx) % hookEvery === 0) grid[r][c] = light;
      } else {
        // Field: scattered eight-point stars in the corners between lozenges.
        const sx = c % 12;
        const sy = Math.floor(fr % lozH);
        const starOn = (sx === 6 && (sy === 2 || sy === 4)) || (sy === 3 && (sx === 5 || sx === 7)) || (sx === 6 && sy === 3);
        if (starOn && (c < cols / 2 - radius * 0.6 || c > cols / 2 + radius * 0.6)) grid[r][c] = li % 2 ? accent : light;
      }
    }
  }

  // Merge cells into one path per colour.
  const byColor = new Map();
  for (let r = 0; r < rows; r += 1) {
    let c = 0;
    while (c < cols) {
      const color = grid[r][c];
      let run = 1;
      while (c + run < cols && grid[r][c + run] === color) run += 1;
      if (color) byColor.set(color, (byColor.get(color) ?? "") + `M${c * cell} ${r * cell}h${run * cell}v${cell}h${-run * cell}z`);
      c += run;
    }
  }
  let s = `<rect width="${W}" height="${H}" fill="${BASE.paper}"/>`;
  for (const [color, d] of byColor) s += `<path d="${d}" fill="${color}"/>`;
  // Weft texture: faint horizontal threads.
  let weft = "";
  for (let r = fieldTop; r < rows - 2; r += 1) weft += `M0 ${r * cell + 5}H${W}`;
  s += `<path d="${weft}" stroke="#000" stroke-width="1" opacity="0.06"/>`;
  // Fringe threads top and bottom.
  let fringe = "";
  for (let c = 1; c < cols; c += 1) {
    const x = c * cell;
    const len = 26 + (c % 3) * 4;
    fringe += `M${x} ${fieldTop * cell}V${fieldTop * cell - len}M${x} ${(rows - 2) * cell}V${(rows - 2) * cell + 14}`;
  }
  s += `<path d="${fringe}" stroke="${BASE.cream}" stroke-width="2.4" stroke-linecap="round"/>`;
  s += `<path d="${fringe}" stroke="${dark}" stroke-width="2.4" stroke-linecap="round" opacity="0.18"/>`;

  // The sewn-on label.
  const lx = border * cell + 18;
  const ly = labelTop * cell + 8;
  const lw = W - lx * 2;
  const lh = (rows - border - 2 - labelTop) * cell - 26;
  s += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="6" fill="${BASE.paper}"/>`;
  s += `<rect x="${lx + 7}" y="${ly + 7}" width="${lw - 14}" height="${lh - 14}" rx="3" fill="none" stroke="${ground}" stroke-width="2" stroke-dasharray="7 6"/>`;
  const tx = lx + 26;
  const textW = lw - 26 - 150;
  s += text(tx, ly + 44, "383 · KOSOVA NË XHEP", { size: 11, weight: 800, fill: ground, tracking: 2.2 });
  s += text(tx, ly + 92, facts.headline, { size: fitSize(facts.headline, textW, 40, 24), weight: 800, fill: BASE.ink, tracking: -1 });
  s += text(tx, ly + 124, `${facts.type} · ${facts.when}`, { size: fitSize(`${facts.type} · ${facts.when}`, textW, 16, 11), weight: 700, fill: BASE.ink, opacity: 0.78 });
  s += text(tx, ly + 152, facts.cityNames.join(" → "), { size: fitSize(facts.cityNames.join(" → "), textW, 15, 10), weight: 800, fill: ground });
  s += text(tx, ly + 178, stamps.length ? `${facts.interestLine} · ${t.stamps(stamps.length)}` : facts.interestLine, { size: fitSize(facts.interestLine, textW, 13, 10), weight: 700, fill: BASE.ink, opacity: 0.6 });
  s += qrPlaceholder(lx + lw - 138, ly + 38, 112, rng, { style: "stitch", fg: dark, bg: BASE.paper });
  return s;
}

/* ---------------------------------------------------------------- api */

export const CARD_STRUCTURES = ["ticket", "filigree", "qilim"];

/**
 * @param {object} rawProfile  quiz answers (any shape; normalized defensively)
 * @param {{ structure?: string, stamps?: string[], seed?: string, lang?: "en"|"sq" }} options
 * @returns {string} a standalone SVG document string, 600×900
 */
export function cardArt(rawProfile, options = {}) {
  const profile = normalizeCardProfile(rawProfile);
  const structure = CARD_STRUCTURES.includes(options.structure) ? options.structure : "ticket";
  const lang = options.lang === "sq" ? "sq" : "en";
  const stamps = Array.isArray(options.stamps) ? options.stamps.filter((id) => typeof id === "string") : [];
  const seedText = `${structure}|${options.seed ?? ""}|${JSON.stringify(profile)}|${stamps.join(",")}`;
  const rng = mulberry32(fnv1a(seedText));
  const facts = cardFacts(profile, lang);
  // Card-local ids: several cards can share one page (a trip and its members).
  const uid = fnv1a(`uid|${seedText}`).toString(36);
  const body =
    structure === "filigree"
      ? filigreeCard(profile, facts, rng, stamps, uid)
      : structure === "qilim"
        ? qilimCard(profile, facts, rng, stamps)
        : ticketCard(profile, facts, rng, stamps, uid);
  const title = `${facts.headline} — Kosova në xhep`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>`;
}
