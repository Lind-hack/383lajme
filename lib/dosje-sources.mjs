/**
 * Gathering the evidence, before anything is written.
 *
 * The order matters more than any other decision in this feature. Sources are
 * fetched first and the model is shown only what came back, so it can cite by
 * pointing at an excerpt and has no way to produce a url of its own. A model
 * asked for "a source" will supply a plausible one; a model handed six excerpts
 * and allowed only to number them cannot.
 *
 * Nothing here decides whether a claim is true. It decides what was actually
 * published, and by whom.
 */

/** Publishers whose reporting can carry a historical claim, best first. */
export const PUBLISHER_TIERS = [
  // Primary documents — the institution's own record of its own act.
  { tier: 1, hosts: ["consilium.europa.eu", "ec.europa.eu", "europarl.europa.eu", "nato.int", "un.org", "unmik.unmissions.org", "icj-cij.org", "scp-ks.org", "irmct.org", "icty.org", "osce.org", "kryeministri-ks.net", "president-ksgov.net", "kuvendikosoves.org", "state.gov", "gov.uk"] },
  // Wires and public broadcasters.
  { tier: 2, hosts: ["reuters.com", "apnews.com", "afp.com", "bbc.com", "bbc.co.uk", "dw.com", "france24.com", "npr.org", "voanews.com"] },
  // Newsrooms and regional reporting with a record on this material. Widened
  // 2026-11: every claim now needs two publishers, and with nine outlets most
  // events in a pack were reported by only one of them.
  { tier: 3, hosts: ["balkaninsight.com", "prishtinainsight.com", "rferl.org", "evropaelire.org", "koha.net", "kallxo.com", "kosovotwopointzero.com", "hrw.org", "amnesty.org", "crisisgroup.org", "theguardian.com", "rfi.fr", "hlc-kosovo.org", "nytimes.com", "washingtonpost.com", "aljazeera.com", "euronews.com", "politico.eu", "cnn.com", "independent.co.uk", "economist.com", "ft.com"] },
];

export function tierOf(url) {
  let host;
  try {
    host = new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const { tier, hosts } of PUBLISHER_TIERS) {
    if (hosts.some((h) => host === h || host.endsWith("." + h))) return tier;
  }
  return null;
}

/**
 * Newsrooms that publish under more than one hostname.
 *
 * The two-publishers rule exists to stop one outlet corroborating itself, and
 * a hostname is not an outlet. uk.reuters.com and reuters.com are one wire;
 * bbc.com and bbc.co.uk are one broadcaster; rferl.org and evropaelire.org are
 * Radio Free Europe and its Albanian service, running the same copy. Each pair
 * satisfied "two distinct publishers" while being a single account of events —
 * exactly the failure the rule was written to prevent.
 */
const SISTER_BRANDS = [
  { id: "reuters", hosts: ["reuters.com"] },
  { id: "bbc", hosts: ["bbc.com", "bbc.co.uk"] },
  { id: "rferl", hosts: ["rferl.org", "evropaelire.org", "azattyq.org"] },
  { id: "ap", hosts: ["apnews.com", "ap.org"] },
  { id: "eu", hosts: ["consilium.europa.eu", "ec.europa.eu", "europa.eu"] },
  { id: "un", hosts: ["un.org", "undocs.org"] },
  { id: "hrw", hosts: ["hrw.org"] },
];

/**
 * Publisher identity for a url — the newsroom, not the hostname.
 *
 * Subdomains fold into their parent, so a regional edition cannot stand in as
 * a second source for its own wire.
 */
export function publisherOf(url) {
  let host;
  try {
    host = new URL(String(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  for (const { id, hosts } of SISTER_BRANDS) {
    if (hosts.some((h) => host === h || host.endsWith("." + h))) return id;
  }
  // Otherwise the registrable domain, so uk.example.com and example.com are
  // one publisher rather than two.
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  // Two-part public suffixes (co.uk, org.uk, com.tr) need three labels.
  const tail2 = parts.slice(-2).join(".");
  const twoPart = ["co.uk", "org.uk", "gov.uk", "ac.uk", "com.tr", "com.au", "co.jp"];
  return twoPart.includes(tail2) ? parts.slice(-3).join(".") : tail2;
}

const foldEvidence = (text) =>
  String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function evidenceHasTerm(haystack, term) {
  const t = foldEvidence(term);
  return t.length > 2 && ` ${haystack} `.includes(` ${t} `);
}

export function sourceMatchesProfile(source, groups) {
  if (!Array.isArray(groups) || groups.length === 0) return true;
  const haystack = foldEvidence(`${source?.title ?? ""} ${source?.text ?? ""}`);
  return groups.some((group) =>
    Array.isArray(group) && group.length > 0 && group.every((term) => evidenceHasTerm(haystack, term))
  );
}

export function relevanceGroupsForQuery(query) {
  const q = foldEvidence(query);
  const has = (term) => evidenceHasTerm(q, term);
  if (has("kosovo") || has("kosova")) {
    if (has("president") || has("election") || has("parliament") || has("assembly") || has("deadlock") || has("speaker") || has("government")) {
      return [["kosovo", "president"], ["kosovo", "parliament"], ["kosovo", "election"], ["kosovo", "deadlock"], ["kosovo", "assembly"], ["kosovo", "government"]];
    }
    if (has("kfor") || has("nato")) return [["kosovo", "kfor"], ["kosovo", "nato"], ["kosovo", "mitrovica"]];
    if (has("serbia") || has("dialogue") || has("normalization")) return [["kosovo", "serbia"], ["kosovo", "dialogue"], ["kosovo", "normalization"]];
  }
  return [];
}

const strip = (html) =>
  String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The article, not the page: the text of its paragraphs when it has at least
 * three real ones, otherwise everything. Menus, cookie banners and footers
 * were filling the excerpt the model reads and pushing the reporting out.
 *
 * @param {string} html
 */
export function articleText(html) {
  const paragraphs = [...String(html ?? "").matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map((m) => strip(m[1]))
    .filter((t) => t.length >= 60);
  return paragraphs.length >= 3 ? paragraphs.join(" ") : strip(html);
}

/**
 * Outlets that answer our fetches with 401/403 (measured 2026-11-02). Their
 * pages can only be read from an archive copy, which does not count as a live
 * source, so they are skipped when choosing candidates rather than taking the
 * slots of outlets that can actually corroborate a claim. They are not
 * circumvented.
 */
const BLOCKED_PUBLISHERS = ["reuters", "ap", "nytimes.com", "washingtonpost.com", "koha.net", "ft.com", "economist.com"];
export function isBlockedPublisher(url) {
  return BLOCKED_PUBLISHERS.includes(String(publisherOf(url) ?? ""));
}

const metaOf = (html, prop) => {
  const re = new RegExp(
    '<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']+)["\']',
    "i"
  );
  return (String(html ?? "").match(re) || [])[1] ?? null;
};

/**
 * Fetch one source and record what came back.
 *
 * Every failure returns a row with its status rather than throwing: a citation
 * that could not be fetched must be visible as unverified, not silently absent.
 * The http_status recorded here is what the database trigger later counts.
 */
export const WAYBACK_AVAILABILITY = "https://archive.org/wayback/available";

/**
 * The closest Wayback snapshot of a url, or null.
 *
 * Measured against the sources this feature actually needs: for "Resolution
 * 1244", four of seven urls Wikipedia cites are dead, and three of those four
 * are un.org — the Tier 1 primary-document host. A dossier that reaches back
 * twenty-seven years is asking for exactly the urls least likely to still
 * resolve, so link rot is the normal case here rather than the exception.
 *
 * `timestamp` is the event's own date when we have it, so the snapshot returned
 * is the page as it read around the event rather than whatever the url last
 * held before it died.
 */
export async function archiveSnapshot(url, { timeoutMs = 8000, fetchImpl = fetch, timestamp = null } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const qs = new URLSearchParams({ url });
    if (timestamp) qs.set("timestamp", String(timestamp));
    const res = await fetchImpl(`${WAYBACK_AVAILABILITY}?${qs}`, { signal: controller.signal });
    if (!res.ok) return null;
    const snap = (await res.json())?.archived_snapshots?.closest;
    if (!snap?.available || !snap?.url) return null;
    return String(snap.url).replace(/^http:\/\//, "https://");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hostnames that cannot resolve, by standard rather than by accident.
 *
 * RFC 2606 and RFC 6761 reserve these so nobody can ever register them. A
 * citation pointing at one is not a link that broke — it is a placeholder that
 * was never a link, and no amount of retrying will change that.
 */
const UNRESOLVABLE_TLDS = ["invalid", "example", "test", "localhost"];

/**
 * Whether it is worth spending a request on this citation's url.
 *
 * The dossier seed recorded two hand-written provenance notes as citations
 * carrying `https://example.invalid/unverified`, because the column is not
 * nullable and the note had to go somewhere. The re-verification job could not
 * tell them from real links: it fetched them nightly, counted the failures, and
 * reported them in the newsroom email as sources that had newly died — five
 * consecutive failures for a host that has never existed and never will.
 *
 * The notes are worth keeping; treating them as evidence is not. This is the
 * one place that distinguishes the two.
 */
export function isFetchableCitationUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url ?? ""));
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  const tld = host.split(".").pop();
  return !UNRESOLVABLE_TLDS.includes(tld) && host !== "localhost";
}

/**
 * Annotated for the same reason as gatherEvidence below: without it,
 * `timestamp = null` infers as the type `null` and a caller passing a real
 * timestamp fails to compile.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch, archive?: boolean, timestamp?: string | null }} [opts]
 */
export async function fetchSource(url, { timeoutMs = 8000, fetchImpl = fetch, archive = true, timestamp = null } = {}) {
  const started = Date.now();
  // One shape whether the fetch worked or not. A failed source has to be
  // representable in the same terms as a successful one so it can be counted
  // as unverified rather than quietly dropped or, worse, assumed.
  const base = {
    url,
    publisher: publisherOf(url),
    tier: tierOf(url),
    fetched_at: new Date().toISOString(),
    http_status: null,
    title: null,
    published_date: null,
    image: null,
    text: "",
    error: null,
    ms: 0,
    // Set only when the live url failed and a snapshot stood in for it. The
    // canonical `url` never changes: publisher and tier are properties of who
    // published the thing, not of where a copy of it was read from, and
    // rewriting url to web.archive.org would collapse every recovered source
    // into a single "publisher" and trip the two-publisher rule.
    archive_url: null,
    via_archive: false,
  };

  const read = async (target) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(target, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "user-agent": "383lajme-dosje/1.0 (+https://www.383ks.com)" },
      });
      const html = res.ok ? await res.text() : "";
      return { res, html, text: articleText(html) };
    } finally {
      clearTimeout(timer);
    }
  };

  const shape = (res, html, text, extra) => ({
    ...base,
    http_status: res.status,
    title: metaOf(html, "og:title") ?? (html.match(/<title[^>]*>([^<]+)</i) || [])[1] ?? null,
    published_date:
      metaOf(html, "article:published_time") ?? metaOf(html, "datePublished") ?? null,
    image: metaOf(html, "og:image") ?? null,
    // Bounded: the model is shown an excerpt, not a whole page, and a very
    // long page must not be able to crowd every other source out of context.
    // Long enough that a quote from the middle of a report can be checked;
    // what the model is shown is cut separately (passageFor).
    text: text.slice(0, 20000),
    ms: Date.now() - started,
    ...extra,
  });

  let live = null;
  try {
    live = await read(url);
    if (live.res.ok && live.text.trim()) return shape(live.res, live.html, live.text, {});
  } catch (err) {
    live = { error: String(err?.name ?? err) };
  }

  // The live url gave nothing usable. A snapshot is the only remaining way to
  // read what was actually published, so try one before recording a failure.
  if (archive) {
    const snapshotUrl = await archiveSnapshot(url, { timeoutMs, fetchImpl, timestamp });
    if (snapshotUrl) {
      try {
        const arch = await read(snapshotUrl);
        if (arch.res.ok && arch.text.trim()) {
          return shape(arch.res, arch.html, arch.text, {
            archive_url: snapshotUrl,
            via_archive: true,
          });
        }
      } catch {
        /* fall through to the failure row below */
      }
    }
  }

  if (live?.res) {
    return shape(live.res, live.html ?? "", live.text ?? "", {});
  }
  return { ...base, error: live?.error ?? "fetch_failed", ms: Date.now() - started };
}

/**
 * Candidate urls for a subject.
 *
 * Not Google News. Its RSS returns redirect wrappers — 200 OK, a few bytes of
 * JavaScript stub, and news.google.com as the apparent publisher — so a
 * citation system built on it would have no text to verify and would credit
 * Google for everyone else's reporting. lib/live-news.ts uses the same feed and
 * deliberately reads only headline, outlet and age for exactly this reason.
 *
 * An encyclopaedia article is an index of other people's reporting, and its
 * reference list is direct, fetchable publisher urls. So the encyclopaedia is
 * read for leads and never cited: it tells us BBC and Human Rights Watch wrote
 * about March 2004, and those reports are then fetched and quoted themselves.
 *
 * Anything not on a known citable publisher is dropped here rather than left
 * for the model to weigh.
 */
/**
 * Round-robin across publishers: the first source from each, then the second
 * from each, and so on, at most `perPublisher` from any one, `limit` in all.
 * Order within a publisher is kept.
 *
 * @template {{ url: string, publisher?: string | null }} T
 * @param {readonly T[]} items
 * @param {{ perPublisher?: number, limit?: number }} [opts]
 * @returns {T[]}
 */
export function diversifyByPublisher(items, { perPublisher = 3, limit = Infinity } = {}) {
  const groups = new Map();
  for (const item of items ?? []) {
    const key = String(item?.publisher ?? publisherOf(item?.url) ?? "").toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const out = [];
  for (let round = 0; round < perPublisher && out.length < limit; round++) {
    for (const list of groups.values()) {
      if (out.length >= limit) break;
      if (list[round]) out.push(list[round]);
    }
  }
  return out;
}

/**
 * Wikimedia asks API clients for a user-agent with a contact; without one,
 * bursts of calls (a run makes dozens) are throttled and the search comes back
 * empty. One retry after a short wait covers a 429.
 */
const WIKI_UA = "383lajme-dosje/1.1 (https://www.383ks.com; dosje research)";
async function wiki(url, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { signal, headers: { "user-agent": WIKI_UA } });
    if (res.status !== 429 && res.status !== 503) return res;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return fetch(url, { signal, headers: { "user-agent": WIKI_UA } });
}

export async function searchSources(query, { limit = 8, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const hit = await wiki(
      "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
        encodeURIComponent(query) +
        "&srlimit=8&format=json",
      controller.signal
    );
    if (!hit.ok) return [];
    // The top three articles, not just the first: one article often cites a
    // single listed outlet, while its neighbours (the people and events it
    // links to) cite others about the same subject.
    // Eight pages, not three: a page about one event (a trial, a person) cites
    // several outlets on that same event, which is what a claim needs.
    const pages = ((await hit.json())?.query?.search ?? []).map((r) => r?.title).filter(Boolean).slice(0, 8);
    if (!pages.length) return [];

    const seen = new Set();
    const out = [];
    for (const page of pages) {
      // A short pause between pages: bursts are what Wikimedia throttles.
      if (out.length || seen.size) await new Promise((r) => setTimeout(r, 250));
      const refs = await wiki(
        "https://en.wikipedia.org/w/api.php?action=parse&page=" +
          encodeURIComponent(page) +
          "&prop=externallinks&format=json",
        controller.signal
      );
      if (!refs.ok) continue;
      const links = (await refs.json())?.parse?.externallinks ?? [];
      for (const raw of links) {
        // Normalise the scheme so an http and https copy of one report are not
        // counted as two publishers.
        const url = String(raw).replace(/^http:\/\//, "https://");
        if (tierOf(url) === null || isBlockedPublisher(url)) continue;
        const key = url.replace(/[#?].*$/, "");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ url, title: null, published_date: null, lead: page });
      }
    }
    // A page's references cluster by outlet, so the first `limit` in page
    // order were routinely one publisher — and a subject with one publisher
    // can never pass the two-publisher rule. Interleave outlets instead.
    // Up to eight per page, so every event keeps its corroborating outlets.
    const byPage = new Map();
    for (const item of out) {
      const list = byPage.get(item.lead) ?? [];
      if (list.length < 8) list.push(item);
      byPage.set(item.lead, list);
    }
    return diversifyByPublisher([...byPage.values()].flat(), { perPublisher: limit, limit });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The evidence pack for one subject: fetched, ranked, and trimmed.
 *
 * Ranked by publisher tier so the model reads a primary document before a blog,
 * and capped so the prompt stays a set of excerpts rather than a haystack.
 * Only rows that actually returned 200 with usable text are included — the
 * model must never see, and so can never cite, a source that did not resolve.
 */
/**
 * @param {string} query
 * @param {{ max?: number, relevanceGroups?: string[][] | null }} [options]
 */
/**
 * A four-digit year in the subject steers snapshots to the era of the event.
 *
 * Without it the Wayback API returns the most recent capture, which for a dead
 * news url is usually the parked domain or the publisher's 404 page rather than
 * the reporting. June is used as a mid-year anchor: the API returns the closest
 * capture either side, so the month only has to be near, not right.
 */
export function timestampForQuery(query) {
  const m = String(query ?? "").match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return m ? `${m[1]}0601` : null;
}

/**
 * TypeScript reads this module's types from the source, not from
 * lib/dosje-sources.d.ts -- a .mjs needs a .d.mts to be picked up, so that file
 * is inert and had drifted. Without this annotation `relevanceGroups = null`
 * infers as the type `null` and every caller passing real groups fails to
 * compile.
 *
 * @param {string} query
 * @param {{ max?: number, relevanceGroups?: string[][] | null }} [opts]
 */
export async function gatherEvidence(query, { max = 6, relevanceGroups = null } = {}) {
  const found = await searchSources(query, { limit: max * 3 });
  if (!found.length) return [];

  const timestamp = timestampForQuery(query);
  const fetched = await Promise.all(
    found.map(async (f) => ({ ...(await fetchSource(f.url, { timestamp })), lead: f.lead ?? null }))
  );
  const profile = Array.isArray(relevanceGroups) && relevanceGroups.length
    ? relevanceGroups
    : relevanceGroupsForQuery(query);

  const readable = fetched
    .filter((s) => s.http_status === 200 && s.text && s.text.length > 200)
    .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9));
  const strict = readable.filter((s) => sourceMatchesProfile(s, profile));
  // Best tier first, but never one outlet filling the whole pack.
  if (publisherCount(strict) >= 2) return pickEvidence(strict, { max });
  // A model-written profile can be narrower than the reporting ("rama" AND
  // "protest" on the same page), leaving one publisher where five wrote about
  // the subject. Relevance then falls back to any one of the profile's terms.
  // Only which pages count as on topic relaxes; every moment drafted from
  // them still needs verbatim quotes from two live publishers to publish.
  const loose = readable.filter((s) => sourceMatchesAnyTerm(s, profile));
  return pickEvidence(publisherCount(loose) > publisherCount(strict) ? loose : strict, { max });
}

/**
 * Choose the pack so claims can be corroborated: sources are grouped by the
 * encyclopaedia page that led to them (one page ≈ one event), groups with two
 * or more publishers come first, two publishers from each, best tier first;
 * remaining room goes to the best single sources.
 *
 * @template {{ url: string, publisher?: string | null, lead?: string | null, tier?: number | null }} T
 * @param {readonly T[]} sources
 * @param {{ max?: number }} [opts]
 * @returns {T[]}
 */
export function pickEvidence(sources, { max = 12 } = {}) {
  const pub = (s) => String(s.publisher ?? publisherOf(s.url) ?? "").toLowerCase();
  const groups = new Map();
  for (const s of sources) {
    const key = s.lead ?? s.url;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const ranked = [...groups.values()]
    .map((list) => [...list].sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9)))
    .sort((a, b) => new Set(b.map(pub)).size - new Set(a.map(pub)).size);
  const out = [];
  const taken = new Set();
  const take = (s) => {
    if (out.length >= max || taken.has(s.url)) return;
    taken.add(s.url);
    out.push(s);
  };
  // Pairs first: two different publishers per event.
  for (const list of ranked) {
    const seen = new Set();
    const pair = list.filter((s) => !seen.has(pub(s)) && seen.add(pub(s))).slice(0, 2);
    if (pair.length === 2 && out.length + 2 <= max) pair.forEach(take);
  }
  // Then whatever is left, best tier first.
  for (const s of ranked.flat().sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9))) take(s);
  return out;
}

/**
 * The part of a page the model reads: sentences that mention the subject (and
 * the one after each, which often carries the date or number), up to
 * `budget` characters. A page with none of the terms shows its opening.
 *
 * @param {string} text
 * @param {string[][] | null | undefined} groups
 * @param {number} [budget]
 */
export function passageFor(text, groups, budget = 3000) {
  const all = String(text ?? "");
  const terms = [...new Set((groups ?? []).flat().map((t) => foldEvidence(t)).filter((t) => t.length >= 3))];
  const sentences = all.split(/(?<=[.!?])\s+/);
  if (!terms.length) return all.slice(0, budget);
  const keep = new Set();
  sentences.forEach((sentence, i) => {
    const f = ` ${foldEvidence(sentence)} `;
    if (terms.some((t) => f.includes(` ${t} `) || f.includes(` ${t}`))) {
      keep.add(i);
      if (i + 1 < sentences.length) keep.add(i + 1);
    }
  });
  if (!keep.size) return all.slice(0, budget);
  let out = "";
  for (const i of [...keep].sort((a, b) => a - b)) {
    const next = out ? `${out} ${sentences[i]}` : sentences[i];
    if (next.length > budget) break;
    out = next;
  }
  return out || all.slice(0, budget);
}

function publisherCount(sources) {
  return new Set(sources.map((s) => String(s.publisher ?? "").toLowerCase()).filter(Boolean)).size;
}

/** True when the page carries at least one distinctive term of the profile (or the profile is empty). */
export function sourceMatchesAnyTerm(source, groups) {
  const terms = [...new Set((Array.isArray(groups) ? groups : []).flat().map((t) => String(t ?? "").trim()).filter((t) => t.length >= 4))];
  if (!terms.length) return true;
  const haystack = foldEvidence(`${source?.title ?? ""} ${source?.text ?? ""}`);
  return terms.some((term) => evidenceHasTerm(haystack, term));
}
