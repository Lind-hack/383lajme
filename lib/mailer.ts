import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptNewsletterMail } from "./newsletter-mail.mjs";
import * as nodemailer from "nodemailer";

/**
 * Site league and market mail goes through here. Operator reports use the
 * encrypted private SMTP queue; reader mail retains the branded sender.
 *
 * Railway cannot reach smtp.gmail.com: on 2026-09-29 every send from
 * production failed with "Connection timeout" / "connect ENETUNREACH
 * …:465", so no league digest, overtake or prize email had ever arrived.
 * Resend's HTTPS API is reachable, so it is the path whenever
 * RESEND_API_KEY is set. Gmail SMTP stays as the fallback for local tools.
 *
 * EMAIL_FROM decides who it comes from. Resend's shared test sender
 * (onboarding@resend.dev) only delivers to the Resend account's own address,
 * so player emails need 383ks.com verified in Resend and EMAIL_FROM set to an
 * address on it, e.g. "Ligat 383 <ligat@383ks.com>".
 */
export type Mail = {
  to: string;
  /** Operator reports use the private SMTP queue, never the reader provider. */
  purpose?: "operator";
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  /** Display name for the sender; the address comes from the environment. */
  fromName?: string;
  /** Makes a retried send a no-op at Resend. */
  idempotencyKey?: string;
};

function senderAddress(): string {
  const configured = (process.env.EMAIL_FROM ?? "").trim();
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured;
  if (address) return address;
  const gmail = (process.env.GMAIL_USER ?? "").trim();
  if (gmail) return gmail;
  throw new Error("EMAIL_FROM (or GMAIL_USER) is required to send email.");
}

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

export async function sendMail(mail: Mail): Promise<{ id: string | null; via: "resend" | "smtp" | "smtp_queue" }> {
  // Operator mail must never consume the transactional Resend quota. Railway
  // cannot reach Gmail SMTP, so use the private server's encrypted durable queue.
  if (mail.purpose === "operator") {
    if (mail.to.trim().toLowerCase() !== "lindsylqa@gmail.com") throw new Error("Unexpected operator mail recipient");
    const admin = createAdminClient();
    const secret = process.env.NEWSLETTER_SECRET || "";
    if (!admin || secret.length < 32) throw new Error("Operator SMTP queue configuration missing");
    const id = createHash("sha256").update("operator:" + (mail.idempotencyKey || randomUUID())).digest("hex");
    const { error } = await admin.from("site_smtp_mail_queue").upsert({
      id, payload: encryptNewsletterMail(mail, secret, id),
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Operator SMTP queue unavailable");
    return { id: "queue:" + id, via: "smtp_queue" };
  }
  const from = `${mail.fromName ?? "383"} <${senderAddress()}>`;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!response.ok) throw new Error(`Resend ${response.status}: ${body.message ?? body.name ?? "send failed"}`);
    return { id: body.id ?? null, via: "resend" };
  }
  const user = (process.env.GMAIL_USER ?? "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !pass) throw new Error("RESEND_API_KEY or GMAIL_USER/GMAIL_APP_PASSWORD is required to send email.");
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  const info = await transport.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers });
  return { id: info.messageId ?? null, via: "smtp" };
}
