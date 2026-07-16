import * as nodemailer from "nodemailer";
import { buildTreguRepriceEmail } from "./tregu-live-email-content.mjs";

type TreguLiveEmail = {
  kind: "news_update";
  runKey: string;
  changes: Array<{
    question: string;
    slug: string;
    provider: string;
    before_probability: number;
    after_probability: number;
    absolute_percentage_point_change: number;
    timestamp: string;
    verified_sources: Array<{ label: string; title: string; slug: string; url?: string }>;
  }>;
};

function configuredRecipient() {
  const recipient = (process.env.TREGU_LIVE_RECIPIENT ?? process.env.RECIPIENT_EMAIL ?? "").trim();
  if (!recipient) throw new Error("TREGU_LIVE_RECIPIENT or RECIPIENT_EMAIL is required for tregu-live notifications.");
  return recipient;
}

function gmailTransport() {
  const user = (process.env.GMAIL_USER ?? "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !pass) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD are required for tregu-live notifications.");
  return { user, transport: nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } }) };
}

/** Sends one non-secret email containing every real verified-news price change in one run. */
export async function sendTreguLiveNotification(notification: TreguLiveEmail) {
  const recipient = configuredRecipient();
  const { user, transport } = gmailTransport();
  const message = buildTreguRepriceEmail({ runKey: notification.runKey, changes: notification.changes });
  await transport.sendMail({ from: user, to: recipient, ...message });
}
