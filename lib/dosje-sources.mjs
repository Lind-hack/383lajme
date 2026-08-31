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
  { tier: 1, hosts: ["consilium.europa.eu", "ec.europa.eu", "nato.int", "un.org", "icj-cij.org", "kryeministri-ks.net", "president-ksgov.net", "kuvendikosoves.org"] },
  // Wires.
  { tier: 2, hosts: ["reuters.com", "apnews.com", "afp.com", "bbc.com", "bbc.co.uk"] },
  // Regional reporting with a record on this material.
  { tier: 3, hosts: ["balkaninsight.com", "rferl.org", "evropaelire.org", "koha.net", "kallxo.com", "kosovotwopointzero.com", "hrw.org", "amnesty.org", "crisisgroup.org"] },
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
export async function fetchSource(url, { timeoutMs = 8000 } = {}) {
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
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "383lajme-dosje/1.0 (+https://www.383ks.com)" },
    });
    const html = res.ok ? await res.text() : "";
    const text = strip(html);
    return {
      ...base,
      http_status: res.status,
      title: metaOf(html, "og:title") ?? (html.match(/<title[^>]*>([^<]+)</i) || [])[1] ?? null,
      published_date:
        metaOf(html, "article:published_time") ?? metaOf(html, "datePublished") ?? null,
      image: metaOf(html, "og:image") ?? null,
      // Bounded: the model is shown an excerpt, not a whole page, and a very
      // long page must not be able to crowd every other source out of context.
      text: text.slice(0, 6000),
      ms: Date.now() - started,
    };
  } catch (err) {
    return { ...base, error: String(err?.name ?? err), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
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
export async function searchSources(query, { limit = 8, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const hit = await fetch(
      "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
        encodeURIComponent(query) +
        "&srlimit=1&format=json",
      { signal: controller.signal, headers: { "user-agent": "383lajme-dosje/1.0" } }
    );
    if (!hit.ok) return [];
    const page = (await hit.json())?.query?.search?.[0]?.title;
    if (!page) return [];

    const refs = await fetch(
      "https://en.wikipedia.org/w/api.php?action=parse&page=" +
        encodeURIComponent(page) +
        "&prop=externallinks&format=json",
      { signal: controller.signal, headers: { "user-agent": "383lajme-dosje/1.0" } }
    );
    if (!refs.ok) return [];
    const links = (await refs.json())?.parse?.externallinks ?? [];

    const seen = new Set();
    const out = [];
    for (const raw of links) {
      // Normalise the scheme so an http and https copy of one report are not
      // counted as two publishers.
      const url = String(raw).replace(/^http:\/\//, "https://");
      if (tierOf(url) === null) continue;
      const key = url.replace(/[#?].*$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, title: null, published_date: null, lead: page });
      if (out.length >= limit) break;
    }
    return out;
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
export async function gatherEvidence(query, { max = 6, relevanceGroups = null } = {}) {
  const found = await searchSources(query, { limit: max * 2 });
  if (!found.length) return [];

  const fetched = await Promise.all(found.map((f) => fetchSource(f.url)));
  const profile = Array.isArray(relevanceGroups) && relevanceGroups.length
    ? relevanceGroups
    : relevanceGroupsForQuery(query);

  return fetched
    .filter((s) => s.http_status === 200 && s.text && s.text.length > 200)
    .filter((s) => sourceMatchesProfile(s, profile))
    .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9))
    .slice(0, max);
}
