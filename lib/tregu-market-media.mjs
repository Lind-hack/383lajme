function plain(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function safeImageUrl(value) {
  const url = String(value ?? "").trim();
  return /^https:\/\/[^\s<>"']+$/i.test(url) ? url : null;
}

const CURATED_SUBJECT_IMAGES = [
  {
    matches: (value) => /shtepia e bardhe.*rezerv|rezerv.*dizel/.test(value),
    file: "Rotterdam-Botlek,_opslagtranks_van_Esso_raffinaderij_IMG_2525_2022-07-11_12.59.jpg",
    alt: "Rezervuarë nafte në rafinerinë e Roterdamit",
    credit: "Michielverbeek · CC BY-SA 4.0",
  },
  {
    matches: (value) => /kuvendi i kosoves.*president/.test(value),
    file: "Parliament_of_the_Republic_of_Kosovo.jpg",
    alt: "Ndërtesa e Kuvendit të Republikës së Kosovës",
    credit: "Arianit · CC BY-SA 4.0",
  },
  {
    matches: (value) => /kongresi i spanjes.*debim/.test(value),
    file: "Congreso_de_los_Diputados_-_Madrid_02.jpg",
    alt: "Ndërtesa e Kongresit të Deputetëve në Madrid",
    credit: "Javier Perez Montes · CC BY-SA 4.0",
  },
  {
    matches: (value) => /zgjedhjet serbe.*sns|sns.*zgjedhjet serbe/.test(value),
    file: "SNS_parliamentary_group_in_2024_(cropped).jpg",
    alt: "Grupi parlamentar i SNS-së në Serbi",
    credit: "S. Miljuš / Voice of America · Public domain",
  },
  {
    matches: (value) => /hormuz/.test(value),
    file: "US_Navy_111009-N-DU438-097_he_aircraft_carrier_USS_George_H.W._Bush_(CVN_77)_transits_through_the_Strait_of_Hormuz.jpg",
    alt: "Anije amerikane duke kaluar Ngushticën e Hormuzit",
    credit: "U.S. Navy / Betsy Knapper · Public domain",
  },
  {
    matches: (value) => /tanker|cisterne saudite/.test(value),
    file: "Product_terminal_at_Preemraff_Lysekil_with_tankers.jpg",
    alt: "Anije cisternë pranë një terminali nafte",
    credit: "W.carter · CC BY-SA 4.0",
  },
  {
    matches: (value) => /zjarr.*(?:france|spanje|madrid|paris)|evakuim.*(?:france|spanje|madrid)/.test(value),
    file: "A_wildfire_affected_Pyrénées-Orientales_in_France.jpg",
    alt: "Pamje satelitore e zjarrit në jug të Francës",
    credit: "European Union / Copernicus Sentinel-2 · Attribution",
  },
  {
    matches: (value) => /kfor|paqeruajtesit moldave/.test(value),
    file: "KFOR_Soldiers_respond_to_protests_in_Kosovo_(7837495).jpg",
    alt: "Ushtarë të KFOR-it në Kosovë",
    credit: "U.S. Army / Anna Pongo · Public domain",
  },
  {
    matches: (value) => /iber|ibrit/.test(value),
    file: "Ibar_Bridge_in_Mitrovica,_Kosovo_00_59_11_140000.jpeg",
    alt: "Ura mbi lumin Ibër në Mitrovicë",
    credit: "GentiBehramaj · CC BY-SA 4.0",
  },
  {
    matches: (value) => /shqiperia.*(?:kapituj|negociat)|gjobat e be-se|gjobat e be|zyres se be-se/.test(value),
    file: "Belgique_-_Bruxelles_-_Schuman_-_Berlaymont_-_01.jpg",
    alt: "Ndërtesa Berlaymont e Komisionit Evropian në Bruksel",
    credit: "EmDee · CC BY-SA 4.0",
  },
  {
    matches: (value) => /parlamenti hungarez/.test(value),
    file: "HUN-2015-Budapest-Hungarian_Parliament_(Budapest)_2015-02.jpg",
    alt: "Ndërtesa e Parlamentit të Hungarisë në Budapest",
    credit: "Godot13 · CC BY-SA 4.0",
  },
  {
    matches: (value) => /bitcoin/.test(value),
    file: "Bitcoin_BTC_golden_coin_with_the_symbol.jpg",
    alt: "Monedhë fizike me simbolin e Bitcoin",
    credit: "Satheesh Sankaran · CC BY-SA 2.0",
  },
  {
    matches: (value) => /icloud/.test(value),
    file: "Cloud_White_iPhone_Air.jpg",
    alt: "Telefon iPhone pranë një sfondi me re",
    credit: "Ahmad Ali Karim · CC0",
  },
  {
    matches: (value) => /koreja e veriut|korene e jugut/.test(value),
    file: "The_well-lit_border_between_South_Korea_and_the_less-illuminated_North_Korea_(iss073e0824280).jpg",
    alt: "Kufiri mes dy Koreve i fotografuar nga hapësira",
    credit: "NASA / Kimiya Yui · Public domain",
  },
  {
    matches: (value) => /bisedim.*iran|teherani.*bisedim/.test(value),
    file: "Tehran_in_a_clean_day.jpg",
    alt: "Pamje panoramike e Teheranit",
    credit: "Amir Pashaei · CC BY-SA 4.0",
  },
  {
    matches: (value) => /centraleve iraniane|sulm.*iranit|goditje.*iraniane/.test(value),
    file: "Israeli_Airstrikes_on_the_Natanz_Nuclear_Facility_during_Operation_Rising_Lion.png",
    alt: "Pamje satelitore e kompleksit bërthamor të Natanzit në Iran",
    credit: "WeatherWriter · CC BY-SA 2.0",
  },
  {
    matches: (value) => /sec.*crypto/.test(value),
    file: "U.S._Securities_and_Exchange_Commission_headquarters.JPG",
    alt: "Selia e Komisionit amerikan të Letrave me Vlerë",
    credit: "AgnosticPreachersKid · CC BY-SA 3.0",
  },
  {
    matches: (value) => /hmeimim|tartus/.test(value),
    file: "Vladimir_Putin_in_Khmeimim_Air_Base_in_Syria_(2017-12-11)_01.jpg",
    alt: "Baza ajrore Khmeimim në Siri",
    credit: "Press Service of the President of Russia · CC BY 4.0",
  },
  {
    matches: (value) => /cmimeve te karburantit/.test(value),
    file: "Old_Gas_Station_Hamburg_Grindel.jpg",
    alt: "Pompë karburanti në një pikë furnizimi",
    credit: "Capecross · CC BY-SA 4.0",
  },
  {
    matches: (value) => /naften e kirkukut/.test(value),
    file: "Product_terminal_at_Preemraff_Lysekil_with_tankers.jpg",
    alt: "Terminal nafte me anije cisternë",
    credit: "W.carter · CC BY-SA 4.0",
  },
  {
    matches: (value) => /robotet humanoide/.test(value),
    file: "Sophia_humanoid_robot_-_Word_Investment_Forum_2018_(45450217992).jpg",
    alt: "Robot humanoid në një forum ndërkombëtar",
    credit: "UNCTAD · CC BY-SA 2.0",
  },
  {
    matches: (value) => /kadrijaj.*kuvendi/.test(value),
    file: "Parliament_of_the_Republic_of_Kosovo.jpg",
    alt: "Ndërtesa e Kuvendit të Kosovës",
    credit: "Arianit · CC BY-SA 4.0",
  },
  {
    matches: (value) => /uss washington|uss lincoln/.test(value),
    file: "USS_George_Washington_(CVN-73)_underway_in_September_2015.JPG",
    alt: "Aeroplanmbajtësja USS George Washington në det",
    credit: "U.S. Navy / Paul Archer · Public domain",
  },
  {
    matches: (value) => /trump.*vaksinat/.test(value),
    file: "COVID-19_vaccine_vial_(2024).jpg",
    alt: "Flakon vaksine",
    credit: "Whispyhistory · CC0",
  },
  {
    matches: (value) => /kurti.*abdixhiku/.test(value),
    file: "Albin_Kurti_2024.jpg",
    alt: "Albin Kurti gjatë vizitës në Komisionin Evropian",
    credit: "Xavier Lejeune / European Union · CC BY 4.0",
  },
  {
    matches: (value) => /kushner.*hamas.*egjipt/.test(value),
    file: "Ministry_of_Foreign_Affairs_of_Egypt,_Cairo.JPG",
    alt: "Ndërtesa e Ministrisë së Jashtme të Egjiptit në Kajro",
    credit: "Faris knight · CC BY-SA 3.0",
  },
  {
    matches: (value) => /izrael.*liban/.test(value),
    file: "Israel_Lebanon_Border.JPG",
    alt: "Kufiri mes Izraelit dhe Libanit",
    credit: "Johnny Zoo · CC BY-SA 3.0",
  },
  {
    matches: (value) => /burgun e fierit/.test(value),
    file: "Gjirokastër_Castle_Albania_-_Prison_cell.JPG",
    alt: "Qeli burgu historik në Shqipëri, fotografi ilustruese",
    credit: "Sietske2 · CC BY-SA 3.0",
  },
  {
    matches: (value) => /zjarri ne fabriken e gjakoves/.test(value),
    file: "Richmond_industrial_fire_240.jpg",
    alt: "Zjarr industrial, fotografi ilustruese nga një tjetër vend",
    credit: "28bytes · CC BY-SA 4.0",
  },
  {
    matches: (value) => /openai.*anthropic/.test(value),
    file: "Datacenter_Server_Racks_(22370909788).jpg",
    alt: "Rafte serverësh në një qendër të dhënash, fotografi ilustruese",
    credit: "Carl Lender · CC BY 2.0",
  },
  {
    matches: (value) => /armepushim.*rusise.*ukraines/.test(value),
    file: "A_damaged_building_in_Bucha_after_the_invasion_of_Russian_troops.jpg",
    alt: "Ndërtesë e dëmtuar nga lufta në Buça, Ukrainë",
    credit: "Kisnaak · CC BY-SA 4.0",
  },
  {
    matches: (value) => /vizave emigruese amerikane/.test(value),
    file: "United_States_Passport_Visa_Pages.jpg",
    alt: "Faqe vizash në një pasaportë amerikane, fotografi ilustruese",
    credit: "Tony Webster · CC BY 2.0",
  },
  {
    matches: (value) => /zvecan/.test(value),
    file: "Zvecan_42.jpg",
    alt: "Pamje e Zveçanit në Kosovë",
    credit: "Geograf208 · CC BY-SA 4.0",
  },
  {
    matches: (value) => /\balbin\s+kurti\b/.test(value),
    file: "Albin_Kurti_2024.jpg",
    alt: "Albin Kurti gjatë vizitës në Komisionin Evropian",
    credit: "Xavier Lejeune / European Union · CC BY 4.0",
  },
];

function curatedImage(subject) {
  const asset = CURATED_SUBJECT_IMAGES.find((item) => item.matches(plain(subject)));
  if (!asset) return null;
  const source = `https://commons.wikimedia.org/wiki/File:${asset.file}`;
  return {
    market_image_url: `https://commons.wikimedia.org/wiki/Special:FilePath/${asset.file}?width=1280`,
    market_image_alt: asset.alt,
    market_image_source_url: source,
    market_image_credit: asset.credit,
  };
}

/** Prefer an image attached to cited coverage that actually names the market subject. */
export function selectMarketIdentityImage(candidate, articles = [], usedUrls = new Set()) {
  const namedSubjects = [plain(candidate?.question), ...(candidate?.proposition?.entities ?? []).map(plain)];
  for (const subject of namedSubjects) {
    const curated = curatedImage(subject);
    if (curated && !usedUrls.has(curated.market_image_url)) {
      usedUrls.add(curated.market_image_url);
      return curated;
    }
  }
  const slugs = new Set((candidate?.source_slugs ?? []).map(String));
  const entities = (candidate?.proposition?.entities ?? [])
    .map(plain)
    .filter((entity) => entity.length >= 5 && !["kosovo", "shqiperi", "government", "qeveria"].includes(entity));
  const selected = (articles ?? []).find((article) => {
    const image = safeImageUrl(article?.imageUrl ?? article?.image_url);
    const sourcePage = safeImageUrl(article?.url);
    const title = plain(article?.title);
    return slugs.has(String(article?.slug)) && image?.startsWith("https://") && sourcePage?.startsWith("https://") && !usedUrls.has(image)
      && (entities.length === 0 || entities.some((entity) => title.includes(entity)) || slugs.size === 1);
  });
  if (!selected) return null;
  const imageUrl = safeImageUrl(selected.imageUrl ?? selected.image_url);
  usedUrls.add(imageUrl);
  return { market_image_url: imageUrl, market_image_alt: String(selected.title ?? candidate.question), market_image_source_url: safeImageUrl(selected.url), market_image_credit: null };
}

export function marketContext(market, article) {
  if (plain(market?.category) === "ekonomi") return "economy";
  const propositionGeography = plain(market?.pre_match_analysis?.news_geography ?? market?.pre_match_analysis?.proposition?.geography);
  if (propositionGeography === "albania" || propositionGeography === "shqiperi") return "albania";
  if (propositionGeography === "world" || propositionGeography === "bote") return "world";
  const category = plain(article?.category);
  if (/shqip|alban|tiran/.test(category)) return "albania";
  if (category.includes("bote") || category.includes("world") || category.includes("diaspor")) return "world";
  if (category.includes("ekonomi")) return "economy";
  if (/kosov|politik|siguri|shoqeri/.test(category)) return "kosovo";
  const marketCategory = plain(market?.category);
  if (marketCategory === "bote") return "world";
  if (marketCategory === "ekonomi") return "economy";
  return "kosovo";
}

/**
 * Resolve only editorial markets. Sport keeps its league, club and driver
 * identity instead of borrowing unrelated news photography.
 */
export function resolveMarketMedia(market, articles = []) {
  const category = plain(market?.category);
  const classification = plain(market?.market_classification);
  if (category === "sport" || classification.startsWith("live_")) return null;

  const curated = curatedImage(market?.question);
  const storedImage = safeImageUrl(market?.market_image_url);
  const identityImage = storedImage ?? curated?.market_image_url;
  if (identityImage) {
    const context = marketContext(market);
    return {
      src: identityImage, kind: "market_identity",
      context, articleSlug: null, title: String(market?.market_image_alt ?? curated?.market_image_alt ?? market?.question ?? ""),
      source: String(market?.market_image_source_url ?? curated?.market_image_source_url ?? ""), credit: String(market?.market_image_credit ?? curated?.market_image_credit ?? ""),
    };
  }

  const bySlug = new Map(
    (Array.isArray(articles) ? articles : [])
      .filter((article) => article?.slug)
      .map((article) => [String(article.slug), article])
  );
  const selected = (Array.isArray(market?.source_article_slugs) ? market.source_article_slugs : [])
    .map((slug) => bySlug.get(String(slug)))
    .find((article) => safeImageUrl(article?.image_url ?? article?.imageUrl) && safeImageUrl(article?.url));
  const context = marketContext(market, selected);
  const sourceSrc = safeImageUrl(selected?.image_url ?? selected?.imageUrl);
  if (!sourceSrc) return null;
  return {
    src: sourceSrc,
    kind: "source_article",
    context,
    articleSlug: selected?.slug ? String(selected.slug) : null,
    title: selected?.title ? String(selected.title) : null,
    source: selected?.url ? String(selected.url) : null, credit: null,
  };
}
