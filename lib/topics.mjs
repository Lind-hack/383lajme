/**
 * Dosje: the standing topics 383 covers continuously, and the timeline each one
 * carries.
 *
 * A topic has two halves. The milestones below are authored history - the fixed
 * points a reader needs to make sense of today's story, most of which predate
 * this archive entirely. The recent half is the archive itself: articles match a
 * topic by its surface forms, so nothing has to be tagged by hand and every
 * story published from here on joins its dossier automatically.
 *
 * EDITORIAL NOTE: the milestone text is a first draft written from well-known
 * public record. Dates and framing must be checked by an editor before this is
 * treated as reference material. Prefer deleting an entry you cannot verify over
 * publishing one you are unsure of - a dossier is only worth having if it is
 * right.
 */

/** Lowercase, accent-tolerant comparison key. */
function fold(text) {
  return String(text ?? "")
    .toLowerCase()
    .replaceAll("\u00eb", "e")
    .replaceAll("\u00e7", "c")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const TOPICS = [
  {
    "slug": "dialogu-kosove-serbi",
    "title": "Dialogu Kosovë–Serbi",
    "blurb": "Bisedimet e ndërmjetësuara nga BE-ja, marrëveshjet e arritura dhe zbatimi i tyre.",
    "forms": [
      "dialogu kosove serbi",
      "kosove serbi",
      "kosova serbia",
      "bruksel",
      "brukselit",
      "ohri",
      "ohrit",
      "normalizim",
      "normalizimit",
      "asociacioni",
      "asociacionin",
      "vucic",
      "petkovic",
      "lajcak",
      "mitrovica",
      "veriu i kosoves"
    ],
    "milestones": [
      {
        "year": "2011",
        "date": "Mars 2011",
        "tag": "Nisja",
        "title": "Dialogu teknik nis në Bruksel",
        "summary": "Kosova dhe Serbia ulen për herë të parë në bisedime të ndërmjetësuara nga Bashkimi Evropian, fillimisht për çështje teknike si lëvizja e lirë dhe kadastra.",
        "why": "Ky format, BE-ja si ndërmjetëse e jo si arbitre, mbetet korniza brenda së cilës zhvillohet çdo bisedim edhe sot."
      },
      {
        "year": "2013",
        "date": "19 prill 2013",
        "tag": "Marrëveshje",
        "title": "Marrëveshja e Parë e Brukselit",
        "summary": "Të dyja palët bien dakord për parimet e normalizimit të marrëdhënieve, përfshirë integrimin e strukturave të sigurisë në veri në sistemin e Kosovës.",
        "why": "Është dokumenti bazë të cilit i referohen pothuajse të gjitha bisedimet e mëpasme, dhe pika ku lind çështja e Asociacionit."
      },
      {
        "year": "2015",
        "date": "Gusht 2015",
        "tag": "Asociacioni",
        "title": "Parimet për Asociacionin e komunave me shumicë serbe",
        "summary": "Palët bien dakord për parimet e përgjithshme të Asociacionit. Gjykata Kushtetuese e Kosovës vlerëson më vonë se pjesë të tyre nuk pajtohen plotësisht me Kushtetutën.",
        "why": "Asociacioni mbetet nyja më e ngurtë e dialogut: pranuar në parim, i pazbatuar në praktikë prej vitesh."
      },
      {
        "year": "2020",
        "date": "4 shtator 2020",
        "tag": "Uashington",
        "title": "Marrëveshjet e Uashingtonit",
        "summary": "Në Shtëpinë e Bardhë nënshkruhen dokumente për normalizim ekonomik mes Kosovës dhe Serbisë, me fokus te infrastruktura, energjia dhe lidhjet tregtare.",
        "why": "Shënon hyrjen e Uashingtonit si aktor paralel me Brukselin: dy tavolina, jo gjithnjë me të njëjtin drejtim."
      },
      {
        "year": "2023",
        "date": "27 shkurt 2023",
        "tag": "Marrëveshje",
        "title": "Marrëveshja për rrugën drejt normalizimit",
        "summary": "Në Bruksel arrihet pajtimi për një marrëveshje bazë për normalizimin e marrëdhënieve, pa nënshkrim formal nga asnjëra palë.",
        "why": "Aneksi i zbatimit u ra dakord në Ohër më 18 mars 2023; mosnënshkrimi mbetet arsyeja që të dyja palët e lexojnë ndryshe."
      },
      {
        "year": "2023",
        "date": "24 shtator 2023",
        "tag": "Siguri",
        "title": "Sulmi i armatosur në Banjskë",
        "summary": "Një grup i armatosur sulmon policinë e Kosovës në Banjskë të Zveçanit. Vritet një polic i Kosovës dhe disa nga sulmuesit.",
        "why": "Ndryshoi tonin e dialogut dhe çoi në rritje të pranisë ndërkombëtare të sigurisë në veri."
      }
    ]
  },
  {
    "slug": "kfor",
    "title": "KFOR-i në Kosovë",
    "blurb": "Prania ushtarake e NATO-s, mandati i saj dhe roli në situatat e sigurisë.",
    "forms": [
      "kfor",
      "nato",
      "paqeruajtes",
      "ura mbi iber",
      "iber"
    ],
    "milestones": [
      {
        "year": "1999",
        "date": "Qershor 1999",
        "tag": "Mandati",
        "title": "KFOR-i vendoset në Kosovë",
        "summary": "Pas fushatës ajrore të NATO-s dhe Rezolutës 1244 të Këshillit të Sigurimit, forca e udhëhequr nga NATO-ja hyn në Kosovë për të garantuar një mjedis të sigurt.",
        "why": "Mandati i vitit 1999 është ende baza ligjore e pranisë së KFOR-it sot, pavarësisht ndryshimit të madh të kontekstit."
      },
      {
        "year": "2023",
        "date": "29 maj 2023",
        "tag": "Përplasje",
        "title": "Ushtarë të KFOR-it lëndohen në veri",
        "summary": "Gjatë protestave para godinave komunale në veri, disa ushtarë të KFOR-it lëndohen në përballje me protestues.",
        "why": "Ishte hera e parë pas shumë vitesh që trupat e NATO-s pësuan lëndime të shumta në Kosovë, dhe solli forca shtesë."
      }
    ]
  },
  {
    "slug": "anetaresimi-ne-be",
    "title": "Rruga e Kosovës drejt BE-së",
    "blurb": "Marrëveshjet, aplikimi për anëtarësim, vizat dhe kushtëzimet.",
    "forms": [
      "bashkimi evropian",
      "bashkimin evropian",
      "be-ja",
      "be-se",
      "anetaresim",
      "anetaresimi",
      "integrim evropian",
      "stabilizim asociim",
      "liberalizim",
      "vizave",
      "komisioni evropian",
      "parlamenti evropian"
    ],
    "milestones": [
      {
        "year": "2016",
        "date": "1 prill 2016",
        "tag": "MSA",
        "title": "Marrëveshja e Stabilizim-Asociimit hyn në fuqi",
        "summary": "MSA-ja, marrëveshja e parë kontraktuale mes Kosovës dhe BE-së, hyn në fuqi dhe krijon kornizën ligjore të marrëdhënies.",
        "why": "Është hapi që e kthen raportin me BE-në nga politikë ndihme në detyrime të ndërsjella."
      },
      {
        "year": "2022",
        "date": "14 dhjetor 2022",
        "tag": "Aplikimi",
        "title": "Kosova aplikon për anëtarësim në BE",
        "summary": "Qeveria e Kosovës dorëzon aplikimin formal për anëtarësim në Bashkimin Evropian.",
        "why": "Aplikimi mbetet pa statusin e vendit kandidat, çka e bën rrugën e Kosovës të ndryshme nga fqinjët."
      },
      {
        "year": "2024",
        "date": "1 janar 2024",
        "tag": "Vizat",
        "title": "Liberalizimi i vizave hyn në fuqi",
        "summary": "Qytetarët e Kosovës me pasaportë biometrike mund të udhëtojnë pa viza në zonën Schengen për qëndrime të shkurtra.",
        "why": "Kosova ishte e fundit në rajon që e fitoi këtë të drejtë, pas më shumë se një dekade pritjeje."
      }
    ]
  },
  {
    "slug": "diaspora",
    "title": "Diaspora dhe të drejtat e saj",
    "blurb": "Votimi, remitancat, shërbimet konsullore dhe lidhja e mërgatës me vendin.",
    "forms": [
      "diaspora",
      "diasporen",
      "diaspores",
      "mergata",
      "mergimtar",
      "mergimtaret",
      "remitanca",
      "remitancat",
      "konsullata",
      "ambasada"
    ],
    "milestones": [
      {
        "year": "Çdo vit",
        "date": "Vera",
        "tag": "Kthimi",
        "title": "Vala verore e kthimit",
        "summary": "Qindra mijë mërgimtarë kthehen çdo verë, duke ngarkuar pikat kufitare dhe duke ndikuar ndjeshëm në ekonominë e sezonit.",
        "why": "Është momenti i vitit kur politikat për diasporën testohen praktikisht: nga radhët në kufi te shërbimet komunale."
      },
      {
        "year": "Në vijim",
        "date": "Në vijim",
        "tag": "Votimi",
        "title": "Votimi nga jashtë vendit",
        "summary": "Mënyra e regjistrimit dhe e dërgimit të votës nga jashtë mbetet çështje e përsëritur para çdo pale zgjedhjesh.",
        "why": "Numri i votuesve të diasporës është mjaft i madh sa të ndikojë rezultatin, prandaj rregullat e regjistrimit janë vazhdimisht të diskutueshme."
      }
    ]
  },
  {
    "slug": "trump-dhe-ballkani",
    "title": "Trump dhe Ballkani",
    "blurb": "Politika amerikane ndaj Kosovës dhe rajonit nën administratën Trump.",
    "forms": [
      "trump",
      "trumpi",
      "trumpit",
      "shtepia e bardhe",
      "uashington",
      "administrata amerikane",
      "shba"
    ],
    "milestones": [
      {
        "year": "2020",
        "date": "4 shtator 2020",
        "tag": "Uashington",
        "title": "Marrëveshjet e Uashingtonit nënshkruhen në Shtëpinë e Bardhë",
        "summary": "Kosova dhe Serbia nënshkruajnë veçmas dokumente për normalizim ekonomik, në një ceremoni në Shtëpinë e Bardhë.",
        "why": "Modeli i ndërmjetësimit amerikan, i shpejtë dhe i drejtpërdrejtë, kthehet si pikë referimi sa herë ndryshon administrata."
      }
    ]
  }
];

const BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

export function topicBySlug(slug) {
  return BY_SLUG.get(String(slug ?? "")) ?? null;
}

function formHits(article, topic) {
  const hay = " " + fold((article?.title ?? "") + " " + (article?.excerpt ?? "") + " " + (article?.category ?? "")) + " ";
  return (topic?.forms ?? []).filter((form) => {
    const f = fold(form);
    return f.length > 2 && hay.includes(" " + f + " ");
  }).length;
}

/**
 * Whether an article belongs to a topic. Matches whole words inside the folded
 * title, excerpt and category, so "bruksel" hits "Brukselit" while a short form
 * can never match the middle of an unrelated word.
 */
export function articleMatchesTopic(article, topic) {
  if (!article || !topic) return false;
  return formHits(article, topic) > 0;
}

/** The single best topic for an article: most surface-form hits wins. */
export function topicForArticle(article) {
  let best = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    const score = formHits(article, topic);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return best;
}

export function articlesForTopic(slug, articles) {
  const topic = topicBySlug(slug);
  if (!topic) return [];
  return (articles ?? [])
    .filter((a) => articleMatchesTopic(a, topic))
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
}

/**
 * The dossier timeline: authored history oldest-first, then this archive's own
 * coverage, with the article being read marked in place so a reader can see
 * where today sits in the longer story.
 */
export function timelineFor(slug, articles, currentSlug) {
  const current = currentSlug ?? null;
  const topic = topicBySlug(slug);
  if (!topic) return [];

  const milestones = (topic.milestones ?? []).map((m) => ({
    kind: "milestone",
    id: "m:" + m.date + ":" + m.title,
    ...m,
  }));

  const recent = articlesForTopic(slug, articles)
    .slice(0, 14)
    .reverse()
    .map((a) => ({
      kind: "article",
      id: "a:" + a.slug,
      year: String(a.publishedAt ?? "").slice(0, 4),
      date: a.publishedAt,
      tag: a.category,
      title: a.title,
      summary: a.excerpt,
      slug: a.slug,
      imageUrl: a.imageUrl ?? null,
      source: a.source ?? null,
      publishedAt: a.publishedAt ?? null,
      isCurrent: Boolean(current) && a.slug === current,
    }));

  return [...milestones, ...recent];
}
