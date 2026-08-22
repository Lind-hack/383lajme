"use client";

import {
  Ambulance,
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CarFront,
  Check,
  ChevronDown,
  CircleGauge,
  Clock3,
  Download,
  ExternalLink,
  Flame,
  Fuel,
  LocateFixed,
  MapPinned,
  Navigation,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import KosovoFieldMap from "./kosovo-field-map";
import {
  BORDER_CROSSINGS,
  EMERGENCY_NUMBERS,
  KOSOVO_CITIES,
  type BorderCrossingId,
  type BorderDirection,
  type CityId,
  type KosovoCity,
} from "@/lib/visit-v2-data";
import { track } from "@/lib/analytics";
import styles from "./visit-v2.module.css";

type WaitRange = { min: number; max: number };
type OfficialWait = {
  crossingId: BorderCrossingId;
  name: string;
  entry: WaitRange;
  exit: WaitRange;
  updatedAt: string | null;
  fetchedAt: string;
};
type CommunitySummary = { median: number; sampleSize: number; confidence: "low" | "medium" | "high" };
type BorderPayload = {
  official: OfficialWait[];
  community: Record<string, CommunitySummary>;
  generatedAt: string;
  error?: string;
};
type NearbyPlace = { name: string; latitude: number; longitude: number; distanceKm: number; openingHours: string | null };
type NearbyPayload = {
  nearest: Record<"police" | "hospital" | "fire_station" | "fuel", NearbyPlace | null>;
  fallbackSearches: Record<"police" | "hospital" | "fire_station" | "fuel", string>;
  degraded: boolean;
  attribution: string;
  note: string;
};
type BrowserLocation = { latitude: number; longitude: number; accuracy: number };

const MAPS = "https://www.google.com/maps/search/?api=1&query=";

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function downloadHtml(filename: string, title: string, content: string, variant: "utility" | "travel") {
  const identity = variant === "utility"
    ? `<header class="identity"><b>383</b><span>KARTA E KUFIRIT</span><em>LIVE • OFFLINE</em></header>`
    : `<header class="identity"><b>383</b><span>KOSOVA PËR TA PËRJETUAR</span><em>TRAVEL EDITION</em></header>`;
  const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;color:#171614;font:15px/1.5 Arial,sans-serif}body.utility{background:#23211d}body.travel{background:#f6d999}.sheet{width:min(900px,calc(100% - 24px));margin:24px auto;overflow:hidden}.identity{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px}.identity b{font-size:34px;line-height:1;letter-spacing:-.08em}.identity span,.identity em{font-size:10px;font-style:normal;font-weight:900;letter-spacing:.14em}.utility .sheet{position:relative;background:#f4f0e8;border:1px solid #45423b;box-shadow:0 24px 80px rgba(0,0,0,.28)}.utility .sheet:before{content:"";position:absolute;inset:0 auto 0 0;width:13px;background:#ff4422}.utility .identity{padding:20px 28px 18px 38px;background:#171614;color:#fff;border-bottom:8px solid #ff4422}.utility .identity b{color:#ff4422}.utility .identity em{color:#b9ffcc}.utility .content{padding:28px 36px 34px}.utility h1{margin:0;font-size:46px;line-height:.98;letter-spacing:-.05em;text-transform:uppercase}.utility h2{margin:28px 0 8px;padding-top:10px;border-top:2px solid #1e1c19;font-size:12px;letter-spacing:.13em;text-transform:uppercase}.utility .meta{margin:8px 0 0;color:#5c574f}.utility .row{padding:15px 0;border-bottom:1px solid #cfc8bd}.utility .row:after{content:"";display:block;clear:both}.utility .bar{height:12px;margin-top:9px;overflow:hidden;background:#d8d2c8}.utility .bar i{display:block;height:100%}.utility .emergency{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.utility .emergency b{padding:12px 10px;background:#9f211b;color:#fff;text-align:center}.travel .sheet{background:#fffaf0;border:1px solid rgba(83,54,17,.18);box-shadow:0 24px 80px rgba(91,54,9,.2)}.travel .identity{padding:18px 24px;background:#ff4422;color:#fff}.travel .identity em{color:#fff2b0}.travel .content{padding:30px}.travel section{position:relative;padding-bottom:26px}.travel h1{width:fit-content;margin:0;padding:5px 13px 8px;background:#171614;color:#fff;font-size:54px;line-height:1;letter-spacing:-.055em;transform:rotate(-1deg)}.travel h2{margin:24px 0 10px}.travel .meta{margin:15px 0 22px;color:#625947;font-size:17px;font-weight:700}.travel .place{display:grid;grid-template-columns:minmax(180px,36%) 1fr;gap:0;overflow:hidden;margin:14px 0;background:#fff;border:1px solid #ead9bd;box-shadow:7px 7px 0 #ffd46b}.travel .place:nth-of-type(even){box-shadow:7px 7px 0 #bce8d0}.travel .place img{width:100%;height:190px;object-fit:cover}.travel .place div{padding:20px}.travel .place h3{margin:0 0 5px;font-size:23px;letter-spacing:-.025em}.travel .place p{margin:5px 0;color:#5f594e}.travel .place a{display:inline-block;margin-top:12px;color:#d6381d;font-weight:900}.fine{margin:0;padding:16px 30px 22px;color:#6b655d;font-size:11px}.utility .fine{background:#e8e2d8}.travel .fine{background:#fff0ca}@media(max-width:600px){.identity{grid-template-columns:auto 1fr}.identity em{grid-column:2}.utility .content,.travel .content{padding:22px}.travel .place{grid-template-columns:1fr}.travel .place img{height:220px}.utility .emergency{grid-template-columns:1fr 1fr}}@media print{body{background:#fff!important}.sheet{width:100%;margin:0;box-shadow:none!important}}@page{margin:10mm}</style></head><body class="${variant}"><main class="sheet">${identity}<div class="content">${content}</div><p class="fine">Ruaje kartën për udhëtim. Pritjet dhe kushtet mund të ndryshojnë. Në emergjencë telefono 112.</p></main></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function rangeLabel(range: WaitRange) {
  return range.min === range.max ? `${range.min} min` : `${range.min}-${range.max} min`;
}

function waitLevel(minutes: number) {
  if (minutes >= 30) return "red";
  if (minutes >= 15) return "amber";
  return "green";
}

function WaitMeter({ minutes }: { minutes: number | null }) {
  const level = waitLevel(minutes ?? 0);
  const scale = minutes === null ? 0 : Math.max(.08, Math.min(1, minutes / 45));
  const style = { "--wait-scale": scale } as CSSProperties;
  return (
    <div className={styles.waitTrack} aria-label={minutes === null ? "Nuk ka të dhëna për pritjen" : `${minutes} minuta, niveli ${level}`}>
      <span key={minutes ?? "empty"} className={styles[`wait${level[0].toUpperCase()}${level.slice(1)}`]} style={style} />
    </div>
  );
}

function CityGuide({ city }: { city: KosovoCity }) {
  const headerStyle = { "--city-image": `url(${city.places[0].image})` } as CSSProperties;
  return (
    <article className={styles.cityGuide}>
      <header style={headerStyle}>
        <div className={styles.cityGuideBrand}><b>383</b><span>KARTA E QYTETIT</span></div>
        <div className={styles.cityGuideCopy}><span>{city.region}</span><h3>{city.name}</h3><p>{city.tagline}</p></div>
        <div className={styles.cityGuideMap} aria-hidden="true"><KosovoFieldMap compact /></div>
      </header>
      <div className={styles.placeGallery}>
        {city.places.map((place) => (
          <article className={styles.placeCard} key={place.name}>
            <img src={place.image} alt={place.imageAlt} loading="lazy" />
            <div>
              <span>{place.category}<small><Clock3 aria-hidden="true" size={12} />{place.visitHint}</small></span>
              <h4>{place.name}</h4>
              <p>{place.description}</p>
              <a href={`${MAPS}${encodeURIComponent(place.mapsQuery)}`} target="_blank" rel="noreferrer"><Navigation aria-hidden="true" size={15} />Hap drejtimet</a>
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}

function SavedCityCover({ city }: { city: KosovoCity }) {
  return (
    <article className={styles.savedCityCover}>
      <img src={city.places[0].image} alt={city.places[0].imageAlt} loading="lazy" />
      <b className={styles.savedCity383}>383</b>
      <div><span>{city.region}</span><h4>{city.name}</h4><p>{city.places.length} ndalesa me fotografi dhe drejtime</p></div>
    </article>
  );
}

async function imageAsDataUrl(path: string) {
  try {
    const response = await fetch(path);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return path;
  }
}

export default function VisitV2Experience() {
  const [mode, setMode] = useState<"border" | "city">("border");
  const [borderPayload, setBorderPayload] = useState<BorderPayload | null>(null);
  const [borderLoading, setBorderLoading] = useState(true);
  const [selectedCrossing, setSelectedCrossing] = useState<BorderCrossingId>("vermice-morine");
  const [direction, setDirection] = useState<BorderDirection>("entry");
  const [nearby, setNearby] = useState<NearbyPayload | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMinutes, setReportMinutes] = useState(15);
  const [reportMessage, setReportMessage] = useState("");
  const [reporting, setReporting] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityId>("prizren");

  /** Arriving from search with a city already chosen. Validated against the
   *  real list so a hand-edited URL cannot select a city that does not exist. */
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("qyteti");
    if (wanted && KOSOVO_CITIES.some((city) => city.id === wanted)) {
      setSelectedCity(wanted as CityId);
    }
  }, []);
  const [savedCities, setSavedCities] = useState<CityId[]>(["prizren"]);
  const [exportingCities, setExportingCities] = useState(false);

  const loadBorders = useCallback(async () => {
    try {
      const response = await fetch("/api/visit/borders", { cache: "no-store" });
      const payload = (await response.json()) as BorderPayload;
      setBorderPayload(payload);
    } catch {
      setBorderPayload({ official: [], community: {}, generatedAt: new Date().toISOString(), error: "Pritjet nuk mund të përditësohen tani." });
    } finally {
      setBorderLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBorders();
    const timer = window.setInterval(() => void loadBorders(), 600_000);
    return () => window.clearInterval(timer);
  }, [loadBorders]);

  const requestLocation = useCallback((fresh = false) => new Promise<BrowserLocation>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Shfletuesi nuk mbështet vendndodhjen."));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => reject(new Error("Leja e vendndodhjes nuk u dha. Aktivizoje nga cilësimet e shfletuesit.")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: fresh ? 0 : 60_000 },
    );
  }), []);

  const locateServices = async () => {
    if (locating) return;
    setLocating(true);
    setLocationMessage("Po kërkojmë shërbimet më të afërta...");
    try {
      const coordinates = await requestLocation();
      const response = await fetch(`/api/visit/nearby?lat=${coordinates.latitude}&lon=${coordinates.longitude}`, { cache: "no-store" });
      const payload = await response.json() as NearbyPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Shërbimi i hartës nuk u përgjigj.");
      setNearby(payload);
      setLocationMessage(payload.degraded ? "Lidhjet hapin kërkimin më të afërt në hartë." : "U gjetën shërbimet pranë teje. Vendndodhja nuk ruhet.");
    } catch (error) {
      setLocationMessage(String(error instanceof Error ? error.message : error));
    } finally {
      setLocating(false);
    }
  };

  const submitReport = async () => {
    setReporting(true);
    setReportMessage("Po kontrollojmë nëse je pranë pikës së zgjedhur...");
    try {
      const coordinates = await requestLocation(true);
      let deviceId = localStorage.getItem("visit-report-device");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("visit-report-device", deviceId);
      }
      const response = await fetch("/api/visit/borders/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crossingId: selectedCrossing, direction, waitMinutes: reportMinutes, ...coordinates, deviceId }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      setReportMessage(payload.message ?? payload.error ?? "Raporti nuk u ruajt.");
      if (response.ok) {
        track("visit_report_submitted", { crossingId: selectedCrossing, direction });
        await loadBorders();
      }
    } catch (error) {
      setReportMessage(String(error instanceof Error ? error.message : error));
    } finally {
      setReporting(false);
    }
  };

  const currentCity = KOSOVO_CITIES.find((city) => city.id === selectedCity) ?? KOSOVO_CITIES[1];
  const currentCrossing = BORDER_CROSSINGS.find((crossing) => crossing.id === selectedCrossing) ?? BORDER_CROSSINGS[0];
  const savedCityCards = savedCities.flatMap((id) => KOSOVO_CITIES.find((city) => city.id === id) ?? []);

  const exportUtility = () => {
    track("visit_card_download", { variant: "border" });
    const waits = BORDER_CROSSINGS.map((crossing) => {
      const current = borderPayload?.official.find((item) => item.crossingId === crossing.id);
      const range = direction === "entry" ? current?.entry : current?.exit;
      const minutes = range?.max ?? 0;
      return `<div class="row"><b>${escapeHtml(crossing.name)} - ${direction === "entry" ? "Hyrje" : "Dalje"}</b><span style="float:right">${range ? escapeHtml(rangeLabel(range)) : "Pa të dhëna"}</span><div class="bar"><i style="width:${Math.max(3, Math.min(100, minutes / 45 * 100))}%;background:${minutes >= 30 ? "#c8261a" : minutes >= 15 ? "#e7a317" : "#198754"}"></i></div></div>`;
    }).join("");
    const services = nearby ? Object.entries(nearby.nearest).map(([kind, place]) => `<div class="row"><b>${escapeHtml(kind)}</b> ${place ? `${escapeHtml(place.name)} - ${place.distanceKm.toFixed(1)} km` : `<a href="${escapeHtml(nearby.fallbackSearches[kind as keyof NearbyPayload["fallbackSearches"]])}">Hap kërkimin më të afërt</a>`}</div>`).join("") : "<div class=\"row\">Lejo vendndodhjen para shkarkimit për të shtuar shërbimet më të afërta.</div>";
    const emergency = EMERGENCY_NUMBERS.map((item) => `<b>${escapeHtml(item.label)} ${item.number}</b>`).join("");
    downloadHtml("383-karta-e-kufirit.html", "Karta e kufirit - 383", `<h1>${escapeHtml(currentCrossing.name)}<br>${direction === "entry" ? "Hyrje" : "Dalje"}</h1><p class="meta">Kosovë / ${escapeHtml(currentCrossing.country)} • Përditësim automatik çdo 10 minuta</p><h2>Pritjet e fundit</h2>${waits}<h2>Shërbimet më të afërta</h2>${services}<h2>Numrat e emergjencës</h2><div class="emergency">${emergency}</div>`, "utility");
  };

  const exportCities = async (cities: KosovoCity[]) => {
    setExportingCities(true);
    try {
      const sections = await Promise.all(cities.map(async (city) => {
        const places = await Promise.all(city.places.map(async (place) => `<article class="place"><img src="${escapeHtml(await imageAsDataUrl(place.image))}" alt="${escapeHtml(place.imageAlt)}"><div><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(place.category)} - ${escapeHtml(place.visitHint)}</p><p>${escapeHtml(place.description)}</p><a href="${MAPS}${encodeURIComponent(place.mapsQuery)}">Hap drejtimet në Google Maps</a></div></article>`));
        return `<section style="page-break-after:always"><h1>${escapeHtml(city.name)}</h1><p class="meta">${escapeHtml(city.tagline)} • ${escapeHtml(city.region)}</p>${places.join("")}</section>`;
      }));
      downloadHtml(cities.length > 1 ? "383-kartat-e-qyteteve.html" : `383-${cities[0].id}.html`, cities.length > 1 ? "Kartat e qyteteve - 383" : `${cities[0].name} - 383`, sections.join(""), "travel");
      track("visit_card_download", { variant: "city", cities: cities.map((city) => city.id).join(",") });
    } finally {
      setExportingCities(false);
    }
  };

  return (
    <main className={styles.visitShell}>
      <a className={styles.skipLink} href="#visit-tools">Kalo te mjetet e udhëtimit</a>
      <a className={styles.floatingEmergency} href="tel:112"><Phone aria-hidden="true" size={18} /><span>Ndihmë tani</span><strong>112</strong></a>

      <section className={styles.visitHero} aria-labelledby="visit-v2-title">
        <div className={styles.heroCopy}>
          <h1 id="visit-v2-title"><span>Kosova</span> në xhep, para kufirit.</h1>
          <p className={styles.heroLead}>Pritjet në kufi, ndihma pranë teje dhe vendet që ia vlen t&apos;i shohësh.</p>
          <a className={styles.heroEmergency} href="tel:112"><Phone aria-hidden="true" size={20} />Ndihmë tani - 112</a>
          <div className={styles.modeSwitch} aria-label="Zgjidh llojin e kartës">
            <button className={mode === "border" ? styles.modeActive : ""} onClick={() => { setMode("border"); document.getElementById("border-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><CircleGauge aria-hidden="true" size={20} /><span><strong>Karta e kufirit</strong><small>Pritjet dhe ndihma afër</small></span><ArrowRight aria-hidden="true" size={17} /></button>
            <button className={mode === "city" ? styles.modeActive : ""} onClick={() => { setMode("city"); document.getElementById("city-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><MapPinned aria-hidden="true" size={20} /><span><strong>Karta e qytetit</strong><small>Pesë vende për çdo qytet</small></span><ArrowRight aria-hidden="true" size={17} /></button>
          </div>
          <p className={styles.privacyLine}><ShieldCheck aria-hidden="true" size={15} />Pa llogari. Vendndodhja kërkohet vetëm kur e zgjedh ti.</p>
        </div>
        <div className={styles.heroMap}><KosovoFieldMap /></div>
        <div className={styles.heroUtilityPreview}>
          <div><span>Pikat kufitare dhe pritjet</span><strong>{borderLoading ? "Po përditësohet..." : "Përditësim automatik"}</strong></div>
          {BORDER_CROSSINGS.map((crossing) => {
            const wait = borderPayload?.official.find((item) => item.crossingId === crossing.id);
            const minutes = wait ? Math.max(wait.entry.max, wait.exit.max) : 0;
            return <span key={crossing.id}><b>{crossing.name}</b><WaitMeter minutes={wait ? minutes : null} /><em>{wait ? `${minutes} min` : "Pa të dhëna"}</em></span>;
          })}
        </div>
      </section>

      <section className={styles.borderSection} id="visit-tools" aria-labelledby="border-card-title">
        <div className={styles.sectionIntro}>
          <h2 id="border-card-title">Shiko pritjen. Zgjidh pikën. Nisu më i qetë.</h2>
          <p>Katër pikat kryesore përditësohen çdo 10 minuta. Raportet e udhëtarëve shfaqen vetëm pasi vendndodhja konfirmon se janë pranë kufirit.</p>
        </div>

        <div className={styles.utilityLayout} id="border-card">
          <div className={styles.utilityControls}>
            <label>Pika kufitare<select value={selectedCrossing} onChange={(event) => { setSelectedCrossing(event.target.value as BorderCrossingId); setReportMessage(""); }}>{BORDER_CROSSINGS.map((crossing) => <option value={crossing.id} key={crossing.id}>{crossing.name} - {crossing.country}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
            <fieldset><legend>Drejtimi</legend><button className={direction === "entry" ? styles.controlActive : ""} onClick={() => setDirection("entry")}>Hyrje në Kosovë</button><button className={direction === "exit" ? styles.controlActive : ""} onClick={() => setDirection("exit")}>Dalje nga Kosova</button></fieldset>
            <div className={styles.quickActions}>
              <button className={styles.locateButton} disabled={locating} onClick={locateServices} aria-describedby="visit-location-note"><LocateFixed aria-hidden="true" size={21} /><span><b>{locating ? "Po kërkojmë pranë teje..." : "Gjej ndihmën më të afërt"}</b><small>Polici, ambulancë, zjarrfikës dhe karburant</small></span><ArrowRight aria-hidden="true" size={18} /></button>
              <button className={styles.reportButton} aria-expanded={reportOpen} aria-controls="visit-report-panel" onClick={() => setReportOpen((open) => !open)}><Users aria-hidden="true" size={21} /><span><b>Raporto pritjen tani</b><small>1 minutë • pranohet vetëm pranë kufirit</small></span><ArrowRight aria-hidden="true" size={18} /></button>
            </div>
            <p id="visit-location-note" className={styles.actionTrust}><ShieldCheck aria-hidden="true" size={13} />Vendndodhja përdoret vetëm për këtë kërkim dhe nuk ruhet.</p>
            {locationMessage && <p className={styles.controlMessage} aria-live="polite">{locationMessage}</p>}
            {reportOpen && <div className={styles.reportPanel} id="visit-report-panel">
              <h3>Raport për {BORDER_CROSSINGS.find((item) => item.id === selectedCrossing)?.name}</h3>
              <label>Sa minuta po pret?<input type="number" min="0" max="240" step="5" value={reportMinutes} onChange={(event) => setReportMinutes(Number(event.target.value))} /></label>
              <p><Navigation aria-hidden="true" size={14} />Lejo vendndodhjen. Raporti pranohet vetëm brenda 1 km nga pika e zgjedhur.</p>
              <button disabled={reporting} onClick={submitReport}><Send aria-hidden="true" size={15} />{reporting ? "Po verifikohet..." : "Verifiko dhe raporto"}</button>
              {reportMessage && <output aria-live="polite">{reportMessage}</output>}
            </div>}
          </div>

          <article className={styles.utilityCard}>
            <div className={styles.utilitySideMark} aria-hidden="true">KUFIRI</div>
            <header><div className={styles.utilityIdentity}><b>383</b><span>KARTA E KUFIRIT</span></div><div className={styles.utilityRoute}><small>KOSOVË / {currentCrossing.country.toUpperCase()}</small><h3>{currentCrossing.name}</h3><span>{direction === "entry" ? "Hyrje në Kosovë" : "Dalje nga Kosova"}</span></div><CarFront aria-hidden="true" size={32} /></header>
            <div className={styles.waitList}>
              {BORDER_CROSSINGS.map((crossing) => {
                const current = borderPayload?.official.find((item) => item.crossingId === crossing.id);
                const range = direction === "entry" ? current?.entry : current?.exit;
                const minutes = range?.max ?? 0;
                const community = borderPayload?.community[`${crossing.id}:${direction}`];
                return <div className={crossing.id === selectedCrossing ? styles.waitSelected : ""} id={`border-${crossing.id}`} key={crossing.id}>
                  <button onClick={() => setSelectedCrossing(crossing.id)}><span><b>{crossing.name}</b><small>Kosovë - {crossing.country}</small></span><strong>{range ? rangeLabel(range) : "Pa të dhëna"}</strong></button>
                  <WaitMeter minutes={range ? minutes : null} />
                  <p><span><Clock3 aria-hidden="true" size={13} />{current?.updatedAt ? `Përditësuar ${current.updatedAt}` : "Duke pritur përditësimin"}</span><span>{community ? `${community.median} min nga ${community.sampleSize} raport${community.sampleSize === 1 ? "" : "e"}` : "Pa raport të verifikuar"}</span></p>
                </div>;
              })}
            </div>

            <div className={styles.nearbyGrid} id="nearby-services">
              {([
                ["police", "Policia", Building2], ["hospital", "Ambulanca", Ambulance], ["fire_station", "Zjarrfikësit", Flame], ["fuel", "Karburanti", Fuel],
              ] as const).map(([kind, label, Icon]) => {
                const place = nearby?.nearest[kind];
                const fallback = nearby?.fallbackSearches[kind];
                const href = place ? `${MAPS}${place.latitude},${place.longitude}` : fallback;
                return <a key={kind} className={!href ? styles.nearbyDisabled : ""} href={href} target={href ? "_blank" : undefined} rel="noreferrer"><Icon aria-hidden="true" size={18} /><span><small>{label}</small><b>{place ? place.name : fallback ? "Hap më të afërtën" : "Kërko vendndodhjen"}</b>{place ? <em>{place.distanceKm.toFixed(1)} km - verifiko orarin</em> : fallback ? <em>Kërkim në hartë</em> : null}</span></a>;
              })}
            </div>

            <footer>
              <div className={styles.emergencyNumbers}>{EMERGENCY_NUMBERS.map((item) => <a href={`tel:${item.number}`} key={item.number}><span>{item.label}</span><b>{item.number}</b></a>)}</div>
              <p><ShieldCheck aria-hidden="true" size={13} />Vendndodhja përdoret vetëm për kontrollin që kërkon ti.</p>
            </footer>
          </article>
          <button className={styles.downloadUtility} onClick={exportUtility}><ArrowDownToLine aria-hidden="true" size={18} />Shkarko kartën <span>HTML që hapet offline</span></button>
        </div>
      </section>

      <section className={styles.citySection} id="city-card" aria-labelledby="city-card-title">
        <div className={styles.cityIntro}>
          <h2 id="city-card-title">Zgjidh qytetin. Ne ta përgatisim ditën.</h2>
          <p>Çdo kartë ka pesë vende me fotografi, përshkrim të shkurtër dhe drejtimin e gatshëm në Google Maps.</p>
        </div>
        <div className={styles.cityBuilder}>
          <div className={styles.cityPicker}>
            <label>Qyteti<select value={selectedCity} onChange={(event) => setSelectedCity(event.target.value as CityId)}>{KOSOVO_CITIES.map((city) => <option key={city.id} value={city.id}>{city.name} - {city.region}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
            <div className={styles.cityPickerNote}><MapPinned aria-hidden="true" size={18} /><span><b>{currentCity.places.length} ndalesa të përzgjedhura</b><small>Mund ta shkarkosh vetëm këtë qytet ose të ndërtosh një paketë.</small></span></div>
            <button className={styles.addCity} disabled={savedCities.includes(currentCity.id)} onClick={() => setSavedCities((cities) => [...cities, currentCity.id])}>{savedCities.includes(currentCity.id) ? <Check aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}{savedCities.includes(currentCity.id) ? "Karta është shtuar" : `Shto kartën e ${currentCity.name}`}</button>
          </div>
          <CityGuide city={currentCity} />
        </div>

        <div className={styles.savedCardsHead}>
          <div><h3>Kartat e tua</h3><p>{savedCityCards.length} qytet{savedCityCards.length === 1 ? "" : "e"} në paketën e këtij udhëtimi</p></div>
          {savedCityCards.length > 0 && <button disabled={exportingCities} onClick={() => void exportCities(savedCityCards)}><Download aria-hidden="true" size={15} />{exportingCities ? "Po përgatiten..." : "Shkarko të gjitha"}</button>}
        </div>
        <div className={styles.savedCards}>{savedCityCards.map((city) => <div key={city.id}><SavedCityCover city={city} /><div className={styles.savedActions}><button disabled={exportingCities} onClick={() => void exportCities([city])}><Download aria-hidden="true" size={15} />Shkarko</button><button onClick={() => setSavedCities((cities) => cities.filter((id) => id !== city.id))}>Hiq</button></div></div>)}</div>
      </section>
    </main>
  );
}
