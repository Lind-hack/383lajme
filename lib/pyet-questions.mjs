/**
 * Pyet 383 — the questions offered before the reader types one.
 *
 * Derived, never generated. A model call per article view would cost a request
 * and a second of latency to produce chips that are almost always the same
 * four questions, and it would put generated text on the page before the
 * reader has asked for anything. These are computed from the article itself,
 * so they render with the server component, cost nothing, and cannot say
 * anything untrue — a chip is an affordance, not a claim.
 *
 * The reader's own question is still the primary path. Chips exist because
 * "why did this happen" is the question people actually have on a news page
 * and typing it every time is friction.
 */

import { fold } from "./search-match.mjs";

/**
 * The question every news page raises, and the one the reader asked for by
 * name: why did this happen in the first place.
 */
const UNIVERSAL = [
  // Kept free of words about the asking ("sipas artikullit", "për këtë temë").
  // Those retrieve on themselves — see STOPWORDS in pyet-retrieval.mjs — and
  // the article is already pinned and labelled as the one being read.
  { label: "Pse ndodhi kjo?", question: "Pse ndodhi kjo?" },
  { label: "Çfarë ndodhi më parë?", question: "Çfarë ka ndodhur më parë?" },
];

/** One extra angle, chosen by section. */
const BY_CATEGORY = {
  "Politikë": {
    label: "Çfarë thonë palët?",
    question: "Çfarë kanë thënë palët e përfshira?",
  },
  Ekonomi: {
    label: "Si i prek qytetarët?",
    question: "Si i prek kjo qytetarët në praktikë?",
  },
  Sport: {
    label: "Çfarë vjen më pas?",
    question: "Çfarë do të thotë ky rezultat për vazhdimin?",
  },
  Teknologji: {
    label: "Pse ka rëndësi?",
    question: "Pse ka rëndësi ky lajm dhe çfarë ndryshon?",
  },
  "Botë": {
    label: "Si lidhet me Kosovën?",
    question: "Si lidhet kjo me Kosovën?",
  },
  Showbiz: {
    label: "Pse u fol kaq shumë?",
    question: "Pse u fol kaq shumë për këtë?",
  },
};

const FALLBACK_ANGLE = {
  label: "Çfarë do të thotë kjo?",
  question: "Çfarë do të thotë kjo dhe pse ka rëndësi?",
};

/**
 * Chips for one article.
 *
 * `subjects` are candidate names (people, places, topics) the site already
 * knows about; the one named in the headline earns a "who is…" chip, because
 * a reader landing mid-story often does not know the person it is about.
 */
export function articleQuestions(article, subjects = []) {
  const out = [...UNIVERSAL];

  const named = headlineSubject(article?.title ?? "", subjects);
  if (named) {
    out.push({
      label: `Kush është ${named}?`,
      question: `Kush është ${named} dhe çfarë roli ka në këtë ngjarje?`,
    });
  }

  out.push(BY_CATEGORY[article?.category] ?? FALLBACK_ANGLE);

  // Four is the most a chip row can carry before it stops reading as a short
  // list of openings and starts reading as a menu to be studied.
  return out.slice(0, 4);
}

/** The first known subject named in the headline, if any. */
function headlineSubject(title, subjects) {
  const folded = ` ${fold(title)} `;
  let best = null;
  for (const subject of subjects) {
    const name = typeof subject === "string" ? subject : subject?.name;
    if (!name) continue;
    const key = fold(name);
    // Two words or more, or a long single word: "BE" and "SHBA" fold to noise
    // that collides with ordinary text.
    if (key.length < 5) continue;
    if (!folded.includes(` ${key}`)) continue;
    if (!best || key.length > fold(best).length) best = name;
  }
  return best;
}

/**
 * Openers for the overlay, where there is no article to anchor to.
 *
 * Built from what has actually been published today, so the suggestions can
 * always be answered — offering a question the archive cannot support would
 * walk the reader straight into a refusal on their first try.
 */
export function starterQuestions(articles = [], limit = 3) {
  const out = [];
  for (const article of articles) {
    if (out.length >= limit) break;
    const title = String(article?.title ?? "").trim();
    if (title.length < 12) continue;
    out.push({
      label: shorten(title),
      question: `Pse ndodhi kjo: ${title}`,
    });
  }
  return out;
}

function shorten(title, max = 52) {
  if (title.length <= max) return title;
  const cut = title.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}
