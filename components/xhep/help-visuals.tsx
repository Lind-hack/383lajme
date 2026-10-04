"use client";

// The pictures that make the trip help readable at a glance: road signs for
// the rules, the airport bus as a timeline with the next departure lit, price
// tiles, and calendar tiles for dates. Every number here comes from
// lib/xhep/help.mjs, which carries its sources.

import { Beer, Bus, CarTaxiFront, Clock, Coffee, Fuel, GlassWater, HandCoins, Lightbulb, Mountain, Phone, Plane, Plug, ShieldCheck, Siren, Snowflake, Triangle, UtensilsCrossed, Wallet, Wine } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { XhepLang } from "@/lib/xhep/i18n";
import styles from "./help-visuals.module.css";

const L = <T,>(lang: XhepLang, en: T, sq: T) => (lang === "en" ? en : sq);

/** Speed limits, alcohol limit, the triangle and the border insurance, as signs and a ticket. */
export function RoadRules({ lang }: { lang: XhepLang }) {
  return (
    <div className={styles.road}>
      <ul className={styles.signs} aria-label={L(lang, "Speed limits", "Kufijtë e shpejtësisë")}>
        {[
          [50, L(lang, "towns", "qytet")],
          [80, L(lang, "outside towns", "jashtë qytetit")],
          [130, L(lang, "motorway", "autostradë")],
        ].map(([n, label]) => (
          <li key={String(n)}>
            <span className={styles.speed} aria-hidden="true">{n}</span>
            <small>{n} km/h · {label}</small>
          </li>
        ))}
        <li>
          <span className={styles.alcohol} aria-hidden="true">0,01%</span>
          <small>{L(lang, "alcohol: treat as zero", "alkooli: llogarite zero")}</small>
        </li>
        <li>
          <span className={styles.triangle} aria-hidden="true"><Triangle size={30} strokeWidth={3} /></span>
          <small>{L(lang, "warning triangle, required", "trekëndëshi, i detyrueshëm")}</small>
        </li>
      </ul>
      <div className={styles.ticket}>
        <ShieldCheck aria-hidden="true" size={22} />
        <span>
          <b>{L(lang, "Border insurance", "Sigurimi kufitar")}</b>
          <small>{L(lang, "At every crossing · not needed for Albanian or North Macedonian plates", "Në çdo pikë kufitare · nuk duhet për targat e Shqipërisë a Maqedonisë së Veriut")}</small>
        </span>
        <span className={styles.ticketPrices}>
          <b>€15</b>
          <small>{L(lang, "15 days", "15 ditë")}</small>
          <b>€20</b>
          <small>{L(lang, "1 month", "1 muaj")}</small>
        </span>
      </div>
    </div>
  );
}

/** Hour of day in Kosovo, so "next bus" is right wherever the visitor's phone thinks it is. */
function kosovoHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

/** Airport line 1A (Trafiku Urban timetable, July 2026): every two hours, every day. */
export function BusTimeline({ lang }: { lang: XhepLang }) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(kosovoHour()), []);
  const rows = [
    { label: L(lang, "From the airport", "Nga aeroporti"), times: [8, 10, 12, 14, 16, 18, 20, 22, 24] },
    { label: L(lang, "To the airport (bus station)", "Drejt aeroportit (stacioni)"), times: [7, 9, 11, 13, 15, 17, 19, 21, 23] },
  ];
  return (
    <div className={styles.bus}>
      <header>
        <span className={styles.busBadge}><Bus aria-hidden="true" size={18} />1A</span>
        <b>{L(lang, "Airport bus · every 2 hours · €6 (€5 by SMS) · ~40 min", "Autobusi i aeroportit · çdo 2 orë · 6 € (5 € me SMS) · ~40 min")}</b>
      </header>
      {rows.map((row) => {
        const next = hour === null ? null : row.times.find((h) => h > hour) ?? null;
        return (
          <div key={row.label} className={styles.busRow}>
            <small>{row.label}</small>
            <ol>
              {row.times.map((h) => (
                <li key={h} data-next={h === next || undefined} data-past={hour !== null && h <= hour ? true : undefined}>
                  {String(h % 24).padStart(2, "0")}:00
                </li>
              ))}
            </ol>
          </div>
        );
      })}
      <p className={styles.busStops}>
        <Plane aria-hidden="true" size={14} />
        {L(lang, "Stops: Airport · Sllatinë · Fushë Kosovë · Lakrishtë · Dardania · Cathedral · Bus station", "Ndalesat: Aeroporti · Sllatinë · Fushë Kosovë · Lakrishtë · Dardani · Katedralja · Stacioni i autobusëve")}
      </p>
    </div>
  );
}

const PRICE_ICONS: Record<string, typeof Coffee> = {
  cappuccino: Coffee,
  cheapMeal: UtensilsCrossed,
  dinnerForTwo: Wine,
  beer: Beer,
  water: GlassWater,
  cityBus: Bus,
  airportBus: Plane,
  taxiStart: CarTaxiFront,
  skiPass: Mountain,
  petrol: Fuel,
  diesel: Fuel,
};

export function PriceTiles({ items }: { items: { id: string; label: string; value: string; note?: string }[] }) {
  return (
    <ul className={styles.prices}>
      {items.map((p) => {
        const Icon = PRICE_ICONS[p.id] ?? Coffee;
        return (
          <li key={p.id}>
            <Icon aria-hidden="true" size={22} />
            <b>{p.value}</b>
            <span>{p.label}</span>
            {p.note && <small>{p.note}</small>}
          </li>
        );
      })}
    </ul>
  );
}

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  sq: ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"],
};

/** A calendar tile: the month on top, the day big. */
export function DateTile({ lang, month, day }: { lang: XhepLang; month: number; day: number }) {
  return (
    <span className={styles.date} aria-hidden="true">
      <small>{MONTHS[lang][month - 1]}</small>
      <b>{day}</b>
    </span>
  );
}

const ESSENTIAL_ICONS: Record<string, typeof Siren> = {
  emergency: Siren,
  lights: Lightbulb,
  winter: Snowflake,
  cash: Wallet,
  tipping: HandCoins,
  power: Plug,
  time: Clock,
  phone: Phone,
};

/** Day-one facts as tiles: an icon, the one thing to remember, then the detail and its source. */
export function EssentialTiles({ items }: { items: { id: string; value: string; title: string; body: string; source: ReactNode }[] }) {
  return (
    <ul className={styles.essentials}>
      {items.map((item) => {
        const Icon = ESSENTIAL_ICONS[item.id] ?? Siren;
        return (
          <li key={item.id} data-id={item.id}>
            <span className={styles.essentialTop}>
              <Icon aria-hidden="true" size={20} />
              <b>{item.value}</b>
            </span>
            <h4>{item.title}</h4>
            <p>{item.body}</p>
            {item.source}
          </li>
        );
      })}
    </ul>
  );
}
