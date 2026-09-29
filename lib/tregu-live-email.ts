import { sendMail } from "@/lib/mailer";
import { buildArgentinaSpainLiveEmail, buildF1LiveEmail, buildF1QualifyingEmail, buildOfficialMarketUpdateEmail, buildTreguRepriceEmail } from "./tregu-live-email-content.mjs";

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
    reason?: "deadline_decay" | "deadline_settlement" | "evidence_convergence";
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

/** Qualifying sets the grid, which is the heaviest term in the opening model. */
type F1QualifyingUpdate = {
  kind: "f1_qualifying";
  runKey: string;
  question: string;
  slug: string;
  sourceUrl?: string;
  provisional?: boolean;
  rows: Array<{ grid: number; key: string; name: string; team: string; colour?: string | null; face?: string | null; before?: number | null; after: number; penalty?: string | null }>;
};

type TreguLiveEmail = NewsUpdate | PairedBinaryLiveUpdate | F1LiveUpdate | OfficialMarketUpdate | F1QualifyingUpdate;

function configuredRecipient() {
  const recipient = (process.env.TREGU_LIVE_RECIPIENT ?? process.env.RECIPIENT_EMAIL ?? "").trim();
  if (!recipient) throw new Error("TREGU_LIVE_RECIPIENT or RECIPIENT_EMAIL is required for tregu-live notifications.");
  return recipient;
}

/** Kept as the one seam every sender here goes through; delivery is lib/mailer
 *  (Resend over HTTPS in production, because Railway cannot reach Gmail SMTP). */
function gmailTransport() {
  const transport = {
    sendMail: (message: { to: string; subject: string; html: string; text?: string; from?: string }) =>
      sendMail({ to: message.to, subject: message.subject, html: message.html, text: message.text, fromName: "383 Tregu" }),
  };
  return { user: "383 Tregu", transport };
}

/** Sends a configured-recipient email only after its caller has confirmed an eligible persisted update. */
export async function sendTreguLiveNotification(notification: TreguLiveEmail) {
  const recipient = notification.kind === "news_update" ? (process.env.TREGU_NEWS_RECIPIENT ?? "lindsylqa@gmail.com") : configuredRecipient();
  const { user, transport } = gmailTransport();
  const message = notification.kind === "f1_qualifying"
    ? buildF1QualifyingEmail({ runKey: notification.runKey, question: notification.question, slug: notification.slug, rows: notification.rows, sourceUrl: notification.sourceUrl, provisional: notification.provisional })
    : notification.kind === "paired_binary_live_update"
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

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** A period just froze its top 3. Nothing is paid until the admin confirms. */
export async function sendLeaderboardRewardNotification(input: {
  rewards: Array<{ period_kind: string; periodLabel: string; place: number; display_name: string; profit: number; prize: number }>;
}) {
  const recipient = configuredRecipient();
  const { user, transport } = gmailTransport();
  const confirmUrl = "https://383ks.com/admin/tregu?tab=shperblime";
  const total = input.rewards.reduce((sum, r) => sum + Number(r.prize), 0);
  const kindLabel = (kind: string) => (kind === "monthly" ? "Muaji" : kind === "league" ? "Liga" : "Java");
  const lines = input.rewards.map(
    (r) => `#${r.place} ${r.display_name} — ${kindLabel(r.period_kind)} ${r.periodLabel} — fitim ${Math.round(r.profit)} 383C — shpërblim ${Math.round(r.prize)} 383C`
  );
  const rows = input.rewards
    .map(
      (r) =>
        `<tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:800">#${r.place}</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:700">${escapeHtml(r.display_name)}</td><td style="padding:10px;border-bottom:1px solid #eee;color:#6b6b6b">${kindLabel(r.period_kind)} · ${escapeHtml(r.periodLabel)}</td><td style="padding:10px;border-bottom:1px solid #eee">+${Math.round(r.profit).toLocaleString("sq-AL")}</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:800;color:#d93819">${Math.round(r.prize).toLocaleString("sq-AL")} 383C</td></tr>`
    )
    .join("");
  await transport.sendMail({
    from: user,
    to: recipient,
    subject: `383 Tregu — shpërblimet e renditjes presin konfirmimin (${Math.round(total)} 383C)`,
    text: `Renditja u mbyll. Këto shpërblime presin konfirmimin tënd para se t'u shfaqen fituesve:\n\n${lines.join("\n")}\n\nGjithsej: ${Math.round(total)} 383C\n\nKonfirmo: ${confirmUrl}`,
    html: `<main style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;color:#171513"><h1 style="font-size:24px;margin:0 0 8px">Shpërblimet e renditjes</h1><p style="margin:0 0 20px;color:#555">Renditja u mbyll. Asgjë nuk u shkon fituesve derisa ta konfirmosh.</p><table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="text-align:left;color:#6b6b6b;font-size:12px"><th style="padding:8px 10px">Vendi</th><th style="padding:8px 10px">Tregtari</th><th style="padding:8px 10px">Periudha</th><th style="padding:8px 10px">Fitimi</th><th style="padding:8px 10px">Shpërblimi</th></tr>${rows}</table><p style="margin:18px 0 22px;font-weight:700">Gjithsej: ${Math.round(total).toLocaleString("sq-AL")} 383C</p><a href="${confirmUrl}" style="display:inline-block;background:#ff4422;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:999px">Konfirmo</a></main>`,
  });
}
