import { NextResponse, type NextRequest } from "next/server";
import { getSearchData } from "@/lib/search-sources";
import { resolveEntity, surfaceForms, mentions } from "@/lib/entities.mjs";
import { retrieve, validQuestion, MAX_SOURCES, MAX_QUESTION } from "@/lib/pyet-retrieval.mjs";
import {
  buildPrompt,
  validateAnswer,
  unsupportedNumbers,
  SYSTEM_PROMPT,
  REFUSAL,
  refusalFor,
} from "@/lib/pyet-prompt.mjs";
import {
  ROUTER_PROMPT,
  buildRouterPrompt,
  parseRoute,
  replyLanguage,
  guessLanguage,
  isDistress,
  GUARD_PROMPT,
  buildGuardPrompt,
  parseGuard,
  fixedReply,
} from "@/lib/pyet-guard.mjs";
import {
  isSmallTalk,
  extractName,
  cleanName,
  buildChatPrompt,
  validateChat,
  CHAT_PROMPT,
} from "@/lib/pyet-chat.mjs";
import { starterQuestions } from "@/lib/pyet-questions.mjs";
import { hydrateBodies } from "@/lib/pyet-server";
import { llmJSON } from "@/lib/llm";
import { THINKING_MODELS, CHAT_MODELS } from "@/lib/groq";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSiteLanguage, localizedAnswerPrompt } from "@/lib/site-language.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Pyet 383 — grounded answers, or none.
 *
 * The design rule, from the product owner: this answers from published 383
 * articles or it says "Nuk kam artikull për këtë." There is deliberately no
 * web tool, no search fallback, and no path where the model's own knowledge
 * reaches the reader. A bot that improvises about a developing Kosovo story is
 * a liability; one that admits the archive does not have it yet is worth
 * trusting.
 *
 * Three gates enforce that, and the first one is free:
 *
 *   1. Retrieval finds nothing  → refuse. No model call is made at all, so
 *      there is nothing to hallucinate with.
 *   2. The model is handed only those articles and told to answer from them.
 *   3. The answer must cite a source that was actually sent, or it is thrown
 *      away and the same refusal is returned.
 *
 * Gate 3 is the one that matters, because 2 is only a request. A model that
 * decides to be helpful about something it half-remembers produces fluent
 * Albanian either way; what it cannot do is cite an article it was never given.
 *
 * The exception, widened by the product owner in November 2026: small talk and
 * harmless general help (a recipe, homework, a film tip, an email) are answered
 * by Dardani as a friend, without sources. A router decides the path and a
 * guard reads every such reply before it is sent (lib/pyet-guard.mjs). Anything
 * about events, politics or public figures still goes through all three gates.
 */

/**
 * Earlier exchanges that travel with a question. Six is enough to keep a long
 * conversation's thread; each is trimmed below, so the prompt stays bounded.
 */
const MAX_HISTORY = 6;

/**
 * Answering costs a model call, so this is not free to abuse. Thirty because
 * a conversation with Dardani is many short messages, not one question.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;

/** Today as a reader in Kosovo would say it, so "sot" and "dje" mean something. */
function todayInKosovo() {
  return new Intl.DateTimeFormat("sq", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Belgrade",
  }).format(new Date());
}

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const hits = new Map<string, number[]>();

/**
 * Per-instance, which is the honest description of what this buys.
 *
 * Serverless spreads callers across instances, so this is a brake on a single
 * script hammering one warm instance, not a quota. A real quota needs shared
 * state; that is worth building when there is evidence it is needed, and the
 * retrieval gate already means the cheapest abuse (asking about things 383 has
 * never covered) never reaches a model.
 */
function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 4000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

/**
 * What readers ask that the archive cannot answer.
 *
 * Logged into the same table as zero-result searches, prefixed so the two can
 * be told apart. This is an editorial signal, not analytics: a question asked
 * repeatedly and refused every time is a story 383 has not covered.
 */
async function logUnanswered(question: string, reason: string) {
  const supabase = createAdminClient();
  if (!supabase) return;
  try {
    await supabase
      .from("search_queries")
      .insert({ query: `pyet: ${question}`.slice(0, 200), suggestions: 0 });
  } catch (error) {
    console.error(`[pyet] could not log an unanswered question (${reason})`, error);
  }
}

/**
 * `thin` distinguishes the two honest refusals: nothing in the archive touches
 * this at all, versus 383 covers the subject but not the angle asked. The
 * reader can see which is true when they are on the article, so saying the
 * wrong one costs trust.
 */
function refuse(reason: string, thin = false, lang = "sq") {
  return NextResponse.json(
    { grounded: false, refusal: refusalFor(lang, thin), reason, language: lang },
    NO_STORE,
  );
}

/**
 * Openers for the overlay, where there is no article to anchor to.
 *
 * `pool` is the recent public archive in slim form (no bodies), the same list
 * for every reader. The browser ranks it against the reader's own interests and
 * question history to offer personal openers (lib/dardani-memory.mjs), so
 * nothing about the reader is ever sent here.
 */
export async function GET() {
  const { articles } = await getSearchData();
  const pool = articles.slice(0, 80).map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: (a.body ?? "").slice(0, 300),
    category: a.category ?? "",
    publishedAt: a.publishedAt ?? "",
  }));
  return NextResponse.json(
    { starters: starterQuestions(articles, 3), pool },
    NO_STORE,
  );
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { grounded: false, refusal: { ...REFUSAL, headline: "Shumë pyetje njëherësh." }, reason: "rate" },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await request.json().catch(() => null);
  const language = isSiteLanguage(body?.language) ? body.language : "sq";
  // The pure modules are .mjs, so their union returns arrive here untyped.
  // Narrowed rather than cast: a cast would hide the day one of them changes.
  const check = validQuestion(body?.question);
  if (!check.ok || typeof check.question !== "string") {
    return refuse(`question-${check.reason ?? "invalid"}`);
  }
  const question: string = check.question;
  const slug = typeof body?.slug === "string" ? body.slug.slice(0, 200) : null;

  /**
   * Earlier exchanges, so a follow-up is read as one.
   *
   * Bounded on both axes and re-validated here rather than trusted: this is a
   * public endpoint, and the history field is the one place a caller could try
   * to write the model's side of the conversation. Trimming each entry caps
   * how much a caller can put in front of the article text.
   */
  const history = (Array.isArray(body?.history) ? body.history : [])
    .slice(-MAX_HISTORY)
    .map((t: unknown) => {
      const turn = t as { question?: unknown; answer?: unknown };
      return {
        question: String(turn?.question ?? "").slice(0, MAX_QUESTION),
        answer: String(turn?.answer ?? "").slice(0, 700),
      };
    })
    .filter((t: { question: string; answer: string }) => t.question && t.answer);

  // Who the reader is, as their own device remembers it. Never stored here.
  // A name said in this very message wins over the remembered one.
  const named = extractName(question);
  const name: string | null = named ?? cleanName(body?.name);
  const interests: string[] = (Array.isArray(body?.interests) ? body.interests : [])
    .filter((x: unknown): x is string => typeof x === "string")
    .map((x: string) => x.replace(/\s+/g, " ").trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 5);
  const today = todayInKosovo();

  const { articles, subjects, people } = await getSearchData();

  // ── Which path ────────────────────────────────────────────────────────────
  // The keyword list still answers the obvious hellos without a router call;
  // every other message is routed by a model (lib/pyet-guard.mjs). A verdict
  // that cannot be read sends the message to the archive, which refuses rather
  // than invents.
  type Route = { route: string; lang: string | null; distress: boolean };
  let route: Route | null = isDistress(question)
    ? { route: "chat", lang: null, distress: true }
    : isSmallTalk(question)
      ? { route: "chat", lang: guessLanguage(question), distress: false }
      : null;
  if (!route) {
    try {
      route = parseRoute(
        await llmJSON<unknown>(ROUTER_PROMPT, buildRouterPrompt(question, history), {
          maxTokens: 200,
          temperature: 0,
          groqModels: CHAT_MODELS,
        }),
      ) as Route | null;
    } catch (error) {
      console.error("[pyet] the router failed; the message goes to the archive", error);
    }
  }
  const lang: string = replyLanguage(route?.lang ?? null, language);

  // What Dardani never does, and a reader in danger: fixed words, no model.
  if (route?.distress || route?.route === "blocked") {
    return NextResponse.json(
      {
        grounded: true,
        kind: "chat",
        answer: fixedReply(route.distress ? "distress" : "blocked", lang),
        sources: [],
        followups: [],
        name: named,
        language: lang,
        model: null,
      },
      NO_STORE,
    );
  }

  // ── Chat and general help ─────────────────────────────────────────────────
  // A friend answers "si je?" and "how do I make flija?" instead of refusing
  // them. Every reply is read by the guard before it is sent; one rewrite is
  // allowed, then a fixed line. A guard that cannot be reached blocks the reply.
  if (route?.route === "chat" || route?.route === "general") {
    const meta: { model?: string } = {};
    const system = localizedAnswerPrompt(CHAT_PROMPT, lang);
    const user = buildChatPrompt(question, {
      name,
      interests,
      headlines: articles.slice(0, 6).map((a) => a.title),
      history,
      today,
      justNamed: Boolean(named),
    });
    let answer = fixedReply("fallback", lang);
    let followups: string[] = [];
    let rejected = "";
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await llmJSON<unknown>(
          system,
          rejected
            ? `${user}\n\nKUJDES: përgjigja e mëparshme u refuzua (${rejected}). Shkruaje sërish duke i respektuar rregullat.`
            : user,
          // Some warmth, not much: at 0.6 the jokes stopped being Albanian.
          // General help leads with Gemini: tested 2026-11-14, qwen3.8 and
          // gpt-oss-120b both invented Albanian facts (a Kadare novel that does
          // not exist, Flag Day "in Prizren", a recipe that boiled blood), while
          // Gemini Flash got them right. Small talk stays on the faster Groq.
          {
            maxTokens: 2000,
            temperature: 0.4,
            groqModels: CHAT_MODELS,
            prefer: route.route === "general" ? "gemini" : "groq",
            // 2.5 Flash first: with thinking off it answered in ~5s and got the
            // facts right. The default ladder starts on aliases that 503 under
            // load and on 3.6 Flash, which cannot switch thinking off and took
            // 30–60s a reply.
            geminiModels: ["gemini-2.5-flash", "gemini-flash-latest"],
            timeoutMs: 15_000,
            meta,
          },
        );
        const draft = validateChat(raw);
        if (!draft.ok || typeof draft.answer !== "string") {
          rejected = draft.reason ?? "invalid";
          continue;
        }
        const verdict = parseGuard(
          await llmJSON<unknown>(GUARD_PROMPT, buildGuardPrompt(question, draft.answer), {
            maxTokens: 200,
            temperature: 0,
            groqModels: CHAT_MODELS,
          }),
        );
        if (verdict.ok) {
          answer = draft.answer;
          followups = Array.isArray(draft.followups) ? draft.followups : [];
          break;
        }
        console.warn(`[pyet] the guard stopped a reply: ${verdict.reason}`);
        rejected = verdict.reason;
        answer = fixedReply("unsure", lang);
      }
    } catch (error) {
      console.error("[pyet] chat fell back to a fixed reply", error);
    }
    return NextResponse.json(
      { grounded: true, kind: "chat", answer, sources: [], followups, name: named, language: lang, model: meta.model ?? null },
      NO_STORE,
    );
  }

  // Who or what the question names, so "Kush është Edi Rama?" retrieves the
  // pieces about him rather than the ones containing the string.
  const entity = resolveEntity(question, [...subjects, ...people]);

  // A follow-up ("po pse?") carries no subject of its own, so the previous
  // question is what says where to look. Without this the thread's second
  // question retrieves nothing and is refused under a perfectly good answer.
  const lastQuestion = history.length ? history[history.length - 1].question : "";
  const retrievalText = history.length ? `${lastQuestion} ${question}` : question;

  const { sources } = retrieve(articles, retrievalText, {
    entityForms: entity ? surfaceForms(entity) : null,
    mentionsFn: mentions,
    pinnedSlug: slug,
    limit: MAX_SOURCES,
  });

  // ── Gate 1 ────────────────────────────────────────────────────────────────
  // Nothing in the archive touches this. Refuse now, before a model runs.
  if (sources.length === 0) {
    void logUnanswered(question, "no-sources");
    return refuse("no-sources", false, lang);
  }

  // The index holds excerpts only. Answering "pse ndodhi kjo" from an excerpt
  // is not possible, and the model correctly says so — which reads to the
  // reader as the archive not covering a story it covers in full.
  const full = await hydrateBodies(sources);

  // ── Gate 2 ────────────────────────────────────────────────────────────────
  const system = localizedAnswerPrompt(SYSTEM_PROMPT, lang);
  const prompt = buildPrompt(question, full, { history, name, today });
  const meta: { model?: string } = {};
  const answerOnce = (user: string) =>
    llmJSON<unknown>(system, user, {
      // Thinking models bill their reasoning against this, so it is roomy.
      maxTokens: 3000,
      // Zero. This is summarising supplied text, so there is nothing for
      // sampling to improve — and at 0.2 the same question against the same
      // single source answered on some runs and declined on others, which
      // reads to a reader as the site randomly forgetting its own archive.
      // (Until this release the Groq path ignored it and sent 0.4.)
      temperature: 0,
      groqModels: THINKING_MODELS,
      meta,
    });

  let raw: unknown;
  try {
    raw = await answerOnce(prompt);
  } catch (error) {
    console.error("[pyet] every provider failed", error);
    return NextResponse.json(
      {
        grounded: false,
        refusal: {
          ...REFUSAL,
          headline: "Nuk munda të përgjigjem tani.",
          detail: "Provo sërish për pak. Ndërkohë, kërkimi i gjen artikujt.",
        },
        reason: "provider-down",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── Gate 3 ────────────────────────────────────────────────────────────────
  let verdict = validateAnswer(raw, full.length);
  let cites: number[] = Array.isArray(verdict.sources) ? verdict.sources : [];

  // Every number must come from a cited article, the question, the thread or
  // today's date. One retry, told which figure it invented, before refusing:
  // a wrong number is the error a reader is most likely to repeat to someone.
  const allowedFor = (n: number[]) => [
    ...n.map((i) => full[i - 1].article.body ?? ""),
    question,
    today,
    ...history.map((t: { question: string; answer: string }) => `${t.question} ${t.answer}`),
  ];
  let invented: string[] =
    verdict.grounded && typeof verdict.answer === "string" ? unsupportedNumbers(verdict.answer, allowedFor(cites)) : [];
  if (invented.length > 0) {
    try {
      raw = await answerOnce(
        `${prompt}\n\nKUJDES: Në një përgjigje të mëparshme shkrove shifra që nuk janë në artikujt që citove ` +
          `(${invented.join(", ")}). Përdor vetëm shifrat që janë në artikuj.`,
      );
      verdict = validateAnswer(raw, full.length);
      cites = Array.isArray(verdict.sources) ? verdict.sources : [];
      invented =
        verdict.grounded && typeof verdict.answer === "string" ? unsupportedNumbers(verdict.answer, allowedFor(cites)) : [];
    } catch {
      // The first answer is already known to be wrong, so it is not shown.
      invented = ["retry-failed"];
    }
  }

  if (!verdict.grounded || cites.length === 0 || invented.length > 0) {
    const why = invented.length > 0 ? "unsupported-number" : (verdict.reason ?? "no-valid-citation");
    void logUnanswered(question, why);
    // Sources were found and shown to the model, so this is the thin case.
    return refuse(why, true, lang);
  }

  // Only the articles the answer actually leaned on are shown as sources.
  // Listing everything retrieved would credit pieces the answer never used.
  const cited = cites.map((n: number) => {
    const a = full[n - 1].article;
    return { title: a.title, href: `/article/${a.slug}`, meta: a.meta ?? null };
  });

  return NextResponse.json(
    {
      grounded: true,
      kind: "news",
      answer: verdict.answer,
      sources: cited,
      followups: Array.isArray(verdict.followups) ? verdict.followups : [],
      name: named,
      language: lang,
      // Which model wrote this, so "what is Pyet running on" has an answer.
      model: meta.model ?? null,
    },
    NO_STORE,
  );
}
