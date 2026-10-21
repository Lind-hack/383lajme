import { NextResponse } from "next/server";
import { buildDosjeReport } from "@/lib/dosje-report.mjs";
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

  const { subject, html, text } = buildDosjeReport(run);
  if (run.mode === "dry-run") return NextResponse.json({ ok: true, sent: false, subject, text });

  try {
    const { via } = await sendMail({
      purpose: "operator",
      to: OWNER,
      subject,
      html,
      text,
      idempotencyKey: `dosje-daily:${run.runId ?? run.date}`,
    });
    return NextResponse.json({ ok: true, sent: true, via, subject });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "send_failed", detail: String(err).slice(0, 300), subject }, { status: 502 });
  }
}
