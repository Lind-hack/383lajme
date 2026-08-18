import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTEXT_MAX,
  MAX_OPTIONS,
  OPTION_MAX,
  QUESTION_MAX,
  buildDraftPrompt,
  DRAFT_SYSTEM_PROMPT,
  draftDateKey,
  groundSlug,
  normalizeQuestion,
  validateDraft,
  isHedgeOption,
  isLocalArticle,
  selectDraftArticles,
} from "./sondazhi-draft.mjs";

const GOOD = {
  question: "A duhet komuna të ndalojë ndërtimet e reja në qendër të Prishtinës?",
  options: ["Po, menjëherë", "Jo, kërkohen banesa"],
  context_line: "Komuna miratoi sot tri leje të reja ndërtimi në qendër.",
  source_article_slug: "ndertimet-prishtine",
};

test("a draft is written for tomorrow, so there is time to review it", () => {
  assert.equal(draftDateKey("2026-08-17"), "2026-08-18");
  assert.equal(draftDateKey("2026-08-31"), "2026-09-01");
  assert.equal(draftDateKey("2026-12-31"), "2027-01-01");
});

test("a well-formed draft passes and comes back trimmed", () => {
  const res = validateDraft({
    ...GOOD,
    question: `  ${GOOD.question}  `,
    options: ["  Po, menjëherë  ", "Jo, kërkohen banesa"],
  });
  assert.equal(res.ok, true);
  assert.equal(res.draft.question, GOOD.question);
  assert.deepEqual(res.draft.options, ["Po, menjëherë", "Jo, kërkohen banesa"]);
  assert.equal(res.draft.sourceArticleSlug, "ndertimet-prishtine");
});

test("a question that is not a question is refused", () => {
  const res = validateDraft({ ...GOOD, question: "Çmimet po rriten në Prishtinë." });
  assert.equal(res.ok, false);
  assert.match(res.reason, /pikëpyetje/);
});

test("questions outside the length band are refused rather than truncated", () => {
  assert.equal(validateDraft({ ...GOOD, question: "A po?" }).ok, false);
  const long = validateDraft({ ...GOOD, question: `${"a".repeat(QUESTION_MAX)}?` });
  assert.equal(long.ok, false);
  assert.match(long.reason, /gjatë/);
});

test("a poll needs at least two options and at most four", () => {
  assert.equal(validateDraft({ ...GOOD, options: ["Vetëm një"] }).ok, false);
  assert.equal(
    validateDraft({ ...GOOD, options: Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => `Opsioni ${i}`) }).ok,
    false
  );
  // Three genuine stances are fine; "Ndoshta" would not be, and is covered below.
  assert.equal(validateDraft({ ...GOOD, options: ["Po", "Jo", "Vetëm pjesërisht"] }).ok, true);
});

test("an option too long for the pill is refused", () => {
  const res = validateDraft({ ...GOOD, options: ["Po", "x".repeat(OPTION_MAX + 1)] });
  assert.equal(res.ok, false);
  assert.match(res.reason, new RegExp(String(OPTION_MAX)));
});

test("two options that differ only by accent or case are the same option", () => {
  const res = validateDraft({ ...GOOD, options: ["Çmimet", "cmimet"] });
  assert.equal(res.ok, false);
  assert.match(res.reason, /përsëritet/);
});

test("blank and non-string options are dropped before counting", () => {
  assert.equal(validateDraft({ ...GOOD, options: ["Po", "   ", "Jo"] }).ok, true);
  assert.equal(validateDraft({ ...GOOD, options: ["Po", 42, null] }).ok, false,
    "dropping the junk leaves only one real option");
});

test("a question asked recently is refused however it is spelled", () => {
  const res = validateDraft(GOOD, {
    recentQuestions: ["a duhet komuna te ndaloje ndertimet e reja ne qender te prishtines?"],
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /së fundmi/);
});

test("an unrelated recent question does not block a new one", () => {
  assert.equal(validateDraft(GOOD, { recentQuestions: ["A e besoni median?"] }).ok, true);
});

test("the repeat key ignores case, accents and punctuation", () => {
  assert.equal(normalizeQuestion("A janë çmimet TË LARTA?"), normalizeQuestion("a jane cmimet te larta"));
  assert.notEqual(normalizeQuestion("A janë të larta?"), normalizeQuestion("A janë të ulëta?"));
});

test("an over-long context line is refused rather than silently cut", () => {
  const res = validateDraft({ ...GOOD, context_line: "x".repeat(CONTEXT_MAX + 1) });
  assert.equal(res.ok, false);
  assert.match(res.reason, /Konteksti/);
});

test("optional fields absent or blank resolve to null", () => {
  const res = validateDraft({ question: GOOD.question, options: GOOD.options, context_line: "  " });
  assert.equal(res.ok, true);
  assert.equal(res.draft.contextLine, null);
  assert.equal(res.draft.sourceArticleSlug, null);
});

test("camelCase keys are accepted alongside the snake_case the prompt asks for", () => {
  const res = validateDraft({
    question: GOOD.question,
    options: GOOD.options,
    contextLine: "Diçka ndodhi sot.",
    sourceArticleSlug: "nje-slug",
  });
  assert.equal(res.ok, true);
  assert.equal(res.draft.contextLine, "Diçka ndodhi sot.");
  assert.equal(res.draft.sourceArticleSlug, "nje-slug");
});

test("garbage in place of a draft is refused, never thrown on", () => {
  for (const raw of [null, undefined, "", 7, [], { question: GOOD.question }]) {
    assert.equal(validateDraft(raw).ok, false, `accepted ${JSON.stringify(raw)}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Grounding
// ─────────────────────────────────────────────────────────────────────────────

test("an invented slug is dropped so tomorrow's Lexo link cannot 404", () => {
  const draft = { question: "A?", options: ["Po", "Jo"], contextLine: null, sourceArticleSlug: "s-ekziston" };
  const out = groundSlug(draft, [{ slug: "ndertimet-prishtine" }]);
  assert.equal(out.sourceArticleSlug, null);
  assert.equal(out.question, "A?", "the question itself survives a bad slug");
});

test("a slug naming a real article is kept", () => {
  const draft = { question: "A?", options: ["Po", "Jo"], contextLine: null, sourceArticleSlug: "real" };
  assert.equal(groundSlug(draft, [{ slug: "real" }]).sourceArticleSlug, "real");
});

test("grounding a draft with no slug is a no-op", () => {
  const draft = { question: "A?", options: ["Po", "Jo"], contextLine: null, sourceArticleSlug: null };
  assert.deepEqual(groundSlug(draft, []), draft);
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

test("the prompt carries the day's headlines with their slugs so the model can cite one", () => {
  const prompt = buildDraftPrompt([
    { slug: "a-slug", title: "Titulli i parë", category: "Ekonomi" },
    { slug: "b-slug", title: "Titulli i dytë", category: "Politikë" },
  ]);
  assert.match(prompt, /Titulli i parë/);
  assert.match(prompt, /slug: a-slug/);
  assert.match(prompt, /\[Ekonomi\]/);
});

test("the prompt lists recent questions to avoid when there are any", () => {
  const prompt = buildDraftPrompt([{ slug: "s", title: "T" }], ["A e besoni median?"]);
  assert.match(prompt, /Mos e përsërit/);
  assert.match(prompt, /A e besoni median\?/);
  const bare = buildDraftPrompt([{ slug: "s", title: "T" }], []);
  assert.ok(!bare.includes("Mos e përsërit"), "no empty avoid-list section");
});

test("an empty news day still produces a usable prompt rather than an empty one", () => {
  const prompt = buildDraftPrompt([]);
  assert.match(prompt, /Lajmet e sotme/);
  assert.match(prompt, /asnjë/);
});

test("untitled articles are skipped and the list is capped", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ slug: `s${i}`, title: `T${i}` }));
  const prompt = buildDraftPrompt([{ slug: "x" }, ...many]);
  assert.ok(!prompt.includes("slug: x"), "an article with no title is not offered");
  assert.equal((prompt.match(/slug: s/g) ?? []).length, 20);
});

// ─────────────────────────────────────────────────────────────────────────────
// Neutral options
//
// An escape hatch is always the safe pick and costs nothing, so it wins — which
// is the unconscious click this feature exists to end. An earlier generator run
// produced "Varet nga burimet" and "Është çështje komplekse" unprompted.
// ─────────────────────────────────────────────────────────────────────────────

test("an option that avoids taking a side is refused", () => {
  for (const hedge of [
    "Nuk e di",
    "Ndoshta",
    "Varet",
    "Varet nga burimet",
    "Është çështje komplekse",
    "Është herët të thuhet",
    "As po as jo",
    "Pa koment",
  ]) {
    assert.equal(isHedgeOption(hedge), true, `"${hedge}" should be refused`);
    const res = validateDraft({ ...GOOD, options: ["Po, menjëherë", hedge] });
    assert.equal(res.ok, false, `draft with "${hedge}" was accepted`);
    assert.match(res.reason, /nuk është qëndrim/);
  }
});

test("a real stance is not mistaken for a hedge, however hedged it sounds", () => {
  for (const real of [
    "Po, absolutisht",
    "Jo, është propagandë",
    "Jo, vendosin prindërit",
    "Vetëm pjesërisht",
    "Po, nëse mbyllet çështja",
    "Jo, s'kanë alternativë",
  ]) {
    assert.equal(isHedgeOption(real), false, `"${real}" should be allowed`);
  }
});

test("hedges are caught regardless of case and accents", () => {
  assert.equal(isHedgeOption("VARET NGA SITUATA"), true);
  assert.equal(isHedgeOption("nuk e di"), true);
  assert.equal(isHedgeOption("Eshte heret te thuhet"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Article selection
//
// The feed is dominated by international wires. Sorted by date alone the local
// stories fall out of the window entirely, so every generated question was
// about somewhere else.
// ─────────────────────────────────────────────────────────────────────────────

test("a story is local by category or by what it names", () => {
  assert.equal(isLocalArticle({ category: "Kosovo", title: "x" }), true, "category");
  assert.equal(isLocalArticle({ category: "Politikë", title: "x" }), true, "category with accent");
  assert.equal(isLocalArticle({ title: "Zjarri në Gjakovë u shua" }), true, "place name");
  assert.equal(isLocalArticle({ title: "Kurti takon Osmanin" }), true, "person name");
  assert.equal(isLocalArticle({ title: "Protesta në Tiranë" }), true, "region");
  assert.equal(
    isLocalArticle({ title: "Çmimet e banesave në Prishtinë rriten", category: "Ekonomi" }),
    true,
    "a local story filed under a general category"
  );
});

test("the regional outlet's wire copy is not mistaken for local news", () => {
  // Euronews Albania files world stories too — it carried the Korea peace-talks
  // piece — so the source alone cannot mark a story as ours.
  assert.equal(
    isLocalArticle({
      title: "Presidenti i Koresë së Jugut propozon bisedime",
      category: "Botë",
      source: "Euronews Albania",
    }),
    false
  );
});

test("a keyword inside a longer, unrelated word does not count", () => {
  // "rama" matched "Ramallahut" and filed a West Bank story as local.
  assert.equal(isLocalArticle({ title: "Kolonët ngrenë tenda pranë Ramallahut", category: "Botë" }), false);
  assert.equal(isLocalArticle({ title: "Panorama e dramës amerikane", category: "Botë" }), false);
  // The real person still matches.
  assert.equal(isLocalArticle({ title: "Edi Rama flet për projektin" }), true);
});

test("Albanian case endings still match their root", () => {
  for (const title of [
    "Qeveria e Kosovës vendos",
    "Rrugët e Prishtinës mbyllen",
    "Zjarr në Gjakovë",
    "Nga Prizreni në Pejë",
  ]) {
    assert.equal(isLocalArticle({ title }), true, title);
  }
});

test("an international story is not mistaken for a local one", () => {
  for (const title of [
    "Bitcoin kalon 64 mijë dollarë",
    "Juventus shton bisedimet për Vicario",
    "Trump urdhëron zvogëlimin e stërvitjeve",
  ]) {
    assert.equal(isLocalArticle({ title, category: "Botë", source: "Al Jazeera" }), false, title);
  }
});

test("local stories are placed ahead of world stories", () => {
  const picked = selectDraftArticles(
    [
      { title: "Bitcoin kalon 64 mijë", category: "Ekonomi", source: "CoinDesk" },
      { title: "Arrestohet një person në Zveçan", category: "Kosovo", source: "Euronews Albania" },
      { title: "Juventus shton bisedimet", category: "Sport", source: "BBC Sport" },
    ],
    { limit: 3, localSlots: 2 }
  );
  assert.match(picked[0].title, /Zveçan/);
});

test("world stories still fill the list when there are few local ones", () => {
  const world = Array.from({ length: 30 }, (_, i) => ({ title: `Bota ${i}`, category: "Botë" }));
  const picked = selectDraftArticles([...world, { title: "Prishtinë sot", category: "Kosovo" }], {
    limit: 20,
    localSlots: 12,
  });
  assert.equal(picked.length, 20, "the list is filled, not left short");
  assert.match(picked[0].title, /Prishtinë/, "the single local story still leads");
});

test("an all-international day still yields a full list rather than nothing", () => {
  const world = Array.from({ length: 25 }, (_, i) => ({ title: `Bota ${i}`, category: "Botë" }));
  const picked = selectDraftArticles(world, { limit: 20, localSlots: 12 });
  assert.equal(picked.length, 20);
});

test("local stories beyond their reserved slots are not thrown away", () => {
  const local = Array.from({ length: 8 }, (_, i) => ({ title: `Kosovë ${i}`, category: "Kosovo" }));
  const picked = selectDraftArticles(local, { limit: 6, localSlots: 3 });
  assert.equal(picked.length, 6, "the extra local stories fill the remaining room");
});

test("articles without a title are dropped before selection", () => {
  const picked = selectDraftArticles([{ category: "Kosovo" }, { title: "Bota", category: "Botë" }], {
    limit: 5,
  });
  assert.deepEqual(picked.map((a) => a.title), ["Bota"]);
});

test("the prompt marks which stories are local, since the brief ranks by origin", () => {
  const prompt = buildDraftPrompt([
    { title: "Bitcoin kalon 64 mijë", category: "Ekonomi", source: "CoinDesk", slug: "btc" },
    { title: "Arrestohet një person në Zveçan", category: "Kosovo", source: "Euronews Albania", slug: "zv" },
  ]);
  assert.match(prompt, /\[LOKALE\].*Zveçan/);
  assert.match(prompt, /\[BOTË\].*Bitcoin/);
  assert.ok(prompt.indexOf("Zveçan") < prompt.indexOf("Bitcoin"), "local is listed first");
});

test("the brief ranks Kosovo above the region above the world", () => {
  assert.match(DRAFT_SYSTEM_PROMPT, /PËRPARËSIA E TEMËS/);
  assert.match(DRAFT_SYSTEM_PROMPT, /Artikujt e shënuar \[LOKALE\] kanë përparësi/);
});
