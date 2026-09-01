/**
 * Which dossier an article belongs to — and, far more often, none.
 *
 * The old rule was a flat list of surface forms per topic, scored by counting
 * hits. It attached a full Kosovo KFOR dossier to any story containing the word
 * "nato", so a NATO exercise in Turkey qualified. The failure is structural: a
 * bag of words has no way to express "this term only counts alongside that one".
 *
 * Three layers replace it, in order of authority:
 *
 *   excludes  veto outright, whatever else matched
 *   anchors   are required; without one the topic cannot match at all
 *   signals   only support, and can never carry a match by themselves
 *
 * "kosove" is an anchor for KFOR. "nato" is a signal. "turqi" is an exclude.
 * A Turkish exercise then has a signal, no anchor and a veto, and scores
 * nothing — which is the whole point.
 *
 * Pure and synchronous. No database, no model, no network: this runs on every
 * article and has to be cheap and predictable.
 */

/**
 * Comparison key: lowercase, diacritics folded, punctuation to space.
 *
 * Albanian ë and ç were folded; the Gaj letters this newsroom meets every week
 * in Serbian and Croatian names were not, and everything left over is replaced
 * by a space. So "Vučić" became the three fragments "vu i " and "Pogačar"
 * became "poga ar" — not a name that failed to match a topic, a name that no
 * longer existed as a word. Folding them can only rejoin a token that was
 * being shattered; it can never split one that was whole.
 */
const DIACRITICS = { "ë": "e", "ç": "c", "č": "c", "ć": "c", "š": "s", "ž": "z", "đ": "d" };

export function fold(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[ëçčćšžđ]/g, (ch) => DIACRITICS[ch])
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whole-word containment.
 *
 * The previous implementation kept hyphens inside the folded text, so the form
 * "kfor" did not match the headline word "KFOR-it" and matches were being made
 * by accident on other words. Hyphens now fold to spaces, which makes "KFOR-it"
 * two tokens and lets the bare form match the first of them.
 */
/**
 * Albanian surface forms of one term.
 *
 * Matching is whole-word, and Albanian inflects: "Kosovën" in the accusative
 * shares no token with the nominative "Kosovë" that every topic lists. So a
 * headline reading "Vuçiq rikthen retorikën për Kosovën" contained the subject
 * four times over and matched nothing — and it was not alone. Run across the
 * live archive, the matcher attached a dossier to none of its 105 articles.
 *
 * 383 also publishes both transliterations of Serbian names, "Vuçiq" beside
 * "Vučić", within the same week. The topics carried only the Serbian one.
 *
 * This table adds spellings of subjects the topics already name. It adds no
 * subject: whether Thaçi or Kurti warrants a file is an editorial question and
 * is not answered here.
 */
const VARIANTS = {
  // Places and institutions
  kosove: ["kosova", "kosoves", "kosoven", "kosovo"],
  serbi: ["serbia", "serbise", "serbine"],
  prishtina: ["prishtine", "prishtines", "prishtinen"],
  mitrovica: ["mitrovice", "mitrovices", "mitrovicen"],
  mitrovice: ["mitrovica", "mitrovices", "mitrovicen"],
  zvecan: ["zvecani", "zvecanit", "zvecanin"],
  zvecani: ["zvecan", "zvecanit"],
  leposaviq: ["leposaviqi", "leposaviqit"],
  banjska: ["banjske", "banjskes", "banjsken"],
  iber: ["ibri", "ibrit", "ibar"],
  ura: ["ures", "uren", "urat"],
  bruksel: ["brukseli", "brukselit"],
  ohri: ["ohrit", "ohr"],
  uashington: ["uashingtoni", "uashingtonit"],
  ballkan: ["ballkani", "ballkanit", "ballkanin"],
  kfor: ["kfori", "kforit"],
  eulex: ["eulexi", "eulexit"],
  kuvend: ["kuvendi", "kuvendin", "kuvendit"],
  parlament: ["parlamenti", "parlamentin", "parlamentit"],
  parlamenti: ["parlament", "parlamentin", "parlamentit"],
  komisioni: ["komision", "komisionin", "komisionit"],
  konsullata: ["konsullate", "konsullaten", "konsullates"],
  ambasada: ["ambasade", "ambasaden", "ambasades"],
  qeveri: ["qeveria", "qeverise", "qeverine"],
  shtepia: ["shtepi", "shtepine", "shtepise"],

  // People. Both transliterations, and the definite forms Albanian attaches
  // to a surname used as a subject ("Vuçiqi tha", "deklarata e Vuçiqit").
  vucic: ["vucici", "vuciq", "vuciqi", "vuciqit"],
  petkovic: ["petkovici", "petkoviq", "petkoviqi", "petkoviqit"],
  kurti: ["kurtit", "kurtin"],
  lajcak: ["lajcaku", "lajcakut"],
  osmani: ["osmanit", "osmanin"],
  konjufca: ["konjufces", "konjufcen"],
  abdixhiku: ["abdixhikut", "abdixhikun"],
  trump: ["trumpi", "trumpit"],
  vetvendosje: ["vetevendosje", "vetevendosja", "vetvendosja", "vetevendosjes"],

  // Processes and events
  dialogu: ["dialog", "dialogun", "dialogut"],
  normalizim: ["normalizimi", "normalizimit", "normalizimin"],
  normalizimin: ["normalizim", "normalizimi", "normalizimit"],
  asociacioni: ["asociacion", "asociacionin", "asociacionit"],
  asociacionin: ["asociacion", "asociacioni", "asociacionit"],
  anetaresim: ["anetaresimi", "anetaresimit", "anetaresimin"],
  anetaresimi: ["anetaresim", "anetaresimit", "anetaresimin"],
  stabilizim: ["stabilizimi", "stabilizimit"],
  asociim: ["asociimi", "asociimit"],
  integrim: ["integrimi", "integrimit", "integrimin"],
  liberalizim: ["liberalizimi", "liberalizimit", "liberalizimin"],
  evropian: ["evropiane", "evropiani", "evropianit", "evropiane"],
  bashkimi: ["bashkim", "bashkimin", "bashkimit"],
  kandidat: ["kandidati", "kandidatit", "kandidatin"],
  vizave: ["viza", "vizat", "vizash"],
  targat: ["targa", "targave", "targash"],
  dinar: ["dinari", "dinarit", "dinaret"],
  paqeruajtes: ["paqeruajtesit", "paqeruajtesve", "paqeruajtesit"],
  diaspora: ["diaspores", "diasporen"],
  mergata: ["mergates", "mergaten"],
  mergim: ["mergimi", "mergimit", "mergimin"],
  remitanca: ["remitancat", "remitancave"],
  kthim: ["kthimi", "kthimit", "kthimin"],
  kthimi: ["kthim", "kthimit", "kthimin"],
  votim: ["votimi", "votimit", "votimin"],
  votimi: ["votim", "votimit", "votimin"],
  votimit: ["votim", "votimi", "votimin"],
  formimi: ["formim", "formimin", "formimit"],
  zgjedhje: ["zgjedhjet", "zgjedhjeve", "zgjedhjen", "zgjedhjes"],
  zgjedhjeve: ["zgjedhje", "zgjedhjet", "zgjedhjen"],
  president: ["presidenti", "presidentin", "presidentit", "presidente"],
  bllokada: ["bllokades", "bllokaden"],
  bllokaden: ["bllokada", "bllokades"],
  ngerc: ["ngerci", "ngercit", "ngerkun"],
  koalicion: ["koalicioni", "koalicionin", "koalicionit"],
  kuorum: ["kuorumi", "kuorumit", "kuorumin"],
  shumice: ["shumica", "shumices", "shumicen"],
  marreveshje: ["marreveshja", "marreveshjen", "marreveshjes"],
};

/**
 * Every accepted spelling of a term, folded, longest checked no differently
 * from the shortest. Built once: `hasTerm` runs on every article × topic.
 */
const VARIANT_INDEX = new Map(
  Object.entries(VARIANTS).map(([term, forms]) => [
    fold(term),
    [...new Set([fold(term), ...forms.map(fold)])],
  ])
);

function hasTerm(haystack, term) {
  const t = fold(term);
  if (t.length < 3) return false;
  const padded = ` ${haystack} `;
  for (const form of VARIANT_INDEX.get(t) ?? [t]) {
    if (padded.includes(` ${form} `)) return true;
  }
  return false;
}

/**
 * Subject evidence comes from the title and excerpt only. Category is a feed
 * bucket, not an event claim: production currently normalizes unrelated
 * international stories to "Kosovë", so it must never become a Dosje anchor.
 */
function haystackFor(article) {
  return fold(`${article?.title ?? ""} ${article?.excerpt ?? ""}`);
}

/** Category may be a weak location hint only after an event group matches. */
function contextHaystackFor(article) {
  return fold(`${haystackFor(article)} ${article?.category ?? ""}`);
}

export const MIN_TOPIC_SCORE = 2;

/**
 * Score one article against one topic.
 *
 * Returns the score and the reasons behind it. The reasons are not decoration:
 * they are what makes a match defensible in the review queue instead of a
 * number nobody can argue with.
 */
export function scoreTopic(article, topic) {
  const hay = haystackFor(article);
  const contextHay = contextHaystackFor(article);
  const reasons = { anchors: [], signals: [], excludes: [], groups: [], context: [] };

  for (const term of topic?.excludes ?? []) {
    if (hasTerm(contextHay, term)) reasons.excludes.push(term);
  }
  if (reasons.excludes.length) return { score: 0, vetoed: true, reasons };

  // A group is an event fingerprint: every term in one group must be present.
  // Legacy callers without groups fall back to individual anchors; production
  // topics define matchGroups explicitly.
  const groups = Array.isArray(topic?.matchGroups) && topic.matchGroups.length
    ? topic.matchGroups
    : (topic?.anchors ?? []).map((anchor) => [anchor]);
  const matchedGroups = groups.filter((group) =>
    Array.isArray(group) && group.length > 0 && group.every((term) => hasTerm(hay, term))
  );
  if (!matchedGroups.length) return { score: 0, vetoed: false, reasons };

  const contextTerms = topic?.context ?? [];
  if (contextTerms.length) {
    reasons.context = contextTerms.filter((term) => hasTerm(contextHay, term));
    if (!reasons.context.length) return { score: 0, vetoed: false, reasons };
  }

  reasons.groups = matchedGroups;
  reasons.anchors = [...new Set(matchedGroups.flat())];
  for (const term of topic?.signals ?? []) {
    if (hasTerm(hay, term)) reasons.signals.push(term);
  }

  // Longer event fingerprints outrank shorter ones. Signals support a proven
  // fingerprint but can never create a match by themselves.
  const groupScore = Math.max(...matchedGroups.map((group) => group.length * 3));
  const score = groupScore + reasons.signals.length;
  return { score, vetoed: false, reasons };
}

/**
 * The best topic for an article, or null.
 *
 * Ties abstain. The old implementation used `score > best`, which silently
 * preferred whichever topic happened to be first in the array — a coin flip
 * dressed as a decision. When two subjects fit equally well the honest answer
 * is that the matcher does not know, and no dossier is shown.
 */
export function matchTopic(article, topics) {
  let best = null;
  let bestScore = 0;
  let tied = false;

  for (const topic of topics ?? []) {
    const { score, vetoed } = scoreTopic(article, topic);
    if (vetoed || score < MIN_TOPIC_SCORE) continue;
    if (score > bestScore) {
      best = topic;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && best && topic.slug !== best.slug) {
      tied = true;
    }
  }

  if (!best || tied) return null;
  const { reasons } = scoreTopic(article, best);
  return { topic: best, score: bestScore, reasons };
}

/**
 * Is this a standing subject, or just a story?
 *
 * A dossier is only warranted where there is history to explain, so a subject
 * has to keep coming back before it earns one: several articles, spread across
 * more than a single day's news cycle. One busy day is one story.
 */
export const MIN_SUBJECT_ARTICLES = 3;
export const MIN_SUBJECT_DAYS = 2;

export function isStandingSubject(matches) {
  const rows = (matches ?? []).filter((m) => m?.articleSlug && m?.publishedAt);
  if (rows.length < MIN_SUBJECT_ARTICLES) return false;
  const days = new Set(rows.map((r) => String(r.publishedAt).slice(0, 10)));
  return days.size >= MIN_SUBJECT_DAYS;
}
