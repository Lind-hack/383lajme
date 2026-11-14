// Server only. Tags articles with the topics they are about (lib/topic-tags.mjs)
// and reads the tags back for the search (lib/search-sources.ts).
//
// runTopicTagging runs from the two-minute heartbeat (runLiveSportsAutomation in
// lib/tregu-automation-server.ts). Each run takes up to CALLS_PER_RUN x PER_CALL
// articles without tags on the current topic tree, newest first, asks the model
// for each dozen in one call, and rewrites the index in the private
// search-topics bucket. A new article is tagged within minutes of publication;
// the archive (ARTICLE_LIMIT, the same 2000 the search holds) is worked through
// in the background over a few hours, and again whenever TOPICS_VERSION moves.
// When nothing is left it rests for IDLE_MS. It never throws.
//
// Kill switch: TOPIC_TAGGING=0.

import { createAdminClient } from "@/lib/supabase/admin";
import { llmJSON } from "@/lib/llm";
import type { GroqModel } from "@/lib/groq";
import {
  INDEX_PATH,
  PER_CALL,
  TAG_BUCKET,
  TAG_SYSTEM,
  buildTagPrompt,
  cleanTags,
  normalizeIndex,
  pickUntagged,
  tagMap,
  withTags,
} from "@/lib/topic-tags.mjs";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const CALLS_PER_RUN = 2;
const TAG_GROQ: GroqModel[] = [{ id: "openai/gpt-oss-120b", params: { reasoning_effort: "low" } }];
const ARTICLE_LIMIT = 2000;
/** After a run that found nothing to tag, the next ones skip the lookups for this long. */
const IDLE_MS = 4 * 60 * 1000;

let idleUntil = 0;

/**
 * The stored index. Only a bucket or file that is really not there reads as
 * empty; any other failure throws. Reading a storage hiccup as "no index yet"
 * would let the next upload replace the whole archive's tags with one batch,
 * and rebuilding them costs about 170 model calls.
 */
async function readIndex(admin: Admin) {
  const { data: bucket } = await admin.storage.getBucket(TAG_BUCKET);
  if (!bucket) return { index: normalizeIndex(null), missing: true };
  const store = admin.storage.from(TAG_BUCKET);
  const { data: files, error: listError } = await store.list("", { search: INDEX_PATH });
  if (listError) throw new Error(`topic index list: ${listError.message}`);
  if (!files?.some((f) => f?.name === INDEX_PATH)) return { index: normalizeIndex(null), missing: false };
  const { data, error } = await store.download(INDEX_PATH);
  if (error || !data) throw new Error(`topic index read: ${error?.message ?? "empty"}`);
  // A file that does not parse is not "no tags": throwing keeps it for a person to look at.
  return { index: normalizeIndex(JSON.parse(await data.text())), missing: false };
}

/** The bucket, created private on first use: only the server reads it. */
async function ensureBucket(admin: Admin) {
  const { data } = await admin.storage.getBucket(TAG_BUCKET);
  if (data) return;
  await admin.storage.createBucket(TAG_BUCKET, { public: false, fileSizeLimit: "5MB", allowedMimeTypes: ["application/json"] });
}

export async function runTopicTagging(now = new Date()) {
  if (process.env.TOPIC_TAGGING === "0") return { skipped: "disabled" };
  if (now.getTime() < idleUntil) return { skipped: "idle" };
  try {
    const admin = createAdminClient();
    if (!admin) return { skipped: "no-admin" };
    const { index, missing } = await readIndex(admin);
    if (missing) await ensureBucket(admin);

    // Slugs first, light; the text only for the few being tagged.
    const { data: rows, error } = await admin
      .from("news_articles")
      .select("slug, title")
      .order("published_at", { ascending: false })
      .limit(ARTICLE_LIMIT);
    if (error) return { ok: false, error: error.message };
    const chosen = pickUntagged(rows ?? [], index, PER_CALL * CALLS_PER_RUN);
    if (!chosen.length) {
      idleUntil = now.getTime() + IDLE_MS;
      return { tagged: 0 };
    }
    const { data: full } = await admin
      .from("news_articles")
      .select("slug, title, excerpt")
      .in("slug", chosen.map((a: { slug: string }) => a.slug));
    const bySlug = new Map((full ?? []).map((a: { slug: string }) => [a.slug, a]));
    const articles = chosen.map((a: { slug: string }) => bySlug.get(a.slug) ?? a);

    const tags = new Map<string, string[]>();
    const asked: string[] = [];
    for (let i = 0; i < articles.length; i += PER_CALL) {
      const batch = articles.slice(i, i + PER_CALL);
      try {
        const raw = await llmJSON<unknown>(TAG_SYSTEM, buildTagPrompt(batch), {
          maxTokens: 900,
          temperature: 0,
          // Gemini first, like the Për ty summaries: the Groq chat model shares a
          // 7000-token-a-minute budget with Pyet, and tagging the archive would
          // spend it. The fallback is a Groq model Pyet does not lead with.
          prefer: "gemini",
          groqModels: TAG_GROQ,
          geminiModels: ["gemini-2.5-flash", "gemini-flash-latest"],
          timeoutMs: 25_000,
        });
        for (const [slug, t] of cleanTags(raw, batch)) tags.set(slug, t);
        asked.push(...batch.map((a: { slug: string }) => a.slug));
      } catch (err) {
        // The model is down or out of quota: nothing is counted against these
        // articles, and the next run asks again.
        console.error("[kerko] topic tags: model unavailable", err instanceof Error ? err.message : err);
      }
    }
    if (!asked.length) return { tagged: 0, error: "model-unavailable" };

    // Read again just before writing: the model calls take up to a minute, and a
    // heartbeat that overlapped this one may have saved its own tags meanwhile.
    const { index: latest } = await readIndex(admin);
    const next = withTags(latest, tags, asked, now.getTime());
    await admin.storage
      .from(TAG_BUCKET)
      .upload(INDEX_PATH, Buffer.from(JSON.stringify(next)), { contentType: "application/json", upsert: true });
    return { tagged: tags.size, skipped: asked.length - tags.size };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** slug → topic ids for the search. An empty map when anything is off: the search falls back to words. */
export async function getTopicTags(): Promise<Map<string, string[]>> {
  try {
    const admin = createAdminClient();
    if (!admin) return new Map();
    const { index } = await readIndex(admin);
    return tagMap(index);
  } catch {
    return new Map();
  }
}
