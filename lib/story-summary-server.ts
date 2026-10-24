// Server only. Writes Dardani's short summaries of new stories (lib/story-summary.mjs)
// and reads them back for Për ty.
//
// runStorySummaries runs from the two-minute heartbeat (runLiveSportsAutomation
// in lib/tregu-automation-server.ts). Most runs do nothing: at most every
// RUN_EVERY_MS it takes the PER_RUN newest stories that have no summary yet,
// asks the model for all of them in one call, checks every line against its
// story, and rewrites index.json in the public perty-summaries bucket. A line
// that fails the checks is replaced by the story's own first sentences; a model
// that is down is simply asked again next run, until the story is GIVE_UP_MS
// old and gets its own sentences too. It never throws.

import { createAdminClient } from "@/lib/supabase/admin";
import { getArticlesBefore, getArticlesBySlugs } from "@/lib/db";
import { llmJSON } from "@/lib/llm";
import {
  GIVE_UP_MS,
  INDEX_PATH,
  SUMMARY_BUCKET,
  SUMMARY_SYSTEM,
  buildSummaryPrompt,
  cleanSummaries,
  isDue,
  normalizeIndex,
  ownSummary,
  pickStories,
  summaryMap,
  withSummaries,
} from "@/lib/story-summary.mjs";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

function publicBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url}/storage/v1/object/public/${SUMMARY_BUCKET}` : "";
}

async function readIndex(admin: Admin) {
  const { data, error } = await admin.storage.from(SUMMARY_BUCKET).download(INDEX_PATH);
  if (error || !data) return { index: normalizeIndex(null), missing: true };
  try {
    return { index: normalizeIndex(JSON.parse(await data.text())), missing: false };
  } catch {
    return { index: normalizeIndex(null), missing: false };
  }
}

async function writeIndex(admin: Admin, index: unknown) {
  const body = Buffer.from(JSON.stringify(index));
  await admin.storage
    .from(SUMMARY_BUCKET)
    .upload(INDEX_PATH, body, { contentType: "application/json", upsert: true, cacheControl: "60" });
}

/** The bucket, created public on first use. */
async function ensureBucket(admin: Admin) {
  const { data } = await admin.storage.getBucket(SUMMARY_BUCKET);
  if (data) return;
  await admin.storage.createBucket(SUMMARY_BUCKET, { public: true, fileSizeLimit: "2MB", allowedMimeTypes: ["application/json"] });
}

export async function runStorySummaries(now = new Date()) {
  try {
    const admin = createAdminClient();
    if (!admin) return { skipped: "no-admin" };
    const { index, missing } = await readIndex(admin);
    if (!isDue(index, now.getTime())) return { skipped: "not-due" };
    if (missing) await ensureBucket(admin);

    const recent = await getArticlesBefore({ limit: 150 });
    const chosen = pickStories(recent, index, { now: now.getTime() });
    if (!chosen.length) {
      await writeIndex(admin, withSummaries(index, [], now.getTime()));
      return { made: 0 };
    }
    // The light rows have no body; the model and the checks need it.
    const full = (await getArticlesBySlugs(chosen.map((a) => a.slug))).filter((a) => a?.slug && a?.title);

    let lines: Map<string, string> | null = null;
    try {
      const raw = await llmJSON<unknown>(SUMMARY_SYSTEM, buildSummaryPrompt(full), {
        maxTokens: 1400,
        temperature: 0.4,
        prefer: "gemini",
      });
      lines = cleanSummaries(raw, full);
    } catch (error) {
      console.error("[per-ty] summaries: model unavailable", error instanceof Error ? error.message : error);
    }

    const made: { slug: string; text: string; by: "dardani" | "own" }[] = [];
    for (const article of full) {
      const line = lines?.get(article.slug);
      if (line) {
        made.push({ slug: article.slug, text: line, by: "dardani" });
        continue;
      }
      // The model answered but this line failed its checks, or the model has
      // been away for hours: the story's own words, so it is not asked forever.
      const age = now.getTime() - Date.parse(article.publishedAt ?? "");
      if (lines || age >= GIVE_UP_MS) {
        const own = ownSummary(article);
        if (own) made.push({ slug: article.slug, text: own, by: "own" });
      }
    }
    await writeIndex(admin, withSummaries(index, made, now.getTime()));
    return { chosen: chosen.length, dardani: made.filter((m) => m.by === "dardani").length, own: made.filter((m) => m.by === "own").length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** slug → summary, for the pages. Cached by Next for five minutes; {} when anything is off. */
export async function getSummaryMap(): Promise<Record<string, { text: string; byDardani: boolean }>> {
  const base = publicBase();
  if (!base) return {};
  try {
    const res = await fetch(`${base}/${INDEX_PATH}`, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    return summaryMap(await res.json());
  } catch {
    return {};
  }
}
