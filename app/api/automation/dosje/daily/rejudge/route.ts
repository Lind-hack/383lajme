import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { revalidateStored } from "@/lib/dosje-draft.mjs";
import { judgeMoment } from "@/lib/dosje-judge-server";
import { admin, authorised } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Re-judge every published moment under the current rules.
 *
 * The rules tightened after moments were already live (3 Nov 2026: a moment
 * must be an event on its date and belong to its dossier). Each approved
 * moment is checked again against its stored quotes (revalidateStored) and by
 * the second reader; one that fails is hidden (needs_source), and a dossier
 * left with no approved moment goes back to draft. Every change lands in
 * dosje_changes, so the next email lists it. A moment the judge could not
 * reach is left as it is and reported, not hidden on a network error.
 */
export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = admin();
  const { data: topics, error: topicError } = await db.from("dosje_topics").select("slug, title").eq("status", "approved");
  if (topicError) return NextResponse.json({ ok: false, reason: topicError.message }, { status: 500 });
  const title = new Map((topics ?? []).map((t) => [String(t.slug), String(t.title)]));
  if (!title.size) return NextResponse.json({ ok: true, checked: 0, hidden: [], kept: [], unreachable: [] });

  const { data: rows, error } = await db
    .from("dosje_milestones")
    .select("id, topic_slug, title, summary, why, tag, event_date, date_precision, claims")
    .eq("status", "approved")
    .in("topic_slug", [...title.keys()]);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });

  const started = Date.now();
  const hidden: Array<{ topic: string; title: string; reasons: string[] }> = [];
  const kept: string[] = [];
  const unreachable: string[] = [];
  for (const row of rows ?? []) {
    if (Date.now() - started > 240_000) {
      unreachable.push(`${row.title} (koha mbaroi; provohet herën tjetër)`);
      continue;
    }
    const recheck = revalidateStored(row);
    let reasons: string[] = [];
    if (!recheck.ok) {
      reasons = recheck.reasons as string[];
    } else {
      const judged = await judgeMoment(recheck.milestone, { kind: "moment", topic: title.get(String(row.topic_slug)) });
      if (judged.problems.some((p) => p.startsWith("judge unavailable"))) {
        unreachable.push(String(row.title));
        continue;
      }
      reasons = judged.ok ? [] : judged.problems;
    }
    if (!reasons.length) {
      kept.push(String(row.title));
      continue;
    }
    const { error: hideError } = await db.from("dosje_milestones").update({ status: "needs_source" }).eq("id", row.id);
    if (hideError) {
      unreachable.push(`${row.title} (${hideError.message})`);
      continue;
    }
    hidden.push({ topic: String(row.topic_slug), title: String(row.title), reasons });
  }

  // A dossier with nothing verified left is not shown as a dossier.
  const emptied: string[] = [];
  for (const slug of new Set(hidden.map((h) => h.topic))) {
    const { count } = await db
      .from("dosje_milestones")
      .select("id", { count: "exact", head: true })
      .eq("topic_slug", slug)
      .eq("status", "approved");
    if (!count) {
      await db.from("dosje_topics").update({ status: "draft", updated_at: new Date().toISOString() }).eq("slug", slug);
      emptied.push(slug);
    }
    revalidatePath(`/dosje/${slug}`);
  }
  if (hidden.length) revalidatePath("/dosje");

  return NextResponse.json({ ok: true, checked: (rows ?? []).length, hidden, kept, unreachable, emptied });
}
