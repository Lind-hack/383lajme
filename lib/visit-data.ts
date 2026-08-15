/**
 * Human-reviewed public-interest data for the first `/visit` release.
 *
 * A `current` status means the linked official page was reviewed on
 * VISIT_DATA_CHECKED_AT. It does not turn a dynamic condition into live data.
 */

export const VISIT_DATA_CHECKED_AT = "2026-08-12" as const;
export const ALBANIA_DATA_CHECKED_AT = "2026-08-15" as const;

export type SourceStatus = "current" | "stale" | "unavailable";

export type VisitSectionId =
  | "travel"
  | "documents"
  | "money"
  | "health"
  | "things-to-do"
  | "buy-invest";

export type VisitResourceKind =
  | "border"
  | "insurance"
  | "legal"
  | "service"
  | "money"
  | "health"
  | "discovery"
  | "property"
  | "investment";

export type VisitResourceEligibility = "check_required";

export type VisitArtifact =
  | "checkpoint-file"
  | "consular-folder"
  | "bank-receipt"
  | "health-ticket"
  | "city-pocket-guide"
  | "property-dossier";

export type OfficialSourceUrl = `https://${string}`;

export interface VisitResource {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceName: string;
  readonly sourceUrl: OfficialSourceUrl;
  readonly checkedAt: string;
  readonly status: SourceStatus;
  readonly critical?: boolean;
  readonly kind?: VisitResourceKind;
  /**
   * `check_required` deliberately avoids inferring border-insurance coverage
   * from a plate country. The visitor must verify the vehicle and policy with
   * the Kosovo Insurance Bureau before travelling.
   */
  readonly eligibility?: VisitResourceEligibility;
}

export interface VisitSection {
  readonly id: VisitSectionId;
  readonly eyebrow: string;
  readonly title: string;
  readonly titleSq: string;
  readonly summary: string;
  readonly artifact: VisitArtifact;
  readonly resources: readonly VisitResource[];
}

export interface EmergencyContact extends VisitResource {
  readonly number: "112" | "127" | "128" | "129" | "192" | "193" | "194";
  readonly callHref: `tel:${string}`;
  readonly critical: true;
}

export type DestinationValue = "kosovo" | "albania" | "kosovo-albania";
export type ArrivalValue = "car" | "plane" | "bus" | "other";
export type PlateCountryValue =
  | "XK"
  | "AL"
  | "DE"
  | "CH"
  | "IT"
  | "GB"
  | "AT"
  | "SE"
  | "US"
  | "OTHER";
export type VisitLanguageValue = "en" | "sq" | "de" | "fr" | "it" | "sv" | "tr" | "sr";
export type PlateCountryGroup = "local" | "neighbour" | "diaspora" | "other";
export type InsuranceEligibility = "not_applicable" | "check_required";

export interface VisitOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly labelSq: string;
  readonly description?: string;
}

export interface PlateCountryOption extends VisitOption<PlateCountryValue> {
  readonly countryCode: PlateCountryValue;
  readonly group: PlateCountryGroup;
  readonly insuranceEligibility: InsuranceEligibility;
}

export interface LanguageOption extends VisitOption<VisitLanguageValue> {
  readonly nativeLabel: string;
  readonly isDefault?: boolean;
}

export interface TravelOptions {
  readonly destinations: readonly VisitOption<DestinationValue>[];
  readonly arrivals: readonly VisitOption<ArrivalValue>[];
  readonly plateCountries: readonly PlateCountryOption[];
  readonly languages: readonly LanguageOption[];
}

const CURRENT = {
  checkedAt: VISIT_DATA_CHECKED_AT,
  status: "current",
} as const;

export const VISIT_SECTIONS = [
  {
    id: "travel",
    eyebrow: "Checkpoint 01",
    title: "Travel and border",
    titleSq: "Udhëtoj për Kosovë",
    summary: "Prepare the route, then verify changing border and vehicle requirements at the official source.",
    artifact: "checkpoint-file",
    resources: [
      {
        id: "official-border-flow",
        title: "Border waits are not live in 383",
        summary:
          "No stable live-feed contract is connected. Open the official border page and check its own update time before choosing a crossing.",
        sourceName: "Kosovo Ministry of Internal Affairs: National Centre for Border Management",
        sourceUrl: "https://mpb.rks-gov.net/?culture=en-gb#tab-3",
        checkedAt: VISIT_DATA_CHECKED_AT,
        status: "unavailable",
        critical: true,
        kind: "border",
      },
      {
        id: "vehicle-border-insurance",
        title: "Check whether this vehicle needs border insurance",
        summary:
          "Coverage depends on the registration country, policy and any recognition agreement. Verify first; do not buy from an unofficial seller.",
        sourceName: "Kosovo Insurance Bureau (BKS)",
        sourceUrl: "https://www.bks-ks.org/pagemodels/open?id=746d7602-2fc6-4b45-aa07-32cc1163a1f4",
        ...CURRENT,
        critical: true,
        kind: "insurance",
        eligibility: "check_required",
      },
      {
        id: "border-road-conditions",
        title: "Check roads leading to border crossings",
        summary:
          "Conditions can change after the page is checked. Read the official road table immediately before departure and keep a safe fallback route.",
        sourceName: "Kosovo Ministry of Internal Affairs: National Centre for Border Management",
        sourceUrl: "https://mpb.rks-gov.net/?culture=en-gb#tab-4",
        ...CURRENT,
        critical: true,
        kind: "border",
      },
    ],
  },
  {
    id: "documents",
    eyebrow: "Folder 02",
    title: "Documents and services",
    titleSq: "Dokumente & shërbime",
    summary: "Start with the rules for your own travel document, then continue to the responsible public service.",
    artifact: "consular-folder",
    resources: [
      {
        id: "foreign-visitor-entry-stay",
        title: "Entry and short-stay rules for foreign visitors",
        summary:
          "Bring a valid travel document and confirm whether your nationality needs a visa. Longer stays and work have separate requirements.",
        sourceName: "Kosovo Ministry of Internal Affairs",
        sourceUrl:
          "https://mpb.rks-gov.net/f/57/11006/INFORMATION-FOR-FOREIGN-CITIZENS-ENTERING-THE-REPUBLIC-OF-KOSOVO",
        ...CURRENT,
        critical: true,
        kind: "legal",
      },
      {
        id: "ekosova-services",
        title: "Open Kosovo government e-services",
        summary:
          "Service eligibility varies. Read the requirements before signing in and only enter personal data on the official eKosova domain.",
        sourceName: "eKosova, Government of Kosovo",
        sourceUrl: "https://ekosova.rks-gov.net/",
        ...CURRENT,
        kind: "service",
      },
      {
        id: "kosovo-consular-help",
        title: "Find visa and consular information",
        summary:
          "Rules depend on nationality and purpose of travel. Confirm the latest position with the responsible Kosovo mission before departure.",
        sourceName: "Kosovo Ministry of Foreign Affairs and Diaspora",
        sourceUrl: "https://mfa-ks.net/en/",
        ...CURRENT,
        critical: true,
        kind: "legal",
      },
    ],
  },
  {
    id: "money",
    eyebrow: "Receipt 03",
    title: "Money and banking",
    titleSq: "Para & banka",
    summary: "Use regulated providers, understand fees before confirming, and know when cash must be declared.",
    artifact: "bank-receipt",
    resources: [
      {
        id: "licensed-financial-institutions",
        title: "Check whether a financial provider is licensed",
        summary:
          "Before opening an account or exchanging money, look for the provider in the Central Bank's current register.",
        sourceName: "Central Bank of the Republic of Kosovo (CBK)",
        sourceUrl: "https://bqk-kos.org/mbikeqyrja-financiare/institucionet-financiare-te-licencuara-2/?lang=en",
        ...CURRENT,
        kind: "money",
      },
      {
        id: "atm-card-fees",
        title: "Pause before accepting an ATM or card conversion",
        summary:
          "Your bank, card network or ATM operator may add fees or conversion. Review the amount and currency shown before confirming.",
        sourceName: "Central Bank of the Republic of Kosovo (CBK)",
        sourceUrl: "https://bqk-kos.org/?lang=en",
        ...CURRENT,
        kind: "money",
      },
      {
        id: "cash-declaration",
        title: "Declare cash and monetary instruments when required",
        summary:
          "Kosovo Customs says travellers carrying EUR 10,000 or more, or the foreign-currency equivalent, must make a written declaration. Check the full rule before crossing.",
        sourceName: "Kosovo Customs",
        sourceUrl: "https://dogana.rks-gov.net/Individs/Index?individId=1077",
        ...CURRENT,
        critical: true,
        kind: "legal",
      },
    ],
  },
  {
    id: "health",
    eyebrow: "Care ticket 04",
    title: "Health",
    titleSq: "Shëndetësi",
    summary: "Reach emergency help quickly, then use official directories to find the appropriate level of care.",
    artifact: "health-ticket",
    resources: [
      {
        id: "health-emergency-112",
        title: "For an emergency, call 112",
        summary:
          "112 is Kosovo's free unified emergency number. 383 provides the call shortcut but does not dispatch, diagnose or rescue.",
        sourceName: "Kosovo Emergency Management Agency",
        sourceUrl: "https://ame.rks-gov.net/page/en-us/centers",
        ...CURRENT,
        critical: true,
        kind: "health",
      },
      {
        id: "public-health-services",
        title: "Find public health-service information",
        summary:
          "Use the Ministry directory to identify the responsible public institution. Call ahead when possible; availability and referral rules can change.",
        sourceName: "Kosovo Ministry of Health",
        sourceUrl: "https://msh.rks-gov.net/Department/Index/1?type=1",
        ...CURRENT,
        critical: true,
        kind: "health",
      },
      {
        id: "travel-health-preparation",
        title: "Carry insurance, medicines and their documents",
        summary:
          "Arrange suitable travel cover and enough prescribed medicine before departure. Seek a qualified clinician for personal medical advice.",
        sourceName: "Australian Government: Smartraveller Kosovo advice",
        sourceUrl: "https://www.smartraveller.gov.au/destinations/europe/kosovo#health",
        ...CURRENT,
        critical: true,
        kind: "health",
      },
    ],
  },
  {
    id: "things-to-do",
    eyebrow: "Pocket guide 05",
    title: "Things to do in Kosovo",
    titleSq: "Çfarë të bëj në Kosovë",
    summary: "Use official place guidance as a starting point and confirm times, access and weather on the day.",
    artifact: "city-pocket-guide",
    resources: [
      {
        id: "nature-route",
        title: "Build a nature route",
        summary:
          "Kosovo's tourism strategy identifies mountain, lake, waterfall and cave regions. Use marked routes and verify local weather and access first.",
        sourceName: "Government of Kosovo: Tourism Strategy 2024-2030",
        sourceUrl: "https://kryeministri.rks-gov.net/wp-content/uploads/2024/07/Tourism-Strategy-2024-2030.pdf",
        ...CURRENT,
        kind: "discovery",
      },
      {
        id: "prizren-culture",
        title: "Add a Prizren culture stop",
        summary:
          "Use municipal announcements to discover local culture, then confirm date, accessibility and organiser details before setting out.",
        sourceName: "Municipality of Prizren: Tourism and Economic Development",
        sourceUrl:
          "https://prizren.rks-gov.net/news/prizreni-pasuron-kalendarin-kulturor-me-festivalin-nderkombetar-te-kampingut-ne-vermice/",
        ...CURRENT,
        kind: "discovery",
      },
      {
        id: "live-events-calendar",
        title: "The 383 events list may be out of date",
        summary:
          "A verified live events feed is not connected. Treat saved listings as a lead only and confirm the date and entry terms with the official organiser.",
        sourceName: "Municipality of Prishtina: Culture",
        sourceUrl: "https://prishtina.rks-gov.net/kulture-subvencionet/",
        checkedAt: VISIT_DATA_CHECKED_AT,
        status: "stale",
        kind: "discovery",
      },
    ],
  },
  {
    id: "buy-invest",
    eyebrow: "Dossier 06",
    title: "Buy or invest in Kosovo",
    titleSq: "Blej / investoj në Kosovë",
    summary: "Verify the asset, registry and professional advice before transferring money or signing anything.",
    artifact: "property-dossier",
    resources: [
      {
        id: "property-register",
        title: "Verify property through the cadastral system",
        summary:
          "Ask for current cadastral evidence and verify the competent municipal office. An advert, scan or seller statement is not proof of title.",
        sourceName: "Kosovo Cadastral Agency",
        sourceUrl: "https://akk.rks-gov.net/en",
        ...CURRENT,
        critical: true,
        kind: "property",
      },
      {
        id: "business-registration",
        title: "Use the official business-registration system",
        summary:
          "Check the legal form, owners and filing requirements before applying. Use independent legal and tax advice for your circumstances.",
        sourceName: "Kosovo Business Registration Agency (ARBK)",
        sourceUrl: "https://rbk.rks-gov.net/Account/?lang=en-US",
        ...CURRENT,
        critical: true,
        kind: "legal",
      },
      {
        id: "investment-support",
        title: "Start with Kosovo's investment contact point",
        summary:
          "Use the state contact point to understand official support, then independently verify costs, incentives, partners and professional advisers.",
        sourceName: "Kosovo Contact Point on Services: KIESA",
        sourceUrl: "https://cps.rks-gov.net/start-a-business/kosovo-investment-and-enterprise-support-agency/",
        ...CURRENT,
        kind: "investment",
      },
    ],
  },
] as const satisfies readonly VisitSection[];

const CURRENT_ALBANIA = {
  checkedAt: ALBANIA_DATA_CHECKED_AT,
  status: "current",
} as const;

export const ALBANIA_VISIT_SECTIONS = [
  {
    id: "travel",
    eyebrow: "Checkpoint 01",
    title: "Travel and border",
    titleSq: "Udhëtimi dhe kufiri",
    summary: "Check entry, vehicle and insurance requirements at the Albanian authority before you reach the border.",
    artifact: "checkpoint-file",
    resources: [
      {
        id: "albania-border-flow",
        title: "Border waits are not live in 383",
        summary:
          "No stable official wait-time feed is connected. Check current State Police notices and allow extra time rather than relying on an old estimate.",
        sourceName: "Albanian State Police",
        sourceUrl: "https://asp.gov.al/",
        checkedAt: ALBANIA_DATA_CHECKED_AT,
        status: "unavailable",
        critical: true,
        kind: "border",
      },
      {
        id: "albania-vehicle-border-insurance",
        title: "Verify Green Card or border insurance before entry",
        summary:
          "A foreign-plated vehicle needs a Green Card valid in Albania, valid border insurance, or another accepted proof under an agreement. Buy only from an authorised seller.",
        sourceName: "Albanian Financial Supervisory Authority (AFSA)",
        sourceUrl: "https://amf.gov.al/mtpl.asp?lang=1",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "insurance",
        eligibility: "check_required",
      },
      {
        id: "albania-foreign-vehicle-temporary-admission",
        title: "Check the temporary-admission rules for a foreign vehicle",
        summary:
          "Non-resident visitors may use a permanently foreign-registered private vehicle under stated conditions. Read the official time limit and who may drive it.",
        sourceName: "Albanian General Directorate of Customs",
        sourceUrl: "https://dogana.gov.al/english/c/179/customs-clearance-of-vehicles",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "border",
      },
    ],
  },
  {
    id: "documents",
    eyebrow: "Folder 02",
    title: "Documents and services",
    titleSq: "Dokumente & shërbime",
    summary: "Confirm the rule for your nationality, then use only the Albanian government's official application channels.",
    artifact: "consular-folder",
    resources: [
      {
        id: "albania-visa-regime",
        title: "Check Albania's visa regime for your nationality",
        summary:
          "Entry rules depend on nationality, travel document and existing visas or residence permits. Read the current Albanian rule before departure.",
        sourceName: "Albanian Ministry for Europe and Foreign Affairs",
        sourceUrl: "https://punetejashtme.gov.al/en/regjimi-i-vizave-per-te-huajt/",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "legal",
      },
      {
        id: "albania-official-evisa",
        title: "Use only Albania's official e-Visa service",
        summary:
          "The foreign ministry warns about lookalike visa sites. If an application is required, start only from the official e-Visa domain.",
        sourceName: "Albanian Ministry for Europe and Foreign Affairs: e-Visa",
        sourceUrl: "https://e-visa.al/",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "service",
      },
      {
        id: "albania-e-services",
        title: "Open Albanian government e-services",
        summary:
          "Eligibility varies by service. Read the requirements and enter personal information only on the official e-Albania portal.",
        sourceName: "e-Albania, Government of Albania",
        sourceUrl: "https://e-albania.al/",
        ...CURRENT_ALBANIA,
        kind: "service",
      },
    ],
  },
  {
    id: "money",
    eyebrow: "Receipt 03",
    title: "Money and banking",
    titleSq: "Para & banka",
    summary: "Use licensed institutions, compare the amount shown before paying, and declare cash when the threshold applies.",
    artifact: "bank-receipt",
    resources: [
      {
        id: "albania-licensed-banks",
        title: "Check whether a bank is licensed",
        summary:
          "Use the Bank of Albania's current list before opening an account, transferring money or trusting a provider with funds.",
        sourceName: "Bank of Albania",
        sourceUrl: "https://www.bankofalbania.org/Supervision/Licensed_institutions/Banks/",
        ...CURRENT_ALBANIA,
        kind: "money",
      },
      {
        id: "albania-licensed-exchange-bureaus",
        title: "Use a licensed foreign-exchange bureau",
        summary:
          "Check the licensed and revoked lists, then confirm the rate, currency and fee before handing over cash.",
        sourceName: "Bank of Albania",
        sourceUrl: "https://www.bankofalbania.org/Supervision/Licensed_institutions/Foreign_Exchange_Bureaus/",
        ...CURRENT_ALBANIA,
        kind: "money",
      },
      {
        id: "albania-cash-declaration",
        title: "Declare EUR 10,000 or more when required",
        summary:
          "Albanian Customs requires travellers entering or leaving with EUR 10,000 or more, or its equivalent, to declare it and provide supporting documents.",
        sourceName: "Albanian General Directorate of Customs",
        sourceUrl: "https://dogana.gov.al/english/c/168/174/195/cash-declaration",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "legal",
      },
    ],
  },
  {
    id: "health",
    eyebrow: "Care ticket 04",
    title: "Health",
    titleSq: "Shëndetësi",
    summary: "Keep the correct emergency numbers close and arrange suitable health cover and medicines before travelling.",
    artifact: "health-ticket",
    resources: [
      {
        id: "albania-emergency-numbers",
        title: "For urgent help, call 112 or the service number",
        summary:
          "112 reaches emergency help. Albania also publishes 127 for medical emergencies, 128 for fire and 129 for State Police.",
        sourceName: "Albanian National Tourism Agency: emergency services",
        sourceUrl: "https://akt.gov.al/en/contact/",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "health",
      },
      {
        id: "albania-medical-emergency-127",
        title: "Call 127 for a medical emergency",
        summary:
          "The Ministry of Health identifies 127 as the single number for medical emergencies. 383 provides a shortcut and does not diagnose or dispatch.",
        sourceName: "Albanian Ministry of Health and Social Welfare",
        sourceUrl: "https://shendetesia.gov.al/urgjenca/",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "health",
      },
      {
        id: "albania-travel-health-preparation",
        title: "Arrange cover, medicines and a care plan before travel",
        summary:
          "Carry appropriate travel insurance and enough prescribed medicine. Ask a qualified clinician for advice specific to your health.",
        sourceName: "UK Government: Albania health advice",
        sourceUrl: "https://www.gov.uk/foreign-travel-advice/albania/health",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "health",
      },
    ],
  },
  {
    id: "things-to-do",
    eyebrow: "Pocket guide 05",
    title: "Things to do in Albania",
    titleSq: "Çfarë të bëj në Shqipëri",
    summary: "Start with the official tourism service, then confirm access, weather, opening times and event dates on the day.",
    artifact: "city-pocket-guide",
    resources: [
      {
        id: "albania-official-tourism",
        title: "Explore Albania's official destination guide",
        summary:
          "Use the National Tourism Agency's destination and interactive-map guidance to plan a route, then verify local access and conditions.",
        sourceName: "Albanian National Tourism Agency",
        sourceUrl: "https://akt.gov.al/en/",
        ...CURRENT_ALBANIA,
        kind: "discovery",
      },
      {
        id: "albania-tourism-map",
        title: "Keep the official tourism map with your route",
        summary:
          "The official map is a planning aid, not live navigation. Check road, trail and weather conditions before setting out.",
        sourceName: "Albanian National Tourism Agency",
        sourceUrl: "https://akt.gov.al/wp-content/uploads/2025/11/05-1-Harta-Turistike-anglisht_compressed.pdf",
        ...CURRENT_ALBANIA,
        kind: "discovery",
      },
      {
        id: "albania-events-calendar",
        title: "Confirm every event date with the organiser",
        summary:
          "The official tourism archive is useful for discovery, but recurring-event pages may not show a current date. Confirm before travelling.",
        sourceName: "Albanian National Tourism Agency: events",
        sourceUrl: "https://akt.gov.al/en/kategori-eventi/evente/",
        checkedAt: ALBANIA_DATA_CHECKED_AT,
        status: "stale",
        kind: "discovery",
      },
    ],
  },
  {
    id: "buy-invest",
    eyebrow: "Dossier 06",
    title: "Buy or invest in Albania",
    titleSq: "Blej / investoj në Shqipëri",
    summary: "Verify the property, business and adviser independently before transferring funds or signing a contract.",
    artifact: "property-dossier",
    resources: [
      {
        id: "albania-cadastral-services",
        title: "Verify property through the State Cadastre",
        summary:
          "Official cadastral information requires a lawful interest and the correct e-Albania service. An advert or seller-provided scan is not proof of title.",
        sourceName: "Albanian State Cadastre Agency (ASHK)",
        sourceUrl: "https://www.ashk.gov.al/programi-i-transparences/",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "property",
      },
      {
        id: "albania-business-register",
        title: "Search the official Business Register",
        summary:
          "Check a business by name or NIPT and review its legal status and registered details before relying on a counterparty.",
        sourceName: "Albanian National Business Center (QKB)",
        sourceUrl: "https://qkb.gov.al/en/business-register/",
        ...CURRENT_ALBANIA,
        critical: true,
        kind: "legal",
      },
      {
        id: "albania-investment-support",
        title: "Start with Albania's official investment contact point",
        summary:
          "Use AIDA for official investment support, then independently verify incentives, partners, property and professional advice.",
        sourceName: "Albanian Investment Development Agency (AIDA)",
        sourceUrl: "https://aida.gov.al/",
        ...CURRENT_ALBANIA,
        kind: "investment",
      },
    ],
  },
] as const satisfies readonly VisitSection[];

export const EMERGENCY_CONTACTS = [
  {
    id: "emergency-112",
    title: "Unified emergency",
    summary: "Call for urgent police, fire/rescue or medical help. 383 does not dispatch emergency services.",
    number: "112",
    callHref: "tel:112",
    sourceName: "Kosovo Emergency Management Agency",
    sourceUrl: "https://ame.rks-gov.net/page/en-us/centers",
    ...CURRENT,
    critical: true,
    kind: "health",
  },
  {
    id: "police-192",
    title: "Kosovo Police",
    summary: "Use 192 to contact Kosovo Police. Use 112 when you need the unified emergency operator.",
    number: "192",
    callHref: "tel:192",
    sourceName: "Kosovo Police",
    sourceUrl: "https://www.kosovopolice.com/en/contact/",
    ...CURRENT,
    critical: true,
    kind: "legal",
  },
  {
    id: "fire-193",
    title: "Fire and rescue",
    summary: "Use 193 for fire and rescue; if uncertain which service you need, call the unified number 112.",
    number: "193",
    callHref: "tel:193",
    sourceName: "Kosovo Emergency Management Agency",
    sourceUrl: "https://ame.rks-gov.net/post/en-us/88/communication-for-the-public",
    ...CURRENT,
    critical: true,
    kind: "health",
  },
  {
    id: "medical-194",
    title: "Medical emergency",
    summary: "Use 194 for a medical emergency; if uncertain which service you need, call the unified number 112.",
    number: "194",
    callHref: "tel:194",
    sourceName: "Kosovo Emergency Management Agency",
    sourceUrl: "https://ame.rks-gov.net/post/en-us/88/communication-for-the-public",
    ...CURRENT,
    critical: true,
    kind: "health",
  },
] as const satisfies readonly EmergencyContact[];

export const ALBANIA_EMERGENCY_CONTACTS = [
  {
    id: "albania-emergency-112",
    title: "Unified emergency",
    summary: "Call 112 for urgent help in Albania. 383 provides the shortcut and does not dispatch emergency services.",
    number: "112",
    callHref: "tel:112",
    sourceName: "Albanian State Police",
    sourceUrl: "https://asp.gov.al/raporti-i-ngjarjeve-08-01-2026/",
    ...CURRENT_ALBANIA,
    critical: true,
    kind: "health",
  },
  {
    id: "albania-medical-127",
    title: "Medical emergency",
    summary: "Use 127 for a medical emergency in Albania. Use 112 when you need the unified emergency route.",
    number: "127",
    callHref: "tel:127",
    sourceName: "Albanian Ministry of Health and Social Welfare",
    sourceUrl: "https://shendetesia.gov.al/urgjenca/",
    ...CURRENT_ALBANIA,
    critical: true,
    kind: "health",
  },
  {
    id: "albania-fire-128",
    title: "Fire and rescue",
    summary: "Use 128 for fire and rescue in Albania. If uncertain which service is needed, call 112.",
    number: "128",
    callHref: "tel:128",
    sourceName: "Albanian National Civil Protection Agency",
    sourceUrl: "https://akmc.gov.al/wp-content/uploads/2025/11/Guide-book-ANG.pdf",
    ...CURRENT_ALBANIA,
    critical: true,
    kind: "health",
  },
  {
    id: "albania-police-129",
    title: "State Police",
    summary: "Use 129 for the Albanian State Police. Use 112 for the unified emergency route.",
    number: "129",
    callHref: "tel:129",
    sourceName: "Albanian State Police",
    sourceUrl: "https://asp.gov.al/apel-per-me-shume-kujdes/",
    ...CURRENT_ALBANIA,
    critical: true,
    kind: "legal",
  },
] as const satisfies readonly EmergencyContact[];

export const TRAVEL_OPTIONS = {
  destinations: [
    {
      value: "kosovo",
      label: "Kosovo",
      labelSq: "Kosovë",
      description: "Guidance for arrival and a stay in Kosovo.",
    },
    {
      value: "albania",
      label: "Albania",
      labelSq: "Shqipëri",
      description: "Country-specific guidance from Albanian authorities.",
    },
    {
      value: "kosovo-albania",
      label: "Kosovo + Albania",
      labelSq: "Kosovë + Shqipëri",
      description: "A two-country route; requirements must be checked separately for each border.",
    },
  ],
  arrivals: [
    { value: "car", label: "Driving", labelSq: "Me veturë" },
    { value: "plane", label: "Flying", labelSq: "Me aeroplan" },
    { value: "bus", label: "Bus or coach", labelSq: "Me autobus" },
    { value: "other", label: "Other", labelSq: "Tjetër" },
  ],
  plateCountries: [
    {
      value: "XK",
      countryCode: "XK",
      label: "Kosovo",
      labelSq: "Kosovë",
      group: "local",
      insuranceEligibility: "not_applicable",
    },
    {
      value: "AL",
      countryCode: "AL",
      label: "Albania",
      labelSq: "Shqipëri",
      group: "neighbour",
      insuranceEligibility: "check_required",
    },
    {
      value: "DE",
      countryCode: "DE",
      label: "Germany",
      labelSq: "Gjermani",
      group: "diaspora",
      insuranceEligibility: "check_required",
    },
    {
      value: "CH",
      countryCode: "CH",
      label: "Switzerland",
      labelSq: "Zvicër",
      group: "diaspora",
      insuranceEligibility: "check_required",
    },
    {
      value: "IT",
      countryCode: "IT",
      label: "Italy",
      labelSq: "Itali",
      group: "diaspora",
      insuranceEligibility: "check_required",
    },
    {
      value: "GB",
      countryCode: "GB",
      label: "United Kingdom",
      labelSq: "Britani e Madhe",
      group: "diaspora",
      insuranceEligibility: "check_required",
    },
    {
      value: "AT",
      countryCode: "AT",
      label: "Austria",
      labelSq: "Austri",
      group: "diaspora",
      insuranceEligibility: "check_required",
    },
    {
      value: "SE",
      countryCode: "SE",
      label: "Sweden",
      labelSq: "Suedi",
      group: "diaspora",
      insuranceEligibility: "check_required",
    },
    {
      value: "US",
      countryCode: "US",
      label: "United States",
      labelSq: "Shtetet e Bashkuara",
      group: "diaspora",
      insuranceEligibility: "check_required",
    },
    {
      value: "OTHER",
      countryCode: "OTHER",
      label: "Another plate country",
      labelSq: "Një shtet tjetër",
      group: "other",
      insuranceEligibility: "check_required",
    },
  ],
  languages: [
    { value: "en", label: "English", labelSq: "Anglisht", nativeLabel: "English", isDefault: true },
    { value: "sq", label: "Albanian", labelSq: "Shqip", nativeLabel: "Shqip" },
    { value: "de", label: "German", labelSq: "Gjermanisht", nativeLabel: "Deutsch" },
    { value: "fr", label: "French", labelSq: "Frëngjisht", nativeLabel: "Français" },
    { value: "it", label: "Italian", labelSq: "Italisht", nativeLabel: "Italiano" },
    { value: "sv", label: "Swedish", labelSq: "Suedisht", nativeLabel: "Svenska" },
    { value: "tr", label: "Turkish", labelSq: "Turqisht", nativeLabel: "Türkçe" },
    { value: "sr", label: "Serbian", labelSq: "Serbisht", nativeLabel: "Srpski" },
  ],
} as const satisfies TravelOptions;

export const VISIT_INFORMATION_NOTICE = {
  title: "Information, not emergency, legal or medical advice",
  body:
    "383 shortens the route to official help. It does not diagnose, dispatch emergency services, provide legal advice or guarantee that a service is available. In an emergency in Kosovo or Albania, call 112.",
  locationPolicy:
    "Location is optional and should remain on this device unless the visitor explicitly chooses to share it.",
  privacyPolicy:
    "Destination, arrival method and plate country are used only to personalise the travel card and should not be transmitted by the first release.",
  reviewedAt: ALBANIA_DATA_CHECKED_AT,
} as const;
