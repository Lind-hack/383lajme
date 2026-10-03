/**
 * Where a story that moved a news market lives, and who published it.
 *
 * Evidence comes in two shapes. Stories from 383's own feed carry the article
 * slug and are read at /article/<slug>. Stories the research step found on
 * other sites carry a "research-<hash>" slug, which is an id for our records,
 * not a page: linking it as /article/research-… was a 404, and the chart
 * labelled every such story "383". Those link to the publisher instead, named
 * by the evidence's own source field or the URL's host.
 */

const OWN_HOSTS = /(^|\.)383ks\.com$|(^|\.)383lajme\.com$/;

function hostOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** @returns {{ href: string | null, external: boolean, source: string, publishedAt: string | null }} */
export function evidenceLink(story) {
  const slug = String(story?.slug ?? "").trim();
  const url = String(story?.url ?? "").trim();
  const host = url ? hostOf(url) : null;
  const ownArticle = slug && !slug.startsWith("research-") && (!host || OWN_HOSTS.test(host));
  const publishedAt = typeof story?.publishedAt === "string" ? story.publishedAt : null;
  if (ownArticle) return { href: `/article/${slug}`, external: false, source: "383", publishedAt };
  const source = String(story?.source ?? "").trim().replace(/^www\./, "") || host || "Lajm";
  if (host && /^https?:$/.test(new URL(url).protocol)) return { href: url, external: true, source, publishedAt };
  return { href: null, external: false, source, publishedAt };
}
