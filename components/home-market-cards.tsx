"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  Banknote,
  ExternalLink,
  Fuel,
  RefreshCw,
} from "lucide-react";
import type {
  ExchangeSnapshot,
  FuelBrandSnapshot,
  FuelSnapshot,
} from "@/lib/home-market-data";
import { dateKeyInKosovo } from "@/lib/reagimi-data";

type CurrencyCode = "ALL" | "EUR";

function formatSourceDate(value: string | null) {
  if (!value) return "Pa përditësim publik";

  const date = new Date(value);
  const months = [
    "jan",
    "shk",
    "mar",
    "pri",
    "maj",
    "qer",
    "korr",
    "gus",
    "sht",
    "tet",
    "nën",
    "dhj",
  ];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Count-up for the headline rate, run from an inline script rather than a React
 * effect.
 *
 * This homepage hydrates around five seconds after navigation start: it is a
 * heavy route with many client components. A React-driven counter can therefore
 * only begin once the final number has already been sitting on screen, readable,
 * for seconds, and yanking it back to zero at that point reads as a fault rather
 * than an animation.
 *
 * This script executes during HTML parse instead, so the count starts with the
 * first paint. By the time React hydrates the text already equals the
 * server-rendered value, so hydration is a no-op and there is no mismatch.
 *
 * It runs once per browsing session, and not at all under prefers-reduced-motion.
 */
const RATE_COUNT_UP_SCRIPT = `(function(){
  try {
    var el = document.currentScript && document.currentScript.previousElementSibling;
    if (!el || !el.dataset || !el.dataset.rate) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try { if (sessionStorage.getItem('383_rate_counted') === '1') return;
          sessionStorage.setItem('383_rate_counted','1'); } catch (e) { return; }
    var target = parseFloat(el.dataset.rate);
    if (!isFinite(target)) return;
    var suffix = el.dataset.suffix || '';
    var start = null, dur = 750;
    function frame(now){
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased).toFixed(2) + suffix;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = target.toFixed(2) + suffix;
    }
    el.textContent = (0).toFixed(2) + suffix;
    requestAnimationFrame(frame);
  } catch (e) { /* the server-rendered value stays put */ }
})();`;

function formatConvertedAmount(value: number) {
  const [whole, decimals] = value.toFixed(2).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimals}`;
}

function MarketCardFrame({
  eyebrow,
  title,
  icon,
  children,
  footer,
  className = "",
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <aside className={`home-market-card ${className}`}>
      <span className="home-market-orb home-market-orb-large" aria-hidden="true" />
      <span className="home-market-orb home-market-orb-small" aria-hidden="true" />
      <div className="home-market-card-inner">
        <header className="home-market-card-head">
          <span className="home-market-icon" aria-hidden="true">
            {icon}
          </span>
          <span>
            <small>{eyebrow}</small>
            <strong>{title}</strong>
          </span>
        </header>
        {children}
        <footer className="home-market-card-footer">{footer}</footer>
      </div>
    </aside>
  );
}

export function CurrencyExchangeCard({
  snapshot,
}: {
  snapshot: ExchangeSnapshot;
}) {
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState<CurrencyCode>("ALL");
  /** Counts up, so each swap keeps turning the arrows the same way rather than
   *  snapping back. Also keys the field flip. */
  const [swaps, setSwaps] = useState(0);
  const numericAmount = Number(amount.replace(",", "."));
  const converted = useMemo(() => {
    if (!Number.isFinite(numericAmount)) return 0;
    return from === "ALL"
      ? numericAmount / snapshot.allPerEur
      : numericAmount * snapshot.allPerEur;
  }, [from, numericAmount, snapshot.allPerEur]);
  const to: CurrencyCode = from === "ALL" ? "EUR" : "ALL";

  return (
    <MarketCardFrame
      eyebrow="KËMBIMI I DITËS"
      title="Lek ↔ Euro"
      icon={<Banknote size={20} strokeWidth={1.9} />}
      className="home-market-card-currency"
      footer={
        <>
          <span>
            <RefreshCw size={12} />
            {formatSourceDate(snapshot.updatedAt)}
          </span>
          <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
            Banka e Shqipërisë
            <ExternalLink size={11} />
          </a>
        </>
      }
    >
      <div className="home-exchange-rate">
        <span>1 EUR</span>
        {/* Tabular figures so the digits do not jitter horizontally while counting.
            The rendered text is the final value, so a no-JS reader still sees the
            real number; data-rate is what the inline counter below reads.

            suppressHydrationWarning because that counter is the point: it runs
            during parse and rewrites this text to 0.00 before React hydrates, so
            the DOM legitimately disagrees with the server HTML. Without it React
            treats the difference as corruption and regenerates the whole subtree,
            which threw a hydration error on every homepage load. */}
        <strong
          className="home-exchange-figure"
          data-rate={snapshot.allPerEur.toFixed(2)}
          data-suffix=" ALL"
          suppressHydrationWarning
        >
          {/* One interpolation, not `{value} ALL` — that emits two text nodes,
              and the counter collapses them into one. suppressHydrationWarning
              forgives differing text, never a differing child count. */}
          {`${snapshot.allPerEur.toFixed(2)} ALL`}
        </strong>
        <script dangerouslySetInnerHTML={{ __html: RATE_COUNT_UP_SCRIPT }} />
        {snapshot.change !== null && (
          <em data-negative={snapshot.change < 0}>
            {snapshot.change > 0 ? "+" : ""}
            {snapshot.change.toFixed(2)}
          </em>
        )}
      </div>

      <div className="home-exchange-fields">
        {/* key={swaps} restarts the flip on every swap. A CSS animation cannot be
            replayed by toggling a class in the same commit; remounting is the
            reliable way to retrigger it. */}
        <label key={`give-${swaps}`} className="home-exchange-flip">
          <span>Ti jep</span>
          <span className="home-exchange-input">
            <input
              inputMode="decimal"
              aria-label={`Shuma në ${from}`}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <b>{from}</b>
          </span>
        </label>

        <button
          type="button"
          className="home-exchange-swap"
          onClick={() => {
            setFrom(to);
            setSwaps((n) => n + 1);
          }}
          aria-label={`Këmbe drejtimin në ${to} me ${from}`}
        >
          <span
            className="home-exchange-swap-icon"
            style={{ transform: `rotate(${swaps * 180}deg)` }}
            aria-hidden="true"
          >
            <ArrowDownUp size={17} />
          </span>
        </button>

        <label key={`get-${swaps}`} className="home-exchange-flip">
          <span>Ti merr</span>
          <span className="home-exchange-output">
            <strong>{formatConvertedAmount(converted)}</strong>
            <b>{to}</b>
          </span>
        </label>
      </div>

      <p className="home-market-note">
        Kurs orientues zyrtar; banka ose këmbimorja mund të aplikojë marzh.
      </p>
    </MarketCardFrame>
  );
}

/**
 * One price, plus its own date when that date is not the row's.
 *
 * NaftaSot publishes each fuel separately and the three drift days apart, so a
 * row dated by its newest price would otherwise imply all three moved that
 * morning. When one lags, it says so on the price itself rather than dragging
 * the whole row backwards.
 */
function FuelValue({
  value,
  at,
  rowAt,
}: {
  value: number | null;
  at?: string | null;
  rowAt?: string | null;
}) {
  if (value === null) return <span className="home-fuel-unavailable">—</span>;

  const lagging = isEarlierDay(at, rowAt);

  return (
    <span data-lagging={lagging || undefined}>
      €{value.toFixed(2)}
      <small>/L</small>
      {lagging ? (
        <small className="home-fuel-since" title={`Ky çmim s'ka lëvizur që nga ${formatSourceDate(at ?? null)}`}>
          {formatSourceDate(at ?? null)}
        </small>
      ) : null}
    </span>
  );
}

/** Compares Kosovo calendar days, not raw timestamps: NaftaSot stamps some
 *  prices in +02:00 and others in UTC, so slicing the ISO string disagrees
 *  with itself either side of midnight. */
function isEarlierDay(at?: string | null, rowAt?: string | null) {
  if (!at || !rowAt) return false;
  const a = Date.parse(at);
  const b = Date.parse(rowAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return dateKeyInKosovo(new Date(a)) < dateKeyInKosovo(new Date(b));
}

/** The brand column is one narrow line that ellipsises, so each supplier gets a
 *  name that fits it. "Petrol Company" was rendering as "Petrol Com…". */
const FUEL_BRAND_LABEL: Record<FuelBrandSnapshot["brand"], string> = {
  "Shell Kosova": "Shell",
  "IP Petrol": "IP Petrol",
  "Petrol Company": "Petrol Co.",
};

function FuelBrandRow({ item }: { item: FuelBrandSnapshot }) {
  const unavailable =
    item.diesel === null && item.petrol === null && item.gas === null;

  // The newest of the row's prices — when it actually last refreshed. Falls
  // back to updatedAt for snapshots pushed before freshestAt existed.
  const rowDate = item.freshestAt ?? item.updatedAt;

  return (
    <div className="home-fuel-row" data-unavailable={unavailable || undefined}>
      <div className="home-fuel-brand">
        {/* title carries the full supplier name for anyone who needs it. */}
        <strong title={item.brand}>{FUEL_BRAND_LABEL[item.brand] ?? item.brand}</strong>
        <small>
          {unavailable ? "pa çmim publik" : formatSourceDate(rowDate)}
        </small>
      </div>
      <FuelValue value={item.diesel} at={item.dates?.diesel} rowAt={rowDate} />
      <FuelValue value={item.petrol} at={item.dates?.petrol} rowAt={rowDate} />
      <FuelValue value={item.gas} at={item.dates?.gas} rowAt={rowDate} />
    </div>
  );
}

export function FuelPricesCard({ snapshot }: { snapshot: FuelSnapshot }) {
  return (
    <MarketCardFrame
      eyebrow="DERIVATET NË KOSOVË"
      title="Çmimi për litër"
      icon={<Fuel size={20} strokeWidth={1.9} />}
      className="home-market-card-fuel"
      footer={
        <>
          <span>
            <RefreshCw size={12} />
            Rifreskim ditor
          </span>
          <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
            NaftaSot
            <ExternalLink size={11} />
          </a>
        </>
      }
    >
      <div className="home-fuel-heading" aria-hidden="true">
        <span>Pompa</span>
        <span>Dizel</span>
        <span>Benzinë</span>
        <span>Gaz</span>
      </div>
      <div className="home-fuel-table">
        {snapshot.brands.map((item) => (
          <FuelBrandRow key={item.brand} item={item} />
        ))}
      </div>
      <p className="home-market-note">
        {/* No longer one station: each fuel takes the newest price that brand
            has published, because their timestamps diverge by days. */}
        Çmimi më i fundit i publikuar për secilin derivat. Mund të ndryshojë
        sipas lokacionit.
      </p>
    </MarketCardFrame>
  );
}
