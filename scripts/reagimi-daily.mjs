import fs from "node:fs";
import { execFileSync } from "node:child_process";

// Never prints credentials. Publishing changes a data row, not the deployment.
const args = process.argv.slice(2);
let secret = process.env.CRON_SECRET || process.env.TREGU_AUTOMATION_SECRET;
if (args.includes("--railway")) {
  try {
    const query = ["variables", "--json", "--service", "6904b122-ba75-4a93-bac4-38cd31e63fba", "--environment", "b51f579f-d954-41f2-abd1-1fc77d0b6eba"];
    const executable = process.platform === "win32" ? "powershell.exe" : "railway";
    const commandArgs = process.platform === "win32" ? ["-NoProfile", "-NonInteractive", "-Command", `railway ${query.join(" ")}`] : query;
    const variables = JSON.parse(execFileSync(executable, commandArgs, { encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"] }));
    secret = variables.CRON_SECRET || variables.TREGU_AUTOMATION_SECRET;
  } catch { throw new Error("Cannot read the production automation credential. Check Railway login and project link; raw command output is suppressed."); }
}
if (!secret) throw new Error("CRON_SECRET or TREGU_AUTOMATION_SECRET is required; no credentials will be printed.");
const site = process.env.SITE_URL || "https://383ks.com";
const fileIndex = args.indexOf("--file");
const file = fileIndex >= 0 ? args[fileIndex + 1] : null;
if (!args.includes("--context") && !file) throw new Error("Use --context or --file <selection.json>.");
const endpoint = new URL("/api/automation/reagimi/daily", site);
const response = await fetch(endpoint, {
  method: file ? "POST" : "GET",
  headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
  body: file ? JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8"))) : undefined,
  signal: AbortSignal.timeout(45000),
});
if (!response.headers.get("content-type")?.includes("application/json")) {
  throw new Error(`Daily video endpoint returned ${response.status} without JSON. Confirm the publishing route is deployed.`);
}
const result = await response.json().catch(() => null);
if (!result) throw new Error(`Daily video endpoint returned invalid JSON (${response.status}).`);
if (!response.ok) throw new Error(`Daily video failed (${response.status}): ${result.error || "Unknown error"}`);
console.log(JSON.stringify(result, null, 2));
