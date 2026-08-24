/**
 * Article imagery is hotlinked from other outlets' CDNs, which serve whatever
 * size their own editors uploaded. One Al Jazeera hero on the homepage was
 * 11.8 MB of JPEG behind a 540px-tall box.
 *
 * Where a host honours a width parameter we ask it for a display-sized
 * rendition. This is deliberately a per-host allowlist rather than a blanket
 * rewrite: measured 2026-08-24, the parameter is ignored, breaks, or actively
 * hurts on most of the hosts in the feed.
 *
 *   host                  original     with ?w=1200   verdict
 *   www.aljazeera.com     11,867,165          127,181  93x smaller -> use it
 *   www.aljazeera.com      3,079,377          182,298  17x smaller -> use it
 *   ichef.bbci.co.uk          59,045                1  breaks; size already in path
 *   resources.koha.net        35,263          211,552  6x LARGER -> never
 *   euronews.al               43,353           43,353  ignored; no gain
 *   i.guim.co.uk       signed renditions; editing width voids the signature
 *
 * Add a host only after measuring it the same way.
 */

/** host -> the query parameter that host resizes by. */
const WIDTH_PARAM_BY_HOST = new Map([
  ["www.aljazeera.com", "w"],
  ["aljazeera.com", "w"],
]);

/**
 * Ask the origin CDN for a rendition about `width` pixels wide.
 *
 * Returns the URL untouched for anything it cannot improve: a missing value, a
 * relative or malformed URL, a host that is not on the list, or a URL whose
 * author already specified a size. Never throws — a bad image URL must degrade
 * to the original src, not take a page render down with it.
 */
export function remoteImageSrc(url, width) {
  if (typeof url !== "string" || url === "") return url;
  if (!Number.isFinite(width) || width <= 0) return url;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return url;

  const param = WIDTH_PARAM_BY_HOST.get(parsed.hostname.toLowerCase());
  if (!param) return url;

  // An explicit size in the stored URL is an editorial choice; leave it alone.
  if (parsed.searchParams.has(param) || parsed.searchParams.has("resize")) return url;

  parsed.searchParams.set(param, String(Math.round(width)));
  return parsed.toString();
}
