const baseUrl = String(process.env.TREGU_AUTOMATION_URL ?? "").replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
if (!/^https:\/\//.test(baseUrl) || !secret) throw new Error("TREGU_AUTOMATION_URL (HTTPS) and TREGU_AUTOMATION_SECRET are required");
const response = await fetch(`${baseUrl}/api/automation/tregu/market-emails`, {
  method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55_000),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`Market email dispatch failed: HTTP ${response.status} ${result.error ?? ""}`);
console.log(JSON.stringify({ kind: "market_emails", sent: result.sent ?? 0, failed: result.failed ?? 0 }));
