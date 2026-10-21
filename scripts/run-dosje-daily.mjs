import { execFileSync } from "node:child_process";
import { existsSync, openSync, closeSync, readFileSync, statSync, unlinkSync, writeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { VETTED_CHANNELS } from "../lib/dosje-video.mjs";

/**
 * The daily dossier run (systemd 383-dosje-daily.timer, 05:00 Europe/Belgrade).
 *
 * This script only talks to models. Everything else — which clusters exist,
 * fetching evidence, checking topics and moments, writing to the database,
 * sending the email — happens on the site through
 * /api/automation/dosje/daily/*, where the validators live and where this
 * script's output is treated as untrusted.
 *
 * Model: GPT-6 Luna through Hermes' Codex OAuth profile. Luna shares one usage
 * limit with the hourly news writer, so:
 *   - the run never starts a model call after 06:40 and stops by 06:50, clear
 *     of the news writer (07:00–23:00), Tregu daily (07:20) and Bota (07:23);
 *   - a 429 / "usage limit" from Luna is never retried — the rest of the run is
 *     written by Gemini through /daily/llm, under the same verification, and
 *     the email says which model wrote what.
 *
 * Flags: --backfill (raised caps, for the rebuild after a wipe; only between
 * 00:00 and 06:40), --dry-run (no writes, no email), --deadline-minutes N,
 * --no-luna (Gemini only: for a smoke test inside the news writer's hours,
 * where Luna's allowance is the news writer's).
 */

// `||`, not `??`: the VPS env file sets CRON_SECRET to an empty string.
const base = (process.env.DOSJE_AUTOMATION_URL || process.env.TREGU_AUTOMATION_URL || "").replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET || process.env.CRON_SECRET || "";
if (!base || !secret) {
  console.error("DOSJE_AUTOMATION_URL (or TREGU_AUTOMATION_URL) and TREGU_AUTOMATION_SECRET (or CRON_SECRET) are required.");
  process.exit(1);
}
const args = process.argv.slice(2);
const backfill = args.includes("--backfill");
const dryRun = args.includes("--dry-run");
const noLuna = args.includes("--no-luna");
const HERMES_BIN = process.env.HERMES_BIN || "/opt/hermes/.venv/bin/hermes";
const HERMES_HOME = process.env.DOSJE_HERMES_HOME || process.env.TREGU_DAILY_HERMES_HOME || "/opt/data/profiles/tregudaily";
const LOCK = process.env.DOSJE_LOCK ?? "/tmp/383-dosje-daily.lock";
const runId = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;

// ── time: the window this run may use ─────────────────────────────────────
function belgradeMinutes(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}
const LAST_CALL = 6 * 60 + 40;
const startedAt = new Date();
const deadlineArg = args.includes("--deadline-minutes") ? Number(args[args.indexOf("--deadline-minutes") + 1]) : NaN;
const nowMin = belgradeMinutes(startedAt);
// Luna belongs to the news writer from 07:00 to 23:00 (and Tregu, Bota after
// it). Outside 00:00–06:40 any run — scheduled, backfill or manual — may use
// Gemini only.
if (nowMin >= LAST_CALL && !noLuna) {
  console.error(JSON.stringify({ ok: false, error: "Luna runs only between 00:00 and 06:40 Europe/Belgrade; pass --no-luna for a Gemini-only run outside that window" }));
  process.exit(2);
}
// In the early window the deadline is 06:40 today; otherwise (a manual run
// with an explicit budget) it is that many minutes from now.
const lastCallAt =
  Number.isFinite(deadlineArg) && deadlineArg > 0
    ? startedAt.getTime() + deadlineArg * 60_000
    : nowMin < LAST_CALL
      ? startedAt.getTime() + (LAST_CALL - nowMin) * 60_000
      : startedAt.getTime() + 30 * 60_000;
// With Luna in play the last call is 06:40 whatever budget was asked for.
const windowEnd = startedAt.getTime() + (LAST_CALL - nowMin) * 60_000;
const lastCall = noLuna ? lastCallAt : Math.min(lastCallAt, windowEnd);
const timeLeft = () => lastCall - Date.now();

// ── one run at a time (daily and backfill share the lock) ─────────────────
function holderAlive() {
  try {
    const pid = Number(readFileSync(LOCK, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function takeLock() {
  try {
    // A lock whose holder is gone (killed, crashed, container restarted) is
    // stale whatever its age; one older than four hours is stale regardless.
    if (existsSync(LOCK) && (!holderAlive() || Date.now() - statSync(LOCK).mtimeMs > 4 * 3600_000)) unlinkSync(LOCK);
    const fd = openSync(LOCK, "wx");
    writeSync(fd, String(process.pid));
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}
if (!takeLock()) {
  console.error(JSON.stringify({ ok: false, error: "another dosje run holds the lock", lock: LOCK }));
  process.exit(3);
}
const release = () => {
  try { unlinkSync(LOCK); } catch { /* already gone */ }
};
process.on("exit", release);
process.on("SIGTERM", () => process.exit(143));
process.on("SIGINT", () => process.exit(130));

// ── the site ──────────────────────────────────────────────────────────────
async function site(path, init = {}) {
  const res = await fetch(`${base}/api/automation/dosje${path}`, {
    ...init,
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(310_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 422) throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

// ── models ────────────────────────────────────────────────────────────────
class LunaLimitError extends Error {}
const LIMIT = /HTTP 429|usage limit has been reached|rate limit (?:reached|exceeded)/i;
const run = {
  runId,
  date: startedAt.toISOString(),
  startedAt: startedAt.toISOString(),
  mode: dryRun ? "dry-run" : backfill ? "backfill" : "daily",
  lunaLimited: noLuna,
  calls: { luna: 0, gemini: 0 },
  topics: { accepted: [], rejected: [] },
  subjects: [],
  mapping: null,
  errors: [],
};

function parseMarked(output) {
  const start = output.lastIndexOf("383_JSON_BEGIN");
  const end = output.indexOf("383_JSON_END", start + 14);
  const raw = start >= 0 && end > start ? output.slice(start + 14, end) : output;
  return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function luna(prompt) {
  const budget = Math.min(timeLeft(), 600_000);
  if (budget < 60_000) throw new Error("deadline");
  run.calls.luna += 1;
  let out;
  try {
    out = execFileSync(
      HERMES_BIN,
      ["chat", "-Q", "--provider", "openai-codex", "--model", "gpt-6-luna", "--toolsets", "safe", "-q", prompt],
      { env: { ...process.env, HERMES_HOME }, encoding: "utf8", timeout: budget, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (err) {
    // Only what Hermes printed: err.message also carries the whole argv, so a
    // fetched article that mentions "429" would otherwise flip the run.
    const said = `${err?.stdout ?? ""}\n${err?.stderr ?? ""}`;
    // A usage limit is not transient within this run: retrying only spends
    // the news writer's allowance. Switch for good.
    if (LIMIT.test(said)) throw new LunaLimitError("Luna usage limit reached");
    const why = err?.code === "ETIMEDOUT" || err?.signal ? "timed out" : said.replace(/\s+/g, " ").slice(-240);
    throw new Error(`luna failed: ${why}`);
  }
  try {
    return parseMarked(out);
  } catch (parseError) {
    // Hermes can exit 0 having printed only its failure line.
    if (LIMIT.test(out)) throw new LunaLimitError("Luna usage limit reached");
    throw parseError;
  }
}

async function gemini(system, prompt) {
  if (timeLeft() < 60_000) throw new Error("deadline");
  run.calls.gemini += 1;
  const r = await site("/daily/llm", { method: "POST", body: JSON.stringify({ system, prompt }) });
  if (!r.ok) throw new Error(`gemini failed: ${r.detail ?? r.reason}`);
  return { json: r.json, model: r.model ?? "gemini" };
}

/** One model answer as JSON, Luna first; one retry for malformed JSON, inside the deadline. */
async function ask(system, task) {
  const marked = `${system}\n\n${task}\n\nKthe VETËM JSON, ndërmjet rreshtave 383_JSON_BEGIN dhe 383_JSON_END. Pa markdown, pa koment.`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (timeLeft() < 60_000) throw new Error("deadline");
    if (!run.lunaLimited) {
      try {
        return { json: luna(marked), model: "gpt-6-luna" };
      } catch (err) {
        if (err instanceof LunaLimitError) {
          run.lunaLimited = true;
          console.log(JSON.stringify({ stage: "luna_limit", note: "switching to Gemini for the rest of this run" }));
        } else if (err instanceof SyntaxError && attempt === 1) {
          continue;
        } else {
          throw err;
        }
      }
    }
    try {
      return await gemini(system, task);
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  throw new Error("no model answer");
}

// ── prompts ───────────────────────────────────────────────────────────────
const TOPIC_SYSTEM = `Ti je redaktor i dosjeve të 383, një faqe lajmesh në Kosovë. Një dosje është historia e një teme që lajmet vazhdojnë ta prekin: çfarë ndodhi më parë që e shpjegon lajmin e sotëm.

Do të marrësh grupe artikujsh që flasin për të njëjtin subjekt. Shqyrto ÇDO grup një nga një. Propozo një dosje për çdo grup që ka të bëjë me politikë, institucione, gjykata, luftë e paqe, ekonomi, shoqëri ose shëndet publik — çdo temë ku lexuesit i duhet historia për ta kuptuar lajmin. Kalo VETËM grupet për rezultate sportive, të famshëm, argëtim ose produkte. Përdor VETËM tekstin e artikujve.

Për çdo dosje:
- "cluster_id": id e grupit, saktësisht.
- "slug": anglisht-shqip pa diakritikë, kebab-case, 2–6 fjalë (p.sh. "kosova-ne-sepa").
- "title": titull shqip për lexuesin, deri 60 shenja, pa datë.
- "blurb": një fjali shqip që thotë për çfarë është dosja.
- "anchors": 1–4 terma shqip, me shkronja të vogla, që shfaqen në titujt/përmbledhjet e grupit dhe pa të cilët tema nuk ekziston.
- "matchGroups": 2–4 grupe; çdo grup është 1–3 terma shqip që duhet të shfaqen TË GJITHË bashkë në titull ose përmbledhje që një artikull t'i përkasë dosjes. Kontrollo që shumica e artikujve të grupit të përputhen me të paktën një grup — shkruaj termat ashtu siç shfaqen në artikuj. Një nga grupet duhet të jetë një emër i vetëm dallues (personi, institucioni ose vendi specifik i temës). Mos përdor terma të përgjithshëm (kosova, qeveria, ministri) vetëm.
- "signals": deri 6 terma ndihmës. "excludes": terma që, nëse shfaqen, e përjashtojnë artikullin.
- "researchQuery": TITULLI I SAKTË i artikullit më të afërt në Wikipedia anglisht për këtë temë (p.sh. "Kosovo Specialist Chambers", "Pope Leo XIV"), jo një frazë kërkimi.
- "researchGroups": 1–3 grupe termash ANGLISHT (të vogla) që një burim i huaj duhet t'i përmbajë bashkë për të qenë për këtë temë.`;

const TOPIC_FORMAT = `{"topics":[{"cluster_id":"...","slug":"...","title":"...","blurb":"...","anchors":["..."],"matchGroups":[["...","..."]],"signals":[],"excludes":[],"researchQuery":"...","researchGroups":[["...","..."]]}]}`;

const RESEARCH_SYSTEM = `Ti je asistent kërkimor për dosjet historike të 383 në Kosovë. Dosja i shpjegon lexuesit ÇFARË NDODHI MË PARË: shkaqet, ngjarjet kyçe dhe marrëveshjet e mëparshme që e bëjnë të kuptueshëm lajmin e sotëm. Shkruaj si histori të qetë, të shkurtër, që lexuesi e lexon deri në fund.

Do të marrësh burime të numëruara. Secili është tekst REAL i shkarkuar nga interneti.

Rregullat, pa përjashtim:
- Mbështetu VETËM te teksti i burimeve. MOS shkruaj asnjë URL; cito me indeksin e burimit.
- "claims" ka NJË zë për ÇDO fjali të "summary"; fjalia kopjohet fjalë për fjalë nga "summary". Një fjali pa zë e hedh poshtë momentin.
- Zgjidh VETËM ngjarje që i përmendin të paktën DY botues të ndryshëm (lista "Botuesit" më poshtë tregon cili indeks i përket cilit botues).
- Në çdo moment, "source_indexes" të claims-ave së bashku duhet të përfshijnë indekse nga të paktën DY botues të ndryshëm — p.sh. një fjali cito [0, 4] nëse 0 dhe 4 janë botues të ndryshëm që thonë të njëjtën gjë. Një moment me një botues të vetëm refuzohet automatikisht; më mirë më pak momente se sa momente të refuzuara.
- Çdo shifër, datë ose numër duhet të shkruhet NJËSOJ siç shfaqet në burim (të njëjtat shifra). Mos llogarit, mos rrumbullako, mos shto numra.
- Për çdo zë jep "quote": fjalinë E SAKTË nga burimi, shkronjë për shkronjë, pa përkthim. Nëse nuk e gjen, lëre bosh.
- "summary": dy ose tri fjali të shkurtra. "why": një fjali, "Pse ka rëndësi" — shpjegim i thjeshtë për lexuesin.
- Momentet janë në të kaluarën dhe renditen sipas datës. Mos përsërit momentet që ekzistojnë tashmë.
- "primer": "Në pak fjalë" — dy ose tri fjali që e shpjegojnë temën nga fillimi, me të njëjtat rregulla citimi.
- "videos": vetëm ID YouTube (11 shenja) që je i sigurt se ekzistojnë, VETËM nga këta kanale: ${VETTED_CHANNELS.map((c) => c.name).join(", ")}. Nëse nuk je i sigurt, kthe [].
- Nëse burimet nuk mjaftojnë, kthe momente bosh. Kjo është përgjigje e saktë.

Shkruaj shqip, në kohën e tashme historike, pa mbiemra vlerësues.`;

const RESEARCH_FORMAT = `{"primer":{"text":"...","claims":[{"sentence":"...","source_indexes":[0,2],"quote":"..."}]},"milestones":[{"title":"...","summary":"...","why":"...","tag":"një fjalë","event_date":"YYYY-MM-DD","date_precision":"day|month|year","display_date":"p.sh. 14 dhjetor 2022","claims":[{"sentence":"...","source_indexes":[0,1],"quote":"..."}]}],"videos":[{"id":"...","channel":"...","title":"..."}]}`;

// ── the run ───────────────────────────────────────────────────────────────
const log = (o) => console.log(JSON.stringify(o));

try {
  const plan = await site(`/daily/plan${backfill ? "?backfill=1" : ""}`);
  log({ stage: "plan", clusters: plan.clusters?.length ?? 0, due: plan.due?.length ?? 0, caps: plan.caps });

  // 1. New topics from what the news keeps returning to.
  if ((plan.clusters ?? []).length) {
    try {
      const task = `Dosjet ekzistuese (mos i përsërit): ${JSON.stringify((plan.topics ?? []).map((t) => t.title))}\n\nGrupet:\n${JSON.stringify(plan.clusters)}\n\nFormati: ${TOPIC_FORMAT}`;
      const { json, model } = await ask(TOPIC_SYSTEM, task);
      const proposals = Array.isArray(json?.topics) ? json.topics : [];
      if (dryRun) {
        run.topics.rejected = proposals.map((p) => ({ slug: p.slug, title: p.title, reasons: ["dry_run"] }));
      } else {
        const verdict = await site("/daily/topics", { method: "POST", body: JSON.stringify({ proposals, model, backfill }) });
        run.topics.accepted = verdict.accepted ?? [];
        run.topics.rejected = verdict.rejected ?? [];
      }
      log({ stage: "topics", model, proposed: proposals.length, accepted: run.topics.accepted.length });
    } catch (err) {
      run.errors.push(`topics: ${String(err?.message ?? err)}`);
    }
  }

  // 2. Map today's articles onto every topic, new ones included, so the
  //    research queue sees today's coverage.
  if (!dryRun) {
    try {
      const m = await site("/subjects", { method: "POST" });
      run.mapping = { ok: m.ok !== false, matched: m.matched ?? m.mapped ?? 0 };
    } catch (err) {
      run.mapping = { ok: false, error: String(err?.message ?? err).slice(0, 200) };
    }
  }

  // 3. Research the topics that are due (re-planned: new topics are due now).
  const replan = dryRun ? plan : await site(`/daily/plan${backfill ? "?backfill=1" : ""}`);
  for (const subject of replan.due ?? []) {
    if (timeLeft() < 3 * 60_000) {
      run.subjects.push({ slug: subject.slug, title: subject.title, skipped: "deadline: lëvizi për nesër" });
      continue;
    }
    const entry = { slug: subject.slug, title: subject.title };
    run.subjects.push(entry);
    if (dryRun) {
      // The evidence step claims the subject for the day; a dry run must not.
      entry.skipped = "dry_run: do të hulumtohej";
      continue;
    }
    let claimed = null;
    try {
      const ev = await site(`/daily/evidence?topic=${encodeURIComponent(subject.slug)}`);
      if (ev.ok) claimed = ev.run_id;
      if (!ev.ok) {
        entry.skipped = ev.reason === "no_sources" ? `pa burime të mjaftueshme (${ev.publishers ?? 0} botues)` : ev.reason;
        continue;
      }
      const sources = ev.sources.map((s) => `[${s.index}] ${s.publisher ?? "?"} — ${s.title ?? ""} (${s.published_date ?? "pa datë"})\n${s.text}`).join("\n\n---\n\n");
      const task =
        `Tema: ${ev.topic.title}\nPër lexuesin: ${ev.topic.blurb}\n` +
        `Lajmet e fundit për temën: ${JSON.stringify(subject.headlines ?? [])}\n` +
        `Momente që ekzistojnë tashmë (mos i përsërit): ${JSON.stringify((ev.existing ?? []).map((m) => `${m.event_date} ${m.title}`))}\n\n` +
        // Spelled out because a moment is refused unless its citations span two
        // publishers, and models otherwise cite one source per moment.
        `Botuesit: ${ev.sources.map((s) => `[${s.index}] ${s.publisher ?? "?"}`).join(", ")}\n\n` +
        `Burimet:\n\n${sources}\n\nFormati: ${RESEARCH_FORMAT}`;
      const { json, model } = await ask(RESEARCH_SYSTEM, task);
      // From here the publish step owns the claim and closes it.
      claimed = null;
      entry.receipt = await site("/daily/publish", {
        method: "POST",
        body: JSON.stringify({
          topic_slug: subject.slug,
          run_id: ev.run_id,
          model,
          sources: ev.sources.map((s) => s.url),
          milestones: Array.isArray(json?.milestones) ? json.milestones : [],
          primer: json?.primer ?? null,
          videos: Array.isArray(json?.videos) ? json.videos : [],
        }),
      });
      log({ stage: "subject", slug: subject.slug, model, published: entry.receipt.published?.length ?? 0 });
    } catch (err) {
      entry.error = String(err?.message ?? err).slice(0, 240);
      if (entry.error === "deadline") entry.error = "deadline: lëvizi për nesër";
      // Release the day's claim so the subject can be tried again tomorrow,
      // rather than counting as researched this week.
      if (claimed !== null) {
        await site("/daily/publish", {
          method: "POST",
          body: JSON.stringify({ topic_slug: subject.slug, run_id: claimed, abandon: true, reason: entry.error }),
        }).catch(() => {});
      }
    }
  }
} catch (err) {
  run.errors.push(String(err?.message ?? err).slice(0, 300));
}

// 4. The email, every run.
run.finishedAt = new Date().toISOString();
try {
  const sent = await site("/daily/report", { method: "POST", body: JSON.stringify(run) });
  log({ stage: "report", sent: sent.sent, subject: sent.subject });
} catch (err) {
  log({ stage: "report", sent: false, error: String(err?.message ?? err).slice(0, 200) });
  process.exitCode = 1;
}
log({ stage: "done", errors: run.errors, subjects: run.subjects.length, luna: run.calls.luna, gemini: run.calls.gemini });
if (run.errors.length || run.subjects.some((s) => s.error && !s.error.startsWith("deadline"))) process.exitCode = 1;
