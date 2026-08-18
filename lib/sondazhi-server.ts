import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  dateKeyInKosovo,
  previousDateKey,
  pollFromRow,
  tallyFromCounts,
  yesterdayCallback,
} from "./sondazhi-data.mjs";
import { getDefaultPoll } from "./polls-data";

/**
 * Server-side data for Sondazhi i Ditës.
 *
 * The card used to fetch everything from the browser, which meant it painted an
 * empty "Duke ngarkuar..." box on every load and only became a poll after
 * hydration — about five seconds on this homepage. The question and yesterday's
 * result are known at request time and never change within a day, so they are
 * rendered on the server. Only the live tally and "have I voted" are left to the
 * client, because those are the only parts that are actually live.
 */

export interface SondazhiCallback {
  pct: number;
  option: string;
  slug: string | null;
  question: string;
}

export interface SondazhiServerData {
  todayKey: string;
  pollDate: string;
  question: string;
  options: string[];
  contextLine: string | null;
  sourceArticleSlug: string | null;
  /** What the room decided yesterday. Null when there is nothing honest to say. */
  callback: SondazhiCallback | null;
}

function newsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Today's poll plus yesterday's outcome, in one round trip for the rows and one
 * for yesterday's tally.
 *
 * Every failure path lands on the static question bank rather than on an empty
 * card: a curated poll is an enhancement, and the homepage has to render whether
 * or not Supabase is reachable.
 */
export async function getSondazhiData(
  todayKey: string = dateKeyInKosovo()
): Promise<SondazhiServerData> {
  const prevKey = previousDateKey(todayKey);
  const fallback = getDefaultPoll(todayKey);

  const base: SondazhiServerData = {
    todayKey,
    pollDate: todayKey,
    question: fallback.question,
    options: fallback.options,
    contextLine: null,
    sourceArticleSlug: null,
    callback: null,
  };

  const supabase = newsClient();
  if (!supabase) return base;

  try {
    const { data: rows, error } = await supabase
      .from("daily_polls")
      .select("poll_date, question, options, context_line, source_article_slug, status")
      .in("poll_date", [todayKey, prevKey]);

    if (error) throw new Error(error.message);

    const todayRow = rows?.find((r) => r.poll_date === todayKey) ?? null;
    const prevRow = rows?.find((r) => r.poll_date === prevKey) ?? null;

    const todayPoll = pollFromRow(todayRow);
    // A draft is a question waiting for review, not a published one. It must
    // never reach a reader just because its date arrived.
    if (todayPoll && todayPoll.status !== "draft") {
      base.pollDate = todayPoll.pollDate;
      base.question = todayPoll.question;
      base.options = todayPoll.options;
      base.contextLine = todayPoll.contextLine ?? null;
      base.sourceArticleSlug = todayPoll.sourceArticleSlug ?? null;
    }

    const prevPoll = pollFromRow(prevRow);
    if (prevPoll && prevPoll.status !== "draft") {
      const { data: prevCounts } = await supabase.rpc("sondazhi_day", {
        p_date: prevKey,
        p_voter: null,
      });
      const tally = tallyFromCounts(
        (prevCounts as { counts?: Record<string, unknown> } | null)?.counts,
        prevPoll.options.length
      );
      const cb = yesterdayCallback(prevPoll, tally.counts);
      if (cb) base.callback = { ...cb, question: prevPoll.question };
    }
  } catch (error) {
    // The static bank still carries the day. Logged rather than swallowed —
    // silently rendering an empty poll is how this card stayed broken before.
    console.error("[sondazhi] poll unavailable; using the static question bank", error);
  }

  return base;
}
