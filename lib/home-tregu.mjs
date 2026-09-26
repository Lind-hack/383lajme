// Which prediction markets the homepage shows today.
//
// The homepage band showed the same two books for as long as they stayed the
// busiest, so a returning reader met the same questions every visit. It now
// draws a fresh set each day: seeded by the Kosovo date, so every reader sees
// the same markets all day and a different set tomorrow, and spread across
// categories so one topic cannot fill the band.

/** Open books only, and not ones about to close under the reader. */
const MIN_TIME_LEFT_MS = 15 * 60 * 1000;

/** FNV-1a: small, stable, and the same on the server and in the browser. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The calendar day in Kosovo, e.g. "2026-09-25". */
export function kosovoDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The competitions Tregu has its own card designs for. They lead the band
 * whenever one is open: they are the floor's best-looking cards and the ones
 * most worth a reader's first tap.
 */
export const SPECIAL_LEAGUES = new Set([
  "uefa.champions",
  "uefa.europa",
  "uefa.europa.conf",
  "uefa.nations",
  "nba",
  "fbk.kosovo",
  "f1",
]);

export function marketLeague(row) {
  if (row?.market_type === "f1_race_winner") return "f1";
  return row?.live_event?.league ?? null;
}

export function isSpecialMarket(row) {
  return SPECIAL_LEAGUES.has(marketLeague(row));
}

function isOpen(row, now) {
  if (!row?.slug || row.status !== "open") return false;
  const closes = Date.parse(row.closes_at ?? "");
  return Number.isFinite(closes) && closes - now > MIN_TIME_LEFT_MS;
}

function seeded(rows, dateKey) {
  return rows
    .map((row) => ({ row, key: hash(`${dateKey}:${row.slug}`) }))
    .sort((a, b) => a.key - b.key)
    .map(({ row }) => row);
}

/**
 * Today's markets for the homepage. Special competitions come first, one per
 * competition while there are enough of them; everything else only fills what
 * is left, at most `perCategory` from one category.
 */
export function pickDailyMarkets(rows, { dateKey, count = 2, now = Date.now(), perCategory = 2 } = {}) {
  const open = (rows ?? []).filter((row) => isOpen(row, now));
  const special = seeded(open.filter(isSpecialMarket), dateKey);
  const rest = seeded(open.filter((row) => !isSpecialMarket(row)), dateKey);

  const picked = [];
  const leagues = new Set();
  // One per competition first, so two cards show two different designs.
  for (const row of special) {
    if (picked.length >= count) break;
    const league = marketLeague(row);
    if (leagues.has(league)) continue;
    picked.push(row);
    leagues.add(league);
  }
  for (const row of special) {
    if (picked.length >= count) break;
    if (!picked.includes(row)) picked.push(row);
  }

  const perCat = new Map();
  for (const row of picked) perCat.set(row.category, (perCat.get(row.category) ?? 0) + 1);
  for (const row of rest) {
    if (picked.length >= count) break;
    const used = perCat.get(row.category) ?? 0;
    if (used >= perCategory) continue;
    picked.push(row);
    perCat.set(row.category, used + 1);
  }
  // A quiet day with one busy category still fills the band.
  for (const row of rest) {
    if (picked.length >= count) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked;
}
