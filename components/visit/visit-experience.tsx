"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  BusFront,
  CarFront,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Globe2,
  HeartPulse,
  Landmark,
  Languages,
  Map,
  MapPin,
  Navigation,
  Phone,
  Plane,
  Printer,
  Route,
  ShieldCheck,
  Sparkles,
  TreePine,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  ALBANIA_DATA_CHECKED_AT,
  ALBANIA_EMERGENCY_CONTACTS,
  ALBANIA_VISIT_SECTIONS,
  EMERGENCY_CONTACTS,
  TRAVEL_OPTIONS,
  VISIT_DATA_CHECKED_AT,
  VISIT_INFORMATION_NOTICE,
  VISIT_SECTIONS,
  type ArrivalValue,
  type DestinationValue,
  type EmergencyContact,
  type PlateCountryValue,
  type SourceStatus,
  type VisitArtifact,
  type VisitLanguageValue,
  type VisitSection,
  type VisitSectionId,
} from "@/lib/visit-data";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./visit.module.css";

type TravelDraft = {
  destination: DestinationValue;
  arrival: ArrivalValue;
  plateCountry: PlateCountryValue;
  language: VisitLanguageValue;
};

type SavedTravelCard = TravelDraft & {
  createdAt: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type CoreCopy = {
  skip: string;
  utility: string;
  title: string;
  intro: string;
  start: string;
  noAccount: string;
  destination: string;
  arrival: string;
  plate: string;
  plateHint: string;
  language: string;
  create: string;
  update: string;
  saved: string;
  offline: string;
  download: string;
  print: string;
  help: string;
  source: string;
  checked: string;
  unavailable: string;
  stale: string;
  open: string;
  quickRoute: string;
  cardTitle: string;
  cardIntro: string;
  routeLabel: string;
  emergency: string;
  privacy: string;
  builderTitle: string;
  guideEyebrow: string;
  guideTitle: string;
  guideIntro: string;
  languageNote: string;
};

const CORE_COPY: Record<VisitLanguageValue, CoreCopy> = {
  en: {
    skip: "Skip to travel setup",
    utility: "383 visitor utility",
    title: "Arrive prepared. Know what to do next.",
    intro:
      "A source-checked guide for visitors to Kosovo or Albania, with urgent help always within reach.",
    start: "Start with six simple routes",
    noAccount: "No account. Your choices stay on this device.",
    destination: "Destination",
    arrival: "How are you arriving?",
    plate: "Vehicle plate country",
    plateHint: "Only used to show a safer insurance reminder.",
    language: "Interface language",
    create: "Create my travel card",
    update: "Update my travel card",
    saved: "Saved on this device",
    offline: "Keep an offline copy before you travel.",
    download: "Save offline",
    print: "Print card",
    help: "Need help now?",
    source: "Official source",
    checked: "Last checked",
    unavailable: "Not live in 383",
    stale: "Needs recheck",
    open: "Open source",
    quickRoute: "Your quick route",
    cardTitle: "Personal travel card",
    cardIntro: "The essentials for your route, ready on one page.",
    routeLabel: "Visit plan",
    emergency: "Emergency help",
    privacy: "Private by design",
    builderTitle: "Build the card you will actually use",
    guideEyebrow: "Source-checked guide",
    guideTitle: "Open the right door, not another search result",
    guideIntro: "Every route names its source and review date. Changing information is marked clearly.",
    languageNote:
      "Interface controls translate. Reviewed source summaries stay in English; official pages open in the authority's language.",
  },
  sq: {
    skip: "Kalo te përgatitja e udhëtimit",
    utility: "Shërbimi i vizitorëve 383",
    title: "Mbërrij i përgatitur. Dije hapin tjetër.",
    intro:
      "Udhëzues me burime të kontrolluara për vizitorët në Kosovë ose Shqipëri, me ndihmë urgjente gjithmonë afër.",
    start: "Fillo me gjashtë rrugë të thjeshta",
    noAccount: "Pa llogari. Zgjedhjet mbesin në këtë pajisje.",
    destination: "Destinacioni",
    arrival: "Si po mbërrin?",
    plate: "Shteti i targave",
    plateHint: "Përdoret vetëm për një kujtesë më të sigurt për sigurimin.",
    language: "Gjuha e ndërfaqes",
    create: "Krijo kartën time",
    update: "Përditëso kartën time",
    saved: "Ruajtur në këtë pajisje",
    offline: "Ruaj një kopje para udhëtimit.",
    download: "Ruaj jashtë linje",
    print: "Printo kartën",
    help: "Të duhet ndihmë tani?",
    source: "Burim zyrtar",
    checked: "Kontrolluar më",
    unavailable: "Jo drejtpërdrejt në 383",
    stale: "Duhet rikontrolluar",
    open: "Hap burimin",
    quickRoute: "Rruga jote e shpejtë",
    cardTitle: "Karta personale e udhëtimit",
    cardIntro: "Gjërat kryesore për rrugën tënde, në një faqe.",
    routeLabel: "Plani i vizitës",
    emergency: "Ndihmë urgjente",
    privacy: "Privatësi që në fillim",
    builderTitle: "Krijo kartën që do ta përdorësh vërtet",
    guideEyebrow: "Udhëzues me burime të kontrolluara",
    guideTitle: "Hape derën e duhur, jo një tjetër rezultat kërkimi",
    guideIntro: "Çdo rrugë e tregon burimin dhe datën e kontrollit. Ndryshimet shënohen qartë.",
    languageNote:
      "Kontrollet e ndërfaqes përkthehen. Përmbledhjet e burimeve mbeten anglisht; faqet zyrtare hapen në gjuhën e autoritetit.",
  },
  de: {
    skip: "Zur Reiseplanung springen",
    utility: "383 Besucherhilfe",
    title: "Gut vorbereitet ankommen. Den nächsten Schritt kennen.",
    intro: "Geprüfte Hinweise für Reisen nach Kosovo oder Albanien, mit schneller Hilfe in Reichweite.",
    start: "Sechs einfache Wege",
    noAccount: "Kein Konto. Ihre Auswahl bleibt auf diesem Gerät.",
    destination: "Reiseziel",
    arrival: "Wie reisen Sie an?",
    plate: "Land des Kennzeichens",
    plateHint: "Nur für einen sicheren Versicherungshinweis.",
    language: "Sprache der Oberfläche",
    create: "Reisekarte erstellen",
    update: "Reisekarte aktualisieren",
    saved: "Auf diesem Gerät gespeichert",
    offline: "Vor der Reise offline speichern.",
    download: "Offline speichern",
    print: "Karte drucken",
    help: "Brauchen Sie jetzt Hilfe?",
    source: "Offizielle Quelle",
    checked: "Zuletzt geprüft",
    unavailable: "Nicht live in 383",
    stale: "Erneut prüfen",
    open: "Quelle öffnen",
    quickRoute: "Ihr schneller Weg",
    cardTitle: "Persönliche Reisekarte",
    cardIntro: "Die wichtigsten Angaben für Ihre Route auf einer Seite.",
    routeLabel: "Reiseplan",
    emergency: "Notfallhilfe",
    privacy: "Privat gestaltet",
    builderTitle: "Erstellen Sie die Reisekarte, die Sie wirklich nutzen",
    guideEyebrow: "Quellengeprüfter Leitfaden",
    guideTitle: "Direkt zur richtigen Stelle, ohne weitere Suche",
    guideIntro: "Jeder Weg nennt Quelle und Prüfdatum. Veränderliche Angaben sind klar markiert.",
    languageNote:
      "Die Oberfläche wird übersetzt. Geprüfte Quellenhinweise bleiben auf Englisch; Behördenseiten öffnen in der Sprache der Behörde.",
  },
  fr: {
    skip: "Aller à la préparation du voyage",
    utility: "Service visiteurs 383",
    title: "Arrivez préparé. Sachez quoi faire ensuite.",
    intro: "Un guide vérifié pour le Kosovo ou l’Albanie, avec l’aide urgente toujours accessible.",
    start: "Six parcours simples",
    noAccount: "Sans compte. Vos choix restent sur cet appareil.",
    destination: "Destination",
    arrival: "Comment arrivez-vous ?",
    plate: "Pays de la plaque",
    plateHint: "Utilisé uniquement pour un rappel d’assurance prudent.",
    language: "Langue de l’interface",
    create: "Créer ma carte de voyage",
    update: "Mettre à jour ma carte",
    saved: "Enregistrée sur cet appareil",
    offline: "Gardez une copie hors ligne avant le départ.",
    download: "Enregistrer hors ligne",
    print: "Imprimer la carte",
    help: "Besoin d’aide maintenant ?",
    source: "Source officielle",
    checked: "Dernière vérification",
    unavailable: "Pas en direct dans 383",
    stale: "À revérifier",
    open: "Ouvrir la source",
    quickRoute: "Votre parcours rapide",
    cardTitle: "Carte de voyage personnelle",
    cardIntro: "L’essentiel de votre trajet sur une page.",
    routeLabel: "Plan de visite",
    emergency: "Aide d’urgence",
    privacy: "Confidentialité intégrée",
    builderTitle: "Créez la carte que vous utiliserez vraiment",
    guideEyebrow: "Guide aux sources vérifiées",
    guideTitle: "Ouvrez la bonne porte, pas un autre résultat de recherche",
    guideIntro: "Chaque parcours indique sa source et sa date de vérification. Les données changeantes sont signalées.",
    languageNote:
      "L’interface est traduite. Les résumés vérifiés restent en anglais; les pages officielles s’ouvrent dans la langue de l’administration.",
  },
  it: {
    skip: "Vai alla preparazione del viaggio",
    utility: "Servizio visitatori 383",
    title: "Arriva preparato. Sai già cosa fare.",
    intro: "Una guida verificata per il Kosovo o l’Albania, con l’aiuto urgente sempre a portata di mano.",
    start: "Sei percorsi semplici",
    noAccount: "Nessun account. Le scelte restano su questo dispositivo.",
    destination: "Destinazione",
    arrival: "Come arrivi?",
    plate: "Paese della targa",
    plateHint: "Usato solo per un promemoria prudente sull’assicurazione.",
    language: "Lingua dell’interfaccia",
    create: "Crea la mia carta di viaggio",
    update: "Aggiorna la carta",
    saved: "Salvata su questo dispositivo",
    offline: "Conserva una copia offline prima del viaggio.",
    download: "Salva offline",
    print: "Stampa la carta",
    help: "Serve aiuto adesso?",
    source: "Fonte ufficiale",
    checked: "Ultimo controllo",
    unavailable: "Non in diretta su 383",
    stale: "Da ricontrollare",
    open: "Apri la fonte",
    quickRoute: "Il tuo percorso rapido",
    cardTitle: "Carta di viaggio personale",
    cardIntro: "Le informazioni essenziali per il tuo percorso, in una pagina.",
    routeLabel: "Piano di visita",
    emergency: "Aiuto urgente",
    privacy: "Privato fin dall’inizio",
    builderTitle: "Crea la carta che userai davvero",
    guideEyebrow: "Guida con fonti verificate",
    guideTitle: "Apri la porta giusta, non un altro risultato di ricerca",
    guideIntro: "Ogni percorso indica fonte e data di controllo. Le informazioni variabili sono segnalate.",
    languageNote:
      "L’interfaccia viene tradotta. I riepiloghi verificati restano in inglese; le pagine ufficiali si aprono nella lingua dell’autorità.",
  },
  sv: {
    skip: "Gå till reseplaneringen",
    utility: "383 besöksguide",
    title: "Kom förberedd. Vet vad du gör härnäst.",
    intro: "En källkontrollerad guide för Kosovo eller Albanien med snabb hjälp alltid nära.",
    start: "Sex enkla vägar",
    noAccount: "Inget konto. Dina val stannar på den här enheten.",
    destination: "Resmål",
    arrival: "Hur anländer du?",
    plate: "Registreringsland",
    plateHint: "Används bara för en försiktig försäkringspåminnelse.",
    language: "Gränssnittsspråk",
    create: "Skapa mitt resekort",
    update: "Uppdatera mitt resekort",
    saved: "Sparat på den här enheten",
    offline: "Spara en offlinekopia före resan.",
    download: "Spara offline",
    print: "Skriv ut kort",
    help: "Behöver du hjälp nu?",
    source: "Officiell källa",
    checked: "Senast kontrollerad",
    unavailable: "Inte live i 383",
    stale: "Kontrollera igen",
    open: "Öppna källa",
    quickRoute: "Din snabba väg",
    cardTitle: "Personligt resekort",
    cardIntro: "Det viktigaste för din rutt på en sida.",
    routeLabel: "Resplan",
    emergency: "Akuthjälp",
    privacy: "Privat från början",
    builderTitle: "Skapa kortet du faktiskt kommer att använda",
    guideEyebrow: "Källkontrollerad guide",
    guideTitle: "Öppna rätt dörr, inte ännu ett sökresultat",
    guideIntro: "Varje väg visar källa och granskningsdatum. Föränderlig information markeras tydligt.",
    languageNote:
      "Gränssnittet översätts. Granskade källsammanfattningar förblir på engelska; myndighetssidor öppnas på myndighetens språk.",
  },
  tr: {
    skip: "Seyahat hazırlığına geç",
    utility: "383 ziyaretçi rehberi",
    title: "Hazırlıklı gelin. Sonraki adımı bilin.",
    intro: "Kosova veya Arnavutluk ziyaretçileri için kaynakları kontrol edilmiş rehber ve hızlı yardım.",
    start: "Altı kolay yol",
    noAccount: "Hesap gerekmez. Seçimleriniz bu cihazda kalır.",
    destination: "Varış yeri",
    arrival: "Nasıl geliyorsunuz?",
    plate: "Plaka ülkesi",
    plateHint: "Yalnızca güvenli bir sigorta hatırlatması için kullanılır.",
    language: "Arayüz dili",
    create: "Seyahat kartımı oluştur",
    update: "Seyahat kartımı güncelle",
    saved: "Bu cihazda kaydedildi",
    offline: "Yola çıkmadan çevrimdışı kopya alın.",
    download: "Çevrimdışı kaydet",
    print: "Kartı yazdır",
    help: "Şimdi yardım mı lazım?",
    source: "Resmî kaynak",
    checked: "Son kontrol",
    unavailable: "383’te canlı değil",
    stale: "Yeniden kontrol et",
    open: "Kaynağı aç",
    quickRoute: "Hızlı rotanız",
    cardTitle: "Kişisel seyahat kartı",
    cardIntro: "Rotanız için temel bilgiler tek sayfada.",
    routeLabel: "Ziyaret planı",
    emergency: "Acil yardım",
    privacy: "Baştan itibaren gizli",
    builderTitle: "Gerçekten kullanacağınız kartı oluşturun",
    guideEyebrow: "Kaynağı kontrol edilmiş rehber",
    guideTitle: "Yeni bir arama sonucu yerine doğru kapıyı açın",
    guideIntro: "Her rota kaynağını ve kontrol tarihini gösterir. Değişken bilgiler açıkça işaretlenir.",
    languageNote:
      "Arayüz çevrilir. İncelenmiş kaynak özetleri İngilizce kalır; resmî sayfalar kurumun dilinde açılır.",
  },
  sr: {
    skip: "Pređi na pripremu putovanja",
    utility: "383 vodič za posetioce",
    title: "Stignite spremni. Znajte sledeći korak.",
    intro: "Proveren vodič za posetioce Kosova ili Albanije, sa hitnom pomoći nadohvat ruke.",
    start: "Šest jednostavnih puteva",
    noAccount: "Bez naloga. Vaši izbori ostaju na ovom uređaju.",
    destination: "Odredište",
    arrival: "Kako dolazite?",
    plate: "Zemlja registracije",
    plateHint: "Koristi se samo za bezbedan podsetnik o osiguranju.",
    language: "Jezik interfejsa",
    create: "Napravi moju putnu karticu",
    update: "Ažuriraj putnu karticu",
    saved: "Sačuvano na ovom uređaju",
    offline: "Sačuvajte kopiju pre puta.",
    download: "Sačuvaj van mreže",
    print: "Odštampaj karticu",
    help: "Treba vam pomoć sada?",
    source: "Zvanični izvor",
    checked: "Poslednja provera",
    unavailable: "Nije uživo u 383",
    stale: "Proverite ponovo",
    open: "Otvori izvor",
    quickRoute: "Vaša brza ruta",
    cardTitle: "Lična putna kartica",
    cardIntro: "Najvažnije za vašu rutu na jednoj stranici.",
    routeLabel: "Plan posete",
    emergency: "Hitna pomoć",
    privacy: "Privatno od početka",
    builderTitle: "Napravite karticu koju ćete zaista koristiti",
    guideEyebrow: "Vodič sa proverenim izvorima",
    guideTitle: "Otvorite prava vrata, ne još jedan rezultat pretrage",
    guideIntro: "Svaka ruta navodi izvor i datum provere. Promenljive informacije su jasno označene.",
    languageNote:
      "Interfejs se prevodi. Provereni sažeci izvora ostaju na engleskom; zvanične stranice se otvaraju na jeziku institucije.",
  },
};

const SECTION_ICONS: Record<VisitSectionId, LucideIcon> = {
  travel: Route,
  documents: FileText,
  money: WalletCards,
  health: HeartPulse,
  "things-to-do": TreePine,
  "buy-invest": BriefcaseBusiness,
};

const ARTIFACT_ICONS: Record<VisitArtifact, LucideIcon> = {
  "checkpoint-file": ClipboardCheck,
  "consular-folder": FileText,
  "bank-receipt": Banknote,
  "health-ticket": HeartPulse,
  "city-pocket-guide": Map,
  "property-dossier": Landmark,
};

const SECTION_TRANSLATIONS: Record<VisitLanguageValue, Record<VisitSectionId, string>> = {
  en: {
    travel: "Travel and border",
    documents: "Documents and services",
    money: "Money and banking",
    health: "Health",
    "things-to-do": "Things to do",
    "buy-invest": "Buy or invest",
  },
  sq: {
    travel: "Udhëtimi dhe kufiri",
    documents: "Dokumente dhe shërbime",
    money: "Para dhe banka",
    health: "Shëndetësi",
    "things-to-do": "Çfarë të bëj",
    "buy-invest": "Blej ose investoj",
  },
  de: {
    travel: "Reise und Grenze",
    documents: "Dokumente und Dienste",
    money: "Geld und Banken",
    health: "Gesundheit",
    "things-to-do": "Unternehmungen",
    "buy-invest": "Kaufen oder investieren",
  },
  fr: {
    travel: "Voyage et frontière",
    documents: "Documents et services",
    money: "Argent et banques",
    health: "Santé",
    "things-to-do": "À faire",
    "buy-invest": "Acheter ou investir",
  },
  it: {
    travel: "Viaggio e frontiera",
    documents: "Documenti e servizi",
    money: "Denaro e banche",
    health: "Salute",
    "things-to-do": "Cosa fare",
    "buy-invest": "Comprare o investire",
  },
  sv: {
    travel: "Resa och gräns",
    documents: "Dokument och tjänster",
    money: "Pengar och banker",
    health: "Hälsa",
    "things-to-do": "Att göra",
    "buy-invest": "Köpa eller investera",
  },
  tr: {
    travel: "Seyahat ve sınır",
    documents: "Belgeler ve hizmetler",
    money: "Para ve bankacılık",
    health: "Sağlık",
    "things-to-do": "Yapılacaklar",
    "buy-invest": "Satın al veya yatırım yap",
  },
  sr: {
    travel: "Putovanje i granica",
    documents: "Dokumenti i usluge",
    money: "Novac i banke",
    health: "Zdravlje",
    "things-to-do": "Šta raditi",
    "buy-invest": "Kupovina ili ulaganje",
  },
};

const ARRIVAL_ICONS: Record<ArrivalValue, LucideIcon> = {
  car: CarFront,
  plane: Plane,
  bus: BusFront,
  other: Navigation,
};

const ARRIVAL_TRANSLATIONS: Record<VisitLanguageValue, Record<ArrivalValue, string>> = {
  en: { car: "Driving", plane: "Flying", bus: "Bus or coach", other: "Other" },
  sq: { car: "Me veturë", plane: "Me aeroplan", bus: "Me autobus", other: "Tjetër" },
  de: { car: "Mit dem Auto", plane: "Mit dem Flugzeug", bus: "Bus oder Reisebus", other: "Andere" },
  fr: { car: "En voiture", plane: "En avion", bus: "Bus ou autocar", other: "Autre" },
  it: { car: "In auto", plane: "In aereo", bus: "Bus o pullman", other: "Altro" },
  sv: { car: "Med bil", plane: "Med flyg", bus: "Buss", other: "Annat" },
  tr: { car: "Arabayla", plane: "Uçakla", bus: "Otobüsle", other: "Diğer" },
  sr: { car: "Automobilom", plane: "Avionom", bus: "Autobusom", other: "Drugo" },
};

const LANGUAGE_LOCALES: Record<VisitLanguageValue, string> = {
  en: "en-GB",
  sq: "sq-XK",
  de: "de-DE",
  fr: "fr-FR",
  it: "it-IT",
  sv: "sv-SE",
  tr: "tr-TR",
  sr: "sr-Latn",
};

const STORAGE_KEY = "383-visit-card-v1";

function sectionsForDestination(destination: DestinationValue): readonly VisitSection[] {
  if (destination === "kosovo") return VISIT_SECTIONS;
  if (destination === "albania") return ALBANIA_VISIT_SECTIONS;
  return VISIT_SECTIONS.map((section, index) => ({
    ...section,
    title: section.id === "things-to-do" || section.id === "buy-invest"
      ? section.title.replace("Kosovo", "Kosovo + Albania")
      : section.title,
    titleSq: section.id === "things-to-do" || section.id === "buy-invest"
      ? section.titleSq.replace("Kosovë", "Kosovë + Shqipëri")
      : section.titleSq,
    summary: "Country-specific sources for both stops. Check each authority separately before crossing or committing money.",
    resources: [...section.resources, ...ALBANIA_VISIT_SECTIONS[index].resources],
  }));
}

function emergencyContactsForDestination(destination: DestinationValue): readonly EmergencyContact[] {
  if (destination === "kosovo") return EMERGENCY_CONTACTS;
  if (destination === "albania") return ALBANIA_EMERGENCY_CONTACTS;
  return [...EMERGENCY_CONTACTS, ...ALBANIA_EMERGENCY_CONTACTS.slice(1)];
}

function routeCountryName(destination: DestinationValue) {
  if (destination === "kosovo") return "Kosovo";
  if (destination === "albania") return "Albania";
  return "Kosovo + Albania";
}

function importantResourcesFor(destination: DestinationValue) {
  const primary = destination === "albania" ? ALBANIA_VISIT_SECTIONS : VISIT_SECTIONS;
  const firstSet = [
    primary[0].resources[0],
    primary[0].resources[1],
    primary[1].resources[0],
    primary[2].resources[0],
    primary[3].resources[1],
  ];
  if (destination !== "kosovo-albania") return firstSet;
  return [
    ...firstSet,
    ALBANIA_VISIT_SECTIONS[0].resources[0],
    ALBANIA_VISIT_SECTIONS[0].resources[1],
    ALBANIA_VISIT_SECTIONS[1].resources[0],
    ALBANIA_VISIT_SECTIONS[2].resources[0],
    ALBANIA_VISIT_SECTIONS[3].resources[1],
  ];
}

function optionLabel(
  option: { label: string; labelSq: string },
  language: VisitLanguageValue,
) {
  return language === "sq" ? option.labelSq : option.label;
}

function statusLabel(status: SourceStatus) {
  if (status === "unavailable") return "Unavailable in 383";
  if (status === "stale") return "Needs recheck";
  return "Current";
}

function isSavedTravelCard(value: unknown): value is SavedTravelCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<SavedTravelCard>;
  return (
    typeof card.createdAt === "string" &&
    TRAVEL_OPTIONS.destinations.some((option) => option.value === card.destination) &&
    TRAVEL_OPTIONS.arrivals.some((option) => option.value === card.arrival) &&
    TRAVEL_OPTIONS.plateCountries.some((option) => option.value === card.plateCountry) &&
    TRAVEL_OPTIONS.languages.some((option) => option.value === card.language)
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function EmergencySheet({
  open,
  onClose,
  destination,
}: {
  open: boolean;
  onClose: () => void;
  destination: DestinationValue;
}) {
  const titleId = useId();
  const callRef = useRef<HTMLAnchorElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => callRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const contacts = emergencyContactsForDestination(destination);
  const countryName = routeCountryName(destination);
  const primarySources = destination === "kosovo-albania"
    ? [EMERGENCY_CONTACTS[0], ALBANIA_EMERGENCY_CONTACTS[0]]
    : [contacts[0]];

  const requestLocation = () => {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("Location is not available in this browser. Tell the operator a nearby address or landmark.");
      return;
    }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus("ready");
      },
      () => {
        setLocationStatus("error");
        setLocationMessage("Location was not shared. You can still call and describe a nearby address or landmark.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const locationText = coordinates
    ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)} (accuracy about ${Math.round(coordinates.accuracy)} m)`
    : "";

  const copyLocation = async () => {
    try {
      await navigator.clipboard.writeText(locationText);
      setLocationMessage("Location copied. Share it only with someone you trust or an emergency operator.");
    } catch {
      setLocationMessage("Copy failed. Read the coordinates aloud to the emergency operator.");
    }
  };

  const shareLocation = async () => {
    if (!coordinates) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My location", text: locationText });
        setLocationMessage("Shared using your device. 383 did not receive the location.");
        return;
      } catch {
        return;
      }
    }
    await copyLocation();
  };

  return createPortal(
    <div
      className={styles.emergencyBackdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section ref={sheetRef} className={styles.emergencySheet} role="dialog" aria-modal="true" aria-labelledby={titleId} lang="en">
        <div className={styles.emergencyTopline}>
          <div>
            <span className={styles.emergencyKicker}>Urgent help in {countryName}</span>
            <h2 id={titleId}>Call the service you need</h2>
          </div>
          <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close emergency help">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div className={styles.primaryEmergencyGroup}>
          <a ref={callRef} className={styles.primaryEmergencyCall} href="tel:112">
            <span className={styles.callIcon}><Phone aria-hidden="true" size={24} /></span>
            <span><strong>Call 112</strong><small>Unified emergency route for {countryName}</small></span>
            <ArrowUpRight aria-hidden="true" size={22} />
          </a>
          <div className={styles.emergencyProvenance}>
            {primarySources.map((contact) => (
              <div key={contact.id}>
                <span className={styles.currentSource}>Current</span>
                <span>Last checked {contact.checkedAt}</span>
                <a href={contact.sourceUrl} target="_blank" rel="noreferrer">
                  {destination === "kosovo-albania" && `${contact.id.startsWith("albania-") ? "Albania" : "Kosovo"}: `}
                  {contact.sourceName} <ArrowUpRight aria-hidden="true" size={12} />
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.emergencyNumbers}>
          {contacts.slice(1).map((contact) => (
            <article key={contact.id}>
              <a className={styles.emergencyNumberCall} href={contact.callHref}>
                <strong>{contact.number}</strong>
                <span>
                  {contact.title}
                  {destination === "kosovo-albania" && ` (${contact.id.startsWith("albania-") ? "Albania" : "Kosovo"})`}
                </span>
              </a>
              <div className={styles.emergencyNumberSource}>
                <span><b>Current</b> · Checked {contact.checkedAt}</span>
                <a href={contact.sourceUrl} target="_blank" rel="noreferrer">
                  {contact.sourceName} <ArrowUpRight aria-hidden="true" size={12} />
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.emergencyAdvice}>
          <ShieldCheck aria-hidden="true" size={20} />
          <p>
            If it is safe, move away from danger. Tell the operator what happened, your location and whether anyone is injured. 383 provides shortcuts only and does not dispatch or promise rescue.
          </p>
        </div>

        <div className={styles.locationBox}>
          <div>
            <span className={styles.locationLabel}>Optional, on-device location</span>
            <p>Your browser asks permission. Nothing is sent to 383. You decide if and when to share it.</p>
          </div>
          {locationStatus !== "ready" ? (
            <button type="button" className={styles.secondaryButton} onClick={requestLocation} disabled={locationStatus === "requesting"}>
              <MapPin aria-hidden="true" size={17} />
              {locationStatus === "requesting" ? "Finding location..." : "Show my coordinates"}
            </button>
          ) : (
            <div className={styles.coordinatePanel}>
              <code>{locationText}</code>
              <div>
                <button type="button" onClick={copyLocation}><Copy aria-hidden="true" size={15} />Copy</button>
                <button type="button" onClick={shareLocation}><ArrowUpRight aria-hidden="true" size={15} />Share</button>
              </div>
            </div>
          )}
          {locationMessage && <p className={styles.inlineMessage} role="status">{locationMessage}</p>}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default function VisitExperience() {
  const reducedMotion = useReducedMotion();
  const formRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [draft, setDraft] = useState<TravelDraft>({
    destination: "kosovo",
    arrival: "car",
    plateCountry: "DE",
    language: "en",
  });
  const [savedCard, setSavedCard] = useState<SavedTravelCard | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const copy = CORE_COPY[draft.language];
  const closeEmergency = useCallback(() => setEmergencyOpen(false), []);
  const activeSections = useMemo(() => sectionsForDestination(draft.destination), [draft.destination]);
  const importantResources = useMemo(() => importantResourcesFor(draft.destination), [draft.destination]);
  const cardShortcuts = useMemo(() => {
    if (draft.destination === "kosovo-albania") {
      return [
        { resource: VISIT_SECTIONS[0].resources[0], label: "Kosovo border source" },
        { resource: ALBANIA_VISIT_SECTIONS[0].resources[0], label: "Albania border source" },
        { resource: VISIT_SECTIONS[0].resources[1], label: "Kosovo insurance check" },
        { resource: ALBANIA_VISIT_SECTIONS[0].resources[1], label: "Albania insurance check" },
        { resource: VISIT_SECTIONS[1].resources[0], label: "Kosovo entry rules" },
        { resource: ALBANIA_VISIT_SECTIONS[1].resources[0], label: "Albania entry rules" },
      ];
    }
    const selected = draft.destination === "albania" ? ALBANIA_VISIT_SECTIONS : VISIT_SECTIONS;
    return [
      { resource: selected[0].resources[0], label: "Border source, check update time" },
      { resource: selected[0].resources[1], label: "Insurance check" },
      { resource: selected[1].resources[0], label: "Entry rules" },
    ];
  }, [draft.destination]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isSavedTravelCard(parsed)) {
          setSavedCard(parsed);
          setDraft(parsed);
        }
      }
      const requestedArrival = new URLSearchParams(window.location.search).get("arrival");
      if (TRAVEL_OPTIONS.arrivals.some((option) => option.value === requestedArrival)) {
        setDraft((current) => ({ ...current, arrival: requestedArrival as ArrivalValue }));
      }
    } catch {
      setSaveMessage("Your previous card could not be read. You can create a new one below.");
    }
  }, []);

  const destination = TRAVEL_OPTIONS.destinations.find((option) => option.value === draft.destination)!;
  const arrival = TRAVEL_OPTIONS.arrivals.find((option) => option.value === draft.arrival)!;
  const plate = TRAVEL_OPTIONS.plateCountries.find((option) => option.value === draft.plateCountry)!;
  const language = TRAVEL_OPTIONS.languages.find((option) => option.value === draft.language)!;
  const ArrivalIcon = ARRIVAL_ICONS[draft.arrival];

  const checkedDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(LANGUAGE_LOCALES[draft.language], {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [draft.language],
  );

  const createTravelCard = () => {
    const nextCard: SavedTravelCard = { ...draft, createdAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCard));
      setSavedCard(nextCard);
      setSaveMessage(copy.saved);
      window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }), 40);
    } catch {
      setSavedCard(nextCard);
      setSaveMessage("The card is ready, but this browser blocked on-device storage. Download a copy to keep it.");
    }
  };

  const downloadCard = () => {
    const card: SavedTravelCard = {
      ...draft,
      createdAt: savedCard?.createdAt ?? new Date().toISOString(),
    };
    const offlineCopy = CORE_COPY[card.language];
    const chosenDestination = TRAVEL_OPTIONS.destinations.find((option) => option.value === card.destination)!;
    const chosenPlate = TRAVEL_OPTIONS.plateCountries.find((option) => option.value === card.plateCountry)!;
    const chosenLanguage = TRAVEL_OPTIONS.languages.find((option) => option.value === card.language)!;
    const links = importantResources
      .map(
        (resource) =>
          `<li lang="en"><a href="${escapeHtml(resource.sourceUrl)}">${escapeHtml(resource.title)}</a><small>${escapeHtml(resource.sourceName)} | Last checked ${escapeHtml(resource.checkedAt)}</small></li>`,
      )
      .join("");
    const html = `<!doctype html><html lang="${escapeHtml(card.language)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(offlineCopy.cardTitle)} | 383</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4efe7;color:#171614;margin:0;padding:32px}main{max-width:720px;margin:auto;background:#fff;padding:32px;border:1px solid #d8d0c5;border-radius:16px}header{border-bottom:2px solid #ff4422;padding-bottom:18px}h1{font-size:32px;margin:8px 0}.route{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.route div{border:1px solid #d8d0c5;padding:14px;border-radius:10px}.route small,li small{display:block;color:#625e57;margin-top:5px}a{color:#171614}li{margin:16px 0}.emergency{background:#a6221b;color:#fff;padding:18px;border-radius:10px;font-size:24px}.note{font-size:13px;line-height:1.5;color:#625e57}@media(max-width:560px){body{padding:12px}main{padding:20px}.route{grid-template-columns:1fr}}@media print{body{background:#fff;padding:0}main{border:0}}</style><main><header><small>${escapeHtml(offlineCopy.utility.toUpperCase())}</small><h1>${escapeHtml(offlineCopy.cardTitle)}</h1><p>${escapeHtml(offlineCopy.saved)}: ${escapeHtml(new Date(card.createdAt).toLocaleString(LANGUAGE_LOCALES[card.language]))}</p></header><section class="route"><div><small>${escapeHtml(offlineCopy.destination)}</small><strong>${escapeHtml(optionLabel(chosenDestination, card.language))}</strong></div><div><small>${escapeHtml(offlineCopy.arrival)}</small><strong>${escapeHtml(ARRIVAL_TRANSLATIONS[card.language][card.arrival])}</strong></div><div><small>${escapeHtml(offlineCopy.plate)}</small><strong>${escapeHtml(optionLabel(chosenPlate, card.language))}</strong></div><div><small>${escapeHtml(offlineCopy.language)}</small><strong>${escapeHtml(chosenLanguage.nativeLabel)}</strong></div></section><p class="emergency"><strong>${escapeHtml(offlineCopy.emergency)}: 112</strong></p><h2>${escapeHtml(offlineCopy.source)}</h2><ul>${links}</ul><p class="note">${escapeHtml(VISIT_INFORMATION_NOTICE.body)} Choices used to make this file were not sent to 383.</p></main></html>`;
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `383-${card.destination}-travel-card.html`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaveMessage("Offline travel card downloaded.");
    } catch {
      setSaveMessage("Download failed. Use Print card and save as PDF instead.");
    }
  };

  const formatCheckedDate = (date: string) =>
    checkedDateFormatter.format(new Date(`${date}T12:00:00Z`));

  return (
    <main className={styles.pageShell}>
      <a className={styles.skipLink} href="#travel-setup" lang={draft.language}>{copy.skip}</a>

      <section className={styles.hero}>
        <div className={styles.atlasFold} aria-hidden="true"><span /><span /><span /></div>
        <div className={styles.heroInner}>
          <motion.div
            className={styles.heroCopy}
            lang={draft.language}
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.eyebrow}><Globe2 aria-hidden="true" size={15} />{copy.utility}</div>
            <h1>{copy.title}</h1>
            <p className={styles.heroIntro}>{copy.intro}</p>
            <div className={styles.heroTrustRow}>
              <span lang="en"><BadgeCheck aria-hidden="true" size={16} />Source checked</span>
              <span lang="en"><Languages aria-hidden="true" size={16} />8 interface languages</span>
              <span><ShieldCheck aria-hidden="true" size={16} />{copy.privacy}</span>
            </div>
          </motion.div>

          <motion.div
            className={styles.quickRoutes}
            lang={draft.language}
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.045, delayChildren: reducedMotion ? 0 : 0.12 } },
            }}
          >
            <p>{copy.start}</p>
            <div className={styles.routeGrid}>
              {activeSections.map((section) => {
                const Icon = SECTION_ICONS[section.id];
                return (
                  <motion.a
                    key={section.id}
                    href={`#${section.id}`}
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: reducedMotion ? 0 : 0.32 }}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{SECTION_TRANSLATIONS[draft.language][section.id]}</span>
                    <ArrowUpRight aria-hidden="true" size={15} />
                  </motion.a>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      <section className={styles.builderSection} id="travel-setup" lang={draft.language}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>01</span>
          <div>
            <p>{copy.quickRoute}</p>
            <h2>{copy.builderTitle}</h2>
          </div>
          <span className={styles.privateNote}><ShieldCheck aria-hidden="true" size={16} />{copy.noAccount}</span>
        </div>

        <div className={styles.builderGrid}>
          <div ref={formRef} className={styles.builderForm}>
            <div className={styles.fieldGroup}>
              <label htmlFor="visit-destination">{copy.destination}</label>
              <select
                id="visit-destination"
                value={draft.destination}
                onChange={(event) => setDraft((current) => ({ ...current, destination: event.target.value as DestinationValue }))}
              >
                {TRAVEL_OPTIONS.destinations.map((option) => (
                  <option key={option.value} value={option.value}>{optionLabel(option, draft.language)}</option>
                ))}
              </select>
            </div>

            <fieldset className={styles.fieldset}>
              <legend>{copy.arrival}</legend>
              <div className={styles.arrivalOptions}>
                {TRAVEL_OPTIONS.arrivals.map((option) => {
                  const Icon = ARRIVAL_ICONS[option.value];
                  return (
                    <label key={option.value} className={draft.arrival === option.value ? styles.optionActive : undefined}>
                      <input
                        type="radio"
                        name="arrival"
                        value={option.value}
                        checked={draft.arrival === option.value}
                        onChange={() => setDraft((current) => ({ ...current, arrival: option.value }))}
                      />
                      <Icon aria-hidden="true" size={19} />
                      <span>{ARRIVAL_TRANSLATIONS[draft.language][option.value]}</span>
                      {draft.arrival === option.value && <Check aria-hidden="true" size={15} />}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className={styles.twoFields}>
              <div className={styles.fieldGroup}>
                <label htmlFor="visit-plate">{copy.plate}</label>
                <select
                  id="visit-plate"
                  value={draft.plateCountry}
                  onChange={(event) => setDraft((current) => ({ ...current, plateCountry: event.target.value as PlateCountryValue }))}
                >
                  {TRAVEL_OPTIONS.plateCountries.map((option) => (
                    <option key={option.value} value={option.value}>{option.countryCode}  {optionLabel(option, draft.language)}</option>
                  ))}
                </select>
                <small lang={draft.arrival === "car" ? draft.language : "en"}>{draft.arrival === "car" ? copy.plateHint : "Saved for any onward journey by car."}</small>
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="visit-language">{copy.language}</label>
                <select
                  id="visit-language"
                  value={draft.language}
                  onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value as VisitLanguageValue }))}
                >
                  {TRAVEL_OPTIONS.languages.map((option) => (
                    <option key={option.value} value={option.value}>{option.nativeLabel}</option>
                  ))}
                </select>
                <small>{copy.languageNote}</small>
              </div>
            </div>

            {draft.destination === "kosovo-albania" && (
              <div className={styles.scopeNotice} role="note" lang="en">
                <Globe2 aria-hidden="true" size={18} />
                <p><strong>Two-country route.</strong> Kosovo and Albania have separate entry, vehicle, money and service rules. The guide keeps both official source sets visible.</p>
              </div>
            )}

            {draft.arrival === "car" && plate.insuranceEligibility === "check_required" && (
              <div className={styles.insuranceNotice} role="note" lang="en">
                <ShieldCheck aria-hidden="true" size={18} />
                <p>
                  <strong>Insurance check required.</strong> A {plate.label} plate does not by itself prove coverage. Verify the vehicle and policy with {draft.destination === "kosovo" ? "the Kosovo Insurance Bureau" : draft.destination === "albania" ? "the Albanian Financial Supervisory Authority" : "the Kosovo and Albanian insurance authorities separately"} before travel.
                </p>
              </div>
            )}

            <button type="button" className={styles.primaryButton} onClick={createTravelCard}>
              <Sparkles aria-hidden="true" size={18} />
              {savedCard ? copy.update : copy.create}
            </button>
            {saveMessage && <p className={styles.saveMessage} role="status">{saveMessage}</p>}
          </div>

          <motion.div
            ref={cardRef}
            className={styles.travelCard}
            layout
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.cardPunches} aria-hidden="true"><i /><i /><i /></div>
            <div className={styles.cardHeader}>
              <div>
                <span lang="en">383 / VISIT</span>
                <h3>{copy.cardTitle}</h3>
                <p>{copy.cardIntro}</p>
              </div>
              <span className={styles.cardStamp} lang="en">
                {draft.destination === "kosovo" ? "XK" : draft.destination === "albania" ? "AL" : "XK + AL"}<br />READY
              </span>
            </div>
            <div className={styles.cardRoute}>
              <span><MapPin aria-hidden="true" size={16} />{copy.routeLabel}</span>
              <strong>{optionLabel(destination, draft.language)}</strong>
              <i aria-hidden="true" />
              <span className={styles.arrivalBadge}><ArrivalIcon aria-hidden="true" size={17} />{ARRIVAL_TRANSLATIONS[draft.language][arrival.value]}</span>
            </div>
            <dl className={styles.cardDetails}>
              <div><dt>{copy.plate}</dt><dd>{plate.countryCode} / {optionLabel(plate, draft.language)}</dd></div>
              <div><dt>{copy.language}</dt><dd>{language.nativeLabel}</dd></div>
              <div>
                <dt>{copy.checked}</dt>
                <dd>
                  {draft.destination === "kosovo"
                    ? formatCheckedDate(VISIT_DATA_CHECKED_AT)
                    : draft.destination === "albania"
                      ? formatCheckedDate(ALBANIA_DATA_CHECKED_AT)
                      : `XK ${formatCheckedDate(VISIT_DATA_CHECKED_AT)} / AL ${formatCheckedDate(ALBANIA_DATA_CHECKED_AT)}`}
                </dd>
              </div>
            </dl>
            <a className={styles.cardEmergency} href="tel:112">
              <Phone aria-hidden="true" size={18} />
              <span><small>{copy.emergency}</small><strong>112</strong></span>
              <ArrowUpRight aria-hidden="true" size={18} />
            </a>
            <div className={styles.cardQuickLinks} lang="en">
              <p><BadgeCheck aria-hidden="true" size={14} />Source-checked shortcuts</p>
              <div>
                {cardShortcuts.map(({ resource, label }) => (
                  <a
                    key={resource.id}
                    href={resource.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${label}: ${resource.sourceName}`}
                  >
                    <span>{label}</span>
                    <ArrowUpRight aria-hidden="true" size={14} />
                  </a>
                ))}
              </div>
            </div>
            <div className={styles.cardActions}>
              <button type="button" onClick={downloadCard}><Download aria-hidden="true" size={16} />{copy.download}</button>
              <button type="button" onClick={() => window.print()}><Printer aria-hidden="true" size={16} />{copy.print}</button>
            </div>
            <p className={styles.offlineNote}><ShieldCheck aria-hidden="true" size={14} />{copy.offline}</p>
          </motion.div>
        </div>
      </section>

      <section className={styles.guideSection} aria-labelledby="guide-title">
        <div className={styles.guideHeading} lang={draft.language}>
          <div>
            <span className={styles.sectionNumber}>02</span>
            <p>{copy.guideEyebrow}</p>
          </div>
          <h2 id="guide-title">{copy.guideTitle}</h2>
          <p>{copy.guideIntro}</p>
        </div>

        <div className={styles.guideGrid} lang="en">
          {activeSections.map((section, index) => {
            const Icon = ARTIFACT_ICONS[section.artifact];
            return (
              <article
                className={`${styles.guideCard} ${index === 0 || index === 5 ? styles.guideCardWide : ""}`}
                id={section.id}
                key={section.id}
                data-artifact={section.artifact}
              >
                <div className={styles.artifactHeader}>
                  <div className={styles.artifactIcon}><Icon aria-hidden="true" size={23} /></div>
                  <div>
                    <span>{section.eyebrow}</span>
                    <h3 lang={draft.language}>{SECTION_TRANSLATIONS[draft.language][section.id]}</h3>
                    <p>{section.summary}</p>
                  </div>
                </div>

                <div className={styles.resourceList}>
                  {section.resources.map((resource) => (
                    <div className={styles.resource} key={resource.id}>
                      <div className={styles.resourceState} data-status={resource.status}>
                        {resource.status === "current" ? <BadgeCheck aria-hidden="true" size={14} /> : <Navigation aria-hidden="true" size={14} />}
                        {statusLabel(resource.status)}
                      </div>
                      <h4>{resource.title}</h4>
                      <p>{resource.summary}</p>
                      {"eligibility" in resource && resource.eligibility === "check_required" && draft.arrival === "car" && (
                        <div className={styles.contextFlag}>Your {plate.countryCode} plate needs an individual coverage check.</div>
                      )}
                      <div className={styles.sourceMeta}>
                        <span>Last checked {formatCheckedDate(resource.checkedAt)}</span>
                        <a href={resource.sourceUrl} target="_blank" rel="noreferrer">
                          <span><strong>Open official source</strong><small>{resource.sourceName}</small></span>
                          <ArrowUpRight aria-hidden="true" size={17} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.integritySection} lang="en">
        <div className={styles.integrityMark}><ShieldCheck aria-hidden="true" size={27} /></div>
        <div>
          <span>383 safety boundary</span>
          <h2>{VISIT_INFORMATION_NOTICE.title}</h2>
        </div>
        <p>{VISIT_INFORMATION_NOTICE.body}</p>
        <div className={styles.integrityDetails}>
          <span><BadgeCheck aria-hidden="true" size={16} />Reviewed {formatCheckedDate(VISIT_INFORMATION_NOTICE.reviewedAt)}</span>
          <span><ShieldCheck aria-hidden="true" size={16} />Choices stay on device</span>
          <Link href="/privatesia">Read 383 privacy terms <ArrowUpRight aria-hidden="true" size={14} /></Link>
        </div>
      </section>

      <button type="button" className={styles.helpButton} onClick={() => setEmergencyOpen(true)} lang={draft.language}>
        <span className={styles.helpPulse} aria-hidden="true" />
        <Phone aria-hidden="true" size={19} />
        <span>{copy.help}</span>
        <strong>112</strong>
      </button>

      <EmergencySheet open={emergencyOpen} onClose={closeEmergency} destination={draft.destination} />
    </main>
  );
}
