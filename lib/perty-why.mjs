// "Pse e sheh këtë?" — one plain line for every story in the reader's paper.
//
// The paper is only trusted if it can say why each story is in it, in words a
// first-time reader understands at a glance: "Sepse zgjodhe Sport", "Nga
// qyteti yt", "Sepse lexove 4 lajme për Prizrenin, 12 minuta". The long form,
// shown when the reader taps the line, adds what the paper knows and how to
// change it. Built from rankFeed() output (lib/per-ty-rank.mjs) and the
// device's affinity tallies; nothing is sent anywhere.

import { normalizeInterests, readingStats } from "./interests.mjs";
import { personById } from "./people.mjs";
import { cityById } from "./cities.mjs";
import { articleKeys } from "./per-ty-rank.mjs";

/** Below this, the tallies are too thin to quote as numbers. */
const QUOTE_READS = 1.5;

/** The follow a key names, as the reader would say it. */
export function keyLabel(key) {
  const at = typeof key === "string" ? key.indexOf(":") : -1;
  if (at < 0) return null;
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (kind === "person") return personById(id)?.name ?? null;
  if (kind === "city") return cityById(id)?.name ?? null;
  if (kind === "cat") return id;
  return null;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "4 lajme, 12 minuta" from the decayed tallies, or "" when too thin to say. */
function tally(stats) {
  const reads = Math.round(stats.reads);
  if (stats.reads < QUOTE_READS || reads < 1) return "";
  const minutes = Math.round(stats.minutes);
  return minutes >= 1 ? `${plural(reads, "lajm", "lajme")}, ${plural(minutes, "minutë", "minuta")}` : plural(reads, "lajm", "lajme");
}

/**
 * @param {{ article: object, kind: string, primaryKey?: string, reason?: string }} item  a rankFeed() item
 * @param {unknown} rawInterests
 * @returns {{ short: string, long: string, key: string | null, picked: boolean }}
 *   key: the follow "Më shumë / Më pak" acts on (null for the day's top stories)
 */
export function whyLine(item, rawInterests, now = Date.now()) {
  const interests = normalizeInterests(rawInterests);
  const key = typeof item?.primaryKey === "string" && item.primaryKey.includes(":") ? item.primaryKey : null;
  const label = key ? keyLabel(key) : null;
  const stats = key ? readingStats(interests.affinity, key, now) : null;
  const said = stats ? tally(stats) : "";
  const read = said ? ` Kohët e fundit ke lexuar ${said} për këtë.` : "";

  if (item?.kind === "person" && label) {
    return { short: `Sepse ndjek ${label}`, long: `E zgjodhe ${label} kur e bëre gazetën.${read}`, key, picked: true };
  }
  if (item?.kind === "city" && label) {
    const home = key === `city:${interests.home}`;
    return {
      short: home ? `Nga qyteti yt, ${label}` : `Sepse ndjek ${label}`,
      long: home ? `${label} është qyteti yt, ndaj lajmet prej andej vijnë të parat.${read}` : `E zgjodhe ${label} kur e bëre gazetën.${read}`,
      key,
      picked: true,
    };
  }
  if (item?.kind === "category" && label) {
    return { short: `Sepse zgjodhe ${label}`, long: `E zgjodhe temën ${label} kur e bëre gazetën.${read}`, key, picked: true };
  }
  if (item?.kind === "learned") {
    // The strongest thing reading taught us about this story.
    let best = null;
    for (const k of articleKeys(item.article)) {
      const s = readingStats(interests.affinity, k, now);
      if (keyLabel(k) && (!best || s.weight > best.stats.weight)) best = { key: k, stats: s };
    }
    if (best) {
      const name = keyLabel(best.key);
      const t = tally(best.stats);
      return {
        short: t ? `Sepse lexove ${t} për ${name}` : `Sepse lexon për ${name}`,
        long: `Nuk e ke zgjedhur ${name}, por e lexon shpesh, ndaj e shtova vetë.${t ? ` Kohët e fundit: ${t}.` : ""}`,
        key: best.key,
        picked: false,
      };
    }
  }
  return {
    short: "Më i lexuari sot në 383",
    long: "Këtë e lexojnë më së shumti sot. E vë pak lajme të tilla që të mos të ikë asgjë e madhe.",
    key: null,
    picked: false,
  };
}
