"use client";

// The border card: the most-used card of Kosova në xhep, so it sits first
// among the packs and does its whole job on the card itself.
//
//   - today's official waits at the four main crossings, entry or exit,
//     with when they were updated and when they are checked next;
//   - one tap for help near you, the card's headline feature: the nearest
//     crossing, police station, emergency hospital and fuel, by road, each
//     with directions (and a call button for police and ambulance), plus the
//     visitor's own coordinates to read out to 112 or send to family;
//   - report the wait where you are standing (the server checks you are
//     within 1 km of the crossing);
//   - 112 always one tap away; the full tools (reports table, offline copy)
//     open in a sheet.

import { useEffect, useState } from "react";
import { Ambulance, Building2, CarFront, Check, Copy, Download, Fuel, LocateFixed, Navigation, Phone, RefreshCw, Send, Share2, Siren, Users } from "lucide-react";
import { BORDER_CROSSINGS, type BorderCrossingId, type BorderDirection } from "@/lib/visit-v2-data";
import type { xhepDict } from "@/lib/xhep/i18n";
import styles from "./border-card.module.css";

type Dict = ReturnType<typeof xhepDict>;
type Range = { min: number; max: number };
type Official = { crossingId: string; entry: Range; exit: Range; updatedAt: string | null };
type Photo = { url: string; sourceUrl: string; credit: string; license: string; embeddable: boolean };
type Place = { name: string; distanceKm: number; minutes: number | null; byRoad?: boolean; mapsUrl: string; streetViewUrl: string; photo: Photo | null };
export type NearbyResult = {
  nearest: { police: Place | null; hospital: Place | null; fuel: Place | null };
  crossing: { id: string; name: string; km: number; minutes: number | null } | null;
  fallbackSearches?: Partial<Record<"police" | "hospital" | "fuel", string>>;
  degraded: boolean;
};

const fmtKm = (km: number) => (km < 10 ? km.toFixed(1) : String(Math.round(km)));
/** The direct line for each kind of help (Emergency Management Agency of Kosovo). */
const LINE: Partial<Record<"police" | "hospital" | "fuel", string>> = { police: "192", hospital: "194" };
const directionsTo = (lat: number, lon: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;

export default function BorderCard({
  d,
  official,
  direction,
  setDirection,
  selected,
  setSelected,
  loadedAt,
  refreshing,
  onRefresh,
  countryOf,
  locating,
  locationStage,
  locationMessage,
  onLocate,
  locationProgress,
  here,
  nearby,
  reportOpen,
  setReportOpen,
  reportMinutes,
  setReportMinutes,
  reporting,
  reportMessage,
  onReport,
  onOpenSheet,
  onDownload,
  downloading,
}: {
  d: Dict;
  official: Official[];
  direction: BorderDirection;
  setDirection: (d: BorderDirection) => void;
  selected: BorderCrossingId;
  setSelected: (id: BorderCrossingId) => void;
  loadedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  countryOf: (id: BorderCrossingId) => string;
  locating: boolean;
  locationStage: string;
  locationMessage: string;
  onLocate: () => void;
  locationProgress: number;
  here: { latitude: number; longitude: number; accuracy: number } | null;
  nearby: NearbyResult | null;
  reportOpen: boolean;
  setReportOpen: (open: boolean) => void;
  reportMinutes: number;
  setReportMinutes: (n: number) => void;
  reporting: boolean;
  reportMessage: string;
  onReport: () => void;
  onOpenSheet: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const b = d.border;
  // The "next check in" line counts down without re-fetching.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const nextIn = loadedAt ? Math.max(0, Math.ceil((loadedAt + 600_000 - now) / 60_000)) : null;
  const updated = official.map((o) => o.updatedAt).filter(Boolean)[0] ?? null;
  const maxWait = (id: string) => {
    const o = official.find((x) => x.crossingId === id);
    return o ? (direction === "entry" ? o.entry : o.exit) : null;
  };

  const icon = (kind: "police" | "hospital" | "fuel") => (kind === "police" ? <Building2 size={22} /> : kind === "hospital" ? <Ambulance size={22} /> : <Fuel size={22} />);
  const service = (kind: "police" | "hospital" | "fuel", place: Place | null) =>
    !place ? (
      // Nothing came back for this kind: open the map search instead of a gap.
      nearby?.fallbackSearches?.[kind] ? (
        <li key={kind}>
          <a href={nearby.fallbackSearches[kind]} target="_blank" rel="noreferrer" className={styles.service}>
            <span className={styles.serviceImg} aria-hidden="true">{icon(kind)}</span>
            <span>
              <small>{d.common.services[kind]}</small>
              <b>{d.nearby.openNearest}</b>
              <em>{d.nearby.mapSearch}</em>
            </span>
          </a>
        </li>
      ) : null
    ) : place ? (
      <li key={kind}>
        <div className={styles.service}>
          <span className={styles.serviceImg}>
            {place.photo?.embeddable ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={place.photo.url} alt="" loading="lazy" />
            ) : (
              <span aria-hidden="true">{icon(kind)}</span>
            )}
          </span>
          <span>
            <small>{d.common.services[kind]}</small>
            <b>{place.name}</b>
            <em>{place.minutes != null ? b.byCar(place.minutes, fmtKm(place.distanceKm)) : b.straight(fmtKm(place.distanceKm))}</em>
            {place.photo?.embeddable && <i className={styles.credit}>{place.photo.credit} · {place.photo.license}</i>}
          </span>
          {place.minutes != null && <strong className={styles.eta}>{place.minutes}<small>min</small></strong>}
        </div>
        <span className={styles.serviceActions}>
          <a href={place.mapsUrl} target="_blank" rel="noreferrer">
            <Navigation size={15} aria-hidden="true" />
            {b.directions}
          </a>
          {LINE[kind] && (
            <a href={`tel:${LINE[kind]}`} data-call>
              <Phone size={15} aria-hidden="true" />
              {b.call(LINE[kind]!)}
            </a>
          )}
        </span>
      </li>
    ) : null;

  return (
    <article className={styles.card} id="visit-tools" aria-labelledby="border-card-title">
      <header className={styles.head}>
        <span className={styles.badge} aria-hidden="true">
          <CarFront size={20} />
        </span>
        <span className={styles.title}>
          <h3 id="border-card-title">{d.hero.borderMode}</h3>
          <small>
            <i className={styles.live} aria-hidden="true" />
            {updated ? b.updated(updated.slice(11, 16) || updated) : d.hero.noData}
            {nextIn !== null && ` · ${b.nextRefresh(nextIn)}`}
          </small>
        </span>
        <button type="button" className={styles.iconBtn} onClick={onRefresh} disabled={refreshing} aria-label={refreshing ? b.refreshing : b.refresh}>
          <RefreshCw size={17} aria-hidden="true" data-spin={refreshing || undefined} />
        </button>
      </header>

      <div className={styles.toggle} role="group" aria-label={b.direction}>
        <button type="button" aria-pressed={direction === "entry"} onClick={() => setDirection("entry")}>
          {b.entry}
        </button>
        <button type="button" aria-pressed={direction === "exit"} onClick={() => setDirection("exit")}>
          {b.exit}
        </button>
      </div>

      <ul className={styles.waits}>
        {BORDER_CROSSINGS.map((c) => {
          const r = maxWait(c.id);
          const level = !r ? "none" : r.max <= 15 ? "low" : r.max <= 45 ? "mid" : "high";
          return (
            <li key={c.id}>
              <button type="button" aria-pressed={selected === c.id} onClick={() => setSelected(c.id)} data-level={level}>
                <span>
                  <b>{c.name}</b>
                  <small>{countryOf(c.id)}</small>
                </span>
                <span className={styles.meter} aria-hidden="true">
                  <i style={{ width: r ? `${Math.max(8, Math.min(100, (r.max / 60) * 100))}%` : "0%" }} />
                </span>
                <strong>{r ? `${r.min}–${r.max} min` : d.hero.noData}</strong>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.source}>{b.officialSource}</p>

      {/* The headline feature: help near you, in one tap. */}
      <button type="button" className={styles.helpHero} onClick={onLocate} disabled={locating} data-busy={locating || undefined}>
        <span className={styles.radar} aria-hidden="true">
          <LocateFixed size={24} />
        </span>
        <span className={styles.helpHeroText}>
          <b>{locating ? locationStage : nearby ? b.findAgain : b.findHelp}</b>
          <small>{b.findHelpHint}</small>
        </span>
        {locating && <i className={styles.helpProgress} style={{ width: `${locationProgress}%` }} aria-hidden="true" />}
      </button>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => setReportOpen(!reportOpen)} aria-expanded={reportOpen}>
          <Users size={18} aria-hidden="true" />
          {b.report}
        </button>
        <a href="tel:112" className={styles.sos}>
          <Phone size={17} aria-hidden="true" />
          112
        </a>
      </div>
      <p className={styles.hint}>{b.locationNote}</p>

      {reportOpen && (
        <div className={styles.report}>
          <label>
            {d.report.heading(BORDER_CROSSINGS.find((c) => c.id === selected)?.name ?? "")}
            <span className={styles.stepper}>
              <button type="button" onClick={() => setReportMinutes(Math.max(0, reportMinutes - 5))} aria-label="−5">−</button>
              <output>{reportMinutes} min</output>
              <button type="button" onClick={() => setReportMinutes(Math.min(240, reportMinutes + 5))} aria-label="+5">+</button>
            </span>
          </label>
          <p>{d.report.locationRule}</p>
          <button type="button" className={styles.primary} onClick={onReport} disabled={reporting}>
            <Send size={16} aria-hidden="true" />
            {reporting ? d.report.submitting : d.report.submit}
          </button>
          {reportMessage && <p role="status" className={styles.message}>{reportMessage}</p>}
        </div>
      )}

      {locationMessage && !nearby && <p role="status" className={styles.message}>{locationMessage}</p>}
      {nearby && (
        <section className={styles.help} aria-label={b.helpTitle}>
          <h4>{b.helpTitle}</h4>
          <ul>
            {nearby.crossing && (
              <li>
                <div className={styles.service}>
                  <span className={styles.serviceImg} aria-hidden="true"><CarFront size={22} /></span>
                  <span>
                    <small>{b.nearestCrossing}</small>
                    <b>
                      {nearby.crossing.name}
                      {(() => {
                        const r = maxWait(nearby.crossing.id);
                        return r ? ` · ${r.min}–${r.max} min` : "";
                      })()}
                    </b>
                    <em>{nearby.crossing.minutes != null ? b.byCar(nearby.crossing.minutes, fmtKm(nearby.crossing.km)) : b.straight(fmtKm(nearby.crossing.km))}</em>
                  </span>
                  {nearby.crossing.minutes != null && <strong className={styles.eta}>{nearby.crossing.minutes}<small>min</small></strong>}
                </div>
                {(() => {
                  const c = BORDER_CROSSINGS.find((x) => x.id === nearby.crossing?.id);
                  return c ? (
                    <span className={styles.serviceActions}>
                      <a href={directionsTo(c.latitude, c.longitude)} target="_blank" rel="noreferrer">
                        <Navigation size={15} aria-hidden="true" />
                        {b.directions}
                      </a>
                    </span>
                  ) : null;
                })()}
              </li>
            )}
            {service("police", nearby.nearest.police)}
            {service("hospital", nearby.nearest.hospital)}
            {service("fuel", nearby.nearest.fuel)}
          </ul>
          {nearby.degraded && <p className={styles.message}>{d.locate.degraded}</p>}
          {here && <WhereAmI here={here} b={b} />}
        </section>
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.more} onClick={onDownload} disabled={downloading}>
          <Download size={16} aria-hidden="true" />
          {downloading ? b.downloading : nearby ? b.downloadWithHelp : b.downloadWaits}
        </button>
        <button type="button" className={styles.more} onClick={onOpenSheet}>
          {b.reports}
        </button>
      </div>
    </article>
  );
}

/** The visitor's own coordinates, to read out to 112 or send to someone. */
function WhereAmI({ here, b }: { here: { latitude: number; longitude: number; accuracy: number }; b: Dict["border"] }) {
  const [copied, setCopied] = useState(false);
  const coords = `${here.latitude.toFixed(5)}, ${here.longitude.toFixed(5)}`;
  const url = `https://maps.google.com/?q=${here.latitude.toFixed(5)},${here.longitude.toFixed(5)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${coords} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const share = async () => {
    const text = b.shareText(coords, url);
    try {
      if (navigator.share) await navigator.share({ text });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch {}
  };
  return (
    <div className={styles.whereAmI}>
      <span className={styles.whereIcon} aria-hidden="true"><Siren size={20} /></span>
      <div>
        <b>{b.sosTitle}</b>
        <output className={styles.coords}>{coords}</output>
        <small>{b.sosBody(Math.max(5, Math.round(here.accuracy)))}</small>
        <span className={styles.whereActions}>
          <button type="button" onClick={() => void copy()}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? b.copied : b.copyCoords}
          </button>
          <button type="button" onClick={() => void share()}>
            <Share2 size={15} aria-hidden="true" />
            {b.shareLocation}
          </button>
          <a href="tel:112">
            <Phone size={15} aria-hidden="true" />
            112
          </a>
        </span>
      </div>
    </div>
  );
}
