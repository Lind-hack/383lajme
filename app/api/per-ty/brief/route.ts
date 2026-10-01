import { NextResponse, type NextRequest } from "next/server";
import { getArticlesBySlugs } from "@/lib/db";
import { llmJSON } from "@/lib/llm";
import {
  BRIEF_SYSTEM,
  MIN_SLUGS,
  briefKey,
  buildBriefPrompt,
  cleanBrief,
  validSlugs,
} from "@/lib/perty-brief.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dardani's three lines for one reader's Për ty (lib/perty-brief.mjs).
 *
 * POST /api/per-ty/brief   { slugs: string[] }   → { lines: { slug, text }[] }
 *
 * The body is the slugs of public stories and nothing else — no interests, no
 * reader id — and nothing is logged or stored beyond an in-memory cache keyed
 * on those slugs. Readers who follow the same things get the same stories, so
 * one model call serves all of them on a warm instance.
 */

const CACHE_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; lines: { slug: string; text: string }[] }>();

/** A model call per request, so a brake on one caller hammering one instance. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 4000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function reply(lines: { slug: string; text: string }[], status = 200) {
  return NextResponse.json({ lines }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slugs = validSlugs(body?.slugs);
  if (slugs.length < MIN_SLUGS) return reply([], 400);

  const key = briefKey(slugs);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return reply(hit.lines);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  if (rateLimited(ip)) return reply([], 429);

  const articles = (await getArticlesBySlugs(slugs).catch(() => [])).filter((a) => a?.slug && a?.title);
  if (articles.length < MIN_SLUGS) return reply([]);

  try {
    // Gemini leads: on this account Groq's remaining models answer unreliably
    // (see lib/llm.ts); Groq still backs it up.
    const raw = await llmJSON<unknown>(BRIEF_SYSTEM, buildBriefPrompt(articles), {
      maxTokens: 600,
      temperature: 0.3,
      prefer: "gemini",
    });
    const lines = cleanBrief(raw, articles.map((a) => a.slug));
    if (lines.length) {
      cache.set(key, { at: Date.now(), lines });
      if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    }
    return reply(lines);
  } catch (error) {
    console.error("[per-ty] brief unavailable", error instanceof Error ? error.message : error);
    return reply([]);
  }
}
