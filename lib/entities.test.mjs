import assert from "node:assert/strict";
import test from "node:test";

import {
  nameAliases,
  looksLikePerson,
  extractPeople,
  resolveEntity,
  surfaceForms,
  mentions,
  wordMatchesForm,
  deriveEntity,
  contentWords,
  CURATED,
} from "./entities.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Names
//
// The case that started this: an article quoting Edi Rama was found by "Rama"
// and missed by "Edi".
// ─────────────────────────────────────────────────────────────────────────────

test("both halves of a name are ways someone will search", () => {
  const a = nameAliases("Edi Rama");
  assert.ok(a.includes("edi rama"), "the full name");
  assert.ok(a.includes("edi"), "the given name — the case this exists for");
  assert.ok(a.includes("rama"), "the family name");
});

test("aliases fold, so a phone keyboard finds an Albanian name", () => {
  const a = nameAliases("Vjosa Osmani");
  assert.ok(a.includes("vjosa"));
  const v = nameAliases("Aleksandar Vučić");
  assert.ok(v.includes("vucic"), "ć must fold to c");
});

test("a single word is not a name and yields nothing", () => {
  assert.deepEqual(nameAliases("Rama"), []);
  assert.deepEqual(nameAliases(""), []);
  assert.deepEqual(nameAliases(null), []);
});

test("tokens too short to be a name are not made into aliases", () => {
  // "Al Jazeera" must never teach the index that "al" means anything.
  const a = nameAliases("Al Jazeera");
  assert.ok(!a.includes("al"), "two letters is not a search");
});

test("an organisational word never becomes an alias", () => {
  // Without this, searching "sport" returns a British broadcaster instead of
  // the section of the site called Sport.
  assert.equal(looksLikePerson("BBC Sport"), false);
  assert.equal(looksLikePerson("LA Clippers"), false, "LA is too short");
  assert.equal(looksLikePerson("US Amateur"), false);
  assert.equal(looksLikePerson("St Jude"), false);
});

test("a real name is recognised as one", () => {
  for (const name of ["Edi Rama", "Cristiano Ronaldo", "Donald Trump", "Vjosa Osmani"]) {
    assert.equal(looksLikePerson(name), true, name);
  }
});

test("a category name can never be captured as a person", () => {
  for (const run of ["Botë Sot", "Politikë Kosovë", "Ekonomi Bota"]) {
    assert.equal(looksLikePerson(run), false, run);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Extraction from the corpus
// ─────────────────────────────────────────────────────────────────────────────

const CORPUS = [
  { title: "Edi Rama flet për projektin e Zvërnecit", body: "Kryeministri Edi Rama tha sot" },
  { title: "Rama takon Kurtin në Tiranë", body: "Edi Rama dhe Albin Kurti" },
  { title: "Cristiano Ronaldo shënon sërish", body: "Cristiano Ronaldo vazhdon" },
  { title: "Lajme nga BBC Sport", body: "BBC Sport raporton" },
  { title: "Diçka pa emra", body: "asgjë e veçantë këtu" },
];

test("recurring people are found without anyone curating them", () => {
  const people = extractPeople(CORPUS, { minMentions: 2 });
  const names = people.map((p) => p.name);
  assert.ok(names.some((n) => n.includes("Edi Rama")), `missing Edi Rama in ${names}`);
  assert.ok(names.some((n) => n.includes("Cristiano Ronaldo")), `missing Ronaldo in ${names}`);
});

test("a broadcaster is not mistaken for a person", () => {
  const names = extractPeople(CORPUS, { minMentions: 1 }).map((p) => p.name);
  assert.ok(!names.some((n) => n.includes("BBC")), `BBC Sport was captured: ${names}`);
});

test("a name mentioned once is not indexed as a subject", () => {
  const once = [{ title: "Dikush Njëherë tha diçka", body: "" }];
  assert.deepEqual(extractPeople(once, { minMentions: 3 }), []);
});

test("a headline mention counts for more than a body mention", () => {
  const titled = extractPeople([{ title: "Filan Fisteku foli", body: "" }], { minMentions: 2 });
  const bodied = extractPeople([{ title: "", body: "Filan Fisteku foli" }], { minMentions: 2 });
  assert.equal(titled.length, 1, "one headline mention should clear a threshold of two");
  assert.equal(bodied.length, 0, "one body mention should not");
});

test("extraction survives an empty or malformed corpus", () => {
  assert.deepEqual(extractPeople([]), []);
  assert.deepEqual(extractPeople(null), []);
  assert.deepEqual(extractPeople([null, {}, { title: null }]), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────

test("a given name alone resolves to the person", () => {
  const e = resolveEntity("edi");
  assert.equal(e?.name, "Edi Rama");
});

test("a role resolves to whoever holds it", () => {
  assert.equal(resolveEntity("kryeministri i shqiperise")?.name, "Edi Rama");
  assert.equal(resolveEntity("presidenti i shqiperise")?.name, "Bajram Begaj");
  assert.equal(resolveEntity("kryeministri i kosoves")?.name, "Albin Kurti");
});

test("the prime minister and the president of Albania are different people", () => {
  // Guards the mistake this data was built to avoid: Edi Rama is the Prime
  // Minister, and returning him for "president" would be confidently wrong.
  const pm = resolveEntity("kryeministri i shqiperise");
  const president = resolveEntity("presidenti i shqiperise");
  assert.notEqual(pm.name, president.name);
});

test("a curated role wins over a coincidental name run", () => {
  const derived = [{ name: "Kryeministri Dikushi", aliases: ["kryeministri dikushi", "kryeministri", "dikushi"] }];
  assert.equal(resolveEntity("kryeministri i kosoves", derived)?.name, "Albin Kurti");
});

test("a derived person resolves when nothing curated claims the word", () => {
  const derived = [{ name: "Cristiano Ronaldo", aliases: ["cristiano ronaldo", "cristiano", "ronaldo"] }];
  assert.equal(resolveEntity("ronaldo", derived)?.name, "Cristiano Ronaldo");
});

test("a query naming nothing resolves to nothing", () => {
  for (const q of ["", "x", "zzzqqq", null]) {
    assert.equal(resolveEntity(q), null, String(q));
  }
});

test("diacritics do not prevent a role from resolving", () => {
  assert.equal(resolveEntity("kryeministri i shqipërisë")?.name, "Edi Rama");
});

// ─────────────────────────────────────────────────────────────────────────────
// Finding an entity's articles
// ─────────────────────────────────────────────────────────────────────────────

test("an entity carries every form worth looking for in article text", () => {
  const rama = CURATED.find((e) => e.id === "edi-rama");
  const forms = surfaceForms(rama);
  assert.ok(forms.includes("edi rama"));
  assert.ok(forms.includes("rama"));
});

test("articles are matched by any surface form, not just the full name", () => {
  const forms = surfaceForms(CURATED.find((e) => e.id === "edi-rama"));
  assert.equal(mentions({ title: "Rama flet për Zvërnecin" }, forms), true, "family name only");
  assert.equal(mentions({ title: "Edi Rama flet" }, forms), true, "full name");
  assert.equal(
    mentions({ title: "Diçka tjetër", body: "sipas Ramës" }, forms),
    true,
    "an inflected form — Albanian declines the stem, so this is listed, not derived",
  );
  assert.equal(mentions({ title: "Panorama e ditës" }, forms), false, "must not match inside a word");
  assert.equal(
    mentions({ title: "Kolonët ngrenë tenda pranë Ramallahut" }, forms),
    false,
    "Ramallah is not Rama — a start-only boundary filed a West Bank story under Albania's PM",
  );
});

test("mentions is safe on empty input", () => {
  assert.equal(mentions(null, ["rama"]), false);
  assert.equal(mentions({ title: "Rama" }, []), false);
  assert.equal(mentions({}, ["rama"]), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// The curated data itself
// ─────────────────────────────────────────────────────────────────────────────

test("every curated entity is complete enough to render and to search", () => {
  const ids = new Set();
  for (const e of CURATED) {
    assert.ok(e.id, `${e.name} has no id`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(e.name, `${e.id} has no name`);
    assert.ok(e.kind, `${e.id} has no kind`);
    assert.ok(e.aliases?.length, `${e.id} has no aliases`);
    assert.ok(e.match?.length, `${e.id} has nothing to match in text`);
    for (const alias of e.aliases) {
      assert.equal(alias, alias.toLowerCase(), `${e.id}: alias "${alias}" is not folded`);
    }
  }
});

test("no alias is claimed by two curated entities", () => {
  const owner = new Map();
  for (const e of CURATED) {
    for (const alias of e.aliases) {
      assert.ok(!owner.has(alias), `"${alias}" claimed by both ${owner.get(alias)} and ${e.id}`);
      owner.set(alias, e.id);
    }
  }
});

test("curated people carry their inflected forms, since no rule can derive them", () => {
  for (const id of ["edi-rama", "albin-kurti", "vjosa-osmani"]) {
    const e = CURATED.find((x) => x.id === id);
    const forms = surfaceForms(e);
    assert.ok(
      forms.length > 2,
      `${id} lists only ${forms.length} forms — inflections are missing`,
    );
  }
});

test("an inflected mention of each curated leader is found", () => {
  const cases = [
    ["edi-rama", "Sipas Ramës, projekti vazhdon"],
    ["albin-kurti", "Qeveria e Kurtit vendosi sot"],
    ["vjosa-osmani", "Dekreti i Osmanit u nënshkrua"],
  ];
  for (const [id, headline] of cases) {
    const forms = surfaceForms(CURATED.find((x) => x.id === id));
    assert.equal(mentions({ title: headline }, forms), true, headline);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Albanian declension
//
// The gap this closes: curated entities had to list every inflected form by
// hand, and derived ones — which nobody curates — matched exact words only.
// ─────────────────────────────────────────────────────────────────────────────

test("a grown ending is still the same word", () => {
  for (const [word, form] of [
    ["kurtin", "kurti"],
    ["kurtit", "kurti"],
    ["gjermanise", "gjermani"],
    ["osmanit", "osmani"],
    ["zjarret", "zjarr"],
    ["trumpi", "trump"],
  ]) {
    assert.equal(wordMatchesForm(word, form), true, `${form} → ${word}`);
  }
});

test("a changed stem vowel is still the same word", () => {
  // Rama → Ramës is not Rama plus a suffix; the stem's own vowel changes.
  assert.equal(wordMatchesForm("rames", "rama"), true);
  assert.equal(wordMatchesForm("ramen", "rama"), true);
});

test("a longer, unrelated word is not a declension", () => {
  // The false positive that has now appeared twice in this codebase.
  assert.equal(wordMatchesForm("ramallahut", "rama"), false);
  assert.equal(wordMatchesForm("ramazani", "rama"), false);
  assert.equal(wordMatchesForm("edicionit", "edi"), false);
  assert.equal(wordMatchesForm("panorama", "rama"), false);
});

test("a derived name now matches its inflections without being curated", () => {
  const trump = deriveEntity({ name: "Donald Trump", kind: "person" });
  assert.equal(mentions({ title: "Vendimi i Trumpit" }, surfaceForms(trump)), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Subjects that are not people
// ─────────────────────────────────────────────────────────────────────────────

test("a topic is searchable by its content words, not just its full label", () => {
  const topic = deriveEntity({ name: "Shuarja e zjarreve në pyje", kind: "teme" });
  assert.ok(topic.aliases.includes("zjarreve"), topic.aliases.join(", "));
  assert.equal(resolveEntity("zjarreve", [topic])?.name, "Shuarja e zjarreve në pyje");
});

test("Albanian function words never become aliases", () => {
  const topic = deriveEntity({ name: "Dialogu për normalizimin me Serbinë", kind: "teme" });
  for (const stop of ["per", "me", "e", "i", "ne"]) {
    assert.ok(!topic.aliases.includes(stop), `"${stop}" became an alias`);
  }
});

test("content words skip the short and the empty", () => {
  assert.deepEqual(contentWords(""), []);
  assert.ok(!contentWords("Toni i mediave në Kosovë").includes("i"));
});

test("a country resolves as a subject in its own right", () => {
  const country = deriveEntity({ name: "Gjermani", kind: "vend" });
  assert.equal(resolveEntity("gjermani", [country])?.kind, "vend");
});

test("a city resolves as a subject in its own right", () => {
  const city = deriveEntity({ name: "Prizren", kind: "qytet", role: "Rajoni i Prizrenit" });
  const found = resolveEntity("prizren", [city]);
  assert.equal(found?.kind, "qytet");
  assert.equal(found?.role, "Rajoni i Prizrenit");
});

test("a curated subject still outranks a derived one of the same name", () => {
  const impostor = deriveEntity({ name: "Edi Rama", kind: "teme" });
  assert.equal(resolveEntity("edi rama", [impostor])?.kind, "person");
});

test("an inflected query names the subject just as squarely", () => {
  const trump = deriveEntity({ name: "Donald Trump", kind: "person" });
  assert.equal(resolveEntity("trumpit", [trump])?.name, "Donald Trump");
  assert.equal(resolveEntity("kurtin")?.name, "Albin Kurti");
  const country = deriveEntity({ name: "Gjermani", kind: "vend" });
  assert.equal(resolveEntity("gjermanise", [country])?.name, "Gjermani");
});

test("an inflected query still cannot reach an unrelated subject", () => {
  assert.equal(resolveEntity("edicionit"), null, "edi must not swallow edicionit");
  assert.equal(resolveEntity("ramallahut"), null);
  assert.equal(resolveEntity("ramazani"), null);
});
