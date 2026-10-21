import { storyKeys } from "./related-articles.mjs";
import { matchTopic, MIN_SUBJECT_ARTICLES, MIN_SUBJECT_DAYS } from "./dosje-match.mjs";

/**
 * Where new dossiers come from.
 *
 * Every topic used to be written by hand, so after the wipe of October 2026
 * nothing could create one: app/api/automation/dosje/subjects only maps
 * articles onto topics that already exist. This finds the subjects the news
 * keeps returning to and checks the topic a model proposes for each.
 *
 * Both halves are deterministic. The model is asked only to name a cluster and
 * write its matching vocabulary; whether that vocabulary is any good is decided
 * here, by running the real matcher (lib/dosje-match.mjs) over the cluster and
 * over everything else.
 */

const DAY = 86_400_000;

/** Two stories are about the same subject when they share enough of what they name. */
function linked(a, b) {
  let names = 0;
  for (const n of a.names) if (b.names.has(n)) names++;
  if (names >= 2) return true;
  if (names === 0) return false;
  let stems = 0;
  for (const s of a.titleStems) if (b.titleStems.has(s)) stems++;
  return stems >= 2;
}

const dayOf = (a) => String(a?.publishedAt ?? "").slice(0, 10);

/**
 * Clusters of recent articles that could earn a dossier.
 *
 * Articles that already belong to an existing topic are set aside first, so a
 * cluster is a subject no dossier covers yet. A cluster qualifies on the same
 * rule the subject mapper uses: at least three articles over at least two days.
 *
 * @param {ReadonlyArray<{slug: string, title: string, excerpt?: string, category?: string, publishedAt?: string}>} articles
 * @param {ReadonlyArray<object>} topics Existing topics, in the matcher's shape.
 * @param {{ days?: number, now?: number, limit?: number }} [opts]
 * @returns {Array<{ id: string, articles: Array<{slug: string, title: string, excerpt?: string, category?: string, publishedAt?: string}>, members: string[], size: number, days: number, shared: string[], rank: number }>}
 */
export function discoverClusters(articles, topics = [], opts = {}) {
  const now = opts.now ?? Date.now();
  const since = now - (opts.days ?? 21) * DAY;
  const limit = opts.limit ?? 8;

  const pool = [];
  const seen = new Set();
  for (const a of articles ?? []) {
    if (!a?.slug || seen.has(a.slug)) continue;
    seen.add(a.slug);
    const t = Date.parse(a.publishedAt ?? "");
    if (!Number.isFinite(t) || t < since) continue;
    if (topics.length && matchTopic(a, topics)) continue;
    pool.push({ article: a, ...storyKeys(a) });
  }

  // Union–find over the link graph.
  const parent = pool.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (linked(pool[i], pool[j])) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  pool.forEach((p, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(p);
  });

  const clusters = [];
  for (const members of groups.values()) {
    const days = new Set(members.map((m) => dayOf(m.article)));
    if (members.length < MIN_SUBJECT_ARTICLES || days.size < MIN_SUBJECT_DAYS) continue;
    // The names most of the cluster shares: what it is about.
    const counts = new Map();
    for (const m of members) for (const n of m.names) counts.set(n, (counts.get(n) ?? 0) + 1);
    const shared = [...counts.entries()]
      .filter(([, c]) => c >= Math.max(2, Math.ceil(members.length / 3)))
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n)
      .slice(0, 8);
    const latest = Math.max(...members.map((m) => Date.parse(m.article.publishedAt ?? "") || 0));
    const articlesSorted = members
      .map((m) => m.article)
      .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
    clusters.push({
      id: articlesSorted.map((a) => a.slug).sort()[0],
      articles: articlesSorted.slice(0, 12),
      // Every member, not only the twelve shown to the model: a proposal's
      // false-match rate must not count the cluster's own stories as unrelated.
      members: articlesSorted.map((a) => a.slug),
      size: members.length,
      days: days.size,
      shared,
      // Bigger and fresher first.
      rank: members.length * (1 / (1 + (now - latest) / (3 * DAY))),
    });
  }
  return clusters.sort((a, b) => b.rank - a.rank).slice(0, limit);
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,7}$/;
const terms = (v) =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x ?? "").trim())
    .filter((x) => x.length >= 3 && x.length <= 60);

/** Proposal thresholds. Loosened at Lind's request (2026-10-21); facts are checked elsewhere, strictly. */
export const MIN_OWN_MATCHES = 2;
export const MAX_FALSE_RATE = 0.2;
export const MAX_OVERLAP = 0.3;

/**
 * Judge a proposed topic by what it would actually match.
 *
 * @param {any} raw The model's proposal.
 * @param {{ cluster: ReadonlyArray<object>, others: ReadonlyArray<object>, topics?: ReadonlyArray<object> }} ctx
 *   `cluster` is the articles it was proposed for; `others` is recent coverage
 *   outside the cluster; `topics` the existing topics.
 * @returns {{ ok: boolean, reasons: string[], topic?: object, ownMatches: number, falseRate: number }}
 */
export function checkProposedTopic(raw, { cluster, others, topics = [] }) {
  const reasons = [];
  const slug = String(raw?.slug ?? "").trim().toLowerCase();
  const title = String(raw?.title ?? "").trim();
  const blurb = String(raw?.blurb ?? "").trim();
  const topic = {
    slug,
    title,
    blurb,
    anchors: terms(raw?.anchors),
    signals: terms(raw?.signals),
    excludes: terms(raw?.excludes),
    matchGroups: (Array.isArray(raw?.matchGroups) ? raw.matchGroups : [])
      .map((g) => terms(g))
      .filter((g) => g.length >= 1 && g.length <= 4),
    context: terms(raw?.context),
  };

  if (!SLUG.test(slug)) reasons.push("slug_invalid");
  if (title.length < 6 || title.length > 80) reasons.push("title_invalid");
  if (blurb.length < 20 || blurb.length > 220) reasons.push("blurb_invalid");
  if (!topic.anchors.length) reasons.push("no_anchors");
  if (!topic.matchGroups.length) reasons.push("no_match_groups");
  if (topics.some((t) => t?.slug === slug)) reasons.push("slug_taken");

  // Judged alone, so a topic is measured by its own vocabulary.
  const matches = (a) => Boolean(matchTopic(a, [topic]));
  const own = (cluster ?? []).filter(matches);
  const stray = (others ?? []).filter(matches);
  const ownMatches = own.length;
  const falseRate = (others?.length ?? 0) ? stray.length / others.length : 0;
  if (ownMatches < MIN_OWN_MATCHES) reasons.push("matches_too_few_of_its_cluster");
  if (falseRate > MAX_FALSE_RATE) reasons.push("matches_too_much_unrelated_news");

  // A new topic must not be a second name for one that exists.
  if (topics.length && ownMatches) {
    const taken = own.filter((a) => topics.some((t) => matchTopic(a, [t]))).length;
    if (taken / ownMatches > MAX_OVERLAP) reasons.push("overlaps_existing_topic");
  }

  return reasons.length
    ? { ok: false, reasons, ownMatches, falseRate }
    : { ok: true, reasons, topic, ownMatches, falseRate };
}
