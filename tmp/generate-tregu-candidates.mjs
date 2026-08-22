import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { buildDailyCodexCommand } from "../lib/tregu-automation.mjs";

const baseUrl = process.env.TREGU_AUTOMATION_URL?.replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET ?? process.env.CRON_SECRET;
const response = await fetch(`${baseUrl}/api/automation/tregu/daily-drafts`, { headers: { authorization: `Bearer ${secret}` } });
if (!response.ok) throw new Error(await response.text());
const { articles } = await response.json();
const prompt = `You are the 383 Tregu daily market editor. From ONLY these verified source articles, propose exactly 3 to 5 unique Albanian binary PO/JO markets. Favor distinctive Kosovo, world, and sports controversies or live developments; do not produce generic evergreen questions. Use short, Polymarket-style titles that never mechanically begin with "A do të". Every title must include a concrete "deri më <day> <month>" deadline and end in "?". Every market must include explicit resolution criteria naming the authoritative source and deadline. Breaking-news and controversy markets must use closes_in_hours from 2 to 48. Cite only supplied source slugs. Example: "Ngushtica e Hormuzit rihapet deri më 20 korrik?". Return ONLY compact JSON: {"markets":[{"question":"...","description":"...","resolution_criteria":"Zgjidhet sipas ... deri më ...","category":"politike|ekonomi|sport|bote|te-tjera","closes_in_hours":12,"source_slugs":["..."]}]}. No markdown.\n\nVerified articles:\n${JSON.stringify(articles)}`;
const hermesBin = process.env.HERMES_BIN ?? "/opt/hermes/.venv/bin/hermes";
const output = execFileSync(hermesBin, buildDailyCodexCommand(prompt), { cwd: process.cwd(), env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/opt/data" }, encoding: "utf8", maxBuffer: 1024 * 1024 });
const json = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
const parsed = JSON.parse(json);
writeFileSync("tmp/tregu-candidates.json", JSON.stringify({ candidates: Array.isArray(parsed) ? parsed : parsed.markets }), "utf8");
console.log("candidate payload generated");
