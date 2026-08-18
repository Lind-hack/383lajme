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


type PollRow = Record<string, unknown> & { poll_date?: string };

/** One query, reported as a result rather than a throw so the caller can retry
 *  with a narrower column list against a table that predates this migration. */
async function selectPolls(
  supabase: ReturnType<typeof newsClient> & object,
  columns: string,
  todayKey: string,
  prevKey: string
): Promise<{ ok: true; data: PollRow[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("daily_polls")
    .select(columns)
    .in("poll_date", [todayKey, prevKey]);
  if (error) return { ok: false, error: error.message };
  // .select() with a runtime column string widens to a union that includes
  // GenericStringError, so this needs the two-step cast.
  return { ok: true, data: (data ?? []) as unknown as PollRow[] };
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
    // The columns this feature added exist only after migration 0042. Until it
    // is applied, asking for them fails the whole query — which would silently
    // replace a curated question with one from the static bank. So a failure
    // retries with the columns the table has always had: the card degrades to
    // "no context line" rather than to the wrong question.
    let rows = await selectPolls(
      supabase,
      "poll_date, question, options, context_line, source_article_slug, status",
      todayKey,
      prevKey
    );
    if (!rows.ok) {
      console.warn("[sondazhi] extended columns unavailable; falling back", rows.error);
      rows = await selectPolls(supabase, "poll_date, question, options", todayKey, prevKey);
    }
    if (!rows.ok) throw new Error(rows.error);
    const { data: pollRows } = rows;

    const todayRow = pollRows?.find((r) => r.poll_date === todayKey) ?? null;
    const prevRow = pollRows?.find((r) => r.poll_date === prevKey) ?? null;

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
      const { data: prevCounts, error: rpcError } = await supabase.rpc("sondazhi_day", {
        p_date: prevKey,
        p_voter: null,
      });
      // Pre-migration the function is absent. Skip the callback rather than
      // throw: losing yesterday's strip is a missing flourish, but throwing
      // here would also discard today's curated question on the way out.
      if (rpcError) {
        console.warn("[sondazhi] yesterday's tally unavailable", rpcError.message);
      } else {
        const tally = tallyFromCounts(
          (prevCounts as { counts?: Record<string, unknown> } | null)?.counts,
          prevPoll.options.length
        );
        const cb = yesterdayCallback(prevPoll, tally.counts);
        if (cb) base.callback = { ...cb, question: prevPoll.question };
      }
    }
  } catch (error) {
    // The static bank still carries the day. Logged rather than swallowed —
    // silently rendering an empty poll is how this card stayed broken before.
    console.error("[sondazhi] poll unavailable; using the static question bank", error);
  }

  return base;
}
