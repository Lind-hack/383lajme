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
 *
 * Some hosts keep the size in the path instead, and there the feed tends to
 * carry a small rendition — 1200px from BBC and Euronews, 1600px from Sky —
 * which a desktop lead has to stretch. Measured 2026-09-26 on every live URL
 * of theirs (23 of 23), each also serves a genuine 2048px rendition:
 *
 *   ichef.bbci.co.uk      /ace/branded_news/1200/…   -> /ace/standard/2048/…
 *                         (the older /news/1024/ form 404s at 2048; left alone)
 *   images.euronews.com   …/1200x675_cmsv2_…         -> …/2048x1152_cmsv2_…
 *   e0.365dm.com          /26/03/1600x900/…          -> /26/03/2048x1152/…
 *
 * These only ever ask for a larger rendition than the stored one; the Next
 * image optimizer then scales it down for whatever the reader's screen needs.
 */

/** host -> the query parameter that host resizes by. */
const WIDTH_PARAM_BY_HOST = new Map([
  ["www.aljazeera.com", "w"],
  ["aljazeera.com", "w"],
]);

/** The largest rendition each path-sized host was measured to serve. */
const LARGE_RENDITION_WIDTH = 2048;

/**
 * host -> rewrite of a stored path to that host's 2048px rendition, applied
 * only when the stored rendition is narrower.
 */
const PATH_RENDITION_BY_HOST = new Map([
  [
    "ichef.bbci.co.uk",
    (pathname) => {
      const m = pathname.match(/^\/ace\/(?:branded_news|branded_sport|standard)\/(\d+)\//);
      return m && Number(m[1]) < LARGE_RENDITION_WIDTH
        ? pathname.replace(m[0], `/ace/standard/${LARGE_RENDITION_WIDTH}/`)
        : pathname;
    },
  ],
  [
    "images.euronews.com",
    (pathname) => {
      const m = pathname.match(/\/(\d+)x(\d+)_cmsv2_/);
      return m && Number(m[1]) < LARGE_RENDITION_WIDTH ? pathname.replace(m[0], "/2048x1152_cmsv2_") : pathname;
    },
  ],
  [
    "e0.365dm.com",
    (pathname) => {
      const m = pathname.match(/^\/(\d{2})\/(\d{2})\/(\d+)x(\d+)\//);
      return m && Number(m[3]) < LARGE_RENDITION_WIDTH ? pathname.replace(m[0], `/${m[1]}/${m[2]}/2048x1152/`) : pathname;
    },
  ],
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

  const rendition = PATH_RENDITION_BY_HOST.get(parsed.hostname.toLowerCase());
  if (rendition) {
    if (width < LARGE_RENDITION_WIDTH) return url;
    const pathname = rendition(parsed.pathname);
    if (pathname === parsed.pathname) return url;
    parsed.pathname = pathname;
    return parsed.toString();
  }

  const param = WIDTH_PARAM_BY_HOST.get(parsed.hostname.toLowerCase());
  if (!param) return url;

  // An explicit size in the stored URL is an editorial choice; leave it alone.
  if (parsed.searchParams.has(param) || parsed.searchParams.has("resize")) return url;

  parsed.searchParams.set(param, String(Math.round(width)));
  return parsed.toString();
}
