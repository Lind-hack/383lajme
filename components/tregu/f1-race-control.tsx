"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import { ArrowDown, Flag, Radio, Ticket, Trophy } from "lucide-react";
import GroupChart from "@/components/tregu/group-chart";
import { F1_RACE_UI_VERSION } from "@/lib/tregu-ui-contract";

type Driver = {
  key: string;
  label: string;
  team: string;
  probability: number;
  headshot_url?: string;
  team_colour?: string;
  grid_position?: number;
};

type TimingRow = {
  driver_code?: string;
  position?: number;
  gap?: string;
  pits?: number;
  status?: string;
};

type Timing = {
  race?: {
    status?: string;
    current_lap?: number;
    total_laps?: number;
  };
  rows?: TimingRow[];
};

type HistoryPoint = {
  createdAt: string;
  probabilities: Record<string, number>;
  lap?: number;
  status?: string;
};

type Props = {
  marketId: string;
  marketOpen: boolean;
  drivers: Driver[];
  timing: Timing | null;
  history?: HistoryPoint[];
  selectedDriverKey?: string;
  onBetDriver?: (driverKey: string) => void;
};

const TEAM_COLORS: Record<string, string> = {
  mclaren: "#FF8000",
  ferrari: "#E8002D",
  mercedes: "#00A19C",
  "red bull": "#3671C6",
  "racing bulls": "#4E7CFF",
  williams: "#168BFF",
  "aston martin": "#229971",
  audi: "#B6B6B6",
  alpine: "#FF87BC",
  haas: "#8B8D91",
  cadillac: "#B8903E",
};

const cleanProbability = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function teamColor(driver: Driver): string {
  const supplied = String(driver.team_colour ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(supplied)) return `#${supplied}`;
  const team = String(driver.team ?? "").toLowerCase();
  return Object.entries(TEAM_COLORS).find(([name]) => team.includes(name))?.[1] ?? "#625A50";
}

function DriverFace({
  driver,
  className,
}: {
  driver: Driver;
  className: string;
}) {
  if (driver.headshot_url) {
    return (
      <img
        src={driver.headshot_url}
        alt={`Portreti i ${driver.label}`}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className={`${className} f1-driver-fallback`} aria-hidden>
      {driver.key}
    </span>
  );
}

function BetButton({
  driver,
  marketOpen,
  selected,
  onBet,
  compact = false,
}: {
  driver: Driver;
  marketOpen: boolean;
  selected: boolean;
  onBet?: (key: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className="f1-bet-button"
      data-selected={selected || undefined}
      disabled={!marketOpen}
      onClick={() => onBet?.(driver.key)}
      aria-label={marketOpen ? `Basto te ${driver.label}` : `Tregu për ${driver.label} është mbyllur`}
    >
      {!compact && <Ticket size={15} strokeWidth={2} aria-hidden />}
      {marketOpen ? (selected ? "Zgjedhur" : "Basto") : "Mbyllur"}
    </button>
  );
}

function GridMarquee({ drivers }: { drivers: Driver[] }) {
  if (drivers.length === 0) {
    return (
      <div className="f1-grid-empty">
        <Flag size={21} strokeWidth={1.8} aria-hidden />
        <strong>Në pritje të gridit zyrtar</strong>
        <span>Pozicionet shfaqen sapo verifikohen.</span>
      </div>
    );
  }

  const renderGrid = (duplicate: boolean) => (
    <ol className="f1-grid-list" aria-hidden={duplicate || undefined}>
      {drivers.map((driver) => (
        <li key={`${duplicate ? "copy-" : ""}${driver.key}`} className="f1-grid-slot">
          <span className="f1-grid-position">P{driver.grid_position}</span>
          <DriverFace driver={driver} className="f1-grid-face" />
          <span className="f1-grid-driver">
            <strong>{driver.label}</strong>
            <small>{driver.team}</small>
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <div
      className="f1-grid-marquee"
      style={{ "--f1-grid-duration": `${Math.max(34, drivers.length * 2.15)}s` } as CSSProperties}
    >
      <div className="f1-grid-track">
        {renderGrid(false)}
        {renderGrid(true)}
      </div>
    </div>
  );
}

export default function F1RaceControl({
  marketOpen,
  drivers,
  timing,
  history = [],
  selectedDriverKey,
  onBetDriver,
}: Props) {
  const fieldRef = useRef<HTMLElement>(null);
  const raceStatus = String(timing?.race?.status ?? "UNAVAILABLE").toUpperCase();
  const isLive = raceStatus === "LIVE";
  const isFinished = raceStatus === "FINISHED";

  const oddsOrder = useMemo(
    () => [...drivers].sort((a, b) => cleanProbability(b.probability) - cleanProbability(a.probability)),
    [drivers]
  );
  const gridOrder = useMemo(
    () =>
      [...drivers]
        .filter((driver) => Number.isInteger(driver.grid_position))
        .sort((a, b) => Number(a.grid_position) - Number(b.grid_position)),
    [drivers]
  );
  const timingByDriver = useMemo(
    () => new Map((timing?.rows ?? []).map((row) => [String(row.driver_code ?? "").toUpperCase(), row])),
    [timing?.rows]
  );
  const liveOrder = useMemo(
    () =>
      [...drivers].sort((a, b) => {
        const positionA = timingByDriver.get(a.key.toUpperCase())?.position ?? 99;
        const positionB = timingByDriver.get(b.key.toUpperCase())?.position ?? 99;
        return positionA - positionB;
      }),
    [drivers, timingByDriver]
  );

  const chartDrivers = (gridOrder.length >= 10 ? gridOrder : oddsOrder).slice(0, 10);
  const topTen = oddsOrder.slice(0, 10);
  const field = isLive || isFinished ? liveOrder : oddsOrder;
  const chartSeries = useMemo(
    () =>
      chartDrivers.map((driver) => {
        const points = history.flatMap((point) => {
          const t = Date.parse(point.createdAt);
          const p = Number(point.probabilities?.[driver.key]);
          return Number.isFinite(t) && Number.isFinite(p) ? [{ t, p: cleanProbability(p) }] : [];
        });
        return {
          label: driver.key,
          color: teamColor(driver),
          series: points.length > 0 ? points : undefined,
          prob: cleanProbability(driver.probability),
        };
      }),
    [chartDrivers, history]
  );

  const scrollToField = () => {
    fieldRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  const lap = timing?.race?.current_lap;
  const totalLaps = timing?.race?.total_laps;
  const hasCompleteGrid = gridOrder.length === drivers.length && drivers.length >= 20;

  return (
    <section
      className="f1-race-control"
      data-f1-race-ui-version={F1_RACE_UI_VERSION}
      aria-label="Tregu i fituesit të garës Formula 1"
    >
      <header className="f1-race-header">
        <div>
          <span className="f1-mark">F1</span>
          <h2>22 pilotë. Një fitues.</h2>
          <p>
            {marketOpen && !isFinished
              ? "Gjasat lëvizin çdo sekondë. Çdo vijë mban ngjyrën e skuadrës."
              : "Historia e regjistruar e garës, me ngjyrat e skuadrave."}
          </p>
        </div>
        <div className="f1-race-status" data-live={isLive || undefined}>
          {isLive ? <Radio size={16} strokeWidth={2} aria-hidden /> : <Flag size={16} strokeWidth={2} aria-hidden />}
          <span>
            {isLive
              ? `LIVE${lap ? ` · Xhiro ${lap}${totalLaps ? `/${totalLaps}` : ""}` : ""}`
              : isFinished
                ? "Gara përfundoi"
                : "Para garës"}
          </span>
        </div>
      </header>

      <div className="f1-race-stage">
        <div className="f1-chart-shell">
          <div className="f1-section-heading">
            <div>
              <h3>{gridOrder.length >= 10 ? "Top 10 nga gridi" : "Top 10 sipas gjasave"}</h3>
              <p>Çmimi live i fitores</p>
            </div>
            <span className="f1-refresh-label">
              <Radio size={14} strokeWidth={2} aria-hidden />
              {marketOpen && !isFinished ? "rifreskim 1s" : "arkiv"}
            </span>
          </div>
          <GroupChart
            height={390}
            cadenceMs={120_000}
            series={chartSeries}
            normalize={false}
            animate={marketOpen && !isFinished}
          />
        </div>

        {!isLive && !isFinished && (
          <aside className="f1-grid-card" aria-label="Gridi zyrtar i nisjes">
            <div className="f1-grid-card-head">
              <span>
                <Flag size={17} strokeWidth={2} aria-hidden />
                Gridi
              </span>
              <strong>{hasCompleteGrid ? `P1-P${drivers.length}` : "Zyrtar"}</strong>
            </div>
            <GridMarquee drivers={gridOrder} />
          </aside>
        )}
      </div>

      <section className="f1-favorites-section" aria-labelledby="f1-favorites-title">
        <div className="f1-section-heading">
          <div>
            <h3 id="f1-favorites-title">10 favoritët për fitore</h3>
            <p>Renditur nga gjasa më e lartë</p>
          </div>
          <Trophy size={19} strokeWidth={1.9} aria-hidden />
        </div>
        <ol className="f1-favorites">
          {topTen.map((driver, index) => {
            const color = teamColor(driver);
            return (
              <li
                key={driver.key}
                className="f1-favorite-card"
                style={{ "--f1-team": color } as CSSProperties}
              >
                <span className="f1-favorite-rank">{String(index + 1).padStart(2, "0")}</span>
                <DriverFace driver={driver} className="f1-favorite-face" />
                <span className="f1-favorite-name">
                  <strong>{driver.label}</strong>
                  <small>{driver.team}</small>
                </span>
                <span className="f1-favorite-odds">
                  {(cleanProbability(driver.probability) * 100).toFixed(1)}%
                </span>
                <BetButton
                  driver={driver}
                  marketOpen={marketOpen}
                  selected={selectedDriverKey === driver.key}
                  onBet={onBetDriver}
                  compact
                />
              </li>
            );
          })}
        </ol>
      </section>

      <button type="button" className="f1-continue-button" onClick={scrollToField}>
        <span>
          <strong>Vazhdo</strong>
          Shiko të gjithë pilotët
        </span>
        <ArrowDown size={19} strokeWidth={2} aria-hidden />
      </button>

      <section ref={fieldRef} className="f1-full-field" aria-labelledby="f1-full-field-title">
        <div className="f1-full-field-head">
          <div>
            <h3 id="f1-full-field-title">
              {drivers.length === 22 ? "Të 22 pilotët" : "Të gjithë pilotët"}
            </h3>
            <p>
              {isLive || isFinished
                ? "Renditja dhe diferenca ndaj liderit"
                : "Nga favoriti te piloti me gjasën më të ulët"}
            </p>
          </div>
          <span>{isLive ? "LIVE TIMING" : "GJASA PËR FITORE"}</span>
        </div>

        <div className="f1-field-columns" aria-hidden>
          <span>Poz.</span>
          <span>Piloti</span>
          <span>{isLive || isFinished ? "Diferenca" : "Gjasa"}</span>
          <span>Veprimi</span>
        </div>

        <ol className="f1-field-list">
          {field.map((driver, index) => {
            const timingRow = timingByDriver.get(driver.key.toUpperCase());
            const position = isLive || isFinished ? timingRow?.position ?? index + 1 : index + 1;
            const gap =
              position === 1
                ? "Lider"
                : String(timingRow?.gap ?? "Pa të dhëna").replace(/^LEADER$/i, "Lider");
            return (
              <li
                key={driver.key}
                className="f1-field-row"
                data-selected={selectedDriverKey === driver.key || undefined}
                style={{ "--f1-team": teamColor(driver) } as CSSProperties}
              >
                <span className="f1-field-position">{String(position).padStart(2, "0")}</span>
                <DriverFace driver={driver} className="f1-field-face" />
                <span className="f1-field-driver">
                  <strong>{driver.label}</strong>
                  <small>{driver.team}</small>
                </span>
                <span className="f1-field-value">
                  {isLive || isFinished ? gap : `${(cleanProbability(driver.probability) * 100).toFixed(1)}%`}
                </span>
                <BetButton
                  driver={driver}
                  marketOpen={marketOpen}
                  selected={selectedDriverKey === driver.key}
                  onBet={onBetDriver}
                />
              </li>
            );
          })}
        </ol>
      </section>
    </section>
  );
}
