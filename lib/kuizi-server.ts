import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getArticlesBefore, getArticlesBySlugs, getLatestArticles } from "./db";
import { llmJSON } from "./llm";
import { KOSOVO_TZ, KOSOVO_TZ_FALLBACK, dateKeyInKosovo, shiftDateKey } from "./reagimi-data";
import { createAdminClient } from "./supabase/admin";
import { generateQuiz } from "./kuizi-draft.mjs";
import { STALE_DAYS, isStoredQuiz, pickDisplayQuiz, type QuizQuestion } from "./kuizi-data.mjs";

/**
 * Server side of Kuizi i Ditës: building and publishing the day's quiz, and
 * reading the one the homepage shows.
 *
 * The quiz is rendered on the server with the page. Only "have I played" and
 * the other readers' results are left to the client, because those are the
 * only live parts.
 */

/** llm.ts has no timeout of its own; a hung provider must not hold the run. */
const LLM_TIMEOUT_MS = 55_000;

export interface KuiziServerData {
  dateKey: string;
  todayKey: string;
  isToday: boolean;
  questions: QuizQuestion[];
}

/**
 * The articles a quiz at `now` may draw on, with bodies (the validator checks
 * answers against them). `replay` reads an earlier window for dry runs; the
 * live path reads the newest articles.
 */
async function articlesFor(now: Date, replay: boolean) {
  if (!replay) return getLatestArticles(120);
  const page = await getArticlesBefore({ before: new Date(now.getTime() + 3600_000).toISOString(), limit: 150 });
  const full = await getArticlesBySlugs(page.map((a) => a.slug));
  return full.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** Generate the quiz for `now` from the 24 hours before it, writing nothing. */
export async function buildKuizi(now: Date, { replay = false }: { replay?: boolean } = {}) {
  const dateKey = dateKeyInKosovo(now);
  const articles = await articlesFor(now, replay);
  const result = await generateQuiz(articles, {
    now,
    dateKey,
    ask: (system: string, user: string) =>
      Promise.race([
        llmJSON<unknown>(system, user, { maxTokens: 7000, temperature: 0.5, prefer: "gemini" }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`LLM timeout ${LLM_TIMEOUT_MS}ms`)), LLM_TIMEOUT_MS)
        ),
      ]),
  });
  return { dateKey, result };
}

export type PublishOutcome =
  | { status: 200; dateKey: string; published: true; rejected: string[] }
  | { status: 200; dateKey: string; skipped: "exists" }
  | { status: 422; dateKey: string; reason: string; rejected: string[] }
  | { status: 500 | 502; dateKey: string; error: string };

/**
 * Publish today's quiz unless one already exists for today (published,
 * edited or rejected by the admin — none of those may be overwritten by a
 * machine). A refusal writes nothing; the card then shows yesterday's quiz
 * under its own date, or nothing.
 */
export async function publishKuizi(supabase: SupabaseClient, now: Date): Promise<PublishOutcome> {
  const dateKey = dateKeyInKosovo(now);

  const existing = await supabase
    .from("kuizi_daily")
    .select("kuiz_date")
    .eq("kuiz_date", dateKey)
    .maybeSingle();
  if (existing.error) return { status: 500, dateKey, error: existing.error.message };
  if (existing.data) return { status: 200, dateKey, skipped: "exists" };

  let built;
  try {
    built = await buildKuizi(now);
  } catch (err) {
    return { status: 502, dateKey, error: err instanceof Error ? err.message : String(err) };
  }
  const { result } = built;
  if (!result.ok) return { status: 422, dateKey, reason: result.reason, rejected: result.rejected };

  // Insert, not upsert: a row that appeared meanwhile (admin, a parallel run)
  // wins, and the unique key turns this into a harmless conflict.
  const { error } = await supabase.from("kuizi_daily").insert({
    kuiz_date: dateKey,
    questions: result.questions,
    status: "published",
    source: "auto",
  });
  if (error && error.code !== "23505") return { status: 500, dateKey, error: error.message };
  if (error) return { status: 200, dateKey, skipped: "exists" };
  return { status: 200, dateKey, published: true, rejected: result.rejected };
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * The quiz the card shows: today's, else yesterday's labelled with its own
 * date, else null (the section is hidden). RLS only exposes published rows.
 */
export async function getKuiziData(
  todayKey: string = dateKeyInKosovo()
): Promise<KuiziServerData | null> {
  const supabase = publicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("kuizi_daily")
    .select("kuiz_date, questions")
    .gte("kuiz_date", shiftDateKey(todayKey, -STALE_DAYS))
    .lte("kuiz_date", todayKey)
    .order("kuiz_date", { ascending: false })
    .limit(2);
  if (error || !data) return null;

  const rows = data
    .filter((r) => isStoredQuiz(r?.questions))
    .map((r) => ({ dateKey: String(r.kuiz_date), questions: r.questions as QuizQuestion[] }));
  const pick = pickDisplayQuiz(rows, todayKey);
  return pick ? { ...pick, todayKey } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily schedule
//
// The Tregu heartbeat calls this every two minutes. publishKuizi already
// refuses to touch a day that has a quiz, so the guards here only bound the
// cost of a day that keeps failing: one run at a time, thirty minutes apart,
// four tries a day. In memory is enough for one Railway instance; a deploy
// resets it, which at worst spends one extra try.
// ─────────────────────────────────────────────────────────────────────────────

const PUBLISH_FROM_HOUR = 6;
const RETRY_GAP_MS = 30 * 60_000;
const MAX_TRIES_PER_DAY = 4;

const schedule = { inFlight: false, day: "", tries: 0, lastTry: 0 };

function kosovoHour(now: Date): number {
  for (const timeZone of [KOSOVO_TZ, KOSOVO_TZ_FALLBACK]) {
    try {
      return Number(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now)
      );
    } catch {
      /* Older ICU without Europe/Pristina: try the fallback zone. */
    }
  }
  return now.getUTCHours() + 1;
}

/** Heartbeat job: publish today's quiz once, from 06:00 Kosovo time. */
export async function runKuiziDaily(now = new Date()) {
  if (kosovoHour(now) < PUBLISH_FROM_HOUR) return { skipped: "early" as const };
  const day = dateKeyInKosovo(now);
  if (schedule.day !== day) Object.assign(schedule, { day, tries: 0, lastTry: 0 });
  if (schedule.inFlight) return { skipped: "in_flight" as const };
  if (schedule.tries >= MAX_TRIES_PER_DAY) return { skipped: "tries_used" as const };
  if (now.getTime() - schedule.lastTry < RETRY_GAP_MS) return { skipped: "backoff" as const };

  const supabase = createAdminClient();
  if (!supabase) return { skipped: "no_service_role" as const };

  schedule.inFlight = true;
  try {
    const outcome = await publishKuizi(supabase, now);
    // A day that already has a quiz costs nothing, so it does not use a try.
    if (!("skipped" in outcome)) {
      schedule.tries += 1;
      schedule.lastTry = now.getTime();
      console.log("[kuizi] daily run", JSON.stringify(outcome).slice(0, 600));
    } else {
      schedule.tries = MAX_TRIES_PER_DAY;
    }
    return outcome;
  } finally {
    schedule.inFlight = false;
  }
}
