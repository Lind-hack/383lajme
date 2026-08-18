export interface Poll {
  question: string;
  options: string[];
}

/**
 * The fallback bank, used on any day without a curated or generated question.
 *
 * Every entry has to pass one test: you cannot guess the result before voting.
 * The bank this replaced failed that badly — "A jeni krenar/e që jeni
 * shqiptar/e?", "A besoni se emigrimi i rinisë po dëmton Kosovën?" — questions
 * whose answers are already known, which is precisely what trains a reader to
 * click without reading.
 *
 * Three rules hold throughout:
 *
 *   1. No neutral option. "Nuk e di", "Varet", "As mirë as keq" is always the
 *      safe pick, it costs nothing, and it wins. Every option here is a side.
 *   2. Prefer a real cost — money, time, comfort, a principle given up. A
 *      question you can answer for free is one you answer without thinking.
 *   3. Policy questions are worded neutrally, and none is framed against any
 *      group. The split has to come from genuine disagreement, not from how
 *      the question is asked.
 */
export const POLL_QUESTIONS: Poll[] = [
  {
    question: "A do ta linit Kosovën përgjithmonë për 2000€ në muaj jashtë vendit?",
    options: ["Po, pa hezitim", "Jo, do të rrija"],
  },
  {
    question: "A duhet Kosova të bashkohet me Shqipërinë?",
    options: ["Po", "Jo"],
  },
  {
    question: "A do të paguanit 20% më shumë për rrymë nga burime më të pastra?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet të lejohet vota e diasporës në zgjedhjet e Kosovës?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet të kenë përparësi të rinjtë në punësimin publik?",
    options: ["Po", "Jo, vetëm merita"],
  },
  {
    question: "Rrogë 800€ në Kosovë apo 2000€ në Gjermani?",
    options: ["800€ këtu", "2000€ jashtë"],
  },
  {
    question: "A duhet të rrëzohen ndërtimet pa leje, edhe kur janë shtëpi banimi?",
    options: ["Po, ligji është ligj", "Jo, mbeten pa strehë"],
  },
  {
    question: "A duhet shërbimi ushtarak të jetë i detyrueshëm në Kosovë?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet ndaluar duhani në të gjitha lokalet, pa asnjë përjashtim?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet legalizuar kanabisi për përdorim mjekësor?",
    options: ["Po", "Jo"],
  },
  {
    question: "A do ta pranonit një rrogë më të ulët për të punuar në Kosovë?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet Kosova të bëjë lëshime për një marrëveshje me Serbinë?",
    options: ["Po, nëse mbyllet çështja", "Jo, asnjë lëshim"],
  },
  {
    question: "A duhet taksuar më shumë banesat që rrinë bosh gjithë vitin?",
    options: ["Po", "Jo"],
  },
  {
    question: "A i besoni më shumë mjekut privat se atij publik?",
    options: ["Privatit", "Publikut"],
  },
  {
    question: "A duhet të ketë mësim fetar në shkollat publike?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet të ndalohen reklamat e basteve sportive?",
    options: ["Po", "Jo"],
  },
  {
    question: "A do të ndërronit rrogën e sigurt për biznesin tuaj?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet të paguhet parkimi në qendër të Prishtinës?",
    options: ["Po", "Jo"],
  },
  {
    question: "A janë grevat e mësuesve të arsyetuara?",
    options: ["Po", "Jo"],
  },
  {
    question: "A do të votonit për një parti të re pa asnjë përvojë qeverisëse?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet investuar në termocentral të ri me qymyr?",
    options: ["Po, na duhet rryma", "Jo, vetëm të rinovueshme"],
  },
  {
    question: "A duhet të ulet mosha e votimit në 16 vjeç?",
    options: ["Po", "Jo"],
  },
  {
    question: "A do të donit që fëmija juaj të bëhej politikan?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet Kosova të pranojë refugjatë nga vende në luftë?",
    options: ["Po", "Jo"],
  },
  {
    question: "A është influencer një profesion i vërtetë?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet të hapen dyqanet e mëdha edhe të dielën?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet të ketë kuota gjinore të detyrueshme në politikë?",
    options: ["Po", "Jo"],
  },
  {
    question: "A ju ka penguar korrupsioni ndonjëherë personalisht?",
    options: ["Po", "Jo"],
  },
  {
    question: "A duhet ndaluar qarkullimi i veturave mbi 20 vjeç në qytete?",
    options: ["Po, për ajrin", "Jo, s'kanë alternativë"],
  },
  {
    question: "A do të ktheheshit në Kosovë pas 10 vjetësh jashtë?",
    options: ["Po", "Jo"],
  },
];

/**
 * The fallback question for a day, rotating through the bank.
 *
 * Both anchors are UTC noon. `new Date(y, m - 1, d)` builds a local-time
 * instant, so across a DST boundary the two anchors sit an hour apart and the
 * difference floors to one day short — meaning any machine in a DST zone,
 * Kosovo included, served *yesterday's* question for two thirds of the year.
 * Production runs UTC and happened to be correct, which is exactly why this
 * went unnoticed. Noon keeps the subtraction clear of both transitions.
 */
export function getDefaultPoll(pollDate: string): Poll {
  const [year, month, day] = pollDate.split("-").map(Number);
  const date = Date.UTC(year, month - 1, day, 12);
  const startOfYear = Date.UTC(year, 0, 0, 12);
  const dayOfYear = Math.round((date - startOfYear) / (1000 * 60 * 60 * 24));
  return POLL_QUESTIONS[dayOfYear % POLL_QUESTIONS.length];
}
