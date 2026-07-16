/** Pure, non-secret composition for the one-per-run verified-news repricing email. */
const SITE_ORIGIN = "https://383ks.com";

function asPercentage(probability) {
  return `${(Number(probability) * 100).toFixed(2)}%`;
}

function asSignedPoints(change) {
  const value = Number(change) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function marketLink(slug) {
  return `${SITE_ORIGIN}/tregu/${encodeURIComponent(String(slug))}`;
}

function sourceLine(source) {
  const label = String(source.label || "Burim i verifikuar");
  const title = String(source.title || source.slug || "Artikull i verifikuar");
  const link = String(source.url || "");
  return link ? `- ${label}: ${title} — ${link}` : `- ${label}: ${title}`;
}

/**
 * The route calls this only for persisted oracle_applied rows. This makes a
 * fallback provider insufficient by itself: a real evidence-backed price move
 * is still required before an email can be composed.
 */
export function hasEvidenceBackedRepriceChanges(result) {
  return Boolean(!result?.skipped && Array.isArray(result?.email_updates) && result.email_updates.length > 0);
}

export function buildTreguRepriceEmail({ runKey, changes }) {
  const lines = [
    "383 Tregu — evidence-backed news market update",
    "This email reports a real probability change applied from verified news evidence; it is not a scan, provider fallback, or no-change notification.",
    `Run: ${runKey}`,
    `Affected markets: ${changes.length}`,
    "",
  ];

  for (const [index, change] of changes.entries()) {
    lines.push(`${index + 1}. ${String(change.question)}`);
    lines.push(`Market: ${String(change.slug)} — ${marketLink(change.slug)}`);
    lines.push(`Provider: ${String(change.provider || "unknown")}`);
    lines.push(`Affected outcome: PO — ${asPercentage(change.before_probability)} → ${asPercentage(change.after_probability)} (${asSignedPoints(change.absolute_percentage_point_change)})`);
    lines.push(`Timestamp: ${String(change.timestamp)}`);
    lines.push("Verified sources used:");
    for (const source of change.verified_sources ?? []) lines.push(sourceLine(source));
    lines.push("Evidence-backed news update: this market probability change was applied only after the verified sources above were supplied to the AI repricer.", "");
  }

  const text = lines.join("\n");
  return {
    subject: `383 Tregu — ${changes.length} evidence-backed market update${changes.length === 1 ? "" : "s"}`,
    text,
    html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`,
  };
}
