import { sendMail } from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildNewsMarketOpenEmail } from "./tregu-creation-email.mjs";
import { TREGU_DRAFT_REVIEW_RECIPIENT } from "./tregu-automation.mjs";

type Claim = { market_id: string; claim_token: string };

/** At-least-once delivery. A leased database row survives provider and process failures. */
export async function sendPendingNewsMarketEmails({ marketId, limit = 10 }: { marketId?: string; limit?: number } = {}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role is required for market creation emails");
  const recipient = String(process.env.TREGU_MARKET_RECIPIENT ?? TREGU_DRAFT_REVIEW_RECIPIENT).trim();
  if (!recipient) throw new Error("Market creation email recipient is required");
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < Math.min(limit, 25); index++) {
    const { data: claims, error: claimError } = await admin.rpc("claim_news_market_open_email", { p_market_id: marketId ?? null });
    if (claimError) throw new Error(`Could not claim market email: ${claimError.message}`);
    const claim = (Array.isArray(claims) ? claims[0] : null) as Claim | undefined;
    if (!claim) break;
    try {
      const { data: market, error: marketError } = await admin.from("markets").select("*").eq("id", claim.market_id).single();
      if (marketError || !market) throw new Error(`Could not load market: ${marketError?.message ?? "missing"}`);
      const { data: opening, error: openingError } = await admin.from("market_snapshots")
        .select("market_prob,created_at").eq("market_id", claim.market_id).eq("oracle_kind", "opening")
        .order("created_at", { ascending: true }).limit(1).single();
      if (openingError || !opening) throw new Error(`Could not load opening graph: ${openingError?.message ?? "missing"}`);
      const message = buildNewsMarketOpenEmail(market, opening);
      await sendMail({ to: recipient, subject: message.subject, html: message.html, text: message.text, fromName: "383 Tregu", idempotencyKey: `market-open-${claim.market_id}` });
      const { data: marked, error: markError } = await admin.from("market_open_notifications")
        .update({ sent_at: new Date().toISOString(), claimed_until: null, last_error: null })
        .eq("market_id", claim.market_id).eq("claim_token", claim.claim_token).is("sent_at", null)
        .select("market_id");
      if (markError || marked?.length !== 1) throw new Error(`Email sent, but delivery receipt could not be saved: ${markError?.message ?? "claim expired"}`);
      sent++;
    } catch (error) {
      failed++;
      const message = String(error instanceof Error ? error.message : error);
      await admin.from("market_open_notifications")
        .update({ claimed_until: null, last_error: message.slice(0, 500) })
        .eq("market_id", claim.market_id).eq("claim_token", claim.claim_token).is("sent_at", null);
      console.error("News market creation email remains queued", { marketId: claim.market_id, error: message });
      // Do not claim the same failed row again in this invocation.
      break;
    }
  }
  return { sent, failed };
}
