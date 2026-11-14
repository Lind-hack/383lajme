/**
 * Kërko — the topic tree.
 *
 * Plain word matching cannot know that Bitcoin is crypto or that a Champions
 * League report is football. "crypto" found no story in the archive while a
 * dozen Bitcoin stories sat in it, because none of them uses the word. This
 * tree gives the search that knowledge, in one direction only: a topic
 * includes everything under it, never what sits beside or above it. "kripto"
 * finds the Bitcoin stories; "bitcoin" does not bring the whole crypto market.
 *
 * Two things use the tree:
 *   - every article is tagged with the topics it is about (lib/topic-tags.mjs,
 *     run from the heartbeat), and a search for a topic finds every article
 *     tagged with it or with anything under it;
 *   - until an article is tagged, the topic's words below stand in for the tags.
 *
 * Forms are folded (lower case, no diacritics; see fold() in search-match) and
 * written without function words ("lig kampionev" for "Ligën e Kampionëve").
 *   prefix  each word matches the start of a word: "kripto" finds "kriptos",
 *           "kriptomonedha"; "lig kampionev" finds "Ligën e Kampionëve"
 *   exact   whole words only, for short names that start other words:
 *           "eth" must not find "Ethiopia"
 *   alias   names a reader may type that are never matched in the text: "ai"
 *           is the Albanian "he" in almost every story, so AI stories are found
 *           by their tags and their longer names only
 *   not     words that start like the topic and are something else:
 *           "kriptografia" is cryptography, not crypto
 *   extra   forms found only through this topic, not topics of their own:
 *           "binance" is crypto, but a reader searching "binance" wants
 *           Binance, not Coinbase
 *
 * Changing ids or the tree means retagging: bump TOPICS_VERSION and the
 * heartbeat retags the archive in the background.
 */

export const TOPICS_VERSION = 1;

export const TOPICS = [
  // Politics
  { id: "politike", name: "Politikë", prefix: ["politik"], exact: ["politics"] },
  { id: "zgjedhje", name: "Zgjedhje", parent: "politike", prefix: ["zgjedhj", "election", "votim", "fushat zgjedhor"], exact: [] },
  { id: "qeveria", name: "Qeveria", parent: "politike", prefix: ["qeveri", "government", "kryeminist", "ministr"], exact: [] },
  { id: "kuvendi", name: "Kuvendi", parent: "politike", prefix: ["kuvend", "parlament", "deputet"], exact: [] },
  { id: "dialogu", name: "Dialogu Kosovë–Serbi", parent: "politike", prefix: ["dialog", "normalizim"], exact: [] },
  { id: "integrimi", name: "BE dhe integrimi", parent: "politike", prefix: ["bashkim evropian", "integrim", "european union", "komision evropian"], exact: ["eu"] },
  { id: "siguria", name: "NATO dhe ushtria", parent: "politike", prefix: ["ushtri", "military"], exact: ["nato"], extra: { prefix: [], exact: ["kfor", "fsk"] } },
  { id: "diaspora", name: "Diaspora", prefix: ["diaspor", "mergimtar"], exact: [] },
  { id: "migrimi", name: "Migrimi dhe vizat", prefix: ["migrant", "emigr", "azil", "migration", "liberalizim"], exact: ["viza", "vizat", "vizave", "vizen"] },

  // Justice and crime
  { id: "drejtesia", name: "Drejtësia", prefix: ["gjykat", "prokurori", "prokuror", "court", "aktakuz", "gjyq"], exact: [] },
  { id: "korrupsioni", name: "Korrupsioni", parent: "drejtesia", prefix: ["korrupsion", "corruption", "ryshfet"], exact: [] },
  { id: "krimi", name: "Krimi", prefix: ["krim", "crime", "vrasj", "arrestim", "arrestoh"], exact: [], not: ["krimea", "krimese", "krimeja"] },
  { id: "policia", name: "Policia", parent: "krimi", prefix: ["polic"], exact: [] },
  { id: "aksidente", name: "Aksidente", prefix: ["aksident", "crash"], exact: [] },
  { id: "lufta", name: "Luftë dhe konflikte", prefix: ["luft", "konflikt", "armepushim", "ceasefire"], exact: ["war"], not: ["luftetar"] },

  // Economy
  { id: "ekonomi", name: "Ekonomi", prefix: ["ekonomi", "econom"], exact: [] },
  { id: "cmimet", name: "Çmimet dhe inflacioni", parent: "ekonomi", prefix: ["inflacion", "inflation", "shtrenjtim", "cmimet", "cmimeve"], exact: [] },
  { id: "energjia", name: "Energjia", parent: "ekonomi", prefix: ["energji", "energy", "rrym", "elektricitet", "electricity"], exact: [], extra: { prefix: [], exact: ["kek", "kesco", "kostt"] } },
  { id: "karburantet", name: "Nafta dhe karburantet", parent: "energjia", prefix: ["karburant", "nafte", "naften", "benzin", "fuel"], exact: ["nafta", "oil"] },
  { id: "punesimi", name: "Punësimi dhe pagat", parent: "ekonomi", prefix: ["punesim", "papunesi", "salary", "wages", "pension"], exact: ["paga", "pagat", "pagave", "pagen"] },
  { id: "bankat", name: "Bankat dhe financat", parent: "ekonomi", prefix: ["bank", "kredi", "norm interes"], exact: [], not: ["kredib"], extra: { prefix: [], exact: ["bqk", "fed", "ecb", "bqe"] } },
  { id: "tregtia", name: "Tregtia dhe tarifat", parent: "ekonomi", prefix: ["eksport", "import", "tregti", "tarif", "trade"], exact: [] },
  { id: "bursa", name: "Bursa dhe aksionet", parent: "ekonomi", prefix: ["bursa vler", "aksionar", "stock market", "stock exchange"], exact: ["aksionet", "aksioneve", "stocks"], extra: { prefix: ["nasdaq", "wall street", "dow jones"], exact: [] } },
  { id: "tatimet", name: "Tatimet", parent: "ekonomi", prefix: ["tatim", "taks"], exact: ["tax", "taxes"], extra: { prefix: [], exact: ["atk", "tvsh"] } },
  { id: "patundshmeria", name: "Banesat dhe qiratë", parent: "ekonomi", prefix: ["banes", "qira", "patundshmeri", "real estate"], exact: [] },
  { id: "turizmi", name: "Turizmi", parent: "ekonomi", prefix: ["turiz", "tourism", "turist"], exact: [] },
  {
    id: "kripto",
    name: "Kripto",
    parent: "ekonomi",
    prefix: ["kripto", "crypto"],
    exact: [],
    not: ["kriptograf", "cryptograph"],
    extra: {
      prefix: ["binance", "coinbase", "stablecoin", "blockchain", "solana", "dogecoin", "tether"],
      exact: ["usdt", "usdc", "xrp", "nft", "nfts", "ftx", "defi"],
    },
  },
  { id: "bitcoin", name: "Bitcoin", parent: "kripto", prefix: ["bitcoin", "bitkoin"], exact: ["btc"] },
  { id: "ethereum", name: "Ethereum", parent: "kripto", prefix: ["ethereum"], exact: ["eth", "ether"] },

  // Sport
  { id: "sport", name: "Sport", prefix: ["sport"], exact: [], not: ["sportel"] },
  { id: "futboll", name: "Futboll", parent: "sport", prefix: ["futboll", "football", "soccer"], exact: [], extra: { prefix: [], exact: ["fifa", "uefa"] } },
  { id: "liga-kampioneve", name: "Liga e Kampionëve", parent: "futboll", prefix: ["lig kampionev", "champions league"], exact: ["ucl"] },
  { id: "premier-league", name: "Premier League", parent: "futboll", prefix: ["premier league", "premier lig"], exact: [] },
  { id: "transferimet", name: "Transferimet", parent: "futboll", prefix: ["transferim"], exact: [] },
  { id: "basketboll", name: "Basketboll", parent: "sport", prefix: ["basketboll", "basketball"], exact: [], extra: { prefix: ["euroleague", "eurolig"], exact: ["nba"] } },
  { id: "tenis", name: "Tenis", parent: "sport", prefix: ["tenis", "tennis"], exact: [], extra: { prefix: ["wimbledon", "roland garros"], exact: ["atp", "wta"] } },
  { id: "f1", name: "Formula 1", parent: "sport", prefix: ["formula 1", "formula one", "grand prix"], exact: ["f1"] },
  { id: "boks", name: "Boks dhe MMA", parent: "sport", prefix: ["boks", "boxing"], exact: ["mma"], extra: { prefix: [], exact: ["ufc"] } },
  { id: "xhudo", name: "Xhudo", parent: "sport", prefix: ["xhudo", "judo"], exact: [] },
  { id: "olimpiada", name: "Lojërat Olimpike", parent: "sport", prefix: ["olimpi", "olympic"], exact: [] },

  // Technology
  { id: "teknologji", name: "Teknologji", prefix: ["teknologji", "technolog"], exact: ["tech"] },
  {
    id: "ai",
    name: "Inteligjenca artificiale",
    parent: "teknologji",
    prefix: ["inteligjenc artificial", "artificial intelligence"],
    exact: [],
    alias: ["ai"],
    extra: { prefix: ["chatgpt", "openai", "anthropic", "deepmind"], exact: [] },
  },
  { id: "telefonat", name: "Telefonat", parent: "teknologji", prefix: ["smartphone", "telefon mencur"], exact: [], extra: { prefix: ["iphone", "android", "samsung galaxy"], exact: [] } },
  { id: "rrjetet-sociale", name: "Rrjetet sociale", parent: "teknologji", prefix: ["rrjet social", "social media"], exact: [], extra: { prefix: ["tiktok", "instagram", "facebook"], exact: [] } },
  { id: "kibernetike", name: "Siguria kibernetike", parent: "teknologji", prefix: ["kibernetik", "cyber", "haker", "hacker"], exact: [] },
  { id: "hapesira", name: "Hapësira", parent: "teknologji", prefix: ["hapesir", "astronaut"], exact: ["space"], extra: { prefix: ["spacex"], exact: ["nasa"] } },

  // Society
  { id: "shendetesia", name: "Shëndetësia", prefix: ["shendet", "health", "spital", "hospital", "vaksin", "kancer", "semundj"], exact: [] },
  { id: "arsimi", name: "Arsimi", prefix: ["arsim", "shkoll", "universitet", "nxenes", "education", "matur"], exact: [] },
  { id: "mjedisi", name: "Mjedisi dhe klima", prefix: ["mjedis", "klim", "ndotj", "climate", "pollution"], exact: [] },
  { id: "moti", name: "Moti", parent: "mjedisi", prefix: ["temperatur", "reshj", "weather", "parashikim mot"], exact: ["moti", "motit", "bore", "debore"] },

  // Culture and showbiz
  { id: "showbiz", name: "Showbiz", prefix: ["showbiz", "celebrit"], exact: [] },
  { id: "muzika", name: "Muzika", parent: "showbiz", prefix: ["muzik", "music", "kenge", "kengetar", "album", "koncert"], exact: [] },
  { id: "filma", name: "Filma dhe seriale", parent: "showbiz", prefix: ["film", "serial", "kinema"], exact: [], extra: { prefix: ["netflix", "hollywood", "oscar"], exact: [] } },
  { id: "festivale", name: "Festivale", parent: "showbiz", prefix: ["festival"], exact: [] },
  { id: "moda", name: "Moda", parent: "showbiz", prefix: ["fashion"], exact: ["moda", "modes", "moden"] },
];

export const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

/** id → every topic under it, at any depth. */
function buildDescendants() {
  const children = new Map();
  for (const t of TOPICS) {
    if (!t.parent) continue;
    if (!children.has(t.parent)) children.set(t.parent, []);
    children.get(t.parent).push(t.id);
  }
  const out = new Map();
  const walk = (id) => {
    if (out.has(id)) return out.get(id);
    const all = [];
    for (const c of children.get(id) ?? []) all.push(c, ...walk(c));
    out.set(id, all);
    return all;
  };
  for (const t of TOPICS) walk(t.id);
  return out;
}

const DESCENDANTS = buildDescendants();

/** The ids under a topic, at any depth: kripto → bitcoin, ethereum. */
export function descendantsOf(id) {
  return DESCENDANTS.get(id) ?? [];
}

/** A topic by id, or null. */
export function topicById(id) {
  return BY_ID.get(id) ?? null;
}

/** Letters before a half-typed word names its topic: "kript" yes, "kri" not yet. */
const HALF_TYPED = 5;

/**
 * Every word starts with its part of the form. In a name of several words the
 * last may still be half-typed ("liga kampion"), once it is long enough to
 * mean something.
 */
function startsAll(words, formWords) {
  if (words.length !== formWords.length) return false;
  const last = formWords.length - 1;
  return formWords.every(
    (f, i) => words[i].startsWith(f) || (i === last && last > 0 && words[i].length >= 4 && f.startsWith(words[i])),
  );
}

/**
 * The topic a folded query unit names, or null. A unit is one word, or two or
 * three words that together name a topic ("liga kampioneve").
 *
 * "kriptomonedha" and "bitcoinit" name their topics through the prefix, and a
 * half-typed "kript" already names crypto; "kri" names nothing yet and is
 * searched as a plain word.
 *
 * @param {string} unit
 */
export function topicFor(unit) {
  if (!unit) return null;
  // Asked once per term per article on every keystroke: remembered, not re-derived.
  if (RESOLVED.has(unit)) return RESOLVED.get(unit);
  if (RESOLVED.size > 2000) RESOLVED.clear();
  const topic = resolveTopic(unit);
  RESOLVED.set(unit, topic);
  return topic;
}

const RESOLVED = new Map();

function resolveTopic(unit) {
  const words = unit.split(" ");
  for (const topic of TOPICS) {
    if (topic.not?.some((n) => unit.startsWith(n))) continue;
    if (topic.alias?.includes(unit)) return topic;
    if (topic.exact.includes(unit)) return topic;
    if (topic.prefix.some((p) => startsAll(words, p.split(" ")))) return topic;
  }
  // Still being typed: the overlay searches on every keystroke, and "kript"
  // showing no Bitcoin story until the "o" lands reads as a different answer.
  if (words.length === 1 && unit.length >= HALF_TYPED) {
    for (const topic of TOPICS) {
      if (topic.not?.some((n) => unit.startsWith(n))) continue;
      if (topic.prefix.some((p) => !p.includes(" ") && p.startsWith(unit))) return topic;
    }
  }
  return null;
}

/**
 * What a topic matches in the text: its own forms, then the forms of
 * everything under it plus its extras. The two are kept apart because a story
 * naming the topic itself is the better answer and ranks first.
 */
function buildForms(topic) {
  const not = [...(topic.not ?? [])];
  const own = { prefix: [...topic.prefix], exact: [...topic.exact], not };
  const wider = { prefix: [...(topic.extra?.prefix ?? [])], exact: [...(topic.extra?.exact ?? [])], not: [...not] };
  for (const id of descendantsOf(topic.id)) {
    const member = BY_ID.get(id);
    if (!member) continue;
    wider.prefix.push(...member.prefix, ...(member.extra?.prefix ?? []));
    wider.exact.push(...member.exact, ...(member.extra?.exact ?? []));
    wider.not.push(...(member.not ?? []));
  }
  return { own, wider };
}

/** Built once: the search scores every entry against these on every keystroke. */
const FORMS = new Map(TOPICS.map((t) => [t.id, buildForms(t)]));

export function topicForms(topic) {
  return FORMS.get(topic.id) ?? buildForms(topic);
}
