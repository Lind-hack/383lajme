"use client";

import {
  X,
  Ambulance,
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CarFront,
  ChevronDown,
  Clock3,
  Flame,
  Fuel,
  LocateFixed,
  Navigation,
  Phone,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import {
  BORDER_CROSSINGS,
  EMERGENCY_NUMBERS,
  KOSOVO_CITIES,
  type BorderCrossingId,
  type BorderDirection,
  type CityId,
} from "@/lib/visit-v2-data";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import styles from "./visit-v2.module.css";
import DardaniImage from "@/components/dardani/dardani-image";
import LangToggle from "@/components/xhep/lang-toggle";
import XhepCompanion from "@/components/xhep/companion";
import PackShelf from "@/components/xhep/packs/pack-shelf";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";

type Dict = ReturnType<typeof xhepDict>;

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
type RecentReport = { crossingId: string; direction: BorderDirection; waitMinutes: number; createdAt: string; confidence: string; reporterMode: "account" | "anonymous" };
type BorderPayload = {
  official: OfficialWait[];
  community: Record<string, CommunitySummary>;
  recentReports: RecentReport[];
  generatedAt: string;
  error?: string;
};
type NearbyPhoto = { url: string; sourceUrl: string; title: string; credit: string; creditUrl?: string | null; license: string; provider: "wikimedia" | "google"; verified: true; embeddable: boolean };
type NearbyPlace = { name: string; latitude: number; longitude: number; distanceKm: number; openingHours: string | null; mapsUrl: string; streetViewUrl: string; photo: NearbyPhoto | null };
type NearbyPayload = {
  nearest: Record<"police" | "hospital" | "fire_station" | "fuel", NearbyPlace | null>;
  fallbackSearches: Record<"police" | "hospital" | "fire_station" | "fuel", string>;
  degraded: boolean;
  attribution: string;
  note: string;
};
type BrowserLocation = { latitude: number; longitude: number; accuracy: number };


function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function downloadHtml(d: Dict, filename: string, title: string, content: string, variant: "utility" | "travel") {
  const identity = variant === "utility"
    ? `<header class="identity"><b>383</b><span>${escapeHtml(d.offline.utilityBrand)}</span><em>LIVE • OFFLINE</em></header>`
    : `<header class="identity"><b>383</b><span>${escapeHtml(d.offline.travelBrand)}</span><em>TRAVEL EDITION</em></header>`;
  const html = `<!doctype html><html lang="${d.offline.htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;color:#171614;font:15px/1.5 Arial,sans-serif}body.utility{background:#23211d}body.travel{background:#f6d999}.sheet{width:min(900px,calc(100% - 24px));margin:24px auto;overflow:hidden}.identity{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px}.identity b{font-size:34px;line-height:1;letter-spacing:-.08em}.identity span,.identity em{font-size:10px;font-style:normal;font-weight:900;letter-spacing:.14em}.utility .sheet{position:relative;background:#f4f0e8;border:1px solid #45423b;box-shadow:0 24px 80px rgba(0,0,0,.28)}.utility .sheet:before{content:"";position:absolute;inset:0 auto 0 0;width:13px;background:#ff4422}.utility .identity{padding:20px 28px 18px 38px;background:#171614;color:#fff;border-bottom:8px solid #ff4422}.utility .identity b{color:#ff4422}.utility .identity em{color:#b9ffcc}.utility .content{padding:28px 36px 34px}.utility h1{margin:0;font-size:46px;line-height:.98;letter-spacing:-.05em;text-transform:uppercase}.utility h2{margin:28px 0 8px;padding-top:10px;border-top:2px solid #1e1c19;font-size:12px;letter-spacing:.13em;text-transform:uppercase}.utility .meta{margin:8px 0 0;color:#5c574f}.utility .row{padding:15px 0;border-bottom:1px solid #cfc8bd}.utility .row:after{content:"";display:block;clear:both}.utility .bar{height:12px;margin-top:9px;overflow:hidden;background:#d8d2c8}.utility .bar i{display:block;height:100%}.utility .service{display:grid;grid-template-columns:220px 1fr;gap:0;margin:14px 0;border:1px solid #cfc8bd;background:#fff}.utility .service img{width:100%;height:170px;object-fit:cover}.utility .service-no-photo{display:grid;place-items:center;min-height:170px;padding:22px;background:#e8e1d6;color:#5c574f;text-align:center;font-size:12px;font-weight:700}.utility .service div{padding:17px}.utility .service small{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#d6381d}.utility .service h3{margin:4px 0;font-size:21px}.utility .service p{margin:5px 0;color:#5c574f}.utility .service a{display:inline-block;margin-top:7px;color:#b52918;font-weight:900}.utility .service .credit,.travel .place .credit{font-size:9px}.utility .emergency{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.utility .emergency b{padding:12px 10px;background:#9f211b;color:#fff;text-align:center}.travel .sheet{background:#fffaf0;border:1px solid rgba(83,54,17,.18);box-shadow:0 24px 80px rgba(91,54,9,.2)}.travel .identity{padding:18px 24px;background:#ff4422;color:#fff}.travel .identity em{color:#fff2b0}.travel .content{padding:30px}.travel section{position:relative;padding-bottom:26px}.travel h1{width:fit-content;margin:0;padding:5px 13px 8px;background:#171614;color:#fff;font-size:54px;line-height:1;letter-spacing:-.055em;transform:rotate(-1deg)}.travel h2{margin:24px 0 10px}.travel .meta{margin:15px 0 22px;color:#625947;font-size:17px;font-weight:700}.travel .place{display:grid;grid-template-columns:minmax(180px,36%) 1fr;gap:0;overflow:hidden;margin:14px 0;background:#fff;border:1px solid #ead9bd;box-shadow:7px 7px 0 #ffd46b}.travel .place:nth-of-type(even){box-shadow:7px 7px 0 #bce8d0}.travel .place img{width:100%;height:190px;object-fit:cover}.travel .place div{padding:20px}.travel .place h3{margin:0 0 5px;font-size:23px;letter-spacing:-.025em}.travel .place p{margin:5px 0;color:#5f594e}.travel .place a{display:inline-block;margin-top:12px;color:#d6381d;font-weight:900}.fine{margin:0;padding:16px 30px 22px;color:#6b655d;font-size:11px}.utility .fine{background:#e8e2d8}.travel .fine{background:#fff0ca}@media(max-width:600px){.identity{grid-template-columns:auto 1fr}.identity em{grid-column:2}.utility .content,.travel .content{padding:22px}.travel .place{grid-template-columns:1fr}.travel .place img{height:220px}.utility .service{grid-template-columns:1fr}.utility .service img{height:210px}.utility .emergency{grid-template-columns:1fr 1fr}}@media print{body{background:#fff!important}.sheet{width:100%;margin:0;box-shadow:none!important}}@page{margin:10mm}</style></head><body class="${variant}"><main class="sheet">${identity}<div class="content">${content}</div><p class="fine">${escapeHtml(d.offline.fine)}</p></main></body></html>`;
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

function relativeReportTime(d: Dict, value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return d.time.now;
  return d.time.minutesAgo(minutes);
}

function waitLevel(minutes: number) {
  if (minutes >= 30) return "red";
  if (minutes >= 15) return "amber";
  return "green";
}

function WaitMeter({ minutes, d }: { minutes: number | null; d: Dict }) {
  const level = waitLevel(minutes ?? 0);
  const scale = minutes === null ? 0 : Math.max(.08, Math.min(1, minutes / 45));
  const style = { "--wait-scale": scale } as CSSProperties;
  return (
    <div className={styles.waitTrack} aria-label={minutes === null ? d.meter.noData : d.meter.label(minutes, level)}>
      <span key={minutes ?? "empty"} className={styles[`wait${level[0].toUpperCase()}${level.slice(1)}`]} style={style} />
    </div>
  );
}

function ExactPlaceVisual({ place, Icon, d }: { place: NearbyPlace; Icon: ComponentType<{ "aria-hidden"?: boolean | "true" | "false"; size?: number }>; d: Dict }) {
  const [loaded, setLoaded] = useState(false);
  if (!place.photo) {
    return <div className={styles.nearbyPlaceholder}>
      <Icon aria-hidden="true" size={23} />
      <span>{d.nearby.photoUnverified}</span>
    </div>;
  }
  return <div className={styles.nearbyVisual}>
    <img className={loaded ? styles.nearbyImageLoaded : ""} src={place.photo.url} alt={d.nearby.photoAlt(place.name)} loading="lazy" onLoad={() => setLoaded(true)} />
    <small className={styles.nearbyPhotoCredit}>{place.photo.credit}</small>
  </div>;
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

export default function VisitV2Experience({ lang = "en" }: { lang?: XhepLang }) {
  const d = xhepDict(lang);
  const t = d.hero;
  const countryOf = (id: BorderCrossingId) => d.common.countries[id];
  const [borderPayload, setBorderPayload] = useState<BorderPayload | null>(null);
  const [, setBorderLoading] = useState(true);
  const [selectedCrossing, setSelectedCrossing] = useState<BorderCrossingId>("vermice-morine");
  const borderSheet = useRef<HTMLDialogElement>(null);
  const [direction, setDirection] = useState<BorderDirection>("entry");
  const [nearby, setNearby] = useState<NearbyPayload | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationProgress, setLocationProgress] = useState(0);
  const [locationStage, setLocationStage] = useState<string>(d.locate.ready);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMinutes, setReportMinutes] = useState(15);
  const [reportMessage, setReportMessage] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportMode, setReportMode] = useState<"account" | "anonymous">("anonymous");
  const [signedIn, setSignedIn] = useState(false);
  const [exportingUtility, setExportingUtility] = useState(false);
  const [focusCity, setFocusCity] = useState<CityId | null>(null);

  /** Arriving from search with a city already chosen. Validated against the
   *  real list so a hand-edited URL cannot select a city that does not exist. */
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("qyteti");
    if (wanted && KOSOVO_CITIES.some((city) => city.id === wanted)) {
      setFocusCity(wanted as CityId);
    }
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const authenticated = Boolean(data.user);
      setSignedIn(authenticated);
      if (authenticated) setReportMode("account");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
      if (!session?.user) setReportMode("anonymous");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!locating) return;
    const timer = window.setInterval(() => setLocationProgress((progress) => Math.min(84, progress + (progress < 40 ? 4 : 2))), 450);
    return () => window.clearInterval(timer);
  }, [locating]);

  const loadBorders = useCallback(async () => {
    try {
      const response = await fetch("/api/visit/borders", { cache: "no-store" });
      const payload = (await response.json()) as BorderPayload;
      setBorderPayload(payload);
    } catch {
      setBorderPayload({ official: [], community: {}, recentReports: [], generatedAt: new Date().toISOString(), error: d.border.loadFailed });
    } finally {
      setBorderLoading(false);
    }
  }, [d]);

  useEffect(() => {
    void loadBorders();
    const timer = window.setInterval(() => void loadBorders(), 600_000);
    return () => window.clearInterval(timer);
  }, [loadBorders]);

  const requestLocation = useCallback((fresh = false) => new Promise<BrowserLocation>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(d.locate.unsupported));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => reject(new Error(d.locate.denied)),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: fresh ? 0 : 60_000 },
    );
  }), [d]);

  const locateServices = async () => {
    if (locating) return;
    setLocating(true);
    setLocationProgress(8);
    setLocationStage(d.locate.asking);
    setLocationMessage("");
    try {
      const coordinates = await requestLocation();
      setLocationProgress(42);
      setLocationStage(d.locate.confirmed);
      setLocationProgress(58);
      setLocationStage(d.locate.analysing);
      const response = await fetch(`/api/visit/nearby?lat=${coordinates.latitude}&lon=${coordinates.longitude}`, { cache: "no-store" });
      const payload = await response.json() as NearbyPayload & { error?: string };
      if (!response.ok) throw new Error(d.locate.mapFailed);
      setLocationProgress(92);
      setLocationStage(d.locate.preparing);
      setNearby(payload);
      setLocationMessage(payload.degraded ? d.locate.degraded : d.locate.found);
      setLocationProgress(100);
      setLocationStage(d.locate.done);
    } catch (error) {
      setLocationMessage(String(error instanceof Error ? error.message : error));
      setLocationProgress(0);
      setLocationStage(d.locate.failed);
    } finally {
      setLocating(false);
    }
  };

  const submitReport = async () => {
    setReporting(true);
    setReportMessage(d.report.checking);
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
        body: JSON.stringify({ crossingId: selectedCrossing, direction, waitMinutes: reportMinutes, ...coordinates, deviceId, anonymous: reportMode === "anonymous" }),
      });
      const payload = await response.json() as { accepted?: boolean; code?: string; distanceKm?: number };
      const errors = d.report.errors;
      setReportMessage(
        response.ok ? (payload.accepted ? d.report.accepted : d.report.quarantined)
        : payload.code === "too_far" ? errors.tooFar(typeof payload.distanceKm === "number" ? payload.distanceKm : null)
        : payload.code === "low_accuracy" ? errors.tooFar(null)
        : payload.code === "sign_in" ? errors.signIn
        : payload.code === "too_soon" ? errors.tooSoon
        : payload.code === "save_failed" ? errors.saveFailed
        : payload.code === "invalid_input" ? errors.invalid
        : errors.generic,
      );
      if (response.ok) {
        track("visit_report_submitted", { crossingId: selectedCrossing, direction, reporterMode: reportMode });
        await loadBorders();
      }
    } catch (error) {
      setReportMessage(String(error instanceof Error ? error.message : error));
    } finally {
      setReporting(false);
    }
  };

  const emergencyLabel = (item: (typeof EMERGENCY_NUMBERS)[number]) => d.common.emergency[item.number as keyof Dict["common"]["emergency"]] ?? item.label;
  const currentCrossing = BORDER_CROSSINGS.find((crossing) => crossing.id === selectedCrossing) ?? BORDER_CROSSINGS[0];
  const recentReports = (borderPayload?.recentReports ?? []).filter((report) => report.crossingId === selectedCrossing && report.direction === direction).slice(0, 6);

  const exportUtility = async () => {
    setExportingUtility(true);
    try {
      track("visit_card_download", { variant: "border" });
      const waits = BORDER_CROSSINGS.map((crossing) => {
        const current = borderPayload?.official.find((item) => item.crossingId === crossing.id);
        const range = direction === "entry" ? current?.entry : current?.exit;
        const minutes = range?.max ?? 0;
        return `<div class="row"><b>${escapeHtml(crossing.name)} - ${escapeHtml(direction === "entry" ? d.border.entryShort : d.border.exitShort)}</b><span style="float:right">${escapeHtml(range ? rangeLabel(range) : t.noData)}</span><div class="bar"><i style="width:${Math.max(3, Math.min(100, minutes / 45 * 100))}%;background:${minutes >= 30 ? "#c8261a" : minutes >= 15 ? "#e7a317" : "#198754"}"></i></div></div>`;
      }).join("");
      const serviceLabels: Record<string, string> = d.common.services;
      const services = nearby ? (await Promise.all(Object.entries(nearby.nearest).map(async ([kind, place]) => {
        if (!place) return `<div class="row"><b>${escapeHtml(serviceLabels[kind])}</b> <a href="${escapeHtml(nearby.fallbackSearches[kind as keyof NearbyPayload["fallbackSearches"]])}">${escapeHtml(d.offline.openNearestSearch)}</a></div>`;
        const visual = place.photo?.embeddable
          ? `<img src="${escapeHtml(await imageAsDataUrl(place.photo.url))}" alt="${escapeHtml(place.photo.title)}">`
          : `<div class="service-no-photo">${escapeHtml(d.offline.noOfflinePhoto)}</div>`;
        const credit = place.photo ? `<p class="credit">${escapeHtml(d.offline.placePhoto)}: ${escapeHtml(place.photo.credit)} • ${escapeHtml(place.photo.license)}</p>` : "";
        return `<article class="service">${visual}<div><small>${escapeHtml(serviceLabels[kind])}</small><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(d.offline.kmAway(place.distanceKm.toFixed(1)))} • ${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}</p><a href="${escapeHtml(place.mapsUrl)}">${escapeHtml(d.common.openDirectionsGoogle)}</a>${credit}</div></article>`;
      }))).join("") : `<div class="row">${escapeHtml(d.offline.allowLocationFirst)}</div>`;
      const emergency = EMERGENCY_NUMBERS.map((item) => `<b>${escapeHtml(emergencyLabel(item))} ${item.number}</b>`).join("");
      downloadHtml(d, "383-karta-e-kufirit.html", d.offline.title, `<h1>${escapeHtml(currentCrossing.name)}<br>${escapeHtml(direction === "entry" ? d.border.entryShort : d.border.exitShort)}</h1><p class="meta">${escapeHtml(d.common.kosovo)} / ${escapeHtml(countryOf(currentCrossing.id))} • ${escapeHtml(d.offline.autoRefreshEvery)}</p><h2>${escapeHtml(d.offline.latestWaits)}</h2>${waits}<h2>${escapeHtml(d.offline.nearestServices)}</h2>${services}<h2>${escapeHtml(d.offline.emergencyNumbers)}</h2><div class="emergency">${emergency}</div>`, "utility");
    } finally {
      setExportingUtility(false);
    }
  };

  return (
    <main className={styles.visitShell}>
      <a className={styles.skipLink} href="#visit-tools">{t.skipToTools}</a>
      <a className={styles.floatingEmergency} href="tel:112"><Phone aria-hidden="true" size={18} /><span>{t.helpNow}</span><strong>112</strong></a>

      <section className={styles.visitHero} data-compact aria-labelledby="visit-v2-title">
        <div className={styles.heroCopy}>
          <LangToggle lang={lang} />
          <div className="visit-dardani">
            <DardaniImage name="diaspora" decorative priority />
            <span>{t.greeting}</span>
          </div>
          <h1 id="visit-v2-title"><span>{t.titleLead}</span> {t.titleRest}</h1>
          <p className={styles.heroLead}>{t.lead}</p>
          <p className={styles.privacyLine}><ShieldCheck aria-hidden="true" size={15} />{t.privacy}</p>
        </div>
      </section>

      {/* The packs are the front of the page. */}
      <section className={styles.citySection} id="city-card" aria-label={d.city.title}>
        <PackShelf lang={lang} focusCity={focusCity} />
      </section>

      <XhepCompanion lang={lang} />

      <section className={styles.borderSection} id="visit-tools" aria-labelledby="border-card-title">
        <div className={styles.sectionIntro}>
          <h2 id="border-card-title">{d.border.title}</h2>
          <p>{d.border.intro}</p>
        </div>

        <article className={styles.miniBorder} id="border-card">
          <header>
            <span className={styles.miniBorderBadge}><CarFront aria-hidden="true" size={18} /></span>
            <span><b>{t.borderMode}</b><small>{direction === "entry" ? d.border.entry : d.border.exit}</small></span>
            <span className={styles.miniBorder383}>383</span>
          </header>
          <ul>
            {BORDER_CROSSINGS.map((crossing) => {
              const current = borderPayload?.official.find((item) => item.crossingId === crossing.id);
              const range = direction === "entry" ? current?.entry : current?.exit;
              return (
                <li key={crossing.id}>
                  <span><b>{crossing.name}</b><small>{countryOf(crossing.id)}</small></span>
                  <WaitMeter minutes={range ? range.max : null} d={d} />
                  <strong>{range ? rangeLabel(range) : t.noData}</strong>
                </li>
              );
            })}
          </ul>
          <p>{d.border.miniNote}</p>
          <footer>
            <a href="tel:112" className={styles.miniBorder112}><Phone aria-hidden="true" size={16} />112</a>
            <button type="button" onClick={() => borderSheet.current?.showModal()}>{d.border.openCard}<ArrowRight aria-hidden="true" size={16} /></button>
          </footer>
        </article>

        <dialog
          ref={borderSheet}
          className={styles.borderSheet}
          aria-labelledby="border-card-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className={styles.borderSheetHead}>
            <b>{t.borderMode}</b>
            <button type="button" onClick={() => borderSheet.current?.close()} aria-label={d.border.closeCard}><X aria-hidden="true" size={20} /></button>
          </div>
        <div className={styles.utilityLayout}>
          <div className={styles.utilityControls}>
            <label>{d.border.crossing}<select value={selectedCrossing} onChange={(event) => { setSelectedCrossing(event.target.value as BorderCrossingId); setReportMessage(""); }}>{BORDER_CROSSINGS.map((crossing) => <option value={crossing.id} key={crossing.id}>{crossing.name} - {countryOf(crossing.id)}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
            <fieldset><legend>{d.border.direction}</legend><button className={direction === "entry" ? styles.controlActive : ""} onClick={() => setDirection("entry")}>{d.border.entry}</button><button className={direction === "exit" ? styles.controlActive : ""} onClick={() => setDirection("exit")}>{d.border.exit}</button></fieldset>
            <div className={styles.quickActions}>
              <button className={styles.locateButton} disabled={locating} onClick={locateServices} aria-describedby="visit-location-note"><LocateFixed aria-hidden="true" size={21} /><span><b>{locating ? locationStage : d.border.findHelp}</b><small>{locationProgress > 0 ? `${locationProgress}% • ${locationStage}` : d.border.findHelpHint}</small></span><ArrowRight aria-hidden="true" size={18} /><i className={styles.locationProgress} role="progressbar" aria-label={d.border.progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={locationProgress}><i style={{ "--location-progress": `${locationProgress}%` } as CSSProperties} /></i></button>
              <button className={styles.reportButton} aria-expanded={reportOpen} aria-controls="visit-report-panel" onClick={() => setReportOpen((open) => !open)}><Users aria-hidden="true" size={21} /><span><b>{d.border.report}</b><small>{d.border.reportHint}</small></span><ArrowRight aria-hidden="true" size={18} /></button>
            </div>
            <p id="visit-location-note" className={styles.actionTrust}><ShieldCheck aria-hidden="true" size={13} />{d.border.locationNote}</p>
            {locationMessage && <p className={styles.controlMessage} aria-live="polite">{locationMessage}</p>}
            {reportOpen && <div className={styles.reportPanel} id="visit-report-panel">
              <h3>{d.report.heading(currentCrossing.name)}</h3>
              <div className={styles.reportIdentity} role="group" aria-label={d.report.identityLabel}>
                <button className={reportMode === "account" ? styles.reportIdentityActive : ""} disabled={!signedIn} onClick={() => setReportMode("account")}><Users aria-hidden="true" size={14} />{d.report.withAccount}</button>
                <button className={reportMode === "anonymous" ? styles.reportIdentityActive : ""} onClick={() => setReportMode("anonymous")}><ShieldCheck aria-hidden="true" size={14} />{d.report.anonymous}</button>
              </div>
              {!signedIn && <p className={styles.signInHint}>{d.report.signInPrompt} <a href="/hyr?next=/visit">{d.report.signInLink}</a>. {d.report.signInRest}</p>}
              <label>{d.report.minutesLabel}<input type="number" min="0" max="240" step="5" value={reportMinutes} onChange={(event) => setReportMinutes(Number(event.target.value))} /></label>
              <p><Navigation aria-hidden="true" size={14} />{d.report.locationRule}</p>
              <button disabled={reporting} onClick={submitReport}><Send aria-hidden="true" size={15} />{reporting ? d.report.submitting : d.report.submit}</button>
              {reportMessage && <output aria-live="polite">{reportMessage}</output>}
            </div>}
            <section className={styles.reportDashboard} aria-labelledby="recent-reports-title">
              <header><div><span className={styles.liveDot} /><h3 id="recent-reports-title">{d.report.dashboard}</h3></div><b>{d.report.live(recentReports.length)}</b></header>
              <div className={styles.reportTable} role="table" aria-label={d.report.tableLabel(currentCrossing.name)}>
                <div className={styles.reportTableHead} role="row"><span role="columnheader">{d.report.columns.time}</span><span role="columnheader">{d.report.columns.source}</span><span role="columnheader">{d.report.columns.wait}</span><span role="columnheader">{d.report.columns.confidence}</span></div>
                {recentReports.length ? recentReports.map((report) => <div role="row" key={`${report.createdAt}-${report.waitMinutes}`}><time role="cell" dateTime={report.createdAt}>{relativeReportTime(d, report.createdAt)}</time><span role="cell">{report.reporterMode === "account" ? d.report.sourceAccount : d.report.sourceAnonymous}</span><strong role="cell">{report.waitMinutes} min</strong><span role="cell" className={styles[`confidence${report.confidence[0]?.toUpperCase()}${report.confidence.slice(1)}`]}>{report.confidence === "high" ? d.report.confidence.high : report.confidence === "medium" ? d.report.confidence.medium : d.report.confidence.low}</span></div>) : <p className={styles.reportEmpty}>{d.report.empty}</p>}
              </div>
            </section>
          </div>

          <article className={styles.utilityCard}>
            <div className={styles.utilitySideMark} aria-hidden="true">{d.border.sideMark}</div>
            <header><div className={styles.utilityIdentity}><b>383</b><span>{d.border.cardBrand}</span></div><div className={styles.utilityRoute}><small>{d.common.kosovo.toUpperCase()} / {countryOf(currentCrossing.id).toUpperCase()}</small><h3>{currentCrossing.name}</h3><span>{direction === "entry" ? d.border.entry : d.border.exit}</span></div><CarFront aria-hidden="true" size={32} /></header>
            <div className={styles.waitList}>
              {BORDER_CROSSINGS.map((crossing) => {
                const current = borderPayload?.official.find((item) => item.crossingId === crossing.id);
                const range = direction === "entry" ? current?.entry : current?.exit;
                const minutes = range?.max ?? 0;
                const community = borderPayload?.community[`${crossing.id}:${direction}`];
                return <div className={crossing.id === selectedCrossing ? styles.waitSelected : ""} id={`border-${crossing.id}`} key={crossing.id}>
                  <button onClick={() => setSelectedCrossing(crossing.id)}><span><b>{crossing.name}</b><small>{d.common.kosovo} - {countryOf(crossing.id)}</small></span><strong>{range ? rangeLabel(range) : t.noData}</strong></button>
                  <WaitMeter minutes={range ? minutes : null} d={d} />
                  <p><span><Clock3 aria-hidden="true" size={13} />{current?.updatedAt ? d.border.updatedAt(current.updatedAt) : d.border.awaitingUpdate}</span><span>{community ? d.border.communityMedian(community.median, community.sampleSize) : d.border.noVerifiedReport}</span></p>
                </div>;
              })}
            </div>

            <div className={styles.nearbyGrid} id="nearby-services">
              {([
                ["police", Building2], ["hospital", Ambulance], ["fire_station", Flame], ["fuel", Fuel],
              ] as const).map(([kind, Icon]) => {
                const label = d.common.services[kind];
                const place = nearby?.nearest[kind];
                const fallback = nearby?.fallbackSearches[kind];
                const href = place ? (place.photo?.sourceUrl ?? place.streetViewUrl) : fallback;
                return <a key={kind} className={!href ? styles.nearbyDisabled : ""} href={href} target={href ? "_blank" : undefined} rel="noreferrer">
                  {place ? <ExactPlaceVisual key={place.photo?.url ?? `${place.latitude}:${place.longitude}`} place={place} Icon={Icon} d={d} /> : <div className={styles.nearbyPlaceholder}><Icon aria-hidden="true" size={24} /></div>}
                  <span className={styles.nearbyCopy}><small><Icon aria-hidden="true" size={13} />{label}</small><b>{place ? place.name : fallback ? d.nearby.openNearest : d.nearby.askLocation}</b>{place ? <><em>{place.distanceKm.toFixed(1)} km • Google Maps</em><i>{place.photo ? d.nearby.photoLinked : d.nearby.openStreetView}</i></> : fallback ? <em>{d.nearby.mapSearch}</em> : null}</span>
                </a>;
              })}
            </div>

            <footer>
              <div className={styles.emergencyNumbers}>{EMERGENCY_NUMBERS.map((item) => <a href={`tel:${item.number}`} key={item.number}><span>{emergencyLabel(item)}</span><b>{item.number}</b></a>)}</div>
              <p><ShieldCheck aria-hidden="true" size={13} />{d.border.footerNote}</p>
            </footer>
          </article>
          <button className={styles.downloadUtility} disabled={exportingUtility} onClick={() => void exportUtility()}><ArrowDownToLine aria-hidden="true" size={18} />{exportingUtility ? d.border.downloading : d.border.download} <span>{d.border.downloadHint}</span></button>
        </div>
        </dialog>
      </section>

    </main>
  );
}
