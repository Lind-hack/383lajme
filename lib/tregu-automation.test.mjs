import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDailyDraftPlan,
  dailyDraftPublicationReason,
  buildRepricePlan as rawBuildRepricePlan,
  evidenceIdentity,
  NEWS_EVIDENCE_LOOKBACK_DAYS,
  classifyDailyAudience,
  isAutomationAuthorized,
  validateDailyDraftSubmission,
  buildDraftReviewEmail,
  buildDailyCodexCommand,
  buildLiveScorePlan,
  buildExactFourDraftPreview,
  buildLiveEventDraftSubmission,
  isEligibleNewsDeadlineMarket,
  TREGU_DRAFT_REVIEW_RECIPIENT,
} from "./tregu-automation.mjs";
import { kosovoLocalDate } from "./tregu-date-key.mjs";
import {
  DAILY_MARKET_CONTRACT_VERSION,
  deriveDailyTopicKey,
  evaluateDailyMarketCandidate,
  selectDailySourceArticles,
} from "./tregu-daily-market-quality.mjs";

const now = new Date("2026-07-13T05:00:00.000Z");
const buildRepricePlan = ({ verifiedArticles, now: scanNow = now, ...options }) => rawBuildRepricePlan({
  ...options,
  now: scanNow,
  verifiedArticles: (verifiedArticles ?? []).map((article) => ({
    ...article,
    url: article.url ?? `https://${String(article.source ?? article.slug ?? "article").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.evidence.test/article`,
    body: article.body ?? "Ky është trupi i plotë i artikullit të ruajtur nga botuesi, me faktet, aktorët, datën, kontekstin dhe kriteret që lejojnë verifikimin editorial të zhvillimit të raportuar. Artikulli përfshin deklaratat origjinale, dokumentet e kontrollueshme, vendin e ngjarjes dhe kufijtë e pyetjes së tregut. Ky material nuk është vetëm titull ose përmbledhje e shkurtër, por tekst i mjaftueshëm për shqyrtim të pavarur dhe citim të burimit.",
  })),
});

test("deadline eligibility excludes mislabeled sport markets before the deadline RPC", () => {
  assert.equal(isEligibleNewsDeadlineMarket({ status: "open", market_type: "binary", market_classification: "general_news", category: "sport" }), false);
  assert.equal(isEligibleNewsDeadlineMarket({ status: "open", market_type: "binary", market_classification: "general_news", category: "politike" }), true);
});

test("news repricing rejects stale, unrelated, headline-only, and already-consumed evidence before provider scoring", () => {
  const scanNow = new Date("2026-08-29T12:00:00.000Z");
  const market = {
    id: "market-kurti-abdixhiku",
    slug: "kurti-dhe-abdixhiku-takohen-deri-me-2-shtator",
    status: "open",
    category: "politike",
    market_classification: "general_news",
    market_type: "binary",
    question: "Kurti dhe Abdixhiku takohen deri më 2 shtator?",
    source_article_slugs: ["old-kurti-source"],
    last_news_at: null,
    q_yes: 0,
    q_no: 0,
    b: 100,
    closes_at: "2026-09-02T00:00:00.000Z",
  };
  const body = "Burimi përshkruan zhvillimin e drejtpërdrejtë, palët e përfshira, afatin dhe deklaratat e tyre me detaje të mjaftueshme për kontroll editorial. Artikulli shënon datën, vendin, aktorët, dokumentet publike, reagimet e palëve dhe mënyrën se si do të verifikohet përfundimi. Ky tekst shtesë përfaqëson trupin e plotë të artikullit dhe jo vetëm një titull të agreguar.";
  const stale = { slug: "old-kurti-source", title: "Kurti dhe Abdixhiku takohen", excerpt: "", body, source: "Reuters", url: "https://www.reuters.com/world/europe/kurti-abdixhiku", publishedAt: "2026-03-01T00:00:00.000Z", category: "Politikë" };
  const unrelated = { slug: "putin-source", title: "Putin takohet me një udhëheqës tjetër", excerpt: "Takimi u zhvillua në Moskë.", body, source: "BBC News", url: "https://www.bbc.com/news/world-europe-putin", publishedAt: "2026-08-29T11:40:00.000Z", category: "Politikë" };
  const headlineOnly = { slug: "fresh-headline", title: "Kurti dhe Abdixhiku në takim", excerpt: "Kurti dhe Abdixhiku në takim", body: "Kurti dhe Abdixhiku në takim", source: "Daily source", url: "https://example.com/fresh", verification: "external_google_news", publishedAt: "2026-08-29T11:45:00.000Z", category: "Politikë" };
  const fresh = { slug: "fresh-kurti-source", title: "Kurti dhe Abdixhiku nisin konsultimet për takimin e radhës", excerpt: "Të dy liderët konfirmuan konsultimet dhe afatin e njoftuar.", body, source: "Koha", url: "https://www.koha.net/arberi/kurti-abdixhiku-konsultime", publishedAt: "2026-08-29T11:50:00.000Z", category: "Politikë" };
  const plan = buildRepricePlan({ markets: [market], verifiedArticles: [stale, unrelated, headlineOnly, fresh], now: scanNow });
  assert.equal(NEWS_EVIDENCE_LOOKBACK_DAYS, 14);
  assert.deepEqual(plan[0].evidence.map((article) => article.slug), ["fresh-kurti-source"]);
  const used = new Map([[market.id, new Set([evidenceIdentity(fresh)])]]);
  const consumedPlan = buildRepricePlan({ markets: [market], verifiedArticles: [fresh], now: scanNow, usedEvidenceByMarket: used });
  assert.deepEqual(consumedPlan[0].evidence, []);
});

test("news repricing source and deadline guards are wired into the production server", () => {
  const server = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(server, /evidenceIdentity/);
  assert.match(server, /market_snapshots/);
  assert.match(server, /body=title/);
  assert.match(server, /deadline_decay_rate_limited/);
  assert.match(server, /60 \* 60 \* 1000/);
  assert.match(server, /remaining_hours/);
  assert.doesNotMatch(server, /const headlines = await liveHeadlinesFor/);
});

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
  assert.equal(plan.rows[0].closes_at, "2026-07-20T05:00:00.000Z");
  assert.deepEqual(plan.rows[0].source_article_slugs, ["kuvendi-ligji"]);
  assert.equal(plan.rejected.length, 2);
});

test("daily non-sport audience classifier keeps recognizable home/world drama and rejects a niche corporate story", () => {
  const sourceArticles = [
    { slug: "zvecan", title: "Arrestohet një person në Zveçan për sulmet e majit", category: "Kosovo" },
    { slug: "gaza", title: "Takim për planin e Gazës dhe bisedimet Iran–Oman", category: "Botë" },
    { slug: "stripe", title: "Stripe finalizon blerjen e OpenRouter mbi 7 miliardë dollarë", category: "Ekonomi" },
    { slug: "sport", title: "Kosova fiton ndeshjen", category: "Sport" },
  ];
  const candidate = (question, category, source_slugs) => ({
    question, category, source_slugs,
    description: "Zhvillim i verifikueshëm nga burimi i furnizuar.",
    resolution_criteria: "Zgjidhet sipas njoftimit autoritativ të publikuar deri në afat.",
    closes_in_days: 2,
  });
  const home = candidate("Arrestohet personi në Zveçan deri më 20 korrik?", "politike", ["zvecan"]);
  const world = candidate("Bisedimet për Gazën japin marrëveshje deri më 20 korrik?", "bote", ["gaza"]);
  const niche = candidate("Stripe blen OpenRouter deri më 20 korrik?", "ekonomi", ["stripe"]);
  const sport = candidate("Kosova fiton ndeshjen deri më 20 korrik?", "sport", ["sport"]);

  assert.equal(classifyDailyAudience(home, sourceArticles), "home_mass");
  assert.equal(classifyDailyAudience(world, sourceArticles), "world_mass");
  assert.equal(classifyDailyAudience(niche, sourceArticles), "niche");
  assert.equal(classifyDailyAudience(sport, sourceArticles), "sport");

  const plan = buildDailyDraftPlan({
    candidates: [home, world, niche, sport],
    existingQuestions: [],
    audienceArticles: sourceArticles,
    requireMassAudience: true,
    nonSportOnly: false,
    now,
  });
  assert.equal(plan.rows.length, 2);
  assert.deepEqual(plan.audienceTiers.map(({ tier }) => tier), ["home_mass", "world_mass"]);
  assert.deepEqual(plan.rejected.map(({ reason }) => reason), ["not_mass_audience", "sports_are_separate_lane"]);
  assert.equal(validateDailyDraftSubmission([], new Set(), { minimum: 0 }).ok, true);
});

test("daily publication predicate keeps the minimum and audience gate identical for preview and apply", () => {
  assert.equal(dailyDraftPublicationReason({ rows: [], audienceTiers: [] }), "insufficient_tradable_market_inventory");
  assert.equal(dailyDraftPublicationReason({ rows: [{}], audienceTiers: [{ tier: "home_mass" }] }), "insufficient_tradable_market_inventory");
  assert.equal(dailyDraftPublicationReason({ rows: [{}, {}], audienceTiers: [{ tier: "niche" }, { tier: "niche" }] }), "missing_mass_audience");
  assert.equal(dailyDraftPublicationReason({ rows: [{}, {}], audienceTiers: [{ tier: "world_mass" }] }), null);
});

test("daily market v2 accepts a consequential decision with a real trading fork", () => {
  const candidate = {
    question: "Kuvendi miraton buxhetin e rishikuar deri më 15 korrik?",
    description: "Votimi i buxhetit varet nga marrëveshja mes shumicës dhe opozitës, ndaj rezultati nuk është i mbyllur nga lajmi i sotëm.",
    resolution_criteria: "PO: procesverbali zyrtar i Kuvendit tregon se buxheti i rishikuar u miratua deri më 15 korrik 2026. JO: nuk miratohet deri në afat. Burimi i zgjidhjes: procesverbali dhe njoftimi i Kuvendit të Kosovës në orën 23:59 sipas kohës së Kosovës.",
    category: "politike",
    closes_in_hours: 48,
    source_slugs: ["budget-1", "budget-2"],
    market_archetype: "scheduled_decision",
    topic_key: "kosovo-budget-vote",
    decision_point: "Votimi i planifikuar mund të kalojë me marrëveshje ose të dështojë nëse nuk sigurohen votat.",
    why_uncertain: "Palët kanë qëndrime të ndryshme dhe nuk ka ende rezultat të publikuar; deklaratat e reja mund ta ndryshojnë pritshmërinë.",
    trading_angle: "Tregtarët peshojnë sinjalet për marrëveshje kundër rrezikut të shtyrjes së votimit.",
    resolution_source: "Kuvendi i Kosovës",
    deadline_basis: "Kalendari i publikuar i punës dhe afati i votimit të rishikuar.",
  };
  const result = evaluateDailyMarketCandidate(candidate, {
    sourceArticles: [
      { slug: "budget-1", title: "Kuvendi cakton votimin e buxhetit", excerpt: "Palët ende nuk kanë marrëveshje.", source: "Kuvendi i Kosovës" },
      { slug: "budget-2", title: "Opozita kërkon ndryshime në buxhet", excerpt: "Votat për miratimin mbeten të pasigurta.", source: "Reuters" },
    ],
    now,
    nonSportOnly: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.contract_version, DAILY_MARKET_CONTRACT_VERSION);
  assert.equal(result.topic_key, "kosovo-budget-vote");
  assert.ok(result.score >= 7);
});

test("daily market v2 rejects headline restatements, meeting-only questions, and arbitrary long deadlines", () => {
  const base = {
    description: "Zhvillimi mbetet i hapur dhe palët kanë rrugë të ndryshme përpara, ndaj tregtarët duhet të peshojnë sinjale të reja.",
    resolution_criteria: "PO: burimi autoritativ konfirmon plotësimin e kushtit të shkruar deri më 15 korrik 2026. JO: kushti nuk plotësohet deri në afat. Burimi i zgjidhjes: institucioni përgjegjës.",
    category: "politike",
    closes_in_hours: 48,
    source_slugs: ["story"],
    market_archetype: "policy_action",
    topic_key: "story-action",
    decision_point: "Vendimi mund të hyjë në fuqi ose të shtyhet pas kundërshtimeve publike.",
    why_uncertain: "Ka kundërshtime dhe nuk ka ende vendim përfundimtar; një njoftim i ri mund të ndryshojë drejtimin.",
    trading_angle: "Çmimi varet nga sinjalet e reja dhe nga distanca e tyre prej kriterit të zgjidhjes.",
    resolution_source: "institucioni përgjegjës",
    deadline_basis: "Afati i ciklit të vendimit të publikuar.",
  };
  const sourceArticles = [{ slug: "story", title: "Institucioni nënshkroi marrëveshjen", excerpt: "Marrëveshja u nënshkrua dhe hyri në fuqi.", source: "Institucioni" }];
  const restatement = evaluateDailyMarketCandidate({ ...base, question: "Institucioni nënshkruan marrëveshjen deri më 15 korrik?" }, { sourceArticles, now, nonSportOnly: true });
  assert.equal(restatement.ok, false);
  assert.match(restatement.reasons.join(" "), /restatement|obvious|dihet/i);

  const meeting = evaluateDailyMarketCandidate({ ...base, topic_key: "leader-meeting", question: "Kurti dhe Abdixhiku takohen deri më 15 korrik?", market_archetype: "scheduled_decision", decision_point: "Takimi mund të mbahet ose të shtyhet, ndërsa tregtarët presin një sinjal.", resolution_source: "Zyra e Kryeministrit" }, { sourceArticles: [{ slug: "story", title: "Takimi pritet brenda javës", excerpt: "Nuk ka agjendë apo marrëveshje të konfirmuar.", source: "RTK" }], now, nonSportOnly: true });
  assert.equal(meeting.ok, false);
  assert.match(meeting.reasons.join(" "), /meeting|takim|decision/i);

  const long = evaluateDailyMarketCandidate({ ...base, question: "Qeveria zbaton planin e ri deri më 23 korrik?", closes_in_hours: 240, topic_key: "government-plan" }, { sourceArticles: [{ slug: "story", title: "Qeveria shqyrton planin e ri", excerpt: "Zbatimi mbetet i pasigurt.", source: "Qeveria" }], now, nonSportOnly: true });
  assert.equal(long.ok, false);
  assert.match(long.reasons.join(" "), /deadline|afat|orë/i);

  const datedTopic = evaluateDailyMarketCandidate({ ...base, question: "Qeveria zbaton planin e ri deri më 15 korrik?", topic_key: "government-plan-2026-08" }, { sourceArticles: [{ slug: "story", title: "Qeveria shqyrton planin e ri", excerpt: "Zbatimi mbetet i pasigurt.", source: "Qeveria" }], now, nonSportOnly: true });
  assert.equal(datedTopic.ok, false);
  assert.match(datedTopic.reasons.join(" "), /topic|deadline/i);
});

test("daily market v2 rejects a topic already represented by an existing market", () => {
  const candidate = {
    question: "Ngushtica e Hormuzit lejon kalim të plotë deri më 15 korrik?",
    description: "Statusi i lundrimit mund të ndryshojë pas bisedimeve dhe kundërdeklaratave të reja.",
    resolution_criteria: "PO: autoriteti detar konfirmon kalim të plotë për anijet tregtare deri më 15 korrik 2026. JO: nuk konfirmohet. Burimi i zgjidhjes: autoriteti detar.",
    category: "bote", closes_in_hours: 48, source_slugs: ["hormuz-new"], market_archetype: "policy_action", topic_key: "hormuz-shipping",
    decision_point: "Autoritetet mund të lejojnë kalim të plotë ose të ruajnë kufizimet aktuale.",
    why_uncertain: "Deklaratat janë kontradiktore dhe kushtet diplomatike ende nuk kanë prodhuar vendim të zbatueshëm.",
    trading_angle: "Tregtarët peshojnë sinjalet diplomatike kundër rrezikut të vazhdimit të mbylljes.",
    resolution_source: "autoriteti detar", deadline_basis: "Afati i komunikimit të radhës për korridorin detar.",
  };
  const result = evaluateDailyMarketCandidate(candidate, {
    sourceArticles: [{ slug: "hormuz-new", title: "Ngushtica mbetet e mbyllur", excerpt: "Bisedimet vazhdojnë.", source: "Reuters" }],
    existingMarkets: [{ question: "Ngushtica e Hormuzit rihapet plotësisht deri më 14 korrik?", source_article_slugs: ["hormuz-old"], pre_match_analysis: { topic_key: "hormuz-shipping" } }],
    now,
    nonSportOnly: true,
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /duplicate|repeated|topic/i);
});

test("daily source packet removes duplicate story headlines while preserving distinct current stories", () => {
  const selected = selectDailySourceArticles([
    { slug: "a", title: "Kuvendi cakton votimin e buxhetit", excerpt: "Palët nuk pajtohen.", publishedAt: "2026-07-13T04:00:00Z" },
    { slug: "b", title: "Buxheti: Kuvendi cakton votimin, palët nuk pajtohen", excerpt: "Votimi pritet.", publishedAt: "2026-07-13T03:00:00Z" },
    { slug: "c", title: "Përmbytjet në Nepal lënë dhjetëra të vdekur", excerpt: "Ekipet e shpëtimit kërkojnë të zhdukurit.", publishedAt: "2026-07-13T02:00:00Z" },
  ], 10);
  assert.deepEqual(selected.map((article) => article.slug), ["a", "c"]);
  assert.equal(deriveDailyTopicKey({ topic_key: "Kosovo Budget Vote" }), "kosovo-budget-vote");
});
test("reprice plan includes every open market and retains only verified non-social evidence", () => {
  const plan = buildRepricePlan({
    markets: [
      {
        id: "affected",
        status: "open",
        category: "politike",
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
      { slug: "kuvendi-ligji", title: "Kuvendi cakton votimin e ligjit të ri", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Kuvendi i Kosovës" },
      { slug: "e-vjeter", category: "Politikë", publishedAt: "2026-07-13T03:00:00.000Z" },
      { slug: "social-thashethem", category: "Politikë", publishedAt: "2026-07-13T04:45:00.000Z", source: "X / Twitter", verification: "social_only" },
    ],
  });

  assert.deepEqual(plan.map((item) => item.market.id), ["affected", "unaffected"]);
  assert.equal(plan[0].market.status, "open");
  assert.equal(plan[0].evidence[0].slug, "kuvendi-ligji");
  assert.deepEqual(plan[1].evidence, []);
});

test("deadline RPC eligibility is limited to open binary general-news markets", () => {
  assert.equal(isEligibleNewsDeadlineMarket({ status: "open", market_type: "binary", market_classification: "general_news" }), true);
  for (const market of [
    { status: "closed", market_type: "binary", market_classification: "general_news" },
    { status: "open", market_type: "three_outcome", market_classification: "general_news" },
    { status: "open", market_type: "two_outcome", market_classification: "live_football" },
    { status: "open", market_type: "binary", market_classification: "live_f1" },
    { status: "open", market_type: "binary", market_classification: "live_football" },
  ]) assert.equal(isEligibleNewsDeadlineMarket(market), false);
});

test("failed scoring records an auditable signal failure without pausing an open market", () => {
  const plan = buildRepricePlan({
    markets: [{
      id: "affected", status: "open", category: "politike", source_article_slugs: ["kuvendi-ligji"],
      q_yes: 21, q_no: 8, b: 100, last_news_at: null,
    }],
    verifiedArticles: [{ slug: "kuvendi-ligji", title: "Kuvendi cakton votimin e ligjit të ri", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Kuvendi i Kosovës" }],
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
    verifiedArticles: [{ slug: "iran-trump-deal", title: "Hormuzi rihapet pas marrëveshjes Iran dhe SHBA", category: "Botë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Reuters", url: "https://www.reuters.com/example" }],
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
  const market = { id: "affected", status: "open", category: "politike", source_article_slugs: ["official", "social"], q_yes: 0, q_no: 0, b: 400, last_news_at: null };
  const socialOnly = buildRepricePlan({
    markets: [market],
    verifiedArticles: [{ slug: "social", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "X / Twitter" }],
  });
  assert.equal(socialOnly.length, 1);
  assert.deepEqual(socialOnly[0].evidence, []);

  const singleSource = buildRepricePlan({
    markets: [market],
    verifiedArticles: [{ slug: "official", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Reuters" }],
  });
  assert.equal(singleSource[0].scoreSuccess({ probability: 0.99, reasoning: "Raport i verifikuar.", cited_slugs: ["official"] }).snapshot.market_prob, 0.52);

  const corroborated = buildRepricePlan({
    markets: [market],
    verifiedArticles: [
      { slug: "official", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Reuters" },
      { slug: "agency", category: "Politikë", publishedAt: "2026-07-13T04:31:00.000Z", source: "Associated Press" },
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
      id: "affected", status: "open", category: "politike", source_article_slugs: ["kuvendi-ligji"],
      q_yes: 0, q_no: 0, b: 100, last_news_at: null,
    }],
    verifiedArticles: [{ slug: "kuvendi-ligji", title: "Kuvendi cakton votimin e ligjit të ri", category: "Politikë", publishedAt: "2026-07-13T04:30:00.000Z", source: "Kuvendi i Kosovës" }],
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
      closes_in_days: 7,
      source_slugs: ["eksportet"],
    },
    {
      question: "Kosova fiton ndeshjen deri më 21 korrik?",
      description: "Rezultati final verifikohet nga federata dhe organizatori.",
      resolution_criteria: "Zgjidhet sipas rezultatit final të publikuar nga federata dhe organizatori deri më 21 korrik.",
      category: "sport",
      closes_in_days: 7,
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
  assert.match(validateDailyDraftSubmission([{ ...candidates[0], closes_in_days: 60 }, ...candidates.slice(1)], known).error, /2.*7/);
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
  assert.match(runner, /market_archetype/);
  assert.match(runner, /topic_key/);
  assert.match(runner, /why_uncertain/);
  assert.match(runner, /closes_in_hours/);
  assert.match(runner, /Active non-sports markets to avoid/);
  assert.match(runner, /Do not use closes_in_days/);
  assert.match(runner, /never mechanically start with “A do të”/);
  assert.match(runner, /process\.argv\.includes\("--dry-run"\)/);
  assert.match(runner, /dryRun: true/);
  assert.match(runner, /model_candidate_count/);
  assert.match(runner, /accepted_count/);
  assert.match(runner, /rejected_count/);
  assert.match(runner, /no_publish_reason/);
  assert.match(runner, /const sendReceipt/);
  assert.match(runner, /const escapeHtml/);
});

test("daily ingestion smoke-tests Codex and avoids the unsupported model default", () => {
  const workflow = readFileSync(new URL("../.github/workflows/codex-cloud-news.yml", import.meta.url), "utf8");
  assert.match(workflow, /Verify Codex auth and model smoke test/);
  assert.match(workflow, /Codex smoke model: account default/);
  assert.match(workflow, /CODEX_CI_SMOKE_OK/);
  assert.match(workflow, /run_codex_write\(\)/);
  assert.match(workflow, /after writing a non-empty batch/);
  assert.match(workflow, /--sandbox read-only/);
  assert.match(workflow, /--sandbox danger-full-access/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /finalize-supabase/);
  assert.doesNotMatch(workflow, /codex_automation_support\.py finalize --file/);
  assert.ok(workflow.indexOf("Configure Codex auth") < workflow.indexOf("Verify Codex auth and model smoke test"));
  assert.ok(workflow.indexOf("Verify Codex auth and model smoke test") < workflow.indexOf("Preflight repo environment"));
  assert.doesNotMatch(workflow, /dangerously-bypass-approvals-and-sandbox/);
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
  assert.match(validateDailyDraftSubmission([{ ...breaking, closes_in_hours: 169 }, liveCandidate, third, fourth], known).error, /6.*7/);
  assert.equal(buildDailyDraftPlan({ candidates: [breaking], existingQuestions: [], now }).rows[0].closes_at, "2026-07-13T17:00:00.000Z");
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

test("protected daily-draft context supplies recent evidence bodies and active topics", () => {
  const endpoint = readFileSync(new URL("../app/api/automation/tregu/daily-drafts/route.ts", import.meta.url), "utf8");
  const automation = readFileSync(new URL("../lib/tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(endpoint, /getLatestArticles\(60\)/);
  assert.match(endpoint, /selectDailySourceArticles/);
  assert.match(endpoint, /body: String\(article\.body/);
  assert.match(endpoint, /source: article\.source/);
  assert.match(endpoint, /activeMarkets/);
  assert.match(endpoint, /pre_match_analysis/);
  assert.match(automation, /minimum: 0,[\s\S]*nonSportOnly: true/);
  assert.match(automation, /dailyDraftPublicationReason\(plan\)/);
  assert.match(readFileSync(new URL("./tregu-automation.mjs", import.meta.url), "utf8"), /insufficient_tradable_market_inventory/);
  assert.match(automation, /status: "draft" as const/);
  assert.doesNotMatch(automation, /status: row\.live_event \? "draft" : "open"/);
});

test("manual admin drafting uses the same v2 quality gate and has no long-date fallback", () => {
  const route = readFileSync(new URL("../app/api/admin/tregu/draft/route.ts", import.meta.url), "utf8");
  const legacy = readFileSync(new URL("./tregu.ts", import.meta.url), "utf8");
  assert.match(route, /validateDailyDraftSubmission/);
  assert.match(route, /buildDailyDraftPlan/);
  assert.match(route, /dailyDraftPublicationReason/);
  assert.match(route, /status: "draft"/);
  assert.doesNotMatch(route, /closes_in_days|\?\? 30/);
  assert.match(legacy, /market_archetype/);
  assert.match(legacy, /closes_in_hours/);
  assert.match(legacy, /selectDailySourceArticles/);
});

test("category-only evidence requires a strict shared trade subject", () => {
  const market = { id: "chelsea", status: "open", question: "A do të konfirmojë Chelsea transferimin e Victor Osimhen?", slug: "chelsea-osimhen", category: "sport", source_article_slugs: ["chelsea-initial"], q_yes: 0, q_no: 0, b: 100, last_news_at: null };
  const plan = buildRepricePlan({
    markets: [market],
    now: new Date("2026-07-27T12:00:00.000Z"),
    verifiedArticles: [
      { slug: "arsenal-saka", title: "Arsenal raporton lajmin e ri për Bukayo Saka", category: "Sport", publishedAt: "2026-07-27T10:00:00.000Z", source: "BBC" },
      { slug: "osimhen-chelsea", title: "Chelsea diskuton transferimin e Victor Osimhen", category: "Sport", publishedAt: "2026-07-27T10:01:00.000Z", source: "Reuters" },
    ],
  });
  assert.deepEqual(plan[0].evidence.map((article) => article.slug), ["osimhen-chelsea"]);
});
