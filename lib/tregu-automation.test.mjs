import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDailyDraftPlan,
  buildRepricePlan,
  isAutomationAuthorized,
  validateDailyDraftSubmission,
  buildDraftReviewEmail,
  buildDailyCodexCommand,
  buildLiveScorePlan,
  buildExactFourDraftPreview,
  buildLiveEventDraftSubmission,
  TREGU_DRAFT_REVIEW_RECIPIENT,
} from "./tregu-automation.mjs";
import { kosovoLocalDate } from "./tregu-date-key.mjs";

const now = new Date("2026-07-13T05:00:00.000Z");

test("Kosovo date keys fall back to Europe/Belgrade only when Europe/Pristina is unsupported", () => {
  const attemptedTimeZones = [];
  class PristinaUnsupportedDateTimeFormat {
    constructor(_locale, options) {
      attemptedTimeZones.push(options.timeZone);
      if (options.timeZone === "Europe/Pristina") throw new RangeError("Invalid time zone specified: Europe/Pristina");
    }

    formatToParts() {
      return [
        { type: "year", value: "2026" },
        { type: "literal", value: "-" },
        { type: "month", value: "07" },
        { type: "literal", value: "-" },
        { type: "day", value: "13" },
      ];
    }
  }

  assert.equal(kosovoLocalDate(now, PristinaUnsupportedDateTimeFormat), "2026-07-13");
  assert.deepEqual(attemptedTimeZones, ["Europe/Pristina", "Europe/Belgrade"]);
});

test("daily draft plan retains only high-quality, unique, admin-review drafts", () => {
  const plan = buildDailyDraftPlan({
    candidates: [
      {
        question: "Ligji i ri miratohet deri më 31 dhjetor?",
        description: "Vendim binar i verifikueshëm nga burimi zyrtar.",
        resolution_criteria: "Zgjidhet sipas njoftimit zyrtar dhe votimit të publikuar nga Kuvendi deri më 31 dhjetor.",
        category: "politike",
        closes_in_days: 7,
        source_slugs: ["kuvendi-ligji"],
      },
      {
        question: "Ligji i ri miratohet deri më 31 dhjetor?",
        description: "Kopje e kandidatit të parë.",
        resolution_criteria: "Zgjidhet sipas njoftimit zyrtar dhe votimit të publikuar nga Kuvendi deri më 31 dhjetor.",
        category: "politike",
        closes_in_days: 7,
        source_slugs: ["kuvendi-ligji"],
      },
      {
        question: "Vendimi publikohet deri më 31 dhjetor?",
        description: "Pa provë të mjaftueshme.",
        resolution_criteria: "",
        category: "politike",
        closes_in_days: 7,
        source_slugs: [],
      },
    ],
    existingQuestions: ["Buxheti miratohet deri më 31 dhjetor?"],
    now,
  });

  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].status, "draft");
  assert.equal(plan.rows[0].ai_generated, true);
  assert.equal(plan.rows[0].closes_at, "2026-12-31T21:59:59.999Z");
  assert.deepEqual(plan.rows[0].source_article_slugs, ["kuvendi-ligji"]);
  assert.equal(plan.rejected.length, 2);
});

test("reprice plan includes every open market and retains only verified non-social evidence", () => {
  const plan = buildRepricePlan({
    markets: [
      {
        id: "affected",
        status: "open",
        category: "politike", question: "Kuvendi miraton ligjin e ri deri më 31 dhjetor?", resolution_criteria: "Ligji i ri miratohet nga Kuvendi deri më 31 dhjetor.",
        source_article_slugs: ["kuvendi-ligji"],
        q_yes: 21,
        q_no: 8,
        b: 100,
        last_news_at: "2026-07-13T04:00:00.000Z",
      },
      {
        id: "unaffected",
        status: "open",
        category: "sport",
        source_article_slugs: ["ndeshja"],
        q_yes: 3,
        q_no: 4,
        b: 100,
        last_news_at: "2026-07-13T04:00:00.000Z",
      },
    ],
    verifiedArticles: [
      { slug: "kuvendi-ligji", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Kuvendi i Kosovës", title: "Kuvendi miraton ligjin e ri" },
      { slug: "e-vjeter", category: "Politikë", publishedAt: "2026-07-13T03:00:00.000Z" },
      { slug: "social-thashethem", category: "Politikë", publishedAt: "2026-07-13T04:45:00.000Z", source: "X / Twitter", verification: "social_only" },
    ],
  });

  assert.deepEqual(plan.map((item) => item.market.id), ["affected", "unaffected"]);
  assert.equal(plan[0].market.status, "open");
  assert.equal(plan[0].evidence[0].slug, "kuvendi-ligji");
  assert.deepEqual(plan[1].evidence, []);
});

test("failed scoring records an auditable signal failure without pausing an open market", () => {
  const plan = buildRepricePlan({
    markets: [{
      id: "affected", status: "open", category: "politike", question: "Kuvendi miraton ligjin e ri deri më 31 dhjetor?", resolution_criteria: "Ligji i ri miratohet nga Kuvendi deri më 31 dhjetor.", source_article_slugs: ["kuvendi-ligji"],
      q_yes: 21, q_no: 8, b: 100, last_news_at: null,
    }],
    verifiedArticles: [{ slug: "kuvendi-ligji", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", title: "Kuvendi miraton ligjin e ri" }],
  });
  const failure = plan[0].scoreFailure(new Error("GROQ_API_KEY is not set"));

  assert.equal(failure.status, "open");
  assert.equal(failure.snapshot, null);
  assert.equal(failure.marketUpdate.status, "open");
  assert.match(failure.audit.error, /GROQ_API_KEY/);
});

test("verified Groq scoring moves live LMSR odds by its capped hybrid oracle adjustment", () => {
  const plan = buildRepricePlan({
    markets: [{
      id: "hormuz", slug: "hormuz-hapet", question: "Ngushtica e Hormuzit rihapet deri më 20 korrik?", status: "open", category: "bote", source_article_slugs: ["iran-trump-deal"],
      q_yes: 0, q_no: 0, b: 100, last_news_at: null,
    }],
    verifiedArticles: [{ slug: "iran-trump-deal", category: "Botë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Reuters", url: "https://www.reuters.com/example", title: "Ngushtica e Hormuzit rihapet pas marrëveshjes Iran Trump" }],
  });
  const success = plan[0].scoreSuccess({ probability: 0.82, reasoning: "Reuters raporton marrëveshje Iran/Trump që mbështet rihapjen.", cited_slugs: ["iran-trump-deal"] });

  assert.equal(success.marketUpdate.status, "open");
  assert.equal(success.snapshot.reference_probability, 0.82);
  assert.equal(success.snapshot.ai_prob, 0.82);
  assert.equal(success.snapshot.oracle_kind, "news_oracle");
  assert.deepEqual(success.snapshot.evidence_slugs, ["iran-trump-deal"]);
  assert.equal(success.snapshot.market_prob_before, 0.5);
  assert.equal(success.snapshot.market_prob, 0.52);
  assert.equal(success.snapshot.oracle_cap, 0.02);
  assert.equal(success.marketUpdate.q_yes > 0, true);
  assert.equal(success.marketUpdate.q_no < 0, true);
});

test("social-only evidence cannot reprice and large hybrid moves require independent corroboration", () => {
  const market = { id: "affected", status: "open", category: "politike", question: "Kuvendi miraton ligjin e ri deri më 31 dhjetor?", resolution_criteria: "Ligji i ri miratohet nga Kuvendi deri më 31 dhjetor.", source_article_slugs: ["official", "social"], q_yes: 0, q_no: 0, b: 400, last_news_at: null };
  const socialOnly = buildRepricePlan({
    markets: [market],
    verifiedArticles: [{ slug: "social", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "X / Twitter" }],
  });
  assert.equal(socialOnly.length, 1);
  assert.deepEqual(socialOnly[0].evidence, []);

  const singleSource = buildRepricePlan({
    markets: [market],
    verifiedArticles: [{ slug: "official", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Reuters", title: "Kuvendi miraton ligjin e ri" }],
  });
  assert.equal(singleSource[0].scoreSuccess({ probability: 0.99, reasoning: "Raport i verifikuar.", cited_slugs: ["official"] }).snapshot.market_prob, 0.52);

  const corroborated = buildRepricePlan({
    markets: [market],
    verifiedArticles: [
      { slug: "official", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Reuters", title: "Kuvendi miraton ligjin e ri" },
      { slug: "agency", category: "Politikë", publishedAt: "2026-07-13T04:31:00.000Z", source: "Associated Press", title: "Kuvendi miraton ligjin e ri" },
    ],
  });
  const move = corroborated[0].scoreSuccess({ probability: 0.99, reasoning: "Dy burime të pavarura.", cited_slugs: ["official", "agency"] });
  assert.equal(move.snapshot.market_prob, 0.55);
  assert.equal(move.snapshot.oracle_cap, 0.05);
  assert.equal(move.snapshot.evidence_sources.length, 2);
});

test("closed and resolved markets never receive hybrid oracle adjustments", () => {
  const plan = buildRepricePlan({
    markets: [
      { id: "closed", status: "closed", category: "politike", source_article_slugs: ["official"], q_yes: 0, q_no: 0, b: 400, last_news_at: null },
      { id: "resolved", status: "resolved", category: "politike", source_article_slugs: ["official"], q_yes: 0, q_no: 0, b: 400, last_news_at: null },
    ],
    verifiedArticles: [{ slug: "official", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Reuters" }],
  });
  assert.deepEqual(plan, []);
});

test("successful scoring retains fresh triggering evidence when the model omits it", () => {
  const [item] = buildRepricePlan({
    markets: [{
      id: "affected", status: "open", category: "politike", question: "Kuvendi miraton ligjin e ri deri më 31 dhjetor?", resolution_criteria: "Ligji i ri miratohet nga Kuvendi deri më 31 dhjetor.", source_article_slugs: ["kuvendi-ligji"],
      q_yes: 0, q_no: 0, b: 100, last_news_at: null,
    }],
    verifiedArticles: [{ slug: "kuvendi-ligji", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", title: "Kuvendi miraton ligjin e ri" }],
  });

  const success = item.scoreSuccess({ probability: 0.6, reasoning: "Vlerësim.", cited_slugs: ["artikull-i-vjeter"] });
  assert.deepEqual(success.snapshot.evidence_slugs, ["kuvendi-ligji"]);
});

test("automation authentication accepts only the configured bearer secret", () => {
  assert.equal(isAutomationAuthorized("Bearer correct", "correct"), true);
  assert.equal(isAutomationAuthorized("Bearer wrong", "correct"), false);
  assert.equal(isAutomationAuthorized("Bearer correct", ""), false);
});

test("daily draft submission accepts only a Codex-sized source-cited set of binary draft markets", () => {
  const candidates = [
    {
      question: "Ligji i ri miratohet deri më 31 dhjetor?",
      description: "Vendim binar i verifikueshëm nga burimi zyrtar.",
      resolution_criteria: "Zgjidhet sipas njoftimit zyrtar dhe votimit të publikuar nga Kuvendi deri më 31 dhjetor.",
      category: "politike",
      closes_in_days: 7,
      source_slugs: ["kuvendi-ligji"],
    },
    {
      question: "Eksporti rekord arrihet deri më 20 korrik?",
      description: "Rezultati krahasohet me statistikat zyrtare të publikuara.",
      resolution_criteria: "Zgjidhet sipas të dhënave zyrtare të publikuara nga Agjencia e Statistikave deri më 20 korrik.",
      category: "ekonomi",
      closes_in_days: 12,
      source_slugs: ["eksportet"],
    },
    {
      question: "Kosova fiton ndeshjen deri më 21 korrik?",
      description: "Rezultati final verifikohet nga federata dhe organizatori.",
      resolution_criteria: "Zgjidhet sipas rezultatit final të publikuar nga federata dhe organizatori deri më 21 korrik.",
      category: "sport",
      closes_in_days: 14,
      source_slugs: ["kombetarja"],
    },
  ];

  assert.deepEqual(
    validateDailyDraftSubmission(candidates, new Set(["kuvendi-ligji", "eksportet", "kombetarja"])),
    { ok: true, candidates }
  );
  assert.match(
    validateDailyDraftSubmission(candidates.slice(0, 2), new Set(["kuvendi-ligji", "eksportet"])).error,
    /3.*5/
  );
  assert.match(
    validateDailyDraftSubmission([{ ...candidates[0], source_slugs: ["inventuar"] }, ...candidates.slice(1)], new Set(["kuvendi-ligji", "eksportet", "kombetarja"])).error,
    /cituar/
  );
});

test("daily drafts use short Polymarket-style titles, a deadline and explicit resolution criteria", () => {
  const candidates = [
    {
      question: "Ngushtica e Hormuzit rihapet deri më 20 korrik?",
      description: "Zhvillim i fundit i sigurisë detare me ndikim ndërkombëtar.",
      resolution_criteria: "Zgjidhet PO vetëm kur njoftimi zyrtar i autoriteteve detare konfirmon kalim të rregullt civil deri më 20 korrik.",
      category: "bote",
      closes_in_days: 7,
      source_slugs: ["hormuz"],
    },
    {
      question: "Kosova fiton ndeshjen deri më 18 korrik?",
      description: "Rezultati i ndeshjes së ardhshme zyrtare të kombëtares.",
      resolution_criteria: "Zgjidhet sipas rezultatit final të publikuar nga federata dhe organizatori deri më 18 korrik.",
      category: "sport",
      closes_in_days: 5,
      source_slugs: ["kombetarja"],
    },
    {
      question: "Kuvendi voton projektligjin deri më 19 korrik?",
      description: "Votimi lidhet me debat aktual parlamentar dhe afat publik.",
      resolution_criteria: "Zgjidhet sipas procesverbalit dhe njoftimit zyrtar të Kuvendit deri më 19 korrik.",
      category: "politike",
      closes_in_days: 6,
      source_slugs: ["kuvendi-ligji"],
    },
  ];
  const known = new Set(["hormuz", "kombetarja", "kuvendi-ligji"]);

  assert.equal(validateDailyDraftSubmission(candidates, known).ok, true);
  assert.match(validateDailyDraftSubmission([{ ...candidates[0], question: "A do të rihapet Ngushtica e Hormuzit deri më 20 korrik?" }, ...candidates.slice(1)], known).error, /titull|Polymarket/i);
  assert.match(validateDailyDraftSubmission([{ ...candidates[0], question: "Ngushtica e Hormuzit rihapet?" }, ...candidates.slice(1)], known).error, /afat/i);
  assert.match(validateDailyDraftSubmission([{ ...candidates[0], closes_in_days: 60 }, ...candidates.slice(1)], known).error, /48|objektiv/i);
});

test("launch migration makes 400 the LMSR default and records a trade-only market snapshot after each bet", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0005_tregu_execution_integrity.sql", import.meta.url), "utf8");

  assert.match(migration, /alter column b set default 400/i);
  assert.match(migration, /insert into public\.market_snapshots/i);
  assert.match(migration, /oracle_kind[\s\S]*'trade'/i);
  assert.match(migration, /v_new_price_yes\s*:=\s*public\.lmsr_price_yes/i);
  assert.match(migration, /market_prob[\s\S]*v_new_price_yes/i);
  assert.doesNotMatch(migration, /status\s*=\s*'stale'/i);
});

test("hybrid oracle migration atomically caps and audits system odds moves without touching user ledgers", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0006_tregu_hybrid_news_oracle.sql", import.meta.url), "utf8");

  assert.match(migration, /create or replace function public\.apply_news_oracle/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /v_market\.status\s*<>\s*'open'/i);
  assert.match(migration, /v_market\.closes_at\s*<=\s*now\(\)/i);
  assert.match(migration, /least\(0\.05/i);
  assert.match(migration, /oracle_kind[\s\S]*'news_oracle'/i);
  assert.match(migration, /market_prob_before/i);
  assert.match(migration, /oracle_cap/i);
  assert.doesNotMatch(migration, /update public\.profiles/i);
  assert.doesNotMatch(migration, /update public\.positions/i);
  assert.doesNotMatch(migration, /insert into public\.transactions/i);
});

test("official live-score migrations accept only configured ESPN events, cap movements, and close only on official final states without ledger writes", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0008_tregu_official_live_score_oracle.sql", import.meta.url), "utf8");
  const finalStatusMigration = readFileSync(new URL("../supabase/migrations/0009_tregu_live_score_full_time_final_status.sql", import.meta.url), "utf8");

  assert.match(migration, /add column if not exists live_event jsonb/i);
  assert.match(migration, /create or replace function public\.apply_live_score_oracle/i);
  assert.match(migration, /p_provider <> 'espn'/i);
  assert.match(migration, /v_market\.live_event->>'event_id' <> p_event_id/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /least\(0\.10/i);
  assert.match(migration, /status = case when p_close_market then 'closed'/i);
  assert.match(migration, /oracle_kind[\s\S]*'live_score'/i);
  assert.doesNotMatch(migration, /update public\.profiles/i);
  assert.doesNotMatch(migration, /update public\.positions/i);
  assert.doesNotMatch(migration, /insert into public\.transactions/i);
  assert.match(finalStatusMigration, /create or replace function public\.apply_live_score_oracle/i);
  assert.match(finalStatusMigration, /FULL_TIME/i);
  assert.match(finalStatusMigration, /detail[\s\S]*FT/i);
  assert.match(finalStatusMigration, /status = case when p_close_market then 'closed'/i);
  assert.doesNotMatch(finalStatusMigration, /update public\.profiles/i);
  assert.doesNotMatch(finalStatusMigration, /update public\.positions/i);
  assert.doesNotMatch(finalStatusMigration, /insert into public\.transactions/i);
});

test("tregu-live market update endpoint delegates to the isolated five-minute news repricer", () => {
  const route = readFileSync(new URL("../app/api/cron/update-markets/route.ts", import.meta.url), "utf8");

  assert.match(route, /runTreguLiveAutomation/);
  assert.match(route, /status:\s*401/);
  assert.doesNotMatch(route, /runLiveSportsAutomation|runOfficialSportsRefresh/);
  assert.doesNotMatch(route, /market_snapshots/);
});

test("shared Tregu snapshot type recognizes hybrid oracle movements", () => {
  const types = readFileSync(new URL("./tregu-client.ts", import.meta.url), "utf8");

  assert.match(types, /oracle_kind\?:[\s\S]*"news_oracle"/);
});

test("draft review email renders high-contrast, email-client-safe cards with review-only links and no secrets", () => {
  const html = buildDraftReviewEmail({
    appUrl: "https://383.example",
    reviewPath: "/admin/tregu/review?drafts=run-123",
    markets: [{
      category: "politike",
      closes_at: "2026-08-12T05:00:00.000Z",
      question: "A do të miratohet ligji i ri deri më 31 dhjetor?",
      description: "Vendim binar i verifikueshëm nga burimi zyrtar.",
      source_article_slugs: ["kuvendi-ligji"],
      evidence: [{ slug: "kuvendi-ligji", title: "Kuvendi shqyrton ligjin" }],
    }],
  });

  assert.match(html, /role="presentation"/);
  assert.match(html, /bgcolor="#FFFFFF"/);
  assert.match(html, /background-color:#0F172A/);
  assert.match(html, /color:#111827/);
  assert.match(html, /color:#FFFFFF/);
  assert.doesNotMatch(html, /backdrop-filter|linear-gradient|radial-gradient|rgba\(/i);
  assert.match(html, /Politikë/);
  assert.match(html, /PO/);
  assert.match(html, /JO/);
  assert.match(html, /Kuvendi shqyrton ligjin/);
  assert.match(html, /Hap rishikimin/);
  assert.match(html, /https:\/\/383\.example\/admin\/tregu\/review\?drafts=run-123/);
  assert.doesNotMatch(html, /ADMIN_SECRET|secret=/i);
  assert.doesNotMatch(html, /<form/i);
});


test("daily draft runner explicitly uses the VPS Codex OAuth model and the fixed Gmail review recipient", () => {
  const command = buildDailyCodexCommand("only verified sources");
  const runner = readFileSync(new URL("../scripts/run-tregu-daily-drafts.mjs", import.meta.url), "utf8");

  assert.deepEqual(command, ["chat", "-Q", "--provider", "openai-codex", "--model", "gpt-5.6-terra", "--toolsets", "safe", "-q", "only verified sources"]);
  assert.equal(TREGU_DRAFT_REVIEW_RECIPIENT, "lindsylqa@gmail.com");
  assert.match(runner, /process\.env\.HERMES_BIN \?\? "\/opt\/hermes\/\.venv\/bin\/hermes"/);
  assert.match(runner, /process\.env\.HERMES_HOME \?\? "\/opt\/data"/);
});

test("daily drafts close breaking markets in hours and may use official live-event closing", () => {
  const liveCandidate = {
    question: "Franca në finale deri më 14 korrik?",
    description: "Franca përballet me Spanjën në ndeshjen gjysmëfinale të Kupës së Botës.",
    resolution_criteria: "PO: Franca arrin finalen vetëm nëse ESPN e shënon Francën fituese në rezultatin zyrtar përfundimtar të ndeshjes France–Spain. JO: Spanja arrin finalen ose ndeshja nuk jep fitoren e Francës.",
    category: "sport", closes_at: "2026-07-15T01:00:00.000Z", source_slugs: [],
    live_event: { provider: "espn", event_id: "760514", yes_team: "France", league: "fifa.world" },
  };
  const breaking = {
    question: "Qeveria publikon vendimin deri më 15 korrik?",
    description: "Njoftimi i ri zyrtar pritet brenda ciklit aktual të lajmeve.",
    resolution_criteria: "Zgjidhet sipas publikimit zyrtar të qeverisë deri më 15 korrik, ora 23:59 në Kosovë.",
    category: "politike", closes_in_hours: 12, source_slugs: ["qeveria-njoftim"],
  };
  const third = { ...breaking, question: "Kuvendi publikon rendin e ditës deri më 15 korrik?", source_slugs: ["kuvendi-rend-dite"] };
  const fourth = { ...breaking, question: "Banka publikon vendimin deri më 15 korrik?", source_slugs: ["banka-vendim"] };
  const known = new Set(["qeveria-njoftim", "kuvendi-rend-dite", "banka-vendim"]);

  assert.equal(validateDailyDraftSubmission([liveCandidate, breaking, third, fourth], known).ok, true);
  assert.match(validateDailyDraftSubmission([{ ...breaking, closes_in_hours: 49 }, liveCandidate, third, fourth], known).error, /48/);
  assert.equal(buildDailyDraftPlan({ candidates: [breaking], existingQuestions: [], now }).rows[0].closes_at, "2026-07-15T21:59:59.999Z");
  assert.equal(buildDailyDraftPlan({ candidates: [liveCandidate], existingQuestions: [], now }).rows[0].closes_at, liveCandidate.closes_at);
});

test("official ESPN Spain 0-2 France STATUS_FULL_TIME FT payload closes the market", () => {
  const market = { id: "spain-france", status: "open", q_yes: 0, q_no: 0, b: 400, live_score_state: null, live_event: { provider: "espn", event_id: "760514", yes_team: "France", league: "fifa.world" } };
  const halftime = { provider: "espn", event_id: "760514", league: "fifa.world", status: "STATUS_HALFTIME", detail: "HT", competitors: [{ team: "France", homeAway: "home", score: 0 }, { team: "Spain", homeAway: "away", score: 1 }], source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260714" };
  const [signal] = buildLiveScorePlan({ markets: [market], events: [halftime] });
  assert.equal(signal.snapshot.oracle_kind, "live_score");
  assert.equal(signal.snapshot.oracle_cap, 0.1);
  assert.equal(signal.snapshot.market_prob_before, 0.5);
  assert.equal(signal.snapshot.reference_probability, 0.35);
  assert.equal(signal.snapshot.market_prob, 0.4);
  assert.match(signal.snapshot.oracle_reasoning, /France 0–1 Spain/);
  assert.equal(signal.close_market, false);
  assert.deepEqual(buildLiveScorePlan({ markets: [{ ...market, live_score_state: { key: signal.state_key } }], events: [halftime] }), []);

  const fullTime = { ...halftime, status: "STATUS_FULL_TIME", detail: "FT", competitors: [{ team: "Spain", homeAway: "home", score: 0 }, { team: "France", homeAway: "away", score: 2, winner: true }] };
  const [finalSignal] = buildLiveScorePlan({ markets: [market], events: [fullTime] });
  assert.equal(finalSignal.close_market, true);
  assert.equal(finalSignal.snapshot.reference_probability, 0.99);
  assert.match(finalSignal.snapshot.oracle_reasoning, /France 2–0 Spain/);
});

test("official ESPN FT detail closes a market even when the status name is not FINAL", () => {
  const market = { id: "spain-france", status: "open", q_yes: 0, q_no: 0, b: 400, live_score_state: null, live_event: { provider: "espn", event_id: "760514", yes_team: "France", league: "fifa.world" } };
  const event = { provider: "espn", event_id: "760514", league: "fifa.world", status: "STATUS_SCHEDULED", detail: "FT", competitors: [{ team: "Spain", homeAway: "home", score: 0 }, { team: "France", homeAway: "away", score: 2, winner: true }], source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760514" };

  assert.equal(buildLiveScorePlan({ markets: [market], events: [event] })[0].close_market, true);
});

test("exact-four preview makes three verified-news drafts plus Spain-France without writes", () => {
  const articles = [
    { slug: "qeveria-njoftim", title: "Qeveria jep njoftim", source: "Qeveria e Kosovës" },
    { slug: "kuvendi-rend-dite", title: "Kuvendi publikon rendin", source: "Kuvendi i Kosovës" },
    { slug: "banka-vendim", title: "Banka njofton vendimin", source: "BQK" },
  ];
  const candidates = articles.map((article, index) => ({
    question: ["Qeveria publikon vendimin deri më 15 korrik?", "Kuvendi publikon rendin e ditës deri më 15 korrik?", "Banka publikon vendimin deri më 15 korrik?"][index],
    description: `Kartë draft nga burimi i verifikuar ${article.source}.`,
    resolution_criteria: `Zgjidhet sipas publikimit zyrtar të cituar nga ${article.source} deri më 15 korrik, ora 23:59 në Kosovë.`,
    category: index === 2 ? "ekonomi" : "politike", closes_in_hours: 12, source_slugs: [article.slug],
  }));
  const preview = buildExactFourDraftPreview({ candidates, articles, event: { event_id: "760514", status: "STATUS_HALFTIME" }, now: new Date("2026-07-14T20:00:00.000Z") });
  assert.equal(preview.rows.length, 4);
  const liveMarket = preview.rows.find((row) => row.live_event?.event_id === "760514");
  assert.equal(liveMarket.question, "Franca në finale deri më 14 korrik?");
  assert.match(liveMarket.resolution_criteria, /PO: Franca arrin finalen/);
  assert.match(liveMarket.resolution_criteria, /JO: Spanja arrin finalen/);
  assert.equal(liveMarket.live_event.yes_team, "France");
  assert.equal(preview.rows.every((row) => row.status === "draft"), true);
  assert.throws(() => buildExactFourDraftPreview({ candidates: candidates.slice(0, 2), articles, event: { event_id: "760514", status: "STATUS_HALFTIME" }, now }), /three/);
});

test("live-event preview uses a separate deterministic event run key only when applying an exact four-card payload", () => {
  const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }, { live_event: { provider: "espn", event_id: "760514" } }];
  const now = new Date("2026-07-14T20:00:00.000Z");

  assert.deepEqual(buildLiveEventDraftSubmission({ candidates, args: [], now }), {
    apply: false,
    body: { candidates, dryRun: true },
  });
  assert.deepEqual(buildLiveEventDraftSubmission({ candidates, args: ["--apply"], now }), {
    apply: true,
    body: { candidates, dryRun: false, runKey: "live-event-drafts:2026-07-14:760514" },
  });
  assert.throws(() => buildLiveEventDraftSubmission({ candidates: candidates.slice(0, 3), args: ["--apply"], now }), /exactly four/i);
  assert.throws(() => buildLiveEventDraftSubmission({ candidates: [...candidates.slice(0, 3), { live_event: { provider: "espn", event_id: "bad/id" } }], args: ["--apply"], now }), /event id/i);
});

test("live-event runner delegates apply gating, preserves draft-only review, and emails only newly created drafts", () => {
  const runner = readFileSync(new URL("../scripts/preview-tregu-live-event-drafts.mjs", import.meta.url), "utf8");
  const endpoint = readFileSync(new URL("../app/api/automation/tregu/daily-drafts/route.ts", import.meta.url), "utf8");
  const automation = readFileSync(new URL("../lib/tregu-automation-server.ts", import.meta.url), "utf8");

  assert.match(runner, /buildLiveEventDraftSubmission/);
  assert.match(runner, /now:\s*new Date\(\)/);
  assert.match(runner, /body:\s*JSON\.stringify\(submission\.body\)/);
  assert.match(endpoint, /runDailyDraftAutomation\(body\.candidates, new Date\(\), body\.runKey\)/);
  assert.match(automation, /buildLiveEventDraftRunKey\(\{ candidates, now \}\)/);
  assert.match(automation, /requestedRunKey !== undefined && typeof requestedRunKey !== "string"/);
  assert.match(automation, /requestedRunKey !== expectedLiveEventRunKey/);
  assert.match(runner, /if\s*\(!submission\.apply\)[\s\S]*else/);
  assert.match(runner, /!result\.skipped\s*&&\s*result\.created\s*>\s*0/);
  assert.match(runner, /buildDraftReviewEmail/);
  assert.match(runner, /TREGU_DRAFT_REVIEW_RECIPIENT/);
  assert.match(runner, /admin\/tregu\/review\?drafts=/);
  assert.doesNotMatch(runner, /status:\s*["']open["']/);
});


test("a date-only Albanian deadline closes at the end of that Europe/Pristina day", () => {
  const candidate = { question: "Trump urdhëron goditje amerikane deri më 25 korrik?", description: "Afat binar me datë të shprehur.", resolution_criteria: "PO vetëm nëse urdhri publikohet deri më 25 korrik 2026.", category: "bote", closes_in_days: 2, source_slugs: ["iran-source"] };
  const row = buildDailyDraftPlan({ candidates: [candidate], existingQuestions: [], now: new Date("2026-07-23T05:00:00.000Z") }).rows[0];
  assert.equal(row.closes_at, "2026-07-25T21:59:59.999Z");
});
