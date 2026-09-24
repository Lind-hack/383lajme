// Keeps a signed-in reader's "Për ty" choices the same on every device.
//
// The device copy (lib/interests.mjs) is always the one the page reads, so the
// feed never waits on the network and keeps working when the database does not.
// Sync is layered on top:
//
//   - once per browser session, after sign-in, the device choices are MERGED
//     with the account's (a union — neither side overwrites the other);
//   - after that, each edit is written through as-is, so removing a topic on
//     one device removes it everywhere.
//
// Only explicit choices travel. Learned reading affinity stays on the device.
// Every failure here is swallowed on purpose: a missing table, a 402 from a
// restricted project or a dropped connection must cost the reader sync, never
// the feed.

import { createClient } from "@/lib/supabase/client";
import { normalizeInterests, readInterests, writeInterests, type Interests } from "@/lib/interests.mjs";

const MERGED_KEY = "383:interests-merged";

type Synced = Pick<Interests, "categories" | "topics" | "people" | "cities">;

function pick(i: Interests): Synced {
  return { categories: i.categories, topics: i.topics, people: i.people, cities: i.cities };
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function mergedThisSession(userId: string): boolean {
  try {
    return sessionStorage.getItem(MERGED_KEY) === userId;
  } catch {
    return false;
  }
}

function markMerged(userId: string) {
  try {
    sessionStorage.setItem(MERGED_KEY, userId);
  } catch {
    // Without session storage the merge simply runs again next load; it is a
    // union, so repeating it is harmless.
  }
}

/**
 * Merge device and account choices once per session. Returns the merged
 * interests (also written to the device), or null when there is no signed-in
 * reader or sync is unavailable.
 */
export async function mergeOnSignIn(): Promise<Interests | null> {
  const userId = await currentUserId();
  if (!userId || mergedThisSession(userId)) return null;

  const local = readInterests();
  try {
    const { data, error } = await createClient().rpc("merge_reader_interests", {
      p_categories: local.categories,
      p_topics: local.topics,
      p_people: local.people,
      p_cities: local.cities,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    // The account copy may predate the current vocabulary, so it goes through
    // the same normaliser as anything read from storage.
    const merged = normalizeInterests({
      ...local,
      categories: row?.categories ?? local.categories,
      topics: row?.topics ?? local.topics,
      people: row?.people ?? local.people,
      cities: row?.cities ?? local.cities,
    });
    writeInterests(merged);
    markMerged(userId);
    return readInterests();
  } catch {
    return null;
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Write the reader's explicit choices to their account, debounced. */
export function pushInterests(interests: Interests) {
  if (pending) clearTimeout(pending);
  pending = setTimeout(async () => {
    pending = null;
    const userId = await currentUserId();
    // Before the merge has run, a write-through would replace the account's
    // choices with this device's and lose whatever was picked elsewhere.
    if (!userId || !mergedThisSession(userId)) return;
    try {
      await createClient()
        .from("reader_interests")
        .upsert({ user_id: userId, ...pick(interests), updated_at: new Date().toISOString() });
    } catch {
      // Sync is best-effort; the device copy is already saved.
    }
  }, 800);
}
