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
      eyebrow="KËMBIMI I JAVËS"
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
        <strong>{snapshot.allPerEur.toFixed(2)} ALL</strong>
        {snapshot.change !== null && (
          <em data-negative={snapshot.change < 0}>
            {snapshot.change > 0 ? "+" : ""}
            {snapshot.change.toFixed(2)}
          </em>
        )}
      </div>

      <div className="home-exchange-fields">
        <label>
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
          onClick={() => setFrom(to)}
          aria-label={`Këmbe drejtimin në ${to} me ${from}`}
        >
          <ArrowDownUp size={17} />
        </button>

        <label>
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

function FuelValue({ value }: { value: number | null }) {
  return value === null ? (
    <span className="home-fuel-unavailable">—</span>
  ) : (
    <span>
      €{value.toFixed(2)}
      <small>/L</small>
    </span>
  );
}

function FuelBrandRow({ item }: { item: FuelBrandSnapshot }) {
  const unavailable =
    item.diesel === null && item.petrol === null && item.gas === null;

  return (
    <div className="home-fuel-row" data-unavailable={unavailable || undefined}>
      <div className="home-fuel-brand">
        <strong>{item.brand.replace(" Kosova", "")}</strong>
        <small>
          {unavailable ? "pa çmim publik" : formatSourceDate(item.updatedAt)}
        </small>
      </div>
      <FuelValue value={item.diesel} />
      <FuelValue value={item.petrol} />
      <FuelValue value={item.gas} />
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
            Rifreskim javor
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
        Çmimi i stacionit më të fundit me të dhëna të plota. Mund të ndryshojë
        sipas lokacionit.
      </p>
    </MarketCardFrame>
  );
}
