import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSource } from "@/lib/dosje-sources.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Checking that the evidence still answers.
 *
 * Every other guard in this feature runs once, at the moment a claim is
 * written. This one exists because the guarantee has to keep being true
 * afterwards: a citation fetched today is a live source, and in a year it may
 * be a 404 while the dossier still asserts the claim and the badge still
 * promises two verified sources.
 *
 * That is a quieter failure than a wrong date and, over time, a worse one. It
 * degrades on its own, nobody is notified, and the reader who follows a link to
 * check something is the first to find out.
 *
 * One failure is not evidence. Newsrooms have bad afternoons, rate limits and
 * maintenance windows, so a citation is only treated as gone after several
 * consecutive failures; a single success resets the count. When a moment falls
 * below two live publishers it is demoted to needs_source and comes off the
 * site — not rejected, because nothing about it was judged wrong. Its evidence
 * stopped answering, and an editor can repair it.
 */

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.TREGU_AUTOMATION_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}` || new URL(req.url).searchParams.get("secret") === secret;
}

/** Consecutive failures before a link is treated as gone rather than unlucky. */
const DEAD_AFTER = 3;

type CitationRow = {
  id: string;
  milestone_id: string;
  url: string;
  publisher: string | null;
  fail_count: number | null;
};

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 25);

  // Oldest checks first, so every citation comes round in turn rather than the
  // job re-checking the same handful every night.
  const { data, error } = await supabase
    .from("dosje_citations")
    .select("id, milestone_id, url, publisher, fail_count")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as CitationRow[];
  const touched = new Set<string>();
  let ok = 0;
  let failed = 0;
  const newlyDead: Array<{ url: string; publisher: string | null; fails: number }> = [];

  for (const c of rows) {
    const res = await fetchSource(c.url, { timeoutMs: 10000 });
    const alive = res.http_status === 200 && (res.text ?? "").length > 0;
    touched.add(c.milestone_id);

    if (alive) {
      ok += 1;
      await supabase
        .from("dosje_citations")
        .update({
          http_status: 200,
          fetched_at: new Date().toISOString(),
          last_ok_at: new Date().toISOString(),
          // A single success clears the record: the link works, and how it
          // behaved last month is no longer interesting.
          fail_count: 0,
        })
        .eq("id", c.id);
      continue;
    }

    failed += 1;
    const fails = (c.fail_count ?? 0) + 1;
    await supabase
      .from("dosje_citations")
      .update({
        http_status: res.http_status,
        fetched_at: new Date().toISOString(),
        fail_count: fails,
        // Rotation is ordered by last_checked_at, which a failure advances,
        // rather than by last_ok_at, which it must not. Ordering on last_ok_at
        // kept every dead link sorted first forever — once the corpses
        // outnumbered the weekly slice, the job re-fetched only those and no
        // live citation was ever re-checked again. But last_ok_at is shown to
        // the reader as the date this source last answered, so stamping it
        // here would put a verification date on a dead link.
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    // Report on the crossing and on anything already past it, so a changed
    // threshold or a hand-edited row cannot slip by unannounced.
    if (fails >= DEAD_AFTER) {
      newlyDead.push({ url: c.url, publisher: c.publisher, fails });
    }
  }

  // Re-count each affected moment. The demotion decision lives in the database
  // so it holds however it is reached — this job, a manual edit, or anything
  // written later.
  const demoted: string[] = [];
  for (const milestoneId of touched) {
    const { data: verdict } = await supabase.rpc("dosje_reverify", {
      p_milestone: milestoneId,
      p_dead_after: DEAD_AFTER,
    });
    const v = verdict as { ok?: boolean; now?: string } | null;
    if (v && v.ok === false && v.now === "needs_source") demoted.push(milestoneId);
  }

  return NextResponse.json({
    ok: true,
    checked: rows.length,
    stillLive: ok,
    failedThisRun: failed,
    newlyDead,
    momentsDemoted: demoted.length,
  });
}

/** Read-only: how stale the evidence is, without touching anything. */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await supabase
    .from("dosje_citations")
    .select("url, publisher, last_ok_at, fail_count, http_status")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    url: string;
    publisher: string | null;
    last_ok_at: string | null;
    fail_count: number | null;
  }>;

  const cutoff = Date.now() - 30 * 86400000;
  return NextResponse.json({
    total: rows.length,
    neverChecked: rows.filter((r) => !r.last_ok_at).length,
    staleOver30Days: rows.filter((r) => r.last_ok_at && Date.parse(r.last_ok_at) < cutoff).length,
    failing: rows.filter((r) => (r.fail_count ?? 0) > 0).length,
    atRisk: rows.filter((r) => (r.fail_count ?? 0) >= DEAD_AFTER - 1).map((r) => r.publisher),
  });
}
