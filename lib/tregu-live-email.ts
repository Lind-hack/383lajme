import * as nodemailer from "nodemailer";
import { buildArgentinaSpainLiveEmail, buildF1LiveEmail, buildOfficialMarketUpdateEmail, buildTreguRepriceEmail } from "./tregu-live-email-content.mjs";

type NewsUpdate = {
  kind: "news_update";
  runKey: string;
  changes: Array<{
    question: string;
    slug: string;
    provider: string;
    before_probability: number;
    after_probability: number;
    absolute_percentage_point_change: number;
    reason?: "deadline_decay" | "deadline_settlement";
    before_state?: { status: string; outcome: string | null };
    after_state?: { status: string; outcome: string | null };
    timestamp: string;
    verified_sources: Array<{ label: string; title: string; slug: string; url?: string; published_at?: string }>;
    evidence_fingerprint?: string;
    remaining_hours?: number | null;
  }>;
};

type PairedBinaryLiveUpdate = {
  kind: "paired_binary_live_update";
  runKey: string;
  changes: Array<{
    persisted: true;
    material_change: true;
    timestamp: string;
    state: Record<string, unknown>;
  }>;
};

type F1LiveUpdate = {
  kind: "f1_live_update";
  runKey: string;
  changes: Array<{ question: string; slug: string; driver_code: string; driver_name: string; team_name: string; team_logo_url?: string | null; headshot_url?: string | null; team_colour?: string | null; note?: string | null; position: number | null; gap: string; pits: number; before_probability: number; after_probability: number; source_url: string; graph: Record<string, unknown> }>;
};

type OfficialMarketUpdate = {
  kind: "official_market_update";
  runKey: string;
  changes: Array<{ question: string; slug: string; kind: string; before: Record<string, unknown>; after: Record<string, unknown>; timestamp: string; source_url?: string }>;
};

type TreguLiveEmail = NewsUpdate | PairedBinaryLiveUpdate | F1LiveUpdate | OfficialMarketUpdate;

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

/** Sends a configured-recipient email only after its caller has confirmed an eligible persisted update. */
export async function sendTreguLiveNotification(notification: TreguLiveEmail) {
  const recipient = configuredRecipient();
  const { user, transport } = gmailTransport();
  const message = notification.kind === "paired_binary_live_update"
    ? buildArgentinaSpainLiveEmail({ runKey: notification.runKey, changes: notification.changes })
    : notification.kind === "f1_live_update"
      ? buildF1LiveEmail({ runKey: notification.runKey, changes: notification.changes })
      : notification.kind === "official_market_update"
        ? buildOfficialMarketUpdateEmail({ runKey: notification.runKey, changes: notification.changes })
        : buildTreguRepriceEmail({ runKey: notification.runKey, changes: notification.changes });
  await transport.sendMail({ from: user, to: recipient, ...message });
}

export async function sendWithdrawalRequestNotification(input: { requestId: string; userEmail?: string | null }) {
  const recipient = configuredRecipient();
  const { user, transport } = gmailTransport();
  const requestId = String(input.requestId);
  const account = String(input.userEmail ?? "Llogari e autentikuar");
  await transport.sendMail({
    from: user,
    to: recipient,
    subject: `383 Tregu — kërkesë tërheqjeje ${requestId.slice(0, 8)}`,
    text: `U regjistrua një kërkesë tërheqjeje për verifikim.\nKërkesa: ${requestId}\nLlogaria: ${account}\nShuma: 10,000 383C / 10€\n\nKontrollo bilancin, transaksionet dhe statusin në panelin admin para miratimit.`,
    html: `<main style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#171513"><h1 style="font-size:24px">Kërkesë tërheqjeje</h1><p>Një kërkesë e re pret verifikimin e bilancit dhe historikut të transaksioneve.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:10px;border-bottom:1px solid #eee">Kërkesa</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:700">${requestId}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee">Llogaria</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:700">${account}</td></tr><tr><td style="padding:10px">Shuma</td><td style="padding:10px;font-weight:700;color:#d93819">10,000 383C / 10€</td></tr></table></main>`,
  });
}
