/**
 * Help near you, made trustworthy. OpenStreetMap lists every "hospital" —
 * including sports-medicine, dental and private clinics — and every "police"
 * entry, including headquarters and academies. A visitor in trouble needs the
 * emergency hospital and the police station, so:
 *
 *   - Kosovo's public emergency hospitals are listed here by hand, each point
 *     checked on OpenStreetMap by name on 2026-10-04, and always win over a
 *     clinic of the same distance;
 *   - map results are filtered and ranked by what they are, not just by
 *     how close they are (rankPlace);
 *   - distance is by road (OSRM), with the straight line only as a labelled
 *     fallback.
 */

export const EMERGENCY_CHECKED_AT = "2026-10-04";

/** Public hospitals with an emergency department, and Mitrovica's main family-medicine centre. */
export const HOSPITALS = [
  { name: "QKUK — Qendra Klinike Universitare e Kosovës", city: "Prishtinë", lat: 42.64421, lon: 21.16171, osm: "https://www.openstreetmap.org/way/281597843" },
  { name: "Spitali Rajonal i Prizrenit", city: "Prizren", lat: 42.20373, lon: 20.72984, osm: "https://www.openstreetmap.org/way/88189508" },
  { name: "Spitali Rajonal i Pejës", city: "Pejë", lat: 42.66219, lon: 20.27324, osm: "https://www.openstreetmap.org/way/463932915" },
  { name: "Spitali Rajonal “Isa Grezda”", city: "Gjakovë", lat: 42.36919, lon: 20.43004, osm: "https://www.openstreetmap.org/way/222060596" },
  { name: "Spitali Rajonal i Mitrovicës (veri)", city: "Mitrovicë", lat: 42.89288, lon: 20.86, osm: "https://www.openstreetmap.org/way/174504769" },
  { name: "QKMF Mitrovicë (jug)", city: "Mitrovicë", lat: 42.88863, lon: 20.86822, osm: "https://www.openstreetmap.org/relation/2221544" },
  { name: "Spitali Rajonal i Gjilanit", city: "Gjilan", lat: 42.45774, lon: 21.46258, osm: "https://www.openstreetmap.org/way/230660085" },
  { name: "Spitali i Ferizajt", city: "Ferizaj", lat: 42.37144, lon: 21.14604, osm: "https://www.openstreetmap.org/way/745687234" },
  { name: "Spitali i Vushtrrisë “Sheik Zahid”", city: "Vushtrri", lat: 42.82493, lon: 20.96454, osm: "https://www.openstreetmap.org/way/204309454" },
];

/** Names that are a "hospital" on the map but no help in an emergency. */
const NOT_EMERGENCY = /transfuz|gjak|blood|dializ|onkolog|psikiatr|neuropsik|geriatr|sport|stomatolog|dental|dentar|dentist|dhëmb|dhemb|fizio|rehabilit|veterin|optik|kozmet|estetik|laborator|radiolog|psikolog|farmaci|barnatore|dream|privat|poliklinik/i;
/** Police entries that are not where a visitor goes. */
const NOT_A_STATION = /drejtori|akademi|qendra e komunikimit|komunikim|logjistik|inspektorat|hetim|forcat speciale|njesia speciale|njësia speciale/i;

/**
 * How suitable a map entry is, lower is better, or null to drop it.
 * @param {"police" | "hospital" | "fuel"} kind
 * @param {Record<string, string>} tags
 */
export function rankPlace(kind, tags = {}) {
  const name = `${tags.name ?? ""} ${tags["name:sq"] ?? ""} ${tags["name:en"] ?? ""}`;
  if (kind === "hospital") {
    if (NOT_EMERGENCY.test(name)) return null;
    if (tags.emergency === "no") return null;
    // Only real hospitals from the map; family-medicine centres (QKMF) come
    // from the checked list, where each one was confirmed by hand.
    if (!/spital|hospital|qkuk|bolnica/i.test(name)) return null;
    return tags.emergency === "yes" ? 0 : 1;
  }
  if (kind === "police") {
    if (NOT_A_STATION.test(name)) return 4;
    if (/stacion|station|policor|policis|polici/i.test(name)) return 0;
    return 1;
  }
  return 0;
}

/** Straight-line kilometres. */
export function crowKm(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Choose the best place: among the best-ranked, the shortest drive.
 * `options` carry rank and (when routing worked) minutes; a place within one
 * rank step that is far quicker to reach still wins — a station 2 minutes
 * away beats a "better" one 25 minutes away.
 */
export function pickBest(options) {
  const usable = options.filter((o) => o.rank !== null);
  if (!usable.length) return null;
  const cost = (o) => (o.minutes ?? o.km * 1.6) + o.rank * 6;
  return [...usable].sort((a, b) => cost(a) - cost(b))[0];
}

/** Whether a Wikimedia file title names this place: a shared word of five letters or more. */
export function photoMatchesName(fileTitle, placeName) {
  const words = (v) =>
    new Set(
      String(v)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 5 && !/^(kosov|prishtin|pristin|spitali|rajonal|qendra|stacioni|policis)/.test(w))
    );
  const a = words(fileTitle);
  return [...words(placeName)].some((w) => a.has(w));
}
