export const SITE_LANGUAGES = ["sq", "en", "de"];
export const LANGUAGE_STORAGE_KEY = "383-language";
export const LANGUAGE_CACHE_VERSION = "v3";
export const LANGUAGE_BATCH_LIMIT = 32;
export const LANGUAGE_CHARACTER_LIMIT = 10000;
export const isSiteLanguage = value => SITE_LANGUAGES.includes(value);
export function isTranslationOriginAllowed(origin, requestOrigin) {
  return !origin || [requestOrigin,"https://383ks.com","https://www.383ks.com","https://383lajme-production.up.railway.app"].includes(origin);
}
export function localizedAnswerPrompt(prompt, language) {
  const target={sq:"Albanian",en:"English",de:"German"}[language]??"Albanian";
  return `${prompt}\n\nAnswer-language instruction: write the answer in ${target}. Keep the same JSON fields, source citation requirements, evidence restrictions and refusal rules.`;
}

// Reviewed navigation and common controls switch immediately, without a network call.
const labels = [
  ["Sot", "Today", "Heute"], ["Për ty", "For you", "Für dich"],
  ["Bota për Kosovën", "The world on Kosovo", "Die Welt über Kosovo"],
  ["Kosova në xhep", "Kosovo in your pocket", "Kosovo für unterwegs"],
  ["Tregu", "Market", "Markt"], ["Pyet Dardanin", "Ask Dardani", "Frag Dardani"],
  ["Kërko", "Search", "Suchen"], ["Hap menunë", "Open menu", "Menü öffnen"],
  ["Mbyll", "Close", "Schließen"], ["Mbyll menunë", "Close menu", "Menü schließen"],
  ["Kosovë", "Kosovo", "Kosovo"], ["Shqipëri", "Albania", "Albanien"],
  ["Botë", "World", "Welt"], ["Ekonomi", "Economy", "Wirtschaft"],
  ["Sport", "Sport", "Sport"], ["Teknologji", "Technology", "Technologie"],
  ["Kulturë", "Culture", "Kultur"], ["Të gjitha", "All", "Alle"],
  ["Lajme", "News", "Nachrichten"], ["Lajmet e fundit", "Latest news", "Neueste Nachrichten"],
  ["Lexo më shumë", "Read more", "Mehr lesen"], ["Lexo artikullin", "Read article", "Artikel lesen"],
  ["Shiko të gjitha", "View all", "Alle anzeigen"], ["Shpërndaj", "Share", "Teilen"],
  ["Ruaj", "Save", "Speichern"], ["Kopjo lidhjen", "Copy link", "Link kopieren"],
  ["Hyr", "Sign in", "Anmelden"], ["Regjistrohu", "Sign up", "Registrieren"],
  ["Dil", "Sign out", "Abmelden"], ["Profili", "Profile", "Profil"],
  ["Portofoli", "Portfolio", "Portfolio"], ["Kontakt", "Contact", "Kontakt"],
  ["Rreth nesh", "About us", "Über uns"], ["Privatësia", "Privacy", "Datenschutz"],
  ["Kushtet", "Terms", "Bedingungen"], ["Navigimi kryesor", "Main navigation", "Hauptnavigation"],
  ["Email", "Email", "E-Mail"], ["Fjalëkalimi", "Password", "Passwort"],
  ["Po", "Yes", "Ja"], ["Jo", "No", "Nein"],
  ["Anulo", "Cancel", "Abbrechen"], ["Vazhdo", "Continue", "Weiter"],
  ["Dërgo", "Send", "Senden"], ["Provo përsëri", "Try again", "Erneut versuchen"],
  ["Duke ngarkuar…", "Loading…", "Wird geladen…"],
  ["Duke ngarkuar tregjet…", "Loading markets…", "Märkte werden geladen…"],
  ["Kërko tregje", "Search markets", "Märkte suchen"],
  ["Mbyllet së shpejti", "Closing soon", "Schließt bald"], ["Vëllimi", "Volume", "Volumen"],
  ["Më të nxehta", "Trending", "Im Trend"], ["Hap tregun →", "Open market →", "Markt öffnen →"],
  ["Lexo në shqip", "Read in Albanian", "Auf Albanisch lesen"],
  ["Përkthyer në shqip", "Translated into Albanian", "Ins Albanische übersetzt"],
  ["Derivatet në Kosovë", "Fuel prices in Kosovo", "Kraftstoffpreise im Kosovo"],
  ["Derivatet", "Fuel prices", "Kraftstoffpreise"],
  ["Këmbimi i ditës", "Today's exchange rates", "Aktuelle Wechselkurse"],
  ["Çmimi për litër", "Price per litre", "Preis pro Liter"],
  ["Naftë", "Diesel", "Diesel"], ["Benzinë", "Petrol", "Benzin"],
  ["Moti", "Weather", "Wetter"], ["Në këto qytete", "In these cities", "In diesen Städten"],
  ["Me re", "Cloudy", "Bewölkt"], ["Shi", "Rain", "Regen"],
  ["Ti jep", "You give", "Du gibst"], ["Ti merr", "You receive", "Du erhältst"],
  ["Më herët", "Earlier", "Zuvor"], ["Lajmi i fundit", "Breaking news", "Eilmeldung"],
  ["Më të lexuarat", "Most read", "Meistgelesen"], ["Njoftime", "Updates", "Meldungen"],
  ["Kategoritë", "Categories", "Kategorien"],
  ["Lajmi më i ri", "Newest story", "Neueste Meldung"],
  ["Lajmi më i vjetër", "Previous story", "Vorherige Meldung"],
  ["Tërhiq", "Swipe", "Wischen"], ["Tërhiq anash", "Swipe sideways", "Seitlich wischen"],
];
const known = new Map();
for (const row of labels) for (const value of row) if (!known.has(value.toLocaleLowerCase())) known.set(value.toLocaleLowerCase(), row);
export function localTranslation(text, language, sourceLanguage = "sq") {
  if(language===sourceLanguage || /^(ALL|EUR|USD|GBP|CHF|JPY|CNY|INR|SEK|NOK|DKK|PLN|TRY|AUD|CAD|BRL|RON|HUF|CZK|RUB)$/.test(text)) return text;
  const row = known.get(text.toLocaleLowerCase());
  if (row) {
    const translated=row[SITE_LANGUAGES.indexOf(language)];
    return text===text.toLocaleUpperCase()?translated.toLocaleUpperCase():translated;
  }
  if (language === sourceLanguage || !/\p{L}/u.test(text) || /^https?:\/\/|^[\w.+-]+@[\w.-]+\.[A-Za-z]+$/u.test(text)) return text;
  return null;
}

export function validateTranslationRequest(body) {
  if (!body || !isSiteLanguage(body.language) || !Array.isArray(body.texts) || !body.texts.length || body.texts.length > LANGUAGE_BATCH_LIMIT) throw new Error("Invalid translation request.");
  if (body.texts.some(text => typeof text !== "string" || !text.trim() || text.length > 8000) || body.texts.join("").length > LANGUAGE_CHARACTER_LIMIT) throw new Error("Translation request is too large.");
  return { language: body.language, texts: body.texts };
}

export function validateTranslationLanguage(text, language) {
  const nameParts=text.trim().split(/\s+/);
  const particle=/^(von|van|de|der|da|del|la)$/i;
  // Names such as Ursula von der Leyen retain their native particles.
  if(nameParts.length>=4&&nameParts.length<=7&&nameParts.some(word=>particle.test(word))&&nameParts.filter(word=>!particle.test(word)).every(word=>/^\p{Lu}[\p{L}'’-]+$/u.test(word))) return;
  const words=text.toLocaleLowerCase().match(/\p{L}+/gu)??[];
  if(words.length<4) return;
  const vocabulary={en:new Set("the and is are of in on for with from this that has have will to by a an it its not you your me do can as at or be been us no".split(" ")),de:new Set("der die das und ist sind von im in an für mit aus diese dieser wird werden zu ein eine es sie nicht dein du den dem auf über bei des dass auch als so nur zum zur noch".split(" ")),sq:new Set("dhe në të është janë nga për me kjo ky një nuk do që sipas më ka kanë".split(" "))};
  const score=lang=>words.filter(word=>vocabulary[lang].has(word)).length;
  const expected=score(language);
  for(const other of SITE_LANGUAGES) if(other!==language) {
    const foreign=score(other);
    if(foreign>=3&&expected<foreign*.4 || foreign>=2&&expected===0) throw new Error("Translation is in the wrong language.");
  }
}
export function validateTranslationOutput(texts, output, language) {
  if (!Array.isArray(output?.translations) || output.translations.length !== texts.length) throw new Error("Incomplete translation.");
  return output.translations.map((value, index) => {
    if (typeof value !== "string" || !value.trim() || value.length > Math.max(1000, texts[index].length * 6) || /<\/?[a-z][^>]*>/i.test(value)) throw new Error("Invalid translation.");
    const numbers = text => (text.replace(/\u2212/g,"-").match(/[+-]?\d+(?:[.,:]\d+)*/g) ?? []).map(value=>value.replace(/,/g,".")).join("|");
    if (numbers(value) !== numbers(texts[index])) throw new Error("Translation changed a number.");
    if(language) validateTranslationLanguage(value,language);
    return value.trim();
  });
}
