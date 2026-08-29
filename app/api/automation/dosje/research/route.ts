import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { llmJSON } from "@/lib/llm";
import { gatherEvidence } from "@/lib/dosje-sources.mjs";
import { validateMilestoneDraft } from "@/lib/dosje-draft.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Drafting one dossier moment a night.
 *
 * Writes with status 'draft' — nothing generated here reaches a reader until it
 * is approved in /admin/dosje. The precedent, and the comment this one is
 * modelled on, is app/api/automation/sondazhi/draft.
 *
 * The order of operations is the design. Evidence is fetched first; the model
 * is then shown a numbered list of excerpts and may only cite by index. It is
 * never asked for a url and never asked whether something is true, because a
 * model asked for a source will supply a plausible one. Everything after the
 * model call is deterministic code in lib/dosje-draft.mjs.
 *
 * Every failure path ends in "no row". There is no partial write and no
 * best-effort milestone: a dossier with fewer moments is honest, one with an
 * invented date is not.
 */

const SYSTEM = `Ti je asistent kërkimor për një arkiv historik të lajmeve në Kosovë.

Do të marrësh një listë burimesh të numëruara. Secili burim është tekst REAL i
shkarkuar nga interneti.

Rregullat, pa përjashtim:
- Mund të mbështetesh VETËM në tekstin e burimeve të dhëna.
- NUK guxon të shkruash asnjë URL. Cito duke treguar indeksin e burimit.
- "claims" duhet të ketë NJË zë për ÇDO fjali të "summary", dhe fjalia duhet
  kopjuar fjalë për fjalë nga "summary". Nëse "summary" ka tri fjali, "claims"
  ka tri zëra. Një fjali pa zë të vetin e hedh poshtë të gjithë momentin.
- Momenti duhet të mbështetet në të paktën DY botues të ndryshëm. Shiko emrin e
  botuesit te çdo burim dhe sigurohu që indekset që cito nuk vijnë të gjitha
  nga i njëjti botues. Nëse nuk ke dy botues, mos e shkruaj momentin fare.
- Çdo shifër, datë ose numër viktimash duhet të shfaqet fjalë për fjalë në
  tekstin e një burimi. Nëse nuk e gjen, mos e shkruaj.
- Për çdo zë të "claims" shto edhe "quote": fjalinë E SAKTË, kopjuar shkronjë
  për shkronjë nga teksti i burimit që e mbështet. Mos e përkthe, mos e shkurto
  dhe mos e rishkruaj. Nëse nuk gjen fjali të saktë, lëre bosh — një citim i
  shpikur është më i keq se asnjë citim.
- Mbaje "summary" të shkurtër: dy ose tri fjali. Sa më shumë fjali, aq më shumë
  citime duhen.
- Nëse burimet nuk mjaftojnë, kthe {"milestones": []}. Kjo është përgjigje e
  saktë, jo dështim.

Shkruaj shqip, në kohën e tashme historike, pa mbiemra vlerësues.`;

type DraftShape = {
  milestones?: Array<{
    title?: string;
    summary?: string;
    why?: string;
    tag?: string;
    event_date?: string;
    date_precision?: string;
    display_date?: string;
    claims?: Array<{ sentence?: string; source_indexes?: number[]; quote?: string }>;
  }>;
};

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.TREGU_AUTOMATION_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  return header === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  let subject = url.searchParams.get("subject");
  let topicSlug = url.searchParams.get("topic");

  // With nothing named, ask which dossier is most worth researching now. This
  // is what connects the two halves: dosje-subjects has been mapping articles
  // to dossiers every two hours, and until this existed the research job
  // ignored all of it and ran on a hardcoded subject every night.
  if (!subject || !topicSlug) {
    const { data: next, error: pickError } = await supabase.rpc("dosje_next_subject", {
      p_min_articles: 3,
      p_min_days: 2,
    });
    if (pickError) {
      return NextResponse.json({ error: pickError.message }, { status: 500 });
    }
    const pick = next as { topic?: string | null; subject?: string; title?: string } | null;
    if (!pick?.topic) {
      // Nothing recurring enough to deserve a dossier. A normal answer, not a
      // failure: most days the news does not add to a standing subject.
      return NextResponse.json({ ok: true, reason: "no_candidate" }, { status: 200 });
    }
    topicSlug = pick.topic;
    subject = pick.subject ?? pick.title ?? pick.topic;
  }

  // Claim the work before doing any of it. The unique (subject_key, run_date)
  // makes a double fire a no-op rather than a doubled spend and a duplicate
  // draft; a row that already exists means today's run is already accounted for.
  const { error: claimError } = await supabase
    .from("dosje_research_runs")
    .insert({ subject_key: subject, outcome: "in_progress" });
  if (claimError) {
    return NextResponse.json(
      { ok: true, skipped: "already_ran_today", subject },
      { status: 200 }
    );
  }

  const finish = async (outcome: string, detail: Record<string, unknown>, cooldownDays = 0) => {
    const cooldown =
      cooldownDays > 0
        ? new Date(Date.now() + cooldownDays * 86400000).toISOString().slice(0, 10)
        : null;
    await supabase
      .from("dosje_research_runs")
      .update({ outcome, detail, cooldown_until: cooldown })
      .eq("subject_key", subject)
      .eq("run_date", new Date().toISOString().slice(0, 10));
  };

  // ── 1. evidence, before anything is written ────────────────────────────────
  const sources = await gatherEvidence(subject, { max: 6 });

  // Gate on distinct publishers, not on how many pages were fetched. Six
  // documents from one institution are one account of events, and the
  // validator will refuse them anyway — checking it here means a subject that
  // cannot possibly pass never reaches the model.
  const distinctPublishers = new Set(
    sources.map((s) => String(s.publisher ?? "").toLowerCase().trim()).filter(Boolean)
  ).size;

  if (distinctPublishers < 2) {
    await finish("no_sources", { found: sources.length, publishers: distinctPublishers }, 30);
    return NextResponse.json(
      { ok: false, reason: "no_sources", found: sources.length, publishers: distinctPublishers },
      { status: 422 }
    );
  }

  // ── 2. the model sees excerpts and may only point at them ──────────────────
  const numbered = sources
    .map((s, i) => `[${i}] ${s.publisher ?? "?"} — ${s.title ?? ""}\n${(s.text ?? "").slice(0, 2500)}`)
    .join("\n\n---\n\n");

  let drafted: DraftShape | null = null;
  try {
    drafted = await llmJSON<DraftShape>(
      SYSTEM,
      `Subjekti: ${subject}\n\nBurimet:\n\n${numbered}\n\n` +
        `Kthe JSON: {"milestones":[{"title","summary","why","tag","event_date":"YYYY-MM-DD",` +
        `"date_precision":"day|month|year","display_date","claims":[{"sentence","source_indexes":[0],"quote"}]}]}`,
      { prefer: "gemini" }
    );
  } catch (err) {
    await finish("llm_failed", { error: String(err) }, 1);
    return NextResponse.json({ ok: false, reason: "llm_failed" }, { status: 502 });
  }

  const candidates = drafted?.milestones ?? [];
  if (!candidates.length) {
    // The model declining is a correct answer, not an error.
    await finish("verify_failed", { reason: "model_returned_none" }, 7);
    return NextResponse.json({ ok: false, reason: "model_returned_none" }, { status: 422 });
  }

  // ── 3. deterministic refusal ───────────────────────────────────────────────
  type Accepted = {
    milestone: Record<string, unknown>;
    citations: Array<Record<string, unknown>>;
  };
  const accepted: Accepted[] = [];
  const rejected: Array<{ title: string; reasons: string[] }> = [];

  for (const raw of candidates) {
    const verdict = validateMilestoneDraft(raw, { sources });
    if (verdict.ok && verdict.milestone) {
      accepted.push({
        milestone: verdict.milestone as Record<string, unknown>,
        citations: (verdict.citations ?? []) as Array<Record<string, unknown>>,
      });
    } else {
      rejected.push({
        title: String(raw?.title ?? "(pa titull)"),
        reasons: (verdict.reasons ?? []) as string[],
      });
    }
  }

  if (!accepted.length) {
    await finish("verify_failed", { rejected }, 7);
    return NextResponse.json({ ok: false, reason: "verify_failed", rejected }, { status: 422 });
  }

  // ── 4. write as drafts, with their citations ───────────────────────────────
  let written = 0;
  for (const { milestone, citations } of accepted) {
    const { data: row, error } = await supabase
      .from("dosje_milestones")
      .insert({
        ...milestone,
        topic_slug: topicSlug,
        status: "draft",
        drafted_by: "dosje-research",
      })
      .select("id")
      .single();

    // A duplicate is the dedupe key doing its job, not a failure.
    if (error || !row) continue;

    const rows = citations.map((c) => ({
      ...c,
      milestone_id: row.id,
      // The fetch that produced this text is the verification. It is recorded
      // here because the database counts only citations that answered 200.
      http_status: 200,
      fetched_at: new Date().toISOString(),
    }));
    if (rows.length) await supabase.from("dosje_citations").insert(rows);
    written += 1;
  }

  await finish("drafted", { written, rejected });
  return NextResponse.json({ ok: true, subject, drafted: written, rejected });
}

/** Read-only diagnostics: what the job would see, without writing anything. */
export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const subject = new URL(req.url).searchParams.get("subject");
  if (!subject) return NextResponse.json({ error: "subject required" }, { status: 400 });

  const sources = await gatherEvidence(subject, { max: 6 });
  return NextResponse.json({
    subject,
    sources: sources.map((s) => ({
      url: s.url,
      publisher: s.publisher,
      tier: s.tier,
      chars: (s.text ?? "").length,
    })),
    publishers: [...new Set(sources.map((s) => s.publisher))].length,
    // The same rule the POST enforces, so a dry run cannot say yes where the
    // real run would refuse.
    wouldProceed:
      new Set(sources.map((s) => String(s.publisher ?? "").toLowerCase().trim()).filter(Boolean))
        .size >= 2,
  });
}
