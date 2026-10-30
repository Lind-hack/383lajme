import { pathToFileURL } from "node:url";

export async function runReprice({ env = process.env, fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console.log } = {}) {
  const baseUrl = env.TREGU_AUTOMATION_URL;
  const secret = env.TREGU_AUTOMATION_SECRET || env.CRON_SECRET;
  if (!baseUrl || !secret) throw new Error("TREGU_AUTOMATION_URL and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required.");
  const endpoint = new URL(`${baseUrl.replace(/\/$/, "")}/api/automation/tregu/reprice`);
  // Production's www -> apex 301 changes POST to GET in fetch (then HTTP 405).
  if (endpoint.hostname === "www.383ks.com") endpoint.hostname = "383ks.com";
  // Two bounded requests fit inside the systemd service's 150-second budget.
  // The server's evidence ledger prevents a repeated request moving odds twice.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    let body;
    try {
      response = await fetchImpl(endpoint.href, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(65_000),
        redirect: "manual",
      });
      body = await response.text();
    } catch {
      if (attempt === 0) { await sleep(3000); continue; }
      throw new Error("Tregu reprice network failure or timeout after 2 attempts.");
    }
    if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt === 0) {
      await sleep(3000);
      continue;
    }
    if (!response.ok) throw new Error(`Tregu reprice HTTP ${response.status}`);
    let result;
    try { result = JSON.parse(body); } catch { throw new Error("Tregu reprice returned invalid JSON."); }
    log(JSON.stringify(result));
    if (result.ok !== true || /"(?:outcome|status|error_class)"\s*:\s*"(?:completed_with_market_errors|oracle_failed|provider_error)"/.test(body)) {
      throw new Error("Tregu reprice reported market/provider errors; inspect the run audit.");
    }
    return result;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runReprice(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
