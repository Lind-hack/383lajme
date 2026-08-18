/**
 * Sondazhi i Ditës — drafting tomorrow's question from today's news.
 *
 * Pure and unit tested. The route does the I/O; everything that decides whether
 * a generated question is fit to publish lives here.
 *
 * The bar is deliberately high. The card's whole premise is that stopping to
 * answer is worth a reader's time, and the static bank it replaces failed that
 * on its own terms: thirty questions on a fixed rotation, most of them settled
 * ("A jeni krenar që jeni shqiptar?"). A question whose answer everyone already
 * knows produces exactly the unconscious click the rewrite exists to end.
 */

import { shiftDateKey } from "./reagimi-data.ts";

export const QUESTION_MIN = 15;
export const QUESTION_MAX = 140;
export const OPTION_MAX = 44;
export const CONTEXT_MAX = 200;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

/** How far back to look for a repeat. Roughly the old bank's whole cycle. */
export const REPEAT_WINDOW = 30;

/**
 * @typedef {object} DraftPoll
 * @property {string} question
 * @property {string[]} options
 * @property {string | null} contextLine
 * @property {string | null} sourceArticleSlug
 */

/** The day a draft is for: tomorrow, so there is time to review it. */
export function draftDateKey(todayKey) {
  return shiftDateKey(todayKey, 1);
}

/**
 * Case- and diacritic-insensitive comparison key. "Çmimet" and "cmimet" are the
 * same question asked twice, and a generator run daily will eventually try it.
 */
export function normalizeQuestion(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


/**
 * Options that let a reader answer without taking a position.
 *
 * "Nuk e di", "Varet", "Është çështje komplekse" - an escape hatch is the
 * single fastest way back to the unconscious click this feature exists to end,
 * because it is always the safe answer and it costs nothing to pick. A poll
 * with a neutral option is a poll where the neutral option wins.
 *
 * Matched against the folded key, so accents and case do not matter.
 */
const HEDGE_PATTERNS = [
  /^nuk e di/,
  /^s ?jam i sigur/,
  /^nuk jam i sigur/,
  /^ndoshta$/,
  /^varet/,
  /^eshte ceshtje komplekse/,
  /^eshte komplekse/,
  /^eshte heret/,
  /^heret te thuhet/,
  /^pa koment/,
  /^as po as jo/,
  /^asnjera/,
  /^tjeter$/,
];

/** True when an option is an escape hatch rather than a position. */
export function isHedgeOption(option) {
  const key = normalizeQuestion(option);
  return HEDGE_PATTERNS.some((re) => re.test(key));
}

/**
 * Validate a generated draft.
 *
 * Returns the cleaned draft or a reason it was refused — never a partially
 * repaired one. A malformed draft is cheap to regenerate and expensive to
 * publish, so nothing here guesses at intent.
 *
 * @param {unknown} raw
 * @param {{ recentQuestions?: readonly string[] }} [opts]
 * @returns {{ ok: true, draft: DraftPoll } | { ok: false, reason: string }}
 */
export function validateDraft(raw, opts = {}) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Drafti nuk është objekt." };
  }

  const question = typeof raw.question === "string" ? raw.question.trim() : "";
  if (!question) return { ok: false, reason: "Pyetja mungon." };
  if (question.length < QUESTION_MIN) {
    return { ok: false, reason: `Pyetja është shumë e shkurtër (${question.length}).` };
  }
  if (question.length > QUESTION_MAX) {
    return { ok: false, reason: `Pyetja është shumë e gjatë (${question.length}).` };
  }
  if (!question.endsWith("?")) {
    return { ok: false, reason: "Pyetja duhet të mbarojë me pikëpyetje." };
  }

  const rawOptions = Array.isArray(raw.options) ? raw.options : null;
  if (!rawOptions) return { ok: false, reason: "Opsionet mungojnë." };

  const options = rawOptions
    .filter((o) => typeof o === "string")
    .map((o) => o.trim())
    .filter(Boolean);

  if (options.length < MIN_OPTIONS) {
    return { ok: false, reason: `Duhen të paktën ${MIN_OPTIONS} opsione.` };
  }
  if (options.length > MAX_OPTIONS) {
    return { ok: false, reason: `Maksimumi ${MAX_OPTIONS} opsione.` };
  }
  if (options.some((o) => o.length > OPTION_MAX)) {
    return { ok: false, reason: `Një opsion e kalon ${OPTION_MAX} karaktere.` };
  }

  // Two options that differ only by accent or case read as a broken poll.
  const seen = new Set();
  for (const o of options) {
    const key = normalizeQuestion(o);
    if (seen.has(key)) return { ok: false, reason: `Opsioni "${o}" përsëritet.` };
    seen.add(key);
  }

  for (const o of options) {
    if (isHedgeOption(o)) {
      return { ok: false, reason: `Opsioni "${o}" nuk është qëndrim.` };
    }
  }

  const recent = new Set((opts.recentQuestions ?? []).map(normalizeQuestion));
  if (recent.has(normalizeQuestion(question))) {
    return { ok: false, reason: "Kjo pyetje është bërë së fundmi." };
  }

  const contextRaw = typeof raw.context_line === "string" ? raw.context_line : raw.contextLine;
  let contextLine = typeof contextRaw === "string" ? contextRaw.trim() : "";
  if (contextLine.length > CONTEXT_MAX) {
    return { ok: false, reason: `Konteksti e kalon ${CONTEXT_MAX} karaktere.` };
  }

  const slugRaw =
    typeof raw.source_article_slug === "string" ? raw.source_article_slug : raw.sourceArticleSlug;
  const sourceArticleSlug = typeof slugRaw === "string" && slugRaw.trim() ? slugRaw.trim() : null;

  return {
    ok: true,
    draft: {
      question,
      options,
      contextLine: contextLine || null,
      sourceArticleSlug,
    },
  };
}

/**
 * The slug has to name an article that actually ran, or the "Lexo" link on
 * tomorrow's callback strip points at a 404. An invented slug drops to null
 * rather than invalidating an otherwise good question.
 *
 * @param {DraftPoll} draft
 * @param {readonly { slug: string }[]} articles
 * @returns {DraftPoll}
 */
export function groundSlug(draft, articles) {
  if (!draft.sourceArticleSlug) return draft;
  const known = new Set(articles.map((a) => a?.slug).filter(Boolean));
  return known.has(draft.sourceArticleSlug)
    ? draft
    : { ...draft, sourceArticleSlug: null };
}

/**
 * The brief given to the model.
 *
 * Written against the failure modes an earlier run actually produced, not
 * against imagined ones: it returned "A e legjitimon deklarata fitoren?" —
 * a question about how to read an event rather than about what the reader
 * thinks — and it kept offering "Varet nga burimet" as a third option. A poll
 * with an escape hatch is a poll where the escape hatch wins.
 */
export const DRAFT_SYSTEM_PROMPT = [
  "Je redaktor i sondazhit ditor për 383, portal lajmesh në Kosovë.",
  "Shkruaj një pyetje TË VETME në shqip, e lidhur me lajmet e sotme, që i ndan lexuesit vërtet përgjysmë.",
  "",
  "Testi kryesor: nëse e di paraprakisht si do të përgjigjet shumica, pyetja nuk vlen.",
  "",
  "Rregulla:",
  "- Pyet për QËNDRIMIN e lexuesit: çfarë duhet bërë, a pajtohet, a do ta pranonte.",
  "  Mos pyet nëse diçka është e vërtetë, nëse një deklaratë është e saktë, ose si duhet",
  "  interpretuar një ngjarje. Ato janë pyetje njohurie, jo mendimi.",
  "- Më e mira është kur lexuesi ka diçka për të humbur: para, kohë, rehati, parime.",
  "- Lidhu me një ngjarje konkrete të sotme, jo me një temë të përgjithshme.",
  "- Preferohen 2 opsione. Përdor 3 vetëm kur ekzistojnë vërtet tri qëndrime.",
  "- ÇDO opsion duhet të jetë qëndrim i qartë. Ndalohen rreptësisht opsionet asnjanëse:",
  "  Nuk e di / Ndoshta / Varet / Është çështje komplekse / Është herët të thuhet /",
  "  As po as jo, dhe çdo variant që i lejon lexuesit të mos zgjedhë anë.",
  "- Opsionet nën 44 karaktere, të shkurtra dhe afërsisht të njëjta në gjatësi.",
  "- Pyetja mbaron me pikëpyetje dhe është nën 140 karaktere.",
  "- context_line: një fjali që thotë çfarë ndodhi sot dhe pse pyetja bëhet pikërisht sot.",
  "- source_article_slug: slug-u i artikullit që e mbështet, ose null.",
  "",
  "Shembuj të mirë, sepse kërkojnë qëndrim dhe kanë kosto:",
  "  A duhet ta ndalojë ligji rrjetet sociale për nën 16-vjeçarët?",
  "    -> Po, me ligj | Jo, vendosin prindërit",
  "  A do të paguanit 20% më shumë për energji më të pastër?",
  "    -> Po | Jo",
  "",
  "Shembuj të këqij, mos i përsërit:",
  "  A është i rëndësishëm arsimi? — përgjigjja dihet paraprakisht",
  "  A e legjitimon deklarata fitoren? — pyetje interpretimi, jo qëndrimi",
  "  Si e vlerësoni situatën? -> Mirë | Keq | As mirë as keq — e treta fiton gjithmonë",
  "",
  "Kthe VETËM JSON:",
  "{\"question\":\"...\",\"options\":[\"...\",\"...\"],\"context_line\":\"...\",\"source_article_slug\":\"...\"}",
].join("\n");

/**
 * Compact the day's articles into the prompt body. Only the fields the model
 * needs to pick a story and cite it.
 *
 * @param {readonly { slug?: string, title?: string, excerpt?: string, category?: string }[]} articles
 * @param {readonly string[]} [recentQuestions]
 * @returns {string}
 */
export function buildDraftPrompt(articles, recentQuestions = []) {
  const lines = articles
    .filter((a) => a && a.title)
    .slice(0, 20)
    .map((a) => `- [${a.category ?? "—"}] ${a.title}${a.slug ? ` (slug: ${a.slug})` : ""}`);

  const avoid = recentQuestions.slice(0, REPEAT_WINDOW);

  return [
    "Lajmet e sotme:",
    lines.join("\n") || "(asnjë)",
    "",
    avoid.length ? `Mos e përsërit asnjë nga këto pyetje të fundit:\n${avoid.map((q) => `- ${q}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
