// One place for how a tone index becomes a colour and a sentence, shared by
// the homepage module, the inset map and /toni, so the three cannot drift.

/**
 * The diverging scale, validated rather than chosen by eye.
 *
 * The obvious palette — the site's own #E41E20 and #16A34A — fails: those two
 * are ΔE 5.0 apart under deuteranopia, so the two poles of a diverging scale
 * are indistinguishable to roughly one man in twelve. Red and green is the
 * classic collapse.
 *
 * The fix is lightness, which survives colour-vision deficiency when hue does
 * not: a DARK red against a LIGHT green measures ΔE 30.4. The direction
 * matters — light red against dark green still fails, at 5.5.
 *
 * Verified with the dataviz validator on the #FFFFFF card surface:
 *   lightness band PASS · CVD separation PASS (worst pair 8.6 deutan)
 *   normal-vision floor PASS
 * Two knowingly accepted flags:
 *   - chroma floor FAILs on the midpoint. A diverging scale is *required* to
 *     have a neutral grey midpoint; the check is scoped to categorical
 *     palettes, where a grey slot would indeed be a bug.
 *   - contrast WARNs below 3:1, which is legal with "relief": visible labels
 *     or a table view. Every country's number is printed beside its bar, and
 *     the rows are the table, so colour is never the only encoding.
 */
export const TONE_COLOR = {
  critical: "#A3121A",
  criticalSoft: "#CB6A6E",
  neutral: "#9CA3AF",
  positiveSoft: "#8FD9AC",
  positive: "#4FC77C",
} as const;

/** Ink, not series colour, for any text. */
export const TONE_INK = { strong: "#111111", muted: "#6B6B6B", faint: "#9CA3AF" } as const;

/**
 * The scale is banded 35–65, not 0–100.
 *
 * Under the v2 stance definition most journalism is genuinely neutral, so
 * every country now sits near 50. Spread across a full 0–100 ramp they would
 * all render the same grey and the map would carry no information at all.
 * Clamped outside the band, and the band is stated in the legend so the
 * compression is visible rather than a hidden flattery.
 */
export const BAND = { lo: 35, hi: 65 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Where an index sits on the band, 0 (most critical) to 1 (most positive). */
export function bandPosition(index: number): number {
  return (clamp(index, BAND.lo, BAND.hi) - BAND.lo) / (BAND.hi - BAND.lo);
}

/** Five steps, not a continuous gradient — a reader can name a step. */
export function toneFill(index: number | null): string {
  if (index == null) return "rgba(17,17,17,0.10)";
  const t = bandPosition(index);
  if (t < 0.2) return TONE_COLOR.critical;
  if (t < 0.4) return TONE_COLOR.criticalSoft;
  if (t <= 0.6) return TONE_COLOR.neutral;
  if (t <= 0.8) return TONE_COLOR.positiveSoft;
  return TONE_COLOR.positive;
}

/** Short label for a single country, in Albanian. */
export function toneLabel(index: number | null): string {
  if (index == null) return "pa të dhëna";
  const t = bandPosition(index);
  if (t < 0.2) return "kritik";
  if (t < 0.4) return "disi kritik";
  if (t <= 0.6) return "neutral";
  if (t <= 0.8) return "disi pozitiv";
  return "pozitiv";
}

/**
 * The sentence the module leads with. The number is support; this is the
 * headline, because "40" answers nothing on its own.
 */
export function verdictSentence(index: number | null): string {
  if (index == null) return "Ende nuk ka mjaft artikuj për një vlerësim.";
  const t = bandPosition(index);
  if (t < 0.2) return "Media botërore po shkruan për Kosovën me ton kryesisht kritik.";
  if (t < 0.4) return "Media botërore po shkruan për Kosovën me pak më shumë kritikë se lëvdata.";
  if (t <= 0.6) return "Media botërore po shkruan për Kosovën kryesisht në mënyrë neutrale.";
  if (t <= 0.8) return "Media botërore po shkruan për Kosovën me pak më shumë lëvdata se kritikë.";
  return "Media botërore po shkruan për Kosovën me ton kryesisht pozitiv.";
}

/**
 * Says out loud that a neutral majority is the expected result. Without this
 * the module reads as broken to anyone who assumes a tone meter should swing.
 */
export const NEUTRAL_IS_NORMAL =
  "Shumica e raportimit është neutrale — kjo është normale: gazetaria raporton, nuk mban anë.";

/**
 * Emoji flag to ISO 3166-1 alpha-2, by decoding the regional-indicator pair.
 * Consolidated here from three separate copies (tone-dashboard, app/toni,
 * app/page) — one of which was missing the range guard and returned garbage
 * for an empty flag. The country data carries Albanian names and flags but no
 * codes, so this is the only bridge to the map's ISO-keyed shapes.
 */
export function flagToCode(flag: string): string {
  const cps = [...flag].map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2) return "";
  const a = cps[0] - 0x1f1e6 + 65;
  const b = cps[1] - 0x1f1e6 + 65;
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return String.fromCharCode(a, b);
}

/**
 * What share of a country's own coverage the index actually rests on.
 *
 * Both producers have always written `excluded` — articles the classifier
 * could not read — and no TS consumer ever looked at it, which is how Greqi
 * came to publish an index of 50 built on 5 of its 79 articles with nothing
 * on screen to say so.
 */
export function coverageOf(summary: { n: number; excluded?: number }): number {
  const total = summary.n + (summary.excluded ?? 0);
  return total > 0 ? summary.n / total : 0;
}

/** Albanian, and rounded the way a person would say it. */
export function formatAge(hours: number | null): string {
  if (hours == null) return "një kohe të panjohur";
  if (hours < 48) return `${Math.round(hours)} orësh`;
  return `${Math.round(hours / 24)} ditësh`;
}

/**
 * The same point as NEUTRAL_IS_NORMAL, as a clause rather than a sentence.
 * The homepage states the neutral share and then explains it in one breath;
 * two separate paragraphs saying it twice cost 60px of a phone screen and
 * read as a correction of the line above.
 */
export const NEUTRAL_IS_SHORT =
  "normale, sepse gazetaria raporton, nuk mban anë.";

const MONTHS_SQ = [
  "jan", "shk", "mar", "pri", "maj", "qer",
  "korr", "gush", "sht", "tet", "nën", "dhj",
];

/**
 * Renders an article's stored date, whatever vintage it is.
 *
 * The cache holds two shapes. Current entries are ISO — the scraper builds
 * them from feedparser's parsed struct_time. Entries written before that fix
 * hold a `[:10]` slice of the raw RFC-822 string, which cuts the month name
 * in half: "Sun, 09 Au". About 200 of the 957 cached articles are still that
 * shape and they render straight onto the cards.
 *
 * ISO becomes "9 gush". Anything else returns null and the caller omits the
 * date rather than printing a fragment — a missing date costs a reader
 * nothing, a broken one costs the page its credibility.
 */
export function formatArticleDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const month = MONTHS_SQ[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month}` : null;
}
