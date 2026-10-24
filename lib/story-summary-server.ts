// Server only. Writes Dardani's short summaries of the week's stories
// (lib/story-summary.mjs) and reads them back for Për ty.
//
// runStorySummaries runs from the two-minute heartbeat (runLiveSportsAutomation
// in lib/tregu-automation-server.ts) but does nothing outside the SUMMARY_HOUR
// (06:00 Kosovo time). In that hour each run takes up to BATCHES_PER_RUN batches
// of PER_RUN stories that have no summary yet, newest first, asks the model for
// each batch in one call, checks every line against its story, and rewrites
// index.json in the public perty-summaries bucket; once every story has one,
// the remaining runs of the hour find nothing to do. A line that fails the
// checks, or a whole batch the model could not answer (its free quota is often
// spent by early morning), gets the story's own first sentences instead, so
// every story is covered before the 07:00 push. Stories published later in the
// day show the newsroom's excerpt until the next morning. It never throws.

import { createAdminClient } from "@/lib/supabase/admin";
import { getArticlesBefore, getArticlesBySlugs } from "@/lib/db";
import { llmJSON } from "@/lib/llm";
import {
  INDEX_PATH,
  PER_RUN,
  SUMMARY_BUCKET,
  SUMMARY_SYSTEM,
  buildSummaryPrompt,
  cleanSummaries,
  isSummaryHour,
  normalizeIndex,
  ownSummary,
  pickStories,
  summaryMap,
  withSummaries,
} from "@/lib/story-summary.mjs";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Model calls per heartbeat run: 2 x 6 stories every two minutes clears a busy week inside the hour. */
const BATCHES_PER_RUN = 2;

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
  if (!isSummaryHour(now.getTime())) return { skipped: "not-summary-hour" };
  try {
    const admin = createAdminClient();
    if (!admin) return { skipped: "no-admin" };
    const { index, missing } = await readIndex(admin);
    if (missing) await ensureBucket(admin);

    const recent = await getArticlesBefore({ limit: 150 });
    const chosen = pickStories(recent, index, { now: now.getTime(), max: PER_RUN * BATCHES_PER_RUN });
    if (!chosen.length) return { made: 0 };
    // The light rows have no body; the model and the checks need it.
    const full = (await getArticlesBySlugs(chosen.map((a) => a.slug))).filter((a) => a?.slug && a?.title);

    const made: { slug: string; text: string; by: "dardani" | "own" }[] = [];
    for (let i = 0; i < full.length; i += PER_RUN) {
      const batch = full.slice(i, i + PER_RUN);
      let lines: Map<string, string> | null = null;
      try {
        const raw = await llmJSON<unknown>(SUMMARY_SYSTEM, buildSummaryPrompt(batch), {
          maxTokens: 1400,
          temperature: 0.4,
          prefer: "gemini",
        });
        lines = cleanSummaries(raw, batch);
      } catch (error) {
        console.error("[per-ty] summaries: model unavailable", error instanceof Error ? error.message : error);
      }
      for (const article of batch) {
        const line = lines?.get(article.slug);
        if (line) {
          made.push({ slug: article.slug, text: line, by: "dardani" });
          continue;
        }
        // The model's line failed its checks, or the model is down: the story's
        // own words, so every story is covered by 07:00.
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
