/**
 * Dates as a reader writes them, not as a database stores them.
 *
 * Article rows carry an ISO timestamp. Printing that raw put
 * "2026-08-25T20:09:00+00:00" into the dossier rail next to hand-written
 * entries like "29 maj 2023", which reads as a leak rather than a date.
 */

const MONTHS = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
];

/**
 * Returns "25 gusht 2026", or null when there is nothing usable to format.
 * Never throws: a malformed stored date must degrade to no date, not to a
 * broken render.
 */
export function albanianDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The date to show for a timeline entry: an article's own published date,
 * formatted; otherwise the authored label a milestone already carries
 * ("Qershor 1999"), which is deliberately vaguer than a day.
 */
export function entryDate(entry) {
  return albanianDate(entry?.publishedAt) ?? entry?.date ?? null;
}
