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

// ─────────────────────────────────────────────────────────────────────────────
// Names are names, not the Albanian words they fold into
//
// "Harry Kane" listed Trump, Xi and Zelensky stories: folding turns the verb
// "kanë" (they have), which is in almost every story, into "kane". A name
// keeps its capital and its spelling when it is looked for in the text.
// ─────────────────────────────────────────────────────────────────────────────

import { nameForms } from "./entities.mjs";

const kane = nameForms(deriveEntity({ name: "Harry Kane", kind: "person" }));

test("a name is not the Albanian word it folds into: Kane is not kanë", () => {
  assert.equal(mentions({ title: "Trump, Xi dhe Putin kanë rënë dakord" }, kane), false);
  assert.equal(mentions({ title: "Diçka", body: "Ata kanë thënë se do të takohen" }, kane), false);
  // At the start of a sentence the verb is capitalised too.
  assert.equal(mentions({ title: "Kanë kaluar dy vite nga lufta" }, kane), false);
  assert.equal(mentions({ title: "Kane vulos 2-1 ndaj Kroacisë" }, kane), true);
  assert.equal(mentions({ title: "Harry Kane synon Champions-in" }, kane), true);
});

test("a name is not every word that starts like it: Kane is not Kansas or Kanada", () => {
  assert.equal(mentions({ title: "Mahomes te Kansas City Chiefs" }, kane), false);
  assert.equal(mentions({ title: "Kanada mbyll kufirin" }, kane), false);
  assert.equal(mentions({ title: "Kanali i Panamasë" }, kane), false);
});

test("a person is found by full name or surname, never by first name alone", () => {
  assert.equal(mentions({ title: "Harry Styles këndon në MSG" }, kane), false);
  assert.equal(mentions({ title: "Harry Fowler nxjerr albumin" }, kane), false);
});

test("real Albanian endings on a name still count", () => {
  const rama = nameForms(CURATED.find((e) => e.id === "edi-rama"));
  // Which Rama: Albania says Edi (Përparim Rama is the mayor of Prishtina).
  assert.equal(mentions({ title: "Sipas Ramës, buxheti i Shqipërisë rritet" }, rama), true);
  assert.equal(mentions({ title: "Ramazani nis të hënën" }, rama), false);
  const kurti = nameForms(CURATED.find((e) => e.id === "albin-kurti"));
  assert.equal(mentions({ title: "Takim me Kurtin sot" }, kurti), true);
  assert.equal(mentions({ title: "Deklarata e Kurtit" }, kurti), true);
  const trump = nameForms(deriveEntity({ name: "Donald Trump", kind: "person" }));
  assert.equal(mentions({ title: "Tarifat e Trumpit" }, trump), true);
});

test("a story written without diacritics still finds a name that has them", () => {
  const prishtina = nameForms(deriveEntity({ name: "Prishtinë", kind: "vend" }));
  assert.equal(mentions({ title: "Protesta ne Prishtine sot" }, prishtina), true);
  assert.equal(mentions({ title: "Protesta në Prishtinë sot" }, prishtina), true);
});

test("lower-case topic words keep matching as before", () => {
  const dialog = nameForms(CURATED.find((e) => e.match?.includes("dialog")));
  assert.equal(mentions({ title: "Raundi i ri i dialogut" }, dialog), true);
});

test("a name first seen declined still finds its plain form: Messin finds Messi", () => {
  const messi = nameForms(deriveEntity({ name: "Lionel Messin", kind: "person" }));
  assert.equal(mentions({ title: "Messi shpëton nga kartoni i kuq" }, messi), true);
  assert.equal(mentions({ title: "Golat e Messit" }, messi), true);
  // A vowel ending is the name itself, not a case: Kurti is not Kurt.
  const kurti = nameForms(deriveEntity({ name: "Albin Kurti", kind: "person" }));
  assert.equal(mentions({ title: "Kurt Cobain kujtohet sot" }, kurti), false);
});

test("an acronym is the whole word: NATO is not Nata or Natës", () => {
  const nato = nameForms(CURATED.find((e) => e.match?.includes("NATO")));
  assert.equal(mentions({ title: "Nata e zgjedhjeve në Prishtinë" }, nato), false);
  assert.equal(mentions({ title: "Natës së parë të festivalit" }, nato), false);
  assert.equal(mentions({ title: "NATO rrit trupat në Kosovë" }, nato), true);
  assert.equal(mentions({ title: "Aleatët e NATO-s takohen" }, nato), true);
});

test("a name inside another with an apostrophe is not it: O'Kane is not Kane", () => {
  assert.equal(mentions({ title: "Waymo, sipas Sean O'Kane, zgjerohet" }, kane), false);
  assert.equal(mentions({ title: "Kane's goal wins it" }, kane), true);
  assert.equal(mentions({ title: "Goli i Kane’s vendos ndeshjen" }, kane), true);
});

test("the English spelling of a place still counts: Kosovo is Kosovë", () => {
  const kosova = nameForms(deriveEntity({ name: "Kosovë", kind: "vend" }));
  assert.equal(mentions({ title: "Kosovo and Serbia meet in Brussels" }, kosova), true);
});

test("a missing diacritic is forgiven only in a story typed without any", () => {
  const rama = nameForms(CURATED.find((e) => e.id === "edi-rama"));
  // A story that writes ë elsewhere would have written Ramën: this is the noodle dish.
  assert.equal(mentions({ title: "Ramen shitet në Prishtinë për herë të parë" }, rama), false);
  // Typed with no diacritics at all, Ramen is the best reading of Ramën.
  assert.equal(mentions({ title: "Takim me Ramen ne Tirane per tarifat" }, rama), true);
  // A stem this short is not a name: Kana is not Kane.
  assert.equal(mentions({ title: "Kana Hanazawa këndon në Tokio" }, kane), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Two people, one surname
//
// "Edi Rama" listed "Rama kërkon ndjesë për mbeturinat në Prishtinë", a story
// about Përparim Rama, the mayor of Prishtina. A surname two people share
// only counts with something that says which of them it is.
// ─────────────────────────────────────────────────────────────────────────────

import { sharedSurnames } from "./entities.mjs";

const edi = nameForms(CURATED.find((e) => e.id === "edi-rama"));
const perparim = nameForms(CURATED.find((e) => e.id === "perparim-rama"));

test("Edi Rama and Përparim Rama are two people", () => {
  const prishtina = { title: "Rama kërkon ndjesë për mbeturinat në Prishtinë" };
  assert.equal(mentions(prishtina, edi), false);
  assert.equal(mentions(prishtina, perparim), true);
  const tirana = { title: "Rama e quan mandatin e PS-së mision në Shqipëri" };
  assert.equal(mentions(tirana, edi), true);
  assert.equal(mentions(tirana, perparim), false);
  assert.equal(mentions({ title: "Edi Rama njofton bonus për bebet" }, edi), true);
  assert.equal(mentions({ title: "Edi Rama njofton bonus për bebet" }, perparim), false);
  assert.equal(mentions({ title: "Përparim Rama hap shkollën e re" }, perparim), true);
  assert.equal(mentions({ title: "Përparim Rama hap shkollën e re" }, edi), false);
  const both = { title: "Edi Rama takon Përparim Ramën" };
  assert.equal(mentions(both, edi), true);
  assert.equal(mentions(both, perparim), true);
});

test("a reader can search for either Rama", () => {
  assert.equal(resolveEntity("perparim rama")?.id, "perparim-rama");
  assert.equal(resolveEntity("edi rama")?.id, "edi-rama");
});

test("a surname the corpus gives to more than one person is shared", () => {
  const shared = sharedSurnames(["Serena Williams", "Ronwen Williams", "Albin Kurti", "Kryeministri Kurti", "Harry Kane"]);
  assert.ok(shared.has("williams"));
  // A title in front of a name is the same person, not a second Kurti.
  assert.ok(!shared.has("kurti"));
  assert.ok(!shared.has("kane"));
});

test("a shared surname alone needs the first name to count", () => {
  const shared = sharedSurnames(["Serena Williams", "Ronwen Williams"]);
  const serena = nameForms(deriveEntity({ name: "Serena Williams", kind: "person" }), { shared });
  assert.equal(mentions({ title: "Ronwen Williams mohon spekulimet" }, serena), false);
  assert.equal(mentions({ title: "Williams fiton në Wimbledon", body: "Serena Williams u rikthye" }, serena), true);
  // A surname nobody else has still counts alone: most Kurti headlines say only "Kurti".
  const kurti = nameForms(deriveEntity({ name: "Albin Kurti", kind: "person" }), { shared });
  assert.equal(mentions({ title: "Kurti takon Macronin" }, kurti), true);
});

test("a phrase opening with a function word is not a person, and a title is not part of the name", () => {
  const people = extractPeople([
    { title: "Për Kosovën, një ditë e madhe", body: "Për Kosovën flitet sot. Për Kosovën." },
    { title: "Kryeministri Albin Kurti takon", body: "Albin Kurti tha se Kryeministri Albin Kurti" },
  ]);
  assert.ok(!people.some((p) => p.name === "Për Kosovën"));
  assert.ok(!people.some((p) => p.name.startsWith("Kryeministri")));
  assert.ok(people.some((p) => p.name === "Albin Kurti"));
});

test("Albania's places and offices say Edi; Kosovo's municipality says Përparim", () => {
  const retreat = { title: "Rama hap në Pogradec retretin e drejtuesve", body: "Kryeministri mblodhi drejtuesit e qarqeve dhe të bashkive." };
  assert.equal(mentions(retreat, edi), true);
  assert.equal(mentions(retreat, perparim), false);
  // "komunitet" (community) is not "komunë".
  const community = { title: "Rama takon të deleguarit në Pogradec", body: "Diskutohet roli i komunitetit." };
  assert.equal(mentions(community, perparim), false);
  const municipality = { title: "Rama sqaron çmimin e projektit", body: "Komuna e Prishtinës do ta financojë." };
  assert.equal(mentions(municipality, perparim), true);
  assert.equal(mentions(municipality, edi), false);
});

test("a word the corpus also writes in lower case is not a first name", () => {
  // "Aktualisht Kane ..." opens a sentence; "aktualisht" (currently) is an adverb.
  const lower = new Set(["aktualisht", "gjyqtarja", "ndersa"]);
  const shared = sharedSurnames(["Harry Kane", "Aktualisht Kane", "Jeanette Vargas", "Gjyqtarja Vargas"], { lower });
  assert.ok(!shared.has("kane"));
  assert.ok(!shared.has("vargas"));
});

test("the person most stories name owns the surname alone", () => {
  const shared = sharedSurnames([
    { name: "Donald Trump", mentions: 40 },
    { name: "Ivanka Trump", mentions: 3 },
  ]);
  const donald = nameForms(deriveEntity({ name: "Donald Trump", kind: "person" }), { shared });
  const ivanka = nameForms(deriveEntity({ name: "Ivanka Trump", kind: "person" }), { shared });
  assert.equal(mentions({ title: "Trump vendos tarifa të reja" }, donald), true);
  assert.equal(mentions({ title: "Trump vendos tarifa të reja" }, ivanka), false);
  assert.equal(mentions({ title: "Trump flet për familjen", body: "Ivanka Trump tha" }, ivanka), true);
  // Close counts: nobody owns it, and the first name decides.
  const even = sharedSurnames([{ name: "Serena Williams", mentions: 5 }, { name: "Venus Williams", mentions: 4 }]);
  const serena = nameForms(deriveEntity({ name: "Serena Williams", kind: "person" }), { shared: even });
  assert.equal(mentions({ title: "Williams fiton sot" }, serena), false);
});

test("any given name counts as the first name: Jacob Bruun Larsen", () => {
  const shared = sharedSurnames(["Jacob Bruun Larsen", "Kasper Larsen"]);
  const jacob = nameForms(deriveEntity({ name: "Jacob Bruun Larsen", kind: "person" }), { shared });
  assert.equal(mentions({ title: "Larsen shënon në finale", body: "Jacob Larsen u rikthye" }, jacob), true);
});

test("a person the corpus found is also found by surname: Trump", () => {
  const people = [{ name: "Donald Trump", aliases: ["donald trump", "donald", "trump"], mentions: 40 }];
  const trump = resolveEntity("trump", people);
  assert.equal(trump?.name, "Donald Trump");
  assert.equal(mentions({ title: "Trump vendos tarifa të reja" }, nameForms(trump)), true);
});

test("a title right before the surname says which Rama", () => {
  assert.equal(mentions({ title: "Kryeministri Rama fjalim në Kuvend" }, edi), true);
  assert.equal(mentions({ title: "Kryeministri Rama fjalim në Kuvend" }, perparim), false);
  assert.equal(mentions({ title: "Kryetari Rama inspekton punimet" }, perparim), true);
  assert.equal(mentions({ title: "Kryetari Rama inspekton punimet" }, edi), false);
  assert.equal(mentions({ title: "Diçka", body: "sipas kryeministrit Rama, buxheti" }, edi), true);
});

test("acronyms and outlet words in capitals are not people", () => {
  const twice = (t) => [{ title: t, body: "" }, { title: t, body: "" }];
  const people = extractPeople([
    ...twice("Video Assistant Referee ndërhyn"),
    ...twice("CLARITY Act kalon"),
    ...twice("Kosovo Online raporton"),
  ]);
  assert.deepEqual(people.map((p) => p.name), []);
});

test("a three-letter stem is not a name: pariz is not Paro", () => {
  const people = [{ name: "Liam Paro", aliases: ["liam paro", "liam", "paro"], mentions: 3 }];
  assert.equal(resolveEntity("pariz", people), null);
});

test("an Albanian first name that is also a word is still a name: Besnik, Gëzim", () => {
  const people = extractPeople([
    { title: "Besnik Bislimi takon", body: "një mik besnik, shumë besnik; gëzim i madh, gëzim" },
    { title: "Besnik Bislimi takon", body: "Gëzim Kelmendi flet. Gëzim Kelmendi" },
  ]);
  assert.deepEqual(people.map((p) => p.name).sort(), ["Besnik Bislimi", "Gëzim Kelmendi"]);
});

test("a job or an office in front of a surname is not a first name: Administrata Trump", () => {
  const shared = sharedSurnames([
    { name: "Donald Trump", mentions: 5 },
    { name: "Administrata Trump", mentions: 2 },
    { name: "Administata Trump", mentions: 2 },
  ]);
  assert.equal(shared.has("trump"), false);
  assert.ok(!extractPeople([{ title: "Historiani Abdullahu flet", body: "Historiani Abdullahu" }]).length);
});

test("people whose names start like ordinary words or titles are still people", () => {
  const twice = (t, b = "") => [{ title: t, body: b }, { title: t, body: b }];
  const people = extractPeople([
    ...twice("Fabrizio Romano konfirmon", "një romantizim i madh, romantizim i ri"),
    ...twice("Harry Kane shënon", "ata kane fituar dhe kane luajtur"),
    ...twice("Shefqet Kërçiqi takon"),
    ...twice("Ishak Ahmeti flet"),
    ...twice("Prince William viziton"),
  ]).map((p) => p.name);
  for (const name of ["Fabrizio Romano", "Harry Kane", "Shefqet Kërçiqi", "Ishak Ahmeti", "Prince William"]) {
    assert.ok(people.includes(name), `${name} missing from ${people.join(", ")}`);
  }
});

test("a curated name is never skipped as an ordinary word: përparim is also 'progress'", () => {
  const lower = new Set(["përparim"]);
  const shared = sharedSurnames([{ name: "Edi Rama", mentions: 10 }, { name: "Përparim Rama", curated: true }], { lower });
  assert.ok(shared.has("rama"));
});

test("a declined name is the same person: Lionel Messit is Lionel Messi", () => {
  const people = extractPeople([
    { title: "Lionel Messi shënon", body: "Golat e Lionel Messit. Lionel Messin e pret" },
    { title: "Lionel Messi fiton", body: "Albin Kurti dhe Albin Kurtit" },
  ]);
  const messi = people.filter((p) => p.name.startsWith("Lionel"));
  assert.deepEqual(messi.map((p) => p.name), ["Lionel Messi"]);
  assert.equal(messi[0].mentions, 6);
});

test("an English headline in Title Case is not a list of names", () => {
  const people = extractPeople([
    { title: "Confusing Scenes As Dream Cycle Ends", body: "" },
    { title: "Confusing Scenes As Dream Cycle Ends", body: "" },
  ]);
  assert.deepEqual(people, []);
});

test("odd input does not throw", () => {
  assert.equal(resolveEntity("kane", [null, { name: "Harry Kane", aliases: ["harry kane", "kane"], mentions: 2 }])?.name, "Harry Kane");
  assert.equal(mentions({ title: "Kane" }, [{ text: "Kane" }]), true);
});
