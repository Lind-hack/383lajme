import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const baseUrl = process.env.TREGU_AUTOMATION_URL?.replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
const engine = "/opt/data/vendor/last30days-skill/skills/last30days/scripts/last30days.py";
if (!baseUrl || !secret) throw new Error("TREGU_AUTOMATION_URL and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required.");

const tempDir = mkdtempSync(join(tmpdir(), "383-pre-match-"));
const planPath = join(tempDir, "plan.json");
const outputPath = join(tempDir, "discovery.json");
const plan = {
  topic: "England Argentina 15 July 2026 football pre-match team news form starting lineups",
  queries: [
    { query: "England Argentina 15 July 2026 football team news form lineup ESPN FIFA Reuters", sources: ["grounding", "x", "instagram"] },
    { query: "site:fifa.com England Argentina 15 July 2026", sources: ["grounding"] },
  ],
};

try {
  writeFileSync(planPath, JSON.stringify(plan));
  const discovery = spawnSync("python3", [engine, plan.topic, "--plan", planPath, "--auto-resolve", "--emit=json", "--output", outputPath], {
    encoding: "utf8", timeout: 55_000, env: { ...process.env, LAST30DAYS_LIBRARY_CONTEXT: "off" },
  });
  let payload = { generated_at: new Date().toISOString(), source_status: { last30days: "error" }, results: [] };
  if (discovery.status === 0) payload = JSON.parse(readFileSync(outputPath, "utf8"));
  const response = await fetch(`${baseUrl}/api/automation/tregu/argentina-england-refresh`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  console.log(body);
  if (!response.ok) process.exitCode = 1;
  if (discovery.status !== 0) console.error(`last30days discovery was unavailable (exit ${discovery.status}); refresh ran with no discovery evidence.`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
