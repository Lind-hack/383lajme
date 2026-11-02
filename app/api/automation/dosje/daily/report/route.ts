import { NextResponse } from "next/server";
import { buildDosjeReport, shouldSendReport } from "@/lib/dosje-report.mjs";
import { pendingChanges, markEmailed, type DosjeChange } from "@/lib/dosje-changes-server";
import { sendMail } from "@/lib/mailer";
import { authorised } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OWNER = "lindsylqa@gmail.com";

/**
 * The last step of the daily dossier run: one email to the owner.
 *
 * Sent every run, including a quiet one, so silence always means the run did
 * not happen. Goes through the operator queue in lib/mailer.ts (the VPS
 * delivers it over SMTP), never the transactional quota. The idempotency key
 * is the run's own id, so a retried report is not a second email.
 */
export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const run = (await req.json().catch(() => null)) as Parameters<typeof buildDosjeReport>[0] & { runId?: string } | null;
  if (!run?.date) return NextResponse.json({ ok: false, reason: "run_required" }, { status: 400 });

  // Every reader-visible change since the last email (migration 0119). A read
  // failure is itself worth an email, so it becomes a run error, not a crash.
  let changes: DosjeChange[] = [];
  try {
    changes = await pendingChanges();
  } catch (err) {
    run.errors = [...(run.errors ?? []), `ndryshimet nuk u lexuan: ${String(err).slice(0, 160)}`];
  }
  const withChanges = { ...run, changes };
  const { subject, html, text } = buildDosjeReport(withChanges);
  if (run.mode === "dry-run") return NextResponse.json({ ok: true, sent: false, subject, text });
  // Lind's rule: no email on a healthy run where nothing changed.
  if (!shouldSendReport(withChanges)) return NextResponse.json({ ok: true, sent: false, reason: "nothing_changed", subject });

  try {
    const { via } = await sendMail({
      purpose: "operator",
      to: OWNER,
      subject,
      html,
      text,
      idempotencyKey: `dosje-daily:${run.runId ?? run.date}`,
    });
    await markEmailed(changes.map((c) => c.id));
    return NextResponse.json({ ok: true, sent: true, via, subject, changes: changes.length });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "send_failed", detail: String(err).slice(0, 300), subject }, { status: 502 });
  }
}
