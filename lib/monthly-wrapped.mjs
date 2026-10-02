// "Tetori në 383": the month in news, as a small Spotify-style wrapped.
//
// Deliberately about the news, not the reader: what happened in Kosovo,
// Albania and the world, who was in the news most, and the busiest day. The
// full personal wrapped is the yearly one in December (docs/ideas/
// gazeta-jote.md); the monthly one stays small so it does not outshine it.
//
// Everything here is built from public newsroom data, so the server can draw
// each card as a shareable image (app/api/og/muaji). Pure and tested.

import { articleKeys } from "./per-ty-rank.mjs";
import { personById } from "./people.mjs";

/** Month names in the definite form a title wants: "Tetori në 383". */
const MONTHS_DEFINITE = ["Janari", "Shkurti", "Marsi", "Prilli", "Maji", "Qershori", "Korriku", "Gushti", "Shtatori", "Tetori", "Nëntori", "Dhjetori"];
/** And the indefinite one, for "në tetor". */
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The three places the month is told through, by the article's category. */
export const REGIONS = [
  { key: "kosove", category: "Kosovë", label: "Kosova" },
  { key: "shqiperi", category: "Shqipëri", label: "Shqipëria" },
  { key: "bote", category: "Botë", label: "Bota" },
];

/** "2026-10" → { year, month } or null. */
export function parseMonth(raw) {
  const m = MONTH_KEY.exec(String(raw ?? ""));
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function monthLabel(raw) {
  const p = parseMonth(raw);
  return p ? { definite: MONTHS_DEFINITE[p.month - 1], name: MONTHS[p.month - 1], year: p.year } : null;
}

/** The Kosovo calendar date of an instant: "2026-10-14". */
export function kosovoDate(iso) {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date(t));
}

/**
 * The UTC instants that bound a Kosovo-calendar month, for the database query.
 * Generous by a day on each side; buildMonthWrapped keeps only the month's own
 * Kosovo dates, so the slack never leaks into the counts.
 */
export function monthRange(raw) {
  const p = parseMonth(raw);
  if (!p) return null;
  const from = new Date(Date.UTC(p.year, p.month - 1, 1) - 86400_000);
  const to = new Date(Date.UTC(p.year, p.month, 1) + 86400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Whether a month has ended in Kosovo by `now` — the wrapped is for whole months. */
export function isMonthOver(raw, now = new Date()) {
  const p = parseMonth(raw);
  if (!p) return false;
  const today = kosovoDate(now.toISOString());
  const next = p.month === 12 ? `${p.year + 1}-01` : `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
  return today >= `${next}-01`;
}

/** The month before the one `now` falls in, in Kosovo: the newest wrapped. */
export function lastMonth(now = new Date()) {
  const [y, m] = kosovoDate(now.toISOString()).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** The story that best stands for a set: most read, then newest. */
function topStory(articles) {
  const best = [...articles].sort(
    (a, b) =>
      (Number(b.engagementScore) || 0) - (Number(a.engagementScore) || 0) ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  )[0];
  return best ? { slug: best.slug, title: best.title, imageUrl: best.imageUrl ?? null } : null;
}

function weekdayOf(date) {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

/**
 * @param {readonly { slug: string, title: string, excerpt?: string, category?: string, city?: string,
 *   publishedAt: string, engagementScore?: number, imageUrl?: string }[]} articles
 * @param {string} month "2026-10"
 */
export function buildMonthWrapped(articles, month) {
  const label = monthLabel(month);
  if (!label) return null;

  const seen = new Set();
  const inMonth = [];
  for (const a of articles ?? []) {
    if (!a?.slug || seen.has(a.slug)) continue;
    const date = kosovoDate(a.publishedAt);
    if (!date || date.slice(0, 7) !== month) continue;
    seen.add(a.slug);
    inMonth.push({ ...a, date });
  }

  const regions = REGIONS.map((r) => {
    const items = inMonth.filter((a) => a.category === r.category);
    return { key: r.key, label: r.label, count: items.length, top: topStory(items) };
  });

  // The person of the month: the followable name most often in the news,
  // matched with the same vetted forms "Për ty" uses.
  const byPerson = new Map();
  for (const a of inMonth) {
    for (const key of articleKeys(a)) {
      if (!key.startsWith("person:")) continue;
      const id = key.slice(7);
      byPerson.set(id, [...(byPerson.get(id) ?? []), a]);
    }
  }
  const [personId, personItems] = [...byPerson.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  const person = personId
    ? { id: personId, name: personById(personId)?.name ?? personId, count: personItems.length, top: topStory(personItems) }
    : null;

  const byDay = new Map();
  for (const a of inMonth) byDay.set(a.date, (byDay.get(a.date) ?? 0) + 1);
  const [busiestDate, busiestCount] = [...byDay.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
  const busiest = busiestDate
    ? {
        date: busiestDate,
        count: busiestCount,
        label: `${weekdayOf(busiestDate)}, ${Number(busiestDate.slice(8))} ${label.name}`,
        top: topStory(inMonth.filter((a) => a.date === busiestDate)),
      }
    : null;

  return {
    month,
    title: `${label.definite} në 383`,
    monthName: label.name,
    year: label.year,
    total: inMonth.length,
    days: byDay.size,
    regions,
    person,
    busiest,
  };
}

/** The cards, in order. Each is one image at app/api/og/muaji/[month]/[card]. */
export const CARDS = ["hyrje", "kosove", "shqiperi", "bote", "emri", "dita"];

/** Cards that have something to show for this month (a quiet month skips some). */
export function cardsFor(wrapped) {
  if (!wrapped || wrapped.total === 0) return [];
  return CARDS.filter((card) => {
    if (card === "emri") return Boolean(wrapped.person && wrapped.person.count >= 3);
    if (card === "dita") return Boolean(wrapped.busiest);
    const region = wrapped.regions.find((r) => r.key === card);
    return region ? region.count > 0 : true;
  });
}
