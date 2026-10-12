/**
 * Kuizi i Ditës — building the day's quiz from the last 24 hours of news.
 *
 * Pure and unit tested. The route fetches articles and calls the model; this
 * file decides which articles the model sees, what it is told, and which of
 * its candidates survive into the five that get published.
 *
 * The model is asked for more candidates than the quiz needs because the
 * validator refuses rather than repairs. Fewer than five survivors means no
 * quiz that day, which the card states plainly; it never pads with filler.
 */

import { isLocalArticle, selectDraftArticles } from "./sondazhi-draft.mjs";
import { QUIZ_LENGTH, isTragedy, validateQuestion } from "./kuizi-data.mjs";

/** How many candidates to ask for. Headroom for the validator's refusals. */
export const CANDIDATES = 16;
/** Judge scores at or below this are dropped: trivia, giveaways, broken options. */
export const JUDGE_DROP_AT = 2;
/** At least this many local questions when the day has that many local stories. */
export const MIN_LOCAL = 2;
/** Window the quiz covers. */
export const WINDOW_HOURS = 24;
/** Characters of body the model sees per article: enough to ground, not to drown. */
export const BODY_CHARS = 700;

/**
 * The articles a quiz may be built from: published inside the window, not a
 * tragedy, local stories reserved room so the wires do not crowd them out.
 *
 * @template {{ slug?: string, title?: string, publishedAt?: string, category?: string, excerpt?: string }} T
 * @param {readonly T[]} articles
 * @param {Date} now
 * @returns {T[]}
 */
export function selectQuizArticles(articles, now) {
  const since = now.getTime() - WINDOW_HOURS * 3600_000;
  const fresh = (articles ?? []).filter((a) => {
    if (!a?.slug || !a.title || isTragedy(a)) return false;
    const t = new Date(a.publishedAt ?? "").getTime();
    return Number.isFinite(t) && t >= since && t <= now.getTime() + 3600_000;
  });
  return selectDraftArticles(fresh, { limit: 24, localSlots: 18 });
}

/**
 * The brief. Written against the specific ways a news quiz goes wrong: a right
 * answer the article never states, a question only a specialist could answer,
 * and trick wording that tests reading rather than knowing the news.
 */
export const KUIZ_SYSTEM_PROMPT = [
  "Je redaktor i Kuizit të Ditës për 383, portal lajmesh në Kosovë.",
  `Shkruaj ${CANDIDATES} pyetje kuizi në shqip për lajmet e 24 orëve të fundit që të jepen.`,
  "Pas çdo përgjigjeje lexuesi sheh si u përgjigjën të tjerët. Qëllimi: ta bësh të mendohet,",
  "të dyshojë te vetja dhe të habitet nga rezultati, jo ta kalojë kuizin pa menduar.",
  "",
  "TESTI I DEBATIT (çdo pyetje duhet ta kalojë): a do të debatonin dy veta në kafene për",
  "përgjigjen PARA se ta shohin? Lexuesi duhet të ketë një instinkt, një mendim, një paragjykim",
  "që lajmi e konfirmon ose e përmbys. Nëse askush s'mund të ketë mendim (në cilin kat ishte",
  "zjarri, sa ekspozita u hapën, sa përqind e tregut ka një spital jashtë vendit), pyetja s'vlen.",
  "",
  "SI E BËN PYETJEN TË VËSHTIRË (por të ndershme):",
  "- KURTHI: në të paktën gjysmën e pyetjeve, përgjigjja që 'tingëllon e saktë', ose që do ta",
  "  zgjidhte dikush që lexoi vetëm titullin, ose që përputhet me paragjykimin e zakonshëm,",
  "  duhet të jetë E GABUAR. Zgjidh lajme ku e vërteta të befason.",
  "- OPSIONE TË AFËRTA: merri opsionet e gabuara nga i njëjti artikull kur mundesh: numra,",
  "  emra, vende, data të tjera që përmenden aty, por që nuk i përgjigjen pyetjes. Kështu",
  "  vetëm ai që e di lajmin vërtet e qëllon.",
  "- Numrat: opsionet afër njëri-tjetrit (p.sh. 21 / 27 / 34 / 40), jo një i saktë dhe tre absurdë.",
  "- Lloje të mira: 'Kush e tha këtë?' me citat të shkurtër nga artikulli dhe politikanë si",
  "  opsione; 'Sa...?' vetëm për shifra me peshë publike (para, çmime, paga, sa njerëz preken);",
  "  'Çfarë vendosi X?' kur vendimi është i papritur; 'Cili NUK u përfshi?' kur përjashtimi",
  "  është befasia (shkruaje NUK me shkronja të mëdha).",
  "- Zgjidh lajme për të cilat njerëzit kanë mendim dhe debatojnë: çmimet, pagat, Serbia",
  "  dhe dialogu, politika, diaspora, shëndetësia, arsimi, sporti kombëtar.",
  "- \"difficulty\": 1 (e lehtë), 2 (mesatare) ose 3 (e vështirë). Përfshi të tria nivelet.",
  "- \"trap\": një fjali e shkurtër (nën 120 karaktere): pse dikush do ta gabonte. Nuk i shfaqet",
  "  lexuesit; pa kurth të qartë, mos e shkruaj pyetjen.",
  "",
  "RREGULLA TË PANEGOCIUESHME:",
  "- Bazohet në NJË artikull të dhënë; vendos slug-un e tij te \"slug\".",
  "- Përgjigjja e saktë thuhet QARTË në tekstin e artikullit. Mos shto asnjë fakt,",
  "  emër, datë apo numër që nuk është në tekst. Vështirë, po; e paqartë, kurrë.",
  "- Vetëm NJË opsion është i saktë sipas artikullit. Opsionet e afërta nga i njëjti artikull",
  "  duhet të jenë qartë të gabuara për pyetjen e bërë. Formulo pyetjen saktë.",
  "- Pyet për thelbin e lajmit, jo për detaje të parëndësishme: pa statistika ndeshjesh",
  "  (pritje, minuta, gjuajtje), pa orë të sakta, pa emra zyrtarësh të dorës së dytë.",
  "- 3 ose 4 opsione, nën 60 karaktere, të njëjtës formë, gjatësie dhe niveli detaji.",
  "  Opsioni i saktë nuk dallohet si më specifiku apo më i gjati.",
  "- Ndalohen: \"Të gjitha\", \"Asnjë nga këto\", \"Nuk e di\", mohim i dyfishtë.",
  "- Pyetja nën 140 karaktere, mbaron me pikëpyetje.",
  "- \"explain\": një fjali (nën 200 karaktere) me një FAKT nga artikulli që lexuesi s'e di",
  "  nga pyetja: çfarë ndodh më pas, afati, kush preket, sa kushton. Pa komente e vlerësime.",
  "  Mos fillo me \"Kjo tregon\", \"Kjo thekson\", \"Kjo dëshmon\". Mos i vër mendime askujt.",
  "- \"correct\": indeksi (nga 0) i opsionit të saktë.",
  "- Asnjë pyetje për vdekje, vrasje, aksidente, dhunë ose tragjedi.",
  "- Mos përmend emra mediash apo burimesh (\"raporton X\") në pyetje, opsione ose explain.",
  "- Pyetje të ndryshme për artikuj të ndryshëm. Artikujt [LOKALE] kanë përparësi.",
  "",
  "Shembull i mirë (kurth + opsione nga artikulli): artikulli thotë se Kosovës i mbeten 27",
  "reforma nga 166 të planit dhe rrezikon mbi 100 milionë euro.",
  "  Sa reforma i mbeten Kosovës për fondet e Planit të Rritjes? -> 27 | 100 | 166 | 12",
  "  (100 dhe 166 janë në artikull, ndaj tundojnë; vetëm 27 i përgjigjet pyetjes.)",
  "Shembull i keq: Ku u takuan X dhe Y? -> Tiranë | Shkodër | Prizren (përgjigjja është te titulli).",
  "",
  "Kthe VETËM JSON:",
  "{\"questions\":[{\"q\":\"...\",\"options\":[\"...\",\"...\",\"...\"],\"correct\":0,\"difficulty\":2,\"trap\":\"...\",\"explain\":\"...\",\"slug\":\"...\"}]}",
].join("\n");

/**
 * Compact the selected articles into the prompt. The model gets an excerpt
 * and the start of the body, because the validator checks the right answer
 * against that same text.
 *
 * @param {readonly { slug: string, title: string, excerpt?: string, body?: string, category?: string }[]} articles
 * @returns {string}
 */
export function buildQuizPrompt(articles) {
  const blocks = articles.map((a) => {
    const body = String(a.body ?? "").replace(/\s+/g, " ").trim().slice(0, BODY_CHARS);
    return [
      `### [${isLocalArticle(a) ? "LOKALE" : "BOTË"}] ${a.title}`,
      `slug: ${a.slug}`,
      a.excerpt ? `përmbledhje: ${String(a.excerpt).trim()}` : "",
      body ? `tekst: ${body}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  return `Lajmet e 24 orëve të fundit:\n\n${blocks.join("\n\n") || "(asnjë)"}`;
}

/**
 * A second, fresh-context read of the surviving candidates. The generator
 * writes good and bad questions side by side and cannot tell them apart; a
 * reader who only judges is much better at applying the debate test.
 */
export const KUIZ_JUDGE_PROMPT = [
  "Je gjykatës i Kuizit të Ditës për 383. Lexuesit luajnë 5 pyetje dhe pas çdo përgjigjeje",
  "shohin si u përgjigjën të tjerët. Kuizi duhet t'i bëjë të mendohen dhe të debatojnë.",
  "",
  "Vlerëso çdo pyetje 1-5:",
  "5 = lexuesi ka instinkt/paragjykim që lajmi e përmbys; kurth i ndershëm; tema prek Kosovën",
  "    ose jetën e njerëzve (para, të drejta, Serbia, politika, shërbime); do të debatohej.",
  "4 = e mirë, e ndershme, me peshë; kurthi pak më i dobët.",
  "3 = e pranueshme por e zbehtë.",
  "2 = trivia: detaje që askush s'i mban mend (statistika ndeshjesh, sa ekspozita, cili kat,",
  "    emra kompanish/personash që lexuesi s'i njeh), ose pyetje për showbiz/botë pa lidhje me lexuesin.",
  "1 = e prishur: përgjigjja dihet nga vetë pyetja ose titulli, opsione të shpikura e absurde",
  "    (\"Rruga B\"), emra mediash si opsione, më shumë se një opsion i saktë, formulim i paqartë.",
  "",
  "Ji i rreptë. Shumica e pyetjeve të një dite nuk meritojnë 5.",
  "Kthe VETËM JSON: {\"scores\":[{\"slug\":\"...\",\"score\":4,\"why\":\"...\"}]}",
].join("\n");

/** The judge sees each question with its options and the answer, by slug. */
export function buildJudgePrompt(questions) {
  return questions
    .map(
      (q) =>
        `### slug: ${q.slug}\n${q.q}\n` +
        q.options.map((o, i) => `${i === q.correct ? "*" : "-"} ${o}`).join("\n") +
        `\nkurthi: ${q.trap}`
    )
    .join("\n\n");
}

/** Judge JSON → slug → score, ignoring anything malformed. */
export function parseJudgeScores(raw) {
  const out = new Map();
  for (const row of Array.isArray(raw?.scores) ? raw.scores : []) {
    if (typeof row?.slug === "string" && Number.isInteger(row?.score) && row.score >= 1 && row.score <= 5) {
      out.set(row.slug, row.score);
    }
  }
  return out;
}

/**
 * Select, prompt, validate. The model call is passed in so this stays pure
 * enough to test, and so the route owns provider choice and timeouts.
 *
 * @param {readonly any[]} articles  recent articles, newest first, with bodies
 * @param {{ now: Date, dateKey: string, ask: (system: string, user: string) => Promise<unknown> }} opts
 * @returns {Promise<(
 *   | { ok: true, questions: import("./kuizi-data.mjs").QuizQuestion[], rejected: string[] }
 *   | { ok: false, reason: string, rejected: string[] }
 * ) & { pool: number, judged: boolean, judgeError?: string | null }>}
 */
export async function generateQuiz(articles, { now, dateKey, ask }) {
  const pool = selectQuizArticles(articles, now);
  if (pool.length < QUIZ_LENGTH) {
    return {
      ok: false,
      reason: `Vetëm ${pool.length} lajme në ${WINDOW_HOURS} orët e fundit.`,
      rejected: [],
      pool: pool.length,
      judged: false,
    };
  }
  const raw = await ask(KUIZ_SYSTEM_PROMPT, buildQuizPrompt(pool));

  // Judge only when there is something to choose between. A failed or empty
  // judge falls back to the generator's order rather than losing the day.
  const { valid } = validateCandidates(raw, pool);
  let scores = null;
  let judgeError = null;
  if (valid.length >= QUIZ_LENGTH) {
    // One retry: a provider hiccup on the judge would otherwise publish the
    // generator's unfiltered order, trivia included.
    for (let attempt = 0; attempt < 2 && !scores; attempt++) {
      try {
        const judged = parseJudgeScores(await ask(KUIZ_JUDGE_PROMPT, buildJudgePrompt(valid)));
        if (judged.size > 0) scores = judged;
        else judgeError = "gjykatësi ktheu përgjigje bosh";
      } catch (err) {
        judgeError = err instanceof Error ? err.message : String(err);
      }
    }
  }
  return {
    ...assembleQuiz(raw, pool, dateKey, scores),
    pool: pool.length,
    judged: Boolean(scores),
    ...(scores ? {} : { judgeError }),
  };
}

/** Small deterministic PRNG so a day's option order is stable across reruns. */
function seeded(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle options and remap the answer index. Models put the right answer
 * first far more often than chance, which a regular player learns in a week.
 */
export function shuffleOptions(question, seedText) {
  const rand = seeded(seedText);
  const order = question.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...question,
    options: order.map((i) => question.options[i]),
    correct: order.indexOf(question.correct),
  };
}

/**
 * Validate every candidate against the articles it cites and keep one
 * question per article, in the model's order.
 *
 * @param {unknown} raw
 * @param {readonly import("./kuizi-data.mjs").QuizArticle[]} articles
 */
export function validateCandidates(raw, articles) {
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const candidates = Array.isArray(raw?.questions) ? raw.questions : [];
  const rejected = [];
  const valid = [];
  const usedSlugs = new Set();

  for (const [i, c] of candidates.entries()) {
    const res = validateQuestion(c, bySlug);
    if (!res.ok) {
      rejected.push(`#${i + 1}: ${res.reason}`);
      continue;
    }
    if (usedSlugs.has(res.question.slug)) {
      rejected.push(`#${i + 1}: Artikulli është përdorur tashmë.`);
      continue;
    }
    usedSlugs.add(res.question.slug);
    valid.push(res.question);
  }
  return { valid, rejected, total: candidates.length };
}

/**
 * Turn the model's candidates into the published quiz, or refuse.
 *
 * Validates each candidate, keeps one question per article, drops what the
 * judge scored as trivia, ranks the rest by the judge's score, takes local
 * questions first up to MIN_LOCAL (when the day offers them), then shuffles
 * options. Without judge scores the model's own order stands.
 *
 * @param {unknown} raw  the model's JSON
 * @param {readonly import("./kuizi-data.mjs").QuizArticle[]} articles  the articles it was shown
 * @param {string} dateKey
 * @param {ReadonlyMap<string, number> | null} [scores]  judge score per slug
 * @returns {{ ok: true, questions: import("./kuizi-data.mjs").QuizQuestion[], rejected: string[] }
 *         | { ok: false, reason: string, rejected: string[] }}
 */
export function assembleQuiz(raw, articles, dateKey, scores = null) {
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const checked = validateCandidates(raw, articles);
  const rejected = [...checked.rejected];
  let valid = checked.valid;

  if (scores) {
    const kept = [];
    for (const q of valid) {
      const score = scores.get(q.slug) ?? 0;
      if (score <= JUDGE_DROP_AT) rejected.push(`Gjykatësi (${score}/5): ${q.q}`);
      else kept.push(q);
    }
    // Stable: equal scores keep the model's order.
    valid = kept
      .map((q, i) => [q, i])
      .sort((a, b) => (scores.get(b[0].slug) ?? 0) - (scores.get(a[0].slug) ?? 0) || a[1] - b[1])
      .map(([q]) => q);
  }

  if (valid.length < QUIZ_LENGTH) {
    return {
      ok: false,
      reason: `Vetëm ${valid.length} pyetje të vlefshme nga ${checked.total}; duhen ${QUIZ_LENGTH}.`,
      rejected,
    };
  }

  const isLocal = (q) => isLocalArticle(bySlug.get(q.slug));
  const localAvailable = articles.filter(isLocalArticle).length;
  const wantLocal = Math.min(MIN_LOCAL, localAvailable);
  const local = valid.filter(isLocal);
  if (local.length < wantLocal) {
    return {
      ok: false,
      reason: `Vetëm ${local.length} pyetje lokale; duhen ${wantLocal}.`,
      rejected,
    };
  }

  const picked = local.slice(0, wantLocal);
  for (const q of valid) {
    if (picked.length >= QUIZ_LENGTH) break;
    if (!picked.includes(q)) picked.push(q);
  }
  // Easiest first, so a reader is drawn in before the hard ones; ties keep
  // the model's order.
  picked.sort((a, b) => a.difficulty - b.difficulty || valid.indexOf(a) - valid.indexOf(b));

  return {
    ok: true,
    questions: picked.map((q, i) => shuffleOptions(q, `${dateKey}:${i}:${q.slug}`)),
    rejected,
  };
}
