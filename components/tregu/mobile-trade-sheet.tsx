"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import CoinFace from "@/components/tregu/coin-face";

export type MobileTradeMode = "buy" | "sell";

export interface MobileTradeOption {
  key: string;
  label: string;
  probability: number;
  color: string;
  imageUrl?: string;
  heldShares?: number;
}

export interface MobileTradeReceipt {
  market: string;
  selection: string;
  coins: number;
  potentialReturn: number;
  probability: number;
  color: string;
  imageUrl?: string;
  finish: "standard" | "gloss" | "carbon" | "metallic" | "parquet" | "speed";
}

interface MobileTradeSheetProps {
  open: boolean;
  mode: MobileTradeMode;
  marketOpen: boolean;
  loggedIn: boolean;
  loginHref: string;
  question: string;
  balance: number | null;
  options: MobileTradeOption[];
  selectedKey: string;
  amount: number;
  sellShares: number;
  maxSellShares: number;
  buyReturn: number | null;
  sellReturn: number | null;
  canBuy: boolean;
  canSell: boolean;
  sellEnabled: boolean;
  placing: boolean;
  message: { ok: boolean; text: string } | null;
  receipt: MobileTradeReceipt | null;
  onOpen: (mode: MobileTradeMode) => void;
  onClose: () => void;
  onModeChange: (mode: MobileTradeMode) => void;
  onSelect: (key: string) => void;
  onAmountChange: (amount: number) => void;
  onSellSharesChange: (shares: number) => void;
  onSubmit: () => void;
  onDismissReceipt: () => void;
}

const QUICK_AMOUNTS = [10, 25, 50, 100];
const SELL_PARTS = [0.25, 0.5, 1];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export default function MobileTradeSheet({
  open,
  mode,
  marketOpen,
  loggedIn,
  loginHref,
  question,
  balance,
  options,
  selectedKey,
  amount,
  sellShares,
  maxSellShares,
  buyReturn,
  sellReturn,
  canBuy,
  canSell,
  sellEnabled,
  placing,
  message,
  receipt,
  onOpen,
  onClose,
  onModeChange,
  onSelect,
  onAmountChange,
  onSellSharesChange,
  onSubmit,
  onDismissReceipt,
}: MobileTradeSheetProps) {
  const [animateSheet, setAnimateSheet] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    const mobileReceipt = Boolean(receipt) && window.matchMedia("(max-width: 760px)").matches;
    if (!open && !mobileReceipt) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, receipt]);

  const openFromDock = (event: MouseEvent<HTMLButtonElement>, nextMode: MobileTradeMode) => {
    setAnimateSheet(event.detail !== 0);
    onOpen(nextMode);
  };

  const receiptStyle = receipt
    ? ({ "--trade-celebration": receipt.color } as CSSProperties)
    : undefined;

  return (
    <>
      <div className="tregu-mobile-dock" data-market-open={marketOpen} aria-label="Veprimet e tregut">
        <button
          type="button"
          className="tregu-mobile-dock-sell"
          disabled={!marketOpen || !sellEnabled}
          aria-describedby={!sellEnabled ? "tregu-mobile-sell-state" : undefined}
          onClick={(event) => openFromDock(event, "sell")}
        >
          <span>Shit</span>
          <strong>{sellEnabled ? "Pozicionin" : "Pa pozicion"}</strong>
        </button>
        <button
          type="button"
          className="tregu-mobile-dock-buy"
          disabled={!marketOpen}
          onClick={(event) => openFromDock(event, "buy")}
        >
          <span>Blej</span>
          <strong>{selected ? `${Math.round(selected.probability * 100)}%` : "383C"}</strong>
        </button>
        <span id="tregu-mobile-sell-state" className="tregu-sr-only">
          Shitja aktivizohet pasi të kesh blerë një pozicion në këtë treg.
        </span>
      </div>

      <div
        className="tregu-mobile-sheet-layer"
        data-open={open}
        data-motion={animateSheet}
        aria-hidden={!open}
      >
        <button className="tregu-mobile-sheet-scrim" type="button" aria-label="Mbyll panelin" onClick={onClose} />
        <section className="tregu-mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="tregu-mobile-sheet-title">
          <div className="tregu-mobile-sheet-handle" aria-hidden />
          <div className="tregu-mobile-sheet-topline">
            <div className="tregu-mobile-sheet-modes" aria-label="Lloji i tregtimit">
              <button type="button" aria-pressed={mode === "buy"} onClick={() => onModeChange("buy")}>Blej</button>
              <button type="button" aria-pressed={mode === "sell"} disabled={!sellEnabled} onClick={() => onModeChange("sell")}>Shit</button>
            </div>
            <button ref={closeButtonRef} className="tregu-mobile-sheet-close" type="button" onClick={onClose} aria-label="Mbyll">
              <CloseIcon />
            </button>
          </div>

          <div className="tregu-mobile-sheet-market">
            {selected?.imageUrl ? (
              // The visible selection label supplies the accessible name.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.imageUrl} alt="" aria-hidden referrerPolicy="no-referrer" />
            ) : (
              <span className="tregu-mobile-sheet-coin"><CoinFace size={34} /></span>
            )}
            <div>
              <p id="tregu-mobile-sheet-title">{question}</p>
              <strong>{selected?.label ?? "Zgjidh rezultatin"}</strong>
            </div>
          </div>

          {!marketOpen ? (
            <div className="tregu-mobile-sheet-empty">
              <strong>Ky treg është mbyllur.</strong>
              <span>Pozicionet nuk mund të ndryshohen pas mbylljes.</span>
            </div>
          ) : !loggedIn ? (
            <div className="tregu-mobile-sheet-empty">
              <strong>Kyçu për të tregtuar me 383 Coin.</strong>
              <span>Bilanci dhe pozicionet e tua ruhen në profil.</span>
              <Link href={loginHref}>Kyçu dhe vazhdo</Link>
            </div>
          ) : (
            <>
              {options.length > 1 && (
                <div className="tregu-mobile-sheet-options" role="radiogroup" aria-label="Zgjidh rezultatin">
                  {options.map((option) => {
                    const unavailable = mode === "sell" && Number(option.heldShares ?? 0) <= 0;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={option.key === selectedKey}
                        data-active={option.key === selectedKey}
                        disabled={unavailable}
                        style={{ "--trade-option": option.color } as CSSProperties}
                        onClick={() => onSelect(option.key)}
                      >
                        {option.imageUrl && (
                          // The adjacent text names the outcome.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={option.imageUrl} alt="" aria-hidden referrerPolicy="no-referrer" />
                        )}
                        <span>{option.label}</span>
                        <strong>{(option.probability * 100).toFixed(0)}%</strong>
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === "buy" ? (
                <div className="tregu-mobile-sheet-trade">
                  <div className="tregu-mobile-sheet-balance">
                    <span>Shuma</span>
                    {balance !== null && <small>Bilanci {balance.toFixed(0)} 383C</small>}
                  </div>
                  <label className="tregu-mobile-sheet-amount">
                    <CoinFace size={30} />
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={amount}
                      onChange={(event) => onAmountChange(Math.max(1, Number(event.target.value) || 1))}
                      aria-label="Shuma në 383 Coin"
                    />
                    <span>383C</span>
                  </label>
                  <div className="tregu-mobile-sheet-quick">
                    {QUICK_AMOUNTS.map((quickAmount) => (
                      <button key={quickAmount} type="button" data-active={amount === quickAmount} onClick={() => onAmountChange(quickAmount)}>
                        +{quickAmount}
                      </button>
                    ))}
                  </div>
                  <div className="tregu-mobile-sheet-return">
                    <span>Fitimi i mundshëm</span>
                    <strong>{buyReturn === null ? "—" : `${buyReturn.toFixed(1)} 383C`}</strong>
                  </div>
                  <button className="tregu-mobile-sheet-submit" type="button" disabled={!canBuy} onClick={onSubmit}>
                    {placing ? "Duke blerë..." : `Blej ${selected?.label ?? "pozicionin"}`}
                  </button>
                </div>
              ) : (
                <div className="tregu-mobile-sheet-trade">
                  <div className="tregu-mobile-sheet-balance">
                    <span>Aksione për të shitur</span>
                    <small>Ke {maxSellShares.toFixed(2)}</small>
                  </div>
                  <label className="tregu-mobile-sheet-amount">
                    <input
                      type="number"
                      min={0}
                      max={maxSellShares}
                      step={0.01}
                      inputMode="decimal"
                      value={sellShares || ""}
                      onChange={(event) => onSellSharesChange(Math.min(maxSellShares, Math.max(0, Number(event.target.value) || 0)))}
                      aria-label="Aksione për të shitur"
                    />
                    <span>aksione</span>
                  </label>
                  <div className="tregu-mobile-sheet-quick">
                    {SELL_PARTS.map((part) => (
                      <button key={part} type="button" data-active={Math.abs(sellShares - maxSellShares * part) < 0.01} onClick={() => onSellSharesChange(maxSellShares * part)}>
                        {part === 1 ? "Të gjitha" : `${part * 100}%`}
                      </button>
                    ))}
                  </div>
                  <div className="tregu-mobile-sheet-fee" role="note">
                    <strong>Kosto e daljes</strong>
                    <span>Shitja llogaritet me çmimin aktual dhe ndikimin e tregut; kthimi mund të jetë më i ulët se blerja.</span>
                  </div>
                  <div className="tregu-mobile-sheet-return">
                    <span>Merr afërsisht</span>
                    <strong>{sellReturn === null ? "—" : `${sellReturn.toFixed(1)} 383C`}</strong>
                  </div>
                  <button className="tregu-mobile-sheet-submit" data-variant="sell" type="button" disabled={!canSell} onClick={onSubmit}>
                    {placing ? "Duke shitur..." : "Shit pozicionin"}
                  </button>
                </div>
              )}
              {message && <p className="tregu-mobile-sheet-message" data-ok={message.ok}>{message.text}</p>}
            </>
          )}
        </section>
      </div>

      {receipt && (
        <section
          className="tregu-trade-celebration"
          data-finish={receipt.finish}
          style={receiptStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tregu-trade-celebration-title"
        >
          <div className="tregu-trade-celebration-wash" aria-hidden />
          <div className="tregu-trade-celebration-ribbons" aria-hidden><i /><i /><i /></div>
          <div className="tregu-trade-celebration-sparks" aria-hidden>
            {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
          </div>
          <button type="button" onClick={onDismissReceipt} aria-label="Mbyll konfirmimin"><CloseIcon /></button>
          <div className="tregu-trade-celebration-content">
            <div className="tregu-trade-celebration-confirm"><span><CheckIcon /></span> U ble</div>
            <div className="tregu-trade-celebration-mark">
              {receipt.imageUrl ? (
                // The visible receipt heading names this mark.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receipt.imageUrl} alt="" aria-hidden referrerPolicy="no-referrer" />
              ) : <CoinFace size={58} />}
            </div>
            <p>{receipt.market}</p>
            <h2 id="tregu-trade-celebration-title">{receipt.selection}</h2>
            <dl>
              <div><dt>U tregtuan</dt><dd>{receipt.coins.toFixed(0)} 383C</dd></div>
              <div><dt>Gjasa</dt><dd>{(receipt.probability * 100).toFixed(0)}%</dd></div>
              <div><dt>Fitimi i mundshëm</dt><dd>{receipt.potentialReturn.toFixed(1)} 383C</dd></div>
            </dl>
            <small>383 Tregu</small>
          </div>
        </section>
      )}
    </>
  );
}
