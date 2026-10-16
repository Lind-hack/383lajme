import { isKnownVideoKey } from "@/lib/video-feed";
import { instagramKey } from "@/lib/video-key.mjs";

/**
 * An Instagram reel's cover for its card: GET ?ig=<code>.
 *
 * Instagram's image server answers other sites' pages with
 * "Cross-Origin-Resource-Policy: same-origin", so a browser will not show the
 * cover from 383's page. This passes Instagram's own current cover through
 * (instagram.com/p/<code>/media redirects to it), cached a day — only for a
 * reel the feed carries, never as an open proxy.
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("ig") ?? "";
  const key = instagramKey(code);
  if (!key || !(await isKnownVideoKey(key))) return new Response(null, { status: 404 });
  try {
    const res = await fetch(`https://www.instagram.com/p/${code}/media/?size=l`, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; 383ks/1.0; +https://383ks.com)" },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response(null, { status: 404 });
    return new Response(res.body, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400" },
    });
  } catch {
    return new Response(null, { status: 504 });
  }
}
