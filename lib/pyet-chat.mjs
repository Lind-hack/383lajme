/**
 * Pyet 383: small talk.
 *
 * Dardani answers news from published 383 articles or not at all (see
 * lib/pyet-retrieval.mjs). That rule was never meant for "si je?" or
 * "faleminderit", and running those through it produced "Artikujt që kam nuk e
 * thonë këtë", a refusal to say hello back.
 *
 * So a message that is only small talk (a greeting, thanks, "kush je ti", a
 * request for a joke, a name) takes its own path. It needs no sources because it
 * makes no claims: the chat prompt forbids saying anything about events, and the
 * one thing it may mention is the list of today's headlines it is handed. Any
 * message carrying a real subject ("tung, po Muriqi a luan sot?") is not small
 * talk and goes through the archive as before.
 */

import { fold, terms } from "./search-match.mjs";
import { contentTerms } from "./pyet-retrieval.mjs";

/**
 * Phrases that mark a message as conversation rather than a news question.
 * Folded (no diacritics, lower case), matched on whole words.
 */
const CUES = [
  // greetings
  "tung", "tungjatjeta", "pershendetje", "pershendet", "ckemi", "c kemi", "hello", "hi", "hey", "hej",
  "mirdita", "miredita", "mire dita", "mirembrema", "miremengjes", "naten e mire", "dita e mire",
  "si je", "si jeni", "si ja kalon", "si po ja kalon", "qysh je", "qysh jeni", "qka po bon", "cka po bon",
  "cka po ben", "cfare po ben", "a je mire", "si ke qene", "si je sot",
  // thanks and praise
  "faleminderit", "flm", "rrofsh", "te lumte", "bravo", "thanks", "thank you", "merci", "je i mire",
  "je shume i mire", "je i zgjuar", "super",
  // about Dardani
  "kush je", "cka je", "cfare je", "si quhesh", "a je robot", "a je njeri", "cfare di", "cka di",
  "cka mund te besh", "cfare mund te besh", "si funksionon", "cfare mund te pyes", "cka mund te pyes",
  // jokes, mood, goodbyes
  "shaka", "me bej te qesh", "jam i merzitur", "jam e merzitur", "jam i lodhur", "jam e lodhur",
  "jam mire", "mirupafshim", "shihemi", "ciao", "bye", "naten",
  // a name
  "quhem", "emri im", "me thirr", "me therrisni", "thirrem",
];

/**
 * Words that belong to small talk itself, so they do not count as a subject.
 * Anything left over after removing these and the stopwords is a real topic,
 * and the message goes to the archive.
 */
const CHAT_WORDS = new Set(
  (
    "tung tungjatjeta pershendetje pershendet ckemi kemi hello hey hej mirdita miredita dita mire " +
    "mirembrema miremengjes naten nate qysh qka cka cfare bon ben kalon qene sot faleminderit flm " +
    "rrofsh lumte bravo thanks thank you merci shume zgjuar super kush quhesh robot njeri mund besh " +
    "funksionon pyes shaka trego bej qesh merzitur lodhur mirupafshim shihemi ciao bye quhem emri " +
    "thirr therrisni thirrem dardan dardani dardanin vlla vllai vella bro plak shpirt zemer cun " +
    "shoku shok shoqe mik mike ok okej po " +
    "gjithe dicka sa bukur hahaha haha lol jemi jeni jam une ti mua ty"
  ).split(" "),
);

/** The reader's name, from "quhem Lind", "emri im është Lind", "më thirr Lindi". */
const NAME_PATTERN =
  /(?:quhem|thirrem|emri\s+im\s+(?:[eë]sht[eë]|osht|asht|[eë]|o)|m[eë]\s+thirr(?:ni)?|m[eë]\s+th[eë]rrisni)\s+([\p{L}][\p{L}'’-]{1,23})/iu;

/** Words that follow "më thirr" without being a name ("më thirr nesër"). */
const NOT_NAMES = new Set("neser sot tani kur pse pak mua ty une ti pra edhe jam je si nje".split(" "));

export function extractName(message) {
  const match = String(message ?? "").match(NAME_PATTERN);
  if (!match || NOT_NAMES.has(fold(match[1]))) return null;
  return cleanName(match[1]);
}

/** A name the client sent back: letters only, short, capitalised. Untrusted. */
export function cleanName(raw) {
  const name = String(raw ?? "").trim().replace(/[^\p{L}'’-]/gu, "").slice(0, 24);
  if (name.length < 2) return null;
  return name.charAt(0).toLocaleUpperCase("sq") + name.slice(1);
}

function hasCue(folded) {
  const padded = ` ${folded} `;
  return CUES.some((cue) => padded.includes(` ${cue} `));
}

/**
 * Is this message only conversation?
 *
 * Both halves are needed. A cue alone would send "tung, çka ndodhi me Kurtin?"
 * to the chat path, which cannot answer it; no leftover subject alone would
 * send "Pse ndodhi kjo?" there, which is a news question about the page.
 */
export function isSmallTalk(message) {
  const folded = fold(message);
  if (!folded || !hasCue(folded)) return false;
  const name = extractName(message);
  const nameFolded = name ? fold(name) : null;
  const leftover = contentTerms(message).filter(
    (t) => !CHAT_WORDS.has(t) && t !== nameFolded && !/^\d+$/.test(t),
  );
  // Very short leftovers ("ti", "po") are filtered by contentTerms already.
  return leftover.length === 0 && terms(message).length <= 14;
}

export const CHAT_PROMPT = `Ti je Dardani, maskota dhe shoku i lexuesve të 383, një faqe lajmesh për Kosovën.
Lexuesi po bisedon me ty, nuk po pyet për ndonjë lajm.

SI FLET:
- Si një shok i ngrohtë nga Kosova: shqip i rrjedhshëm, i thjeshtë, me pak shije kosovare.
  Pa zhargon të rëndë dhe pa fjalë fyese. Mos i përsërit të njëjtat shprehje nga një
  përgjigje në tjetrën.
- 1–3 fjali të shkurtra. Pa listë me pika, pa titull, pa emoji të tepërta (maksimumi një).
- Nëse e di emrin e lexuesit, përdore natyrshëm, jo në çdo fjali.
- Nëse lexuesi të përshëndet dhe nuk ia di emrin, mund ta pyesësh një herë si ta thërrasësh.
  Mos e pyet nëse në bisedë e ke pyetur tashmë.
- Nëse të tregon emrin, përshëndete me atë emër.
- Je Dardani, jo njeri. Nëse të pyet, thuaj se je asistenti i 383 që lexon arkivin e lajmeve.

RREGULL I FORTË:
- Mos thuaj asgjë për ngjarje, politikë, sport, njerëz publikë, shifra apo data.
  Lajmet i jep vetëm kur lexuesi pyet për to, dhe atëherë i kërkon në arkiv.
- Mund të përmendësh titujt e sotëm më poshtë si ide për çka mund të pyesë, pa shtuar
  asgjë përtej titullit.
- Shaka: vetëm shaka të buta, të pafajshme, pa tallur grupe njerëzish.
- Nëse lexuesi duket në hall të madh ose flet për t'i bërë keq vetes, fol butë dhe
  sugjeroji të flasë me dikë që i beson ose të thërrasë 112.

FORMATI: vetëm JSON i vlefshëm, asgjë tjetër:
{"answer": "…", "followups": ["pyetje 1", "pyetje 2"]}
"followups" janë 0–2 pyetje të shkurtra që lexuesi mund t'i bëjë për titujt e sotëm.`;

/** The user turn for a chat message: who the reader is, today's headlines, the thread. */
export function buildChatPrompt(message, opts = {}) {
  const { name = null, interests = [], headlines = [], history = [], today = "", justNamed = false } = opts;
  const about = [
    name ? `Emri i lexuesit: ${name}` : "Emri i lexuesit: nuk dihet",
    // Without this the model greeted "Quhem Lind" with "Lind! Si ta thërras?".
    justNamed ? "Lexuesi sapo ta tha emrin në këtë mesazh. Mos e pyet më për emrin." : null,
    interests.length ? `Lexuesi ndjek: ${interests.join(", ")}` : null,
    today ? `Sot është ${today}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const titles = headlines.length
    ? `TITUJT E SOTËM TE 383:\n${headlines.map((t) => `- ${t}`).join("\n")}\n\n`
    : "";
  const past = history.length
    ? `BISEDA DERI TANI:\n${history.map((t) => `Lexuesi: ${t.question}\nDardani: ${t.answer}`).join("\n\n")}\n\n`
    : "";
  return `${about}\n\n${titles}${past}LEXUESI THOTË:\n${message}`;
}

/** Short follow-up questions from a model reply. Untrusted, so bounded. */
export function cleanFollowups(raw) {
  const out = [];
  for (const value of Array.isArray(raw) ? raw : []) {
    const q = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
    if (q.length < 6 || q.length > 90 || out.includes(q)) continue;
    out.push(q);
    if (out.length === 2) break;
  }
  return out;
}

export function validateChat(raw) {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "no-json" };
  const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";
  if (answer.length < 2) return { ok: false, reason: "empty-answer" };
  if (answer.length > 600) return { ok: false, reason: "runaway-answer" };
  return { ok: true, answer, followups: cleanFollowups(raw.followups) };
}
