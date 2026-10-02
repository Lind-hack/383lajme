// Sends "Edicioni yt i mëngjesit" at 07:00 Kosovo time to every browser that
// turned it on. Run from the two-minute heartbeat (runLiveSportsAutomation in
// lib/tregu-automation-server.ts); outside the 07:00 hour it does nothing.
//
// Rows are claimed first — today's date written before any push goes out — so
// two overlapping heartbeats never send the same morning twice. The push is
// empty; see lib/perty-morning.mjs for what the reader then sees.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmptyPush } from "@/lib/web-push";
import { vapidKeys } from "@/lib/tregu-rivalry-server";
import { isMorningWindow, kosovoNow } from "@/lib/perty-morning.mjs";

/** Pushes in flight at once: enough to finish in seconds, gentle on the push services. */
const PARALLEL = 25;

export async function runMorningEditionPush(now = new Date()) {
  if (!isMorningWindow(now)) return { skipped: "not-morning" };
  const admin = createAdminClient();
  if (!admin) return { skipped: "no-admin" };
  const keys = await vapidKeys(admin);
  if (!keys) return { skipped: "no-vapid-keys" };

  const { date } = kosovoNow(now);
  const { data, error } = await admin
    .from("perty_push_subscriptions")
    .update({ last_sent_on: date, last_sent_at: now.toISOString() })
    .or(`last_sent_on.is.null,last_sent_on.lt.${date}`)
    .select("endpoint");
  if (error) throw new Error(`morning claim: ${error.message}`);

  const endpoints = (data ?? []).map((row) => row.endpoint as string);
  let sent = 0;
  const gone: string[] = [];
  for (let i = 0; i < endpoints.length; i += PARALLEL) {
    const results = await Promise.allSettled(endpoints.slice(i, i + PARALLEL).map((e) => sendEmptyPush(e, keys)));
    results.forEach((result, j) => {
      if (result.status !== "fulfilled") return; // one device failing must not stop the others
      if (result.value === "gone") gone.push(endpoints[i + j]);
      else sent += 1;
    });
  }
  // Browsers that unsubscribed are forgotten.
  if (gone.length) await admin.from("perty_push_subscriptions").delete().in("endpoint", gone);
  return { claimed: endpoints.length, sent, removed: gone.length };
}
