export interface Poll {
  question: string;
  options: string[];
}

export const POLL_QUESTIONS: Poll[] = [
  { question: "A duhet Kosova të bashkohet me Shqipërinë?", options: ["Po", "Jo"] },
  { question: "A mendoni se Kosova do të anëtarësohet në BE brenda 10 viteve?", options: ["Po", "Jo"] },
  { question: "A besoni se emigrimi i rinisë po dëmton Kosovën?", options: ["Po", "Jo"] },
  { question: "A duhet të lejohet vota e diasporës në zgjedhjet e Kosovës?", options: ["Po", "Jo"] },
  { question: "A e besoni median shqiptare?", options: ["Po", "Jo"] },
  { question: "A keni frikë nga krimi i organizuar në Kosovë?", options: ["Po", "Jo"] },
  { question: "A duhet Kosova të ketë ushtri të plotë?", options: ["Po", "Jo"] },
  { question: "A mendoni se gjuha shqipe po degradohet?", options: ["Po", "Jo"] },
  { question: "A duhet të ndalohet pirja e duhanit në lokale publike?", options: ["Po", "Jo"] },
  { question: "A keni menduar ndonjëherë të emigroni?", options: ["Po", "Jo", "Tashmë jam jashtë"] },
  { question: "A ju duket çmimi i naftës në Kosovë i drejtë?", options: ["Po, i arsyeshëm", "Jo, shumë i lartë"] },
  { question: "A besoni se Kosova do të arrijë marrëveshje me Serbinë ndonjëherë?", options: ["Po", "Jo"] },
  { question: "A mendoni se sistemi arsimor në Kosovë është cilësor?", options: ["Po", "Jo"] },
  { question: "A duhet të legalizohet kanabisi në Kosovë?", options: ["Po", "Jo"] },
  { question: "A mendoni se politika shqiptare është e ndikuar nga jashtë?", options: ["Po shumë", "Disi", "Jo aspak"] },
  { question: "A jeni krenar/e që jeni shqiptar/e?", options: ["Po, shumë", "Po, disi", "Jo"] },
  { question: "A mendoni se Kosova duhet të anëtarësohet plotësisht në NATO?", options: ["Po", "Jo"] },
  { question: "A besoni te drejtësia dhe gjykatat në Kosovë?", options: ["Po", "Jo"] },
  { question: "A mendoni se çmimet e shtëpive në Prishtinë janë të larta?", options: ["Po, jashtë mase", "Jo, janë normale"] },
  { question: "A duhet Kosova të lejojë vizat ruse?", options: ["Po", "Jo"] },
  { question: "Cili është problemi kryesor i Kosovës?", options: ["Papunësia", "Korrupsioni", "Emigrimi", "Siguria"] },
  { question: "Si e vlerësoni drejtimin e vendit sot?", options: ["Mirë", "Keq", "As mirë as keq"] },
  { question: "Ku preferoni të jetoni?", options: ["Kosovë", "Shqipëri", "Europë Perëndimore", "SHBA/Kanada"] },
  { question: "Cili sektor duhet të ketë më shumë investime?", options: ["Arsimi", "Shëndetësia", "Infrastruktura", "Teknologjia"] },
  { question: "Si e vlerësoni ekonominë e Kosovës?", options: ["Në rritje", "Stagnuese", "Në rënie"] },
  { question: "Çfarë ju mungon më shumë nëse jeni jashtë Kosovës?", options: ["Familja", "Ushqimi", "Mikpritja", "Natyra"] },
  { question: "A mendoni se turizmi mund të bëhet industri kryesore e Kosovës?", options: ["Po, absolutisht", "Ndoshta", "Jo"] },
  { question: "Cila fushë ka të ardhme më të mirë në Kosovë?", options: ["Teknologjia", "Biznesi", "Arti/Kultura", "Sportet"] },
  { question: "A mendoni se rinia kosovare ka mundësi të mjaftueshme?", options: ["Po", "Jo", "Nuk jam i/e sigurt"] },
  { question: "Si mendoni se do të jetë Kosova pas 20 viteve?", options: ["Shumë më mirë", "Njësoj si sot", "Më keq"] },
];

export function getDefaultPoll(pollDate: string): Poll {
  const [year, month, day] = pollDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const startOfYear = new Date(year, 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  return POLL_QUESTIONS[dayOfYear % POLL_QUESTIONS.length];
}
