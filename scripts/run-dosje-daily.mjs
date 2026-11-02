import { execFileSync } from "node:child_process";
import { existsSync, openSync, closeSync, readFileSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { VETTED_CHANNELS } from "../lib/dosje-video.mjs";
import { dateInText } from "../lib/dosje-draft.mjs";

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

// Marks that this run's email went out, so the systemd failure hook
// (scripts/systemd/383-dosje-failed.sh) never sends a second one.
const REPORTED = process.env.DOSJE_REPORTED_MARK ?? "/tmp/383-dosje-reported";

const backfill = args.includes("--backfill");
const dryRun = args.includes("--dry-run");
let noLuna = args.includes("--no-luna");
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
// Switching to Gemini instead of exiting: an exit here sent no email, and a
// run that is late (the news run overran 05:00) went silent for the day.
if (nowMin >= LAST_CALL && !noLuna) {
  console.log(JSON.stringify({ stage: "luna_window_closed", note: "after 06:40: this run writes with Gemini only" }));
  noLuna = true;
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
  // Off by choice (--no-luna, or after 06:40), not because it hit its limit.
  lunaOff: noLuna,
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

/** "Salih Mustafa: [2] bbc, [5] apnews; …": events that two or more publishers report. */
function pairsOf(sources) {
  const byEvent = new Map();
  for (const s of sources) {
    if (!s.event) continue;
    if (!byEvent.has(s.event)) byEvent.set(s.event, []);
    byEvent.get(s.event).push(s);
  }
  const pairs = [...byEvent].filter(([, list]) => new Set(list.map((x) => x.publisher)).size >= 2);
  return pairs.length
    ? pairs.map(([event, list]) => `${event}: ${list.map((x) => `[${x.index}] ${x.publisher ?? "?"}`).join(", ")}`).join("; ")
    : "asnjë";
}

// ── prompts ───────────────────────────────────────────────────────────────
const TOPIC_SYSTEM = `Ti je redaktor i dosjeve të 383, një faqe lajmesh në Kosovë. Një dosje është historia e një teme që lajmet vazhdojnë ta prekin: çfarë ndodhi më parë që e shpjegon lajmin e sotëm.

Do të marrësh grupe artikujsh që flasin për të njëjtin subjekt. Shqyrto ÇDO grup një nga një. Propozo një dosje për çdo grup që ka të bëjë me politikë, institucione, gjykata, luftë e paqe, ekonomi, shoqëri ose shëndet publik — çdo temë ku lexuesit i duhet historia për ta kuptuar lajmin. Kalo VETËM grupet për rezultate sportive, të famshëm, argëtim ose produkte. Përdor VETËM tekstin e artikujve.

Për çdo dosje:
- "cluster_id": id e grupit, saktësisht.
- "slug": anglisht-shqip pa diakritikë, kebab-case, 2–6 fjalë (p.sh. "kosova-ne-sepa").
- "title": titull shqip për lexuesin, deri 60 shenja, pa datë. Titulli është SUBJEKTI i qëndrueshëm (një institucion, proces, mosmarrëveshje ose çështje — p.sh. "Dhomat e Specializuara të Kosovës"), JO një ngjarje e vetme e lajmit (jo "Dekretimi i ligjit…", "Kuvendi miraton…", pa vite). Një titull-ngjarje refuzohet automatikisht.
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
- ÇDO zë ka "quotes": të paktën DY citate, nga DY botues të ndryshëm (shih listën "Botuesit"). Çdo citat është {"source": indeksi, "text": fjali e kopjuar SHKRONJË PËR SHKRONJË nga ai burim, pa përkthim, të paktën 20 shenja}. Kontrolli i kërkon citatet në tekstin e shkarkuar; një citat që nuk është aty, ose një zë me një botues të vetëm, e hedh poshtë momentin. Më mirë më pak momente se sa momente të refuzuara.
- Rreshti "Burime për të njëjtën ngjarje" tregon cilat burime flasin për të njëjtën ngjarje — zgjidh momentet nga ato. Çdo fjali duhet ta thonë të dy burimet; nëse vetëm njëri e thotë një detaj, lëre detajin jashtë.
- Kopjo citatin ashtu siç është në tekst: mos ndrysho asnjë fjalë, mos e shkurto në mes, mos e përkthe.
- Çdo shifër në fjali duhet të jetë brenda citateve të ATIJ zëri, e shkruar njësoj. Mos llogarit, mos rrumbullako, mos shto numra.
- DATA: "event_date" dhe "date_precision" duhet t'i thotë një citat. Nëse citatet thonë ditën, muajin dhe vitin → "day"; vetëm muajin dhe vitin → "month" (event_date = dita e parë e muajit); vetëm vitin → "year" (event_date = 1 janar). Mos e bëj datën më të saktë se citatet.
- "why" vetëm shpjegon pse ka rëndësi; MOS shto fakte, emra apo shifra që nuk janë në moment.
- Çdo fjali e "summary" është E SHKURTËR (deri 20 fjalë) dhe thotë NJË fakt që e thonë TË DY citatet e saj. Mos përkthe një fjali të gjatë nga një burim i vetëm; shkruaj vetëm atë që burimet kanë të përbashkët. Detaje që i thotë vetëm një burim, lëri jashtë.
- "summary": dy ose tri fjali të shkurtra. "why": një fjali, "Pse ka rëndësi" — shpjegim i thjeshtë për lexuesin.
- "title": vetëm çfarë thonë fjalitë e momentit; asnjë shifër që nuk është në citate.
- Momentet janë në të kaluarën dhe renditen sipas datës. Mos përsërit momentet që ekzistojnë tashmë.
- "primer": "Në pak fjalë" — dy ose tri fjali që e shpjegojnë temën nga fillimi, me të njëjtat rregulla citimi.
- "search": për çdo moment, emri i ngjarjes ANGLISHT si titull artikulli në Wikipedia (p.sh. "Indictment of Hashim Thaçi", "Trial of Salih Mustafa"). Përdoret për të gjetur botues të tjerë për të njëjtën ngjarje.
- "date_quotes": nëse citatet e fjalive nuk e thonë datën, një fjali e kopjuar saktë nga cilido burim që e thotë datën (p.sh. "On 24 June 2020, ...").
- "videos": vetëm ID YouTube (11 shenja) që je i sigurt se ekzistojnë, VETËM nga këta kanale: ${VETTED_CHANNELS.map((c) => c.name).join(", ")}. Nëse nuk je i sigurt, kthe [].
- Nëse burimet nuk mjaftojnë, kthe momente bosh. Kjo është përgjigje e saktë.

Shkruaj shqip, në kohën e tashme historike, pa mbiemra vlerësues.`;

const RESEARCH_FORMAT = `{"primer":{"text":"...","event_date":"YYYY-MM-DD","date_precision":"day|month|year","claims":[{"sentence":"...","quotes":[{"source":0,"text":"..."},{"source":2,"text":"..."}]}]},"milestones":[{"title":"...","summary":"...","why":"...","tag":"një fjalë","event_date":"YYYY-MM-DD","date_precision":"day|month|year","search":"Event title in English","claims":[{"sentence":"...","quotes":[{"source":0,"text":"..."},{"source":1,"text":"..."}]}],"date_quotes":[{"source":2,"text":"..."}]}],"videos":[{"id":"...","channel":"...","title":"..."}]}`;

// ── corroboration ─────────────────────────────────────────────────────────
const CORROBORATE_SYSTEM = `You check a history timeline before publication. Each claim is one Albanian sentence that already has quotes from some publishers. Using ONLY the numbered sources given, find for each listed claim ONE sentence, from a source whose publisher is NOT already among that claim's publishers, that states the same fact.

Rules:
- Copy the sentence exactly as it appears, character for character, at least 20 characters. No translation, no ellipsis, no edits.
- It must state the same fact (same people, same act, same numbers). Related or background sentences do not count.
- If no source states it, return no quote for that claim. Never return a near match.
- If a moment is listed as needing its date, find one sentence in any source that states that date (day, month and year for day precision) and return it in date_quotes.

Answer only JSON: {"moments":[{"i":0,"claims":[{"j":0,"quotes":[{"source":3,"text":"..."}]}],"date_quotes":[{"source":5,"text":"..."}]}]}`;

/** Publishers of a claim's quotes, by source index in `pool`. */
const claimPublishers = (claim, pool) =>
  new Set((claim?.quotes ?? []).map((q) => pool[q?.source]?.publisher).filter(Boolean));

/** Does any quote of this moment (or its date quotes) state its date? */
const dateQuoted = (m) =>
  [...(m?.claims ?? []).flatMap((c) => c?.quotes ?? []), ...(m?.date_quotes ?? [])].some((q) =>
    dateInText(String(q?.text ?? ""), String(m?.event_date ?? ""), m?.date_precision ?? "day")
  );

/**
 * Widen the pool with each weak moment's own event, then ask once for the
 * missing second-publisher sentences and dated sentences. Mutates `pool`,
 * `milestones` and `primer` in place; nothing is trusted — publish verifies
 * every quote against the live page and the strict checks decide.
 */
async function corroborate(slug, pool, milestones, primer) {
  const moments = primer ? [...milestones, { ...primer, __primer: true }] : [...milestones];
  const weak = moments
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => (m?.claims ?? []).some((c) => claimPublishers(c, pool).size < 2) || (m?.event_date && !dateQuoted(m)));
  if (!weak.length || timeLeft() < 4 * 60_000) return { weak: weak.length, added: 0, quotes: 0 };

  let added = 0;
  for (const { m } of weak.slice(0, 5)) {
    if (!m?.search || pool.length >= 24) continue;
    const more = await site(`/daily/more?topic=${encodeURIComponent(slug)}&q=${encodeURIComponent(String(m.search).slice(0, 120))}`).catch(() => null);
    for (const s of more?.sources ?? []) {
      if (pool.length >= 24 || pool.some((p) => p.url === s.url)) continue;
      pool.push({ ...s, index: pool.length });
      added += 1;
    }
  }

  const listing = weak
    .map(({ m, i }) => {
      const claims = (m.claims ?? [])
        .map((c, j) => ({ c, j }))
        .filter(({ c }) => claimPublishers(c, pool).size < 2)
        .map(({ c, j }) => `  claim ${j}: ${c.sentence} (already quoted by: ${[...claimPublishers(c, pool)].join(", ") || "none"})`);
      const date = m.event_date && !dateQuoted(m) ? `  needs its date: ${m.event_date} (${m.date_precision ?? "day"})` : "";
      return [`moment ${i}: ${m.title ?? "Në pak fjalë"}`, ...claims, date].filter(Boolean).join("\n");
    })
    .join("\n\n");
  const sources = pool
    .map((s) => `[${s.index}] ${s.publisher ?? "?"} — ${s.title ?? ""} (${s.published_date ?? "no date"})\n${s.text}`)
    .join("\n\n---\n\n");
  let json;
  try {
    ({ json } = await ask(CORROBORATE_SYSTEM, `Moments needing corroboration:

${listing}

Sources:

${sources}`));
  } catch (err) {
    return { weak: weak.length, added, quotes: 0, error: String(err?.message ?? err).slice(0, 160) };
  }
  let quotes = 0;
  for (const found of Array.isArray(json?.moments) ? json.moments : []) {
    const m = moments[found?.i];
    if (!m) continue;
    const target = m.__primer ? primer : m;
    for (const fc of Array.isArray(found?.claims) ? found.claims : []) {
      const claim = target?.claims?.[fc?.j];
      if (!claim) continue;
      const have = claimPublishers(claim, pool);
      for (const q of Array.isArray(fc?.quotes) ? fc.quotes : []) {
        const pub = pool[q?.source]?.publisher;
        if (!pub || have.has(pub)) continue;
        claim.quotes = [...(claim.quotes ?? []), { source: q.source, text: String(q.text ?? "") }];
        have.add(pub);
        quotes += 1;
      }
    }
    const dq = (Array.isArray(found?.date_quotes) ? found.date_quotes : []).filter((q) => pool[q?.source]);
    if (dq.length) {
      target.date_quotes = [...(target.date_quotes ?? []), ...dq.map((q) => ({ source: q.source, text: String(q.text ?? "") }))];
      quotes += dq.length;
    }
  }
  log({ stage: "corroborate", slug, weak: weak.length, added, quotes });
  return { weak: weak.length, added, quotes };
}

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
      const sources = ev.sources.map((s) => `[${s.index}] ${s.publisher ?? "?"} — ${s.title ?? ""} (${s.published_date ?? "pa datë"})${s.event ? ` · ngjarja: ${s.event}` : ""}\n${s.text}`).join("\n\n---\n\n");
      const task =
        `Tema: ${ev.topic.title}\nPër lexuesin: ${ev.topic.blurb}\n` +
        `Lajmet e fundit për temën: ${JSON.stringify(subject.headlines ?? [])}\n` +
        `Momente që ekzistojnë tashmë (mos i përsërit): ${JSON.stringify((ev.existing ?? []).map((m) => `${m.event_date} ${m.title}`))}\n\n` +
        // Spelled out because a moment is refused unless its citations span two
        // publishers, and models otherwise cite one source per moment.
        `Botuesit: ${ev.sources.map((s) => `[${s.index}] ${s.publisher ?? "?"}`).join(", ")}\n` +
        // Sources led to by the same event page are the ones that can quote one claim together.
        `Burime për të njëjtën ngjarje: ${pairsOf(ev.sources)}\n\n` +
        `Burimet:\n\n${sources}\n\nFormati: ${RESEARCH_FORMAT}`;
      const { json, model } = await ask(RESEARCH_SYSTEM, task);
      const pool = ev.sources.map((s) => ({ ...s }));
      const milestones = Array.isArray(json?.milestones) ? json.milestones : [];
      const primer = json?.primer ?? null;
      // A claim needs quotes from two publishers and the date must be in a
      // quote. Drafts are usually one article translated: find the event's
      // other outlets, then ask for their matching sentences.
      entry.corroboration = await corroborate(subject.slug, pool, milestones, primer);
      // From here the publish step owns the claim and closes it.
      claimed = null;
      entry.receipt = await site("/daily/publish", {
        method: "POST",
        body: JSON.stringify({
          topic_slug: subject.slug,
          run_id: ev.run_id,
          model,
          sources: pool.map((s) => s.url),
          milestones,
          primer,
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
  try { writeFileSync(REPORTED, run.runId); } catch { /* the hook then may send a second note; harmless */ }
} catch (err) {
  log({ stage: "report", sent: false, error: String(err?.message ?? err).slice(0, 200) });
  process.exitCode = 1;
}
log({ stage: "done", errors: run.errors, subjects: run.subjects.length, luna: run.calls.luna, gemini: run.calls.gemini });
if (run.errors.length || run.subjects.some((s) => s.error && !s.error.startsWith("deadline"))) process.exitCode = 1;
