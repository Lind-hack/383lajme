import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { automationDenied } from "@/lib/require-automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Drop the cached HTML for a route, so a deployment is actually visible.
 *
 * The homepage is `export const revalidate = 3600`. That number is about
 * traffic, not about correctness, and it has one consequence nobody wants: a
 * new deployment does not replace the page a reader gets. Vercel keeps the
 * prerender in a durable cache keyed on the pathname, so after shipping, the
 * site serves the *previous* build's homepage for up to an hour — measured on
 * 2026-08-23 as `X-Vercel-Cache: HIT, Age: 253` returning a homepage with no
 * Kosovë spotlight while /api/pyet and /kategori/shqiperi, which are dynamic,
 * were already live from the new build. A cache-busting query does not help:
 * the ISR key ignores it.
 *
 * So the deployment tells the site it happened. .github/workflows/revalidate.yml
 * calls this once Vercel reports a successful production deployment.
 *
 * Gated by the same automation secret as the other machine-to-machine routes.
 * It only discards cache — it cannot write anything — but an open endpoint that
 * forces re-rendering is a free way to make the origin do work.
 */

/** The routes whose staleness a reader would actually notice. */
const DEFAULT_PATHS = ["/", "/toni", "/tregu", "/visit"];

/** Bounded so a caller cannot ask for a thousand regenerations in one request. */
const MAX_PATHS = 20;

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const requested = Array.isArray(body?.paths) ? body.paths : DEFAULT_PATHS;

  const paths = requested
    .filter((p: unknown): p is string => typeof p === "string" && p.startsWith("/"))
    .slice(0, MAX_PATHS);

  if (paths.length === 0) {
    return NextResponse.json({ error: "paths must be absolute, e.g. \"/\"" }, { status: 422 });
  }

  const done: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];
  for (const path of paths) {
    try {
      revalidatePath(path);
      done.push(path);
    } catch (error) {
      failed.push({ path, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json(
    { revalidated: done, failed, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
