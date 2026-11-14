import assert from "node:assert/strict";
import test from "node:test";

import {
  fold,
  terms,
  scoreEntry,
  search,
  nearest,
  looksLikeQuestion,
  GROUPS,
} from "./search-match.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Folding
//
// Nobody types ë or ç on a phone. If folding breaks, the search returns nothing
// for most Albanian words and looks simply broken.
// ─────────────────────────────────────────────────────────────────────────────

test("diacritics fold away, so a phone keyboard still finds the word", () => {
  assert.equal(fold("Kosovë"), "kosove");
  assert.equal(fold("Çmimet"), "cmimet");
  assert.equal(fold("Prishtinë"), "prishtine");
  assert.equal(fold("Gjermani"), "gjermani");
});

test("case and punctuation are irrelevant to a match", () => {
  assert.equal(fold("DIALOGU Kosovë-Serbi!"), "dialogu kosove serbi");
  assert.equal(fold("  të  larta?  "), "te larta");
});

test("folding survives an empty or absent value", () => {
  for (const v of ["", null, undefined, "   ", "!!!"]) assert.equal(fold(v), "");
  assert.deepEqual(terms(""), []);
  assert.deepEqual(terms("dialogu  serbi"), ["dialogu", "serbi"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────────────────────

test("an exact title beats a prefix, which beats a word, which beats the body", () => {
  const q = terms("bote");
  const exact = scoreEntry(q, { title: "Botë" });
  const prefix = scoreEntry(q, { title: "Botëkuptimi modern" });
  const word = scoreEntry(q, { title: "Lajme nga bote e gjerë" });
  const body = scoreEntry(q, { title: "Diçka tjetër", body: "ndodhi në bote" });
  assert.ok(exact > prefix, `exact ${exact} !> prefix ${prefix}`);
  assert.ok(prefix > word, `prefix ${prefix} !> word ${word}`);
  assert.ok(word > body, `word ${word} !> body ${body}`);
});

test("a title match cannot be displaced by any pile of body matches", () => {
  const q = terms("kosove");
  const titled = scoreEntry(q, { title: "Kosovë" });
  const bodyHeavy = scoreEntry(q, {
    title: "Diçka",
    body: "kosove ".repeat(50),
  });
  assert.ok(titled > bodyHeavy, `${titled} !> ${bodyHeavy}`);
});

test("every term must hit, so extra words narrow rather than widen", () => {
  const entry = { title: "Dialogu Kosovë-Serbi", body: "bisedimet vazhdojnë" };
  assert.ok(scoreEntry(terms("dialogu"), entry) > 0);
  assert.ok(scoreEntry(terms("dialogu serbi"), entry) > 0);
  assert.equal(scoreEntry(terms("dialogu bitcoin"), entry), 0, "unmatched term must exclude");
});

test("a shorter title wins when both contain the query", () => {
  const q = terms("bot");
  const short = scoreEntry(q, { title: "Botë" });
  const long = scoreEntry(q, { title: "Botë e gjerë dhe lajmet ndërkombëtare sot" });
  assert.ok(short > long, `${short} !> ${long}`);
});

test("weight lets a destination outrank an article of equal text match", () => {
  const q = terms("gjermani");
  const plain = scoreEntry(q, { title: "Gjermani" });
  const weighted = scoreEntry(q, { title: "Gjermani", weight: 1.5 });
  assert.ok(weighted > plain);
});

test("an empty query matches nothing rather than everything", () => {
  assert.equal(scoreEntry(terms(""), { title: "Kosovë" }), 0);
  assert.deepEqual(search([{ kind: "vend", title: "Kosovë" }], ""), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

const INDEX = [
  { kind: "tema", title: "Dialogu Kosovë-Serbi" },
  { kind: "artikull", title: "Sorensen: Nuk ka afat kohor për dialogun" },
  { kind: "artikull", title: "LDK heq kërkesën për zgjedhjen e Presidentit", body: "dialogu" },
  { kind: "vend", title: "Gjermani" },
  { kind: "kategori", title: "Botë" },
  { kind: "vizito", title: "Prizren" },
  { kind: "treg", title: "A do të nisë dialogu deri në dhjetor?" },
];

test("results arrive grouped, with the strongest group first", () => {
  const groups = search(INDEX, "dialogu");
  assert.ok(groups.length > 0);
  assert.equal(groups[0].kind, "tema", "the exact topic should lead, not the articles");
  assert.equal(groups[0].label, "TEMA");
});

test("a country query returns the country ahead of anything else", () => {
  const groups = search(INDEX, "gjermani");
  assert.equal(groups[0].kind, "vend");
  assert.equal(groups[0].items[0].title, "Gjermani");
});

test("each group is capped so one kind cannot fill the overlay", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    kind: "artikull",
    title: `Dialogu numër ${i}`,
  }));
  const groups = search(many, "dialogu", { perGroup: 4 });
  assert.equal(groups[0].items.length, 4);
});

test("the overall cap is respected across groups", () => {
  const groups = search(INDEX, "dialogu", { perGroup: 10, total: 2 });
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  assert.equal(count, 2);
});

test("no group is emitted empty", () => {
  for (const g of search(INDEX, "dialogu")) {
    assert.ok(g.items.length > 0, `${g.kind} came back empty`);
  }
});

test("every declared group has an Albanian heading", () => {
  for (const g of GROUPS) {
    assert.ok(g.label && g.label === g.label.toUpperCase(), `${g.kind} heading`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The zero-result state
//
// A dead end is the one outcome this feature must never produce.
// ─────────────────────────────────────────────────────────────────────────────

test("a near-miss suggests the destinations it nearly matched", () => {
  const s = nearest(INDEX, "gjerman");
  assert.ok(s.length > 0);
  assert.equal(s[0].title, "Gjermani");
});

test("suggestions are places to go, never a lone article", () => {
  const s = nearest(INDEX, "dialog");
  assert.ok(s.length > 0);
  for (const item of s) {
    assert.notEqual(item.kind, "artikull", `suggested an article: ${item.title}`);
  }
});

test("a query sharing nothing suggests nothing rather than noise", () => {
  assert.deepEqual(nearest(INDEX, "zzzzqqq"), []);
});

test("suggestions need most of the word, not a shared syllable", () => {
  assert.deepEqual(nearest(INDEX, "g"), [], "one letter must not match everything");
  assert.deepEqual(nearest(INDEX, "gj"), []);
  // The case that made this rule: "dialogu" once suggested a Spanish outlet
  // called "Diario", which is a correct three-letter prefix and a useless answer.
  const withOutlet = [...INDEX, { kind: "media", title: "Diario Área Campo de Gibraltar" }];
  const s = nearest(withOutlet, "dialogu");
  for (const item of s) {
    assert.ok(!item.title.startsWith("Diario"), `suggested ${item.title} for "dialogu"`);
  }
});

test("a genuine near-miss still suggests, despite the stricter stem", () => {
  assert.equal(nearest(INDEX, "gjerman")[0]?.title, "Gjermani", "one letter short still matches");
  assert.equal(nearest(INDEX, "prizre")[0]?.title, "Prizren");
});

// ─────────────────────────────────────────────────────────────────────────────
// Question detection — only ever promotes Pyet 383, never withholds results
// ─────────────────────────────────────────────────────────────────────────────

test("question-shaped queries are recognised", () => {
  for (const q of [
    "a do te vazhdoje dialogu?",
    "Pse u ndal dialogu",
    "si funksionon tregu",
    "Kush e fitoi zgjedhjen",
    "çfarë ndodhi sot",
  ]) {
    assert.equal(looksLikeQuestion(q), true, q);
  }
});

test("a plain lookup is not mistaken for a question", () => {
  for (const q of ["dialogu Kosovë-Serbi", "Gjermani", "çmimet e banesave", ""]) {
    assert.equal(looksLikeQuestion(q), false, q);
  }
});

test("question detection never changes what is returned", () => {
  const asQuestion = search(INDEX, "a do të nisë dialogu?");
  const asLookup = search(INDEX, "dialogu");
  assert.ok(asQuestion.length > 0, "a question still searches");
  assert.ok(asLookup.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Albanian inflection, typos, function words, recency, closest
// ─────────────────────────────────────────────────────────────────────────────

import { searchTerms, stem, withinOneEdit, closest } from "./search-match.mjs";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const art = (title, date, body = "") => ({ kind: "artikull", title, body, href: `/article/${title}`, date });

test("an inflected form finds the others: kosova finds Kosovës", () => {
  assert.equal(stem("kosova"), "kosov");
  assert.equal(stem("kosoves"), "kosov");
  assert.equal(stem("be"), "be");
  const hits = search([art("Qeveria e Kosovës miraton buxhetin", "2026-09-27")], "kosova", { now: NOW });
  assert.equal(hits[0]?.items.length, 1);
});

test("one mistyped letter still finds the word", () => {
  assert.ok(withinOneEdit("gjermanija", "gjermania"));
  assert.ok(!withinOneEdit("gjermanija", "gjeorgjia"));
  const hits = search([art("Gjermania mbyll kufirin", "2026-09-27")], "gjermanija", { now: NOW });
  assert.equal(hits[0]?.items.length, 1);
  // The everyday spelling finds the diacritic one through the stem.
  assert.equal(search([art("Protestë në Prishtinë sot", "2026-09-27")], "prishtina", { now: NOW })[0]?.items.length, 1);
});

test("function words are not required terms", () => {
  assert.deepEqual(searchTerms("protesta në Prishtinë"), ["protesta", "prishtine"]);
  // A query of nothing but function words still searches for them.
  assert.deepEqual(searchTerms("në të"), ["ne", "te"]);
});

test("an exact title word still beats an inflected or mistyped one", () => {
  const entries = [art("Kosovës i jepet statusi", "2026-09-27"), art("Kosova fiton ndeshjen", "2026-09-27")];
  const [group] = search(entries, "kosova", { now: NOW });
  assert.equal(group.items[0].title, "Kosova fiton ndeshjen");
});

test("between equally good matches the newer story comes first", () => {
  const entries = [art("Buxheti i ri miratohet", "2026-09-01"), art("Buxheti i ri miratohet sot", "2026-09-27")];
  const [group] = search(entries, "buxheti", { now: NOW });
  assert.equal(group.items[0].date, "2026-09-27");
});

test("a shorter headline does not outrank a newer story of the same match", () => {
  const entries = [art("Zgjedhjet nesër", "2026-09-01"), art("Zgjedhjet lokale mbahen në gjithë vendin sot", "2026-09-27")];
  const [group] = search(entries, "zgjedhjet", { now: NOW });
  assert.equal(group.items[0].date, "2026-09-27");
});

test("recency never lifts a body match over a title match", () => {
  const entries = [art("Tjetër temë krejt", "2026-09-28", "buxheti i ri"), art("Buxheti i ri", "2025-01-01")];
  const [group] = search(entries, "buxheti", { now: NOW });
  assert.equal(group.items[0].title, "Buxheti i ri");
});

test("closest returns partial matches, most terms first, when nothing matches all", () => {
  const entries = [
    art("Protesta në Prishtinë", "2026-09-27"),
    art("Buxheti i Prishtinës", "2026-09-26"),
    art("Ndeshja në Tiranë", "2026-09-27"),
  ];
  assert.deepEqual(search(entries, "protesta prishtine buxheti", { now: NOW }), []);
  const near = closest(entries, "protesta prishtine buxheti", { now: NOW });
  assert.deepEqual(near.map((e) => e.title), ["Protesta në Prishtinë", "Buxheti i Prishtinës"]);
  assert.deepEqual(closest(entries, "", { now: NOW }), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Topic families
//
// A broad topic contains its narrower ones, never the other way round. A reader
// who types "crypto" wants the Bitcoin stories too; a reader who types
// "bitcoin" wants Bitcoin, not every story about the crypto market.
// ─────────────────────────────────────────────────────────────────────────────

const btc = art("Bitcoin bie nën 80 mijë dollarë", "2026-09-27");
const btcBody = art("ETF-të patën hyrje neto", "2026-09-27", "fondet e bitcoin-it rriten");
const eth = art("Ethereum rritet 4% pas përditësimit", "2026-09-27");
const market = art("Tregu i kriptos humb 200 miliardë", "2026-09-27");
const exchange = art("Binance rikthen tërheqjet në dollarë", "2026-09-27");
const nvidia = art("Nvidia publikon model që transkripton 40 gjuhë", "2026-09-27");
const ethiopia = art("Ethiopia hap kufirin me Kenian", "2026-09-27");
const titles = (groups) => (groups[0]?.items ?? []).map((i) => i.title);

test("a broad topic finds its narrower ones: crypto finds Bitcoin and Ethereum", () => {
  for (const q of ["crypto", "kripto", "kriptomonedha", "cryptocurrency"]) {
    const found = titles(search([btc, eth, market, exchange], q, { now: NOW }));
    assert.ok(found.includes(btc.title), `${q} missed Bitcoin`);
    assert.ok(found.includes(eth.title), `${q} missed Ethereum`);
    assert.ok(found.includes(exchange.title), `${q} missed Binance`);
    assert.ok(found.includes(market.title), `${q} missed the crypto market story`);
  }
});

test("a narrow topic stays narrow: bitcoin does not bring the whole crypto market", () => {
  const found = titles(search([btc, btcBody, eth, market, exchange], "bitcoin", { now: NOW }));
  assert.deepEqual(found, [btc.title, btcBody.title]);
});

test("a topic's own short name counts, as a whole word only", () => {
  assert.deepEqual(titles(search([btc, eth, market], "btc", { now: NOW })), [btc.title]);
  assert.deepEqual(titles(search([art("Strive blen 124 BTC", "2026-09-27"), market], "bitcoin", { now: NOW })), [
    "Strive blen 124 BTC",
  ]);
  assert.deepEqual(titles(search([eth, ethiopia], "eth", { now: NOW })), [eth.title]);
});

test("a story naming the broad topic itself ranks above one that only names a member", () => {
  const found = titles(search([btc, market], "kripto", { now: NOW }));
  assert.deepEqual(found, [market.title, btc.title]);
});

test("a query never matches from the middle of a word", () => {
  assert.deepEqual(search([nvidia], "kripto", { now: NOW }), []);
  assert.deepEqual(search([art("Diçka", "2026-09-27", "u transkriptua fjalimi")], "kripto", { now: NOW }), []);
});

test("every term must still hit when one of them is a topic", () => {
  const found = titles(search([btc, art("ETF-të e Bitcoin regjistruan dalje", "2026-09-27")], "kripto etf", { now: NOW }));
  assert.deepEqual(found, ["ETF-të e Bitcoin regjistruan dalje"]);
});

test("closest() uses the same topic rules", () => {
  const near = closest([btc, nvidia], "kripto zgjedhje", { now: NOW });
  assert.deepEqual(near.map((e) => e.title), [btc.title]);
});

test("the Albanian spelling counts: bitcoin finds Bitkoinit, and bitkoin finds Bitcoin", () => {
  const sq = art("Deputetja mban ETF të Bitkoinit", "2026-09-27");
  assert.deepEqual(titles(search([sq, btc, market], "bitcoin", { now: NOW })).sort(), [btc.title, sq.title].sort());
  assert.ok(titles(search([sq, btc], "bitkoin", { now: NOW })).includes(btc.title));
});

test("an Albanian compound still finds its word: zgjedhje finds parazgjedhjet", () => {
  const pre = art("Partitë nisin fushatën", "2026-09-27", "debati para parazgjedhjeve");
  const post = art("Kompromisi i paszgjedhjeve", "2026-09-27");
  assert.deepEqual(titles(search([pre, post], "zgjedhje", { now: NOW })), [post.title, pre.title]);
  // Not any letters before it: a word inside another word stays out.
  assert.deepEqual(search([art("Drama në fushë", "2026-09-27")], "rama", { now: NOW }), []);
});

test("cryptography is not crypto", () => {
  const crypto = art("Kriptografia e re mbron bankat", "2026-09-27");
  assert.deepEqual(titles(search([crypto, market], "kripto", { now: NOW })), [market.title]);
  // Searched for by name, it is still found.
  assert.deepEqual(titles(search([crypto, market], "kriptografia", { now: NOW })), [crypto.title]);
});

test("a brand joined in capitals still counts its parts: gpt finds ChatGPT", () => {
  const chat = art("Shkurtimet e ChatGPT për përdoruesit falas", "2026-09-27");
  assert.deepEqual(titles(search([chat], "gpt", { now: NOW })), [chat.title]);
  assert.deepEqual(titles(search([chat], "chatgpt", { now: NOW })), [chat.title]);
});

test("a topic half-typed already finds its family: kript finds Bitcoin", () => {
  assert.ok(titles(search([btc, market], "kript", { now: NOW })).includes(btc.title));
  // Too short to name anything yet.
  assert.deepEqual(titles(search([btc], "kri", { now: NOW })), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Topic tags
//
// Every article carries the topics it is about (lib/topic-tags.mjs). A search
// for a topic finds every article tagged with it or with anything under it,
// whatever words the story happens to use; an article without tags yet falls
// back to the topic's words.
// ─────────────────────────────────────────────────────────────────────────────

const tagged = (title, topics, body = "") => ({ ...art(title, "2026-09-27", body), topics });

test("a tagged story is found by its topic and every topic above it, whatever its words", () => {
  const ucl = tagged("Real Madrid mposht Bayernin 2-1", ["liga-kampioneve"]);
  assert.deepEqual(titles(search([ucl], "liga e kampioneve", { now: NOW })), [ucl.title]);
  assert.deepEqual(titles(search([ucl], "futboll", { now: NOW })), [ucl.title]);
  assert.deepEqual(titles(search([ucl], "sport", { now: NOW })), [ucl.title]);
  assert.deepEqual(titles(search([ucl], "champions league", { now: NOW })), [ucl.title]);
});

test("a narrow topic never brings what sits beside or above it", () => {
  const league = tagged("Kosova fiton në Superligë", ["futboll"]);
  const ucl = tagged("Real Madrid mposht Bayernin", ["liga-kampioneve"]);
  assert.deepEqual(titles(search([league, ucl], "liga e kampioneve", { now: NOW })), [ucl.title]);
});

test("on a tagged story the topic's words in the summary are not enough", () => {
  // The story the reader complained about: general crypto news that mentions Bitcoin in passing.
  const general = tagged("Tregu i kriptos humb 200 miliardë", ["kripto"], "edhe bitcoin bie");
  const about = tagged("Strive blen 124 monedha", ["bitcoin"]);
  assert.deepEqual(titles(search([general, about], "bitcoin", { now: NOW })), [about.title]);
  // Still found by the broad topic, both of them.
  assert.equal(search([general, about], "kripto", { now: NOW })[0].items.length, 2);
});

test("an untagged story still falls back to the topic's words", () => {
  const untagged = art("Diçka për tregjet", "2026-09-27", "bitcoin u rrit sot");
  assert.deepEqual(titles(search([untagged], "bitcoin", { now: NOW })), [untagged.title]);
});

test("a story naming the topic itself in its headline is found even if the tagger missed it", () => {
  const missed = tagged("Bitcoin kalon 90 mijë dollarë", ["bursa"]);
  assert.deepEqual(titles(search([missed], "bitcoin", { now: NOW })), [missed.title]);
});

test("ai finds AI stories by tag and by name, never the pronoun", () => {
  const byTag = tagged("OpenAI lanson modelin e ri", ["ai"]);
  const byName = art("Inteligjenca artificiale në shkolla", "2026-09-27");
  const pronoun = art("Ai tha se do të kthehet", "2026-09-27");
  const found = titles(search([byTag, byName, pronoun], "ai", { now: NOW }));
  assert.deepEqual(found.sort(), [byTag.title, byName.title].sort());
});

test("a brand stays narrow: tiktok does not bring every social-media story", () => {
  const tiktok = art("TikTok ndalohet në shkolla", "2026-09-27");
  const insta = art("Instagram ndryshon algoritmin", "2026-09-27");
  assert.deepEqual(titles(search([tiktok, insta], "tiktok", { now: NOW })), [tiktok.title]);
  assert.equal(search([tiktok, insta], "rrjetet sociale", { now: NOW })[0].items.length, 2);
});

test("searchTerms keeps a topic's name of several words together", () => {
  assert.deepEqual(searchTerms("liga e kampioneve"), ["liga kampioneve"]);
  assert.deepEqual(searchTerms("real madrid liga e kampioneve"), ["real", "madrid", "liga kampioneve"]);
  assert.deepEqual(searchTerms("kosova"), ["kosova"]);
});

test("a headline word the tags disagree with ranks below every story tagged with the topic", () => {
  // "zgjedhje" is also "choice": the tagger knows this book-club story is not about elections.
  const books = tagged("Zgjedhjet e klubeve të librave", ["showbiz"]);
  const vote = tagged("Kuvendi shpërndahet, vendi shkon në votime", ["zgjedhje"]);
  assert.deepEqual(titles(search([books, vote], "zgjedhje", { now: NOW })), [vote.title, books.title]);
});

test("the Champions League is found in any case form", () => {
  for (const title of ["Real fiton në Ligën e Kampionëve", "Shorti i Ligës së Kampionëve", "Liga e Kampionëve nis sot"]) {
    assert.deepEqual(titles(search([art(title, "2026-09-27")], "liga e kampioneve", { now: NOW })), [title]);
  }
});

test("words that only start like a topic are not it", () => {
  const cases = [
    ["Kredibiliteti i qeverisë bie", "bankat"],
    ["Bursa për studentët nis sot", "bursa"],
    ["Radhë të gjata te sporteli i ATK", "sport"],
    ["Shoferët e taxi protestojnë", "tatimet"],
  ];
  for (const [title, topic] of cases) {
    const query = { bankat: "banka", bursa: "aksionet", sport: "sport", tatimet: "tax" }[topic];
    assert.deepEqual(search([art(title, "2026-09-27")], query, { now: NOW }), [], `${query} found "${title}"`);
  }
});

test("a topic of several words is recognised while its last word is still being typed", () => {
  assert.deepEqual(searchTerms("liga e kampion"), ["liga kampion"]);
  assert.deepEqual(searchTerms("rrjetet soci"), ["rrjetet soci"]);
  const ucl = tagged("Real Madrid mposht Bayernin", ["liga-kampioneve"]);
  assert.deepEqual(titles(search([ucl], "liga e kampion", { now: NOW })), [ucl.title]);
  // A short stub is not yet a name.
  assert.deepEqual(searchTerms("liga e kam"), ["liga", "kam"]);
});
