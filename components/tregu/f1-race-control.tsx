"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, Flag, Radio, Ticket, Trophy } from "lucide-react";
import ExactMarketChart from "@/components/tregu/exact-market-chart";
import { f1DriverHeadshot, f1TeamColor } from "@/lib/f1-driver-presentation";
import { F1_RACE_UI_VERSION } from "@/lib/tregu-ui-contract";
import SportBrandMark from "@/components/tregu/sport-brand-mark";

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

const cleanProbability = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function teamColor(driver: Driver): string {
  return f1TeamColor(driver.team, driver.team_colour);
}

function DriverFace({
  driver,
  className,
  eager = false,
}: {
  driver: Driver;
  className: string;
  eager?: boolean;
}) {
  const headshot = f1DriverHeadshot(driver.key, driver.headshot_url);
  if (headshot) {
    return (
      <img
        src={headshot}
        alt={`Portreti i ${driver.label}`}
        className={className}
        loading={eager ? "eager" : "lazy"}
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

  const pairs = Array.from({ length: Math.ceil(drivers.length / 2) }, (_, index) =>
    drivers.slice(index * 2, index * 2 + 2)
  );

  return (
    <div
      className="f1-grid-marquee"
      style={{ "--f1-grid-duration": `${Math.max(30, pairs.length * 3.1)}s` } as CSSProperties}
    >
      <div className="f1-grid-track">
        <ol className="f1-grid-list">
          {pairs.map((pair, pairIndex) => (
            <li key={`grid-row-${pairIndex + 1}`} className="f1-grid-pair">
              {pair.map((driver, laneIndex) => (
                <article
                  key={driver.key}
                  className="f1-grid-slot"
                  data-lane={laneIndex === 0 ? "left" : "right"}
                  aria-label={`Pozita ${driver.grid_position}: ${driver.label}, ${driver.team}`}
                >
                  <span className="f1-grid-position">P{driver.grid_position}</span>
                  <DriverFace driver={driver} className="f1-grid-face" eager />
                  <span className="f1-grid-driver">
                    <strong>{driver.label}</strong>
                    <small>{driver.team}</small>
                  </span>
                </article>
              ))}
            </li>
          ))}
        </ol>
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
  const [showAllDrivers, setShowAllDrivers] = useState(false);
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

  const chartDrivers = useMemo(
    () => oddsOrder.slice(0, 5),
    [oddsOrder]
  );
  const field = isLive || isFinished ? liveOrder : oddsOrder;
  const visibleDrivers = showAllDrivers ? field : field.slice(0, 10);
  const chartSeries = useMemo(
    () =>
      chartDrivers.map((driver) => {
        const points = history.flatMap((point) => {
          const t = Date.parse(point.createdAt);
          const p = Number(point.probabilities?.[driver.key]);
          return Number.isFinite(t) && Number.isFinite(p) ? [{ t, p: cleanProbability(p) }] : [];
        });
        return {
          key: driver.key,
          label: driver.key,
          color: teamColor(driver),
          points,
          current: cleanProbability(driver.probability),
        };
      }),
    [chartDrivers, history]
  );

  const lap = timing?.race?.current_lap;
  const totalLaps = timing?.race?.total_laps;
  const hasCompleteGrid = gridOrder.length === drivers.length && drivers.length >= 20;

  return (
    <section
      className="f1-race-control tregu-detail-chart-shell"
      data-tone="sport"
      data-f1-race-ui-version={F1_RACE_UI_VERSION}
      aria-label="Tregu i fituesit të garës Formula 1"
    >
      <header className="f1-race-header">
        <div>
          <SportBrandMark brandKey="f1" size="lg" />
          <h2>22 pilotë. Një fitues.</h2>
          <p>
            {marketOpen && !isFinished
              ? "Gjasat përditësohen vetëm kur mbërrin një vektor i verifikuar. Çdo vijë mban ngjyrën e skuadrës."
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
              <h3>5 favoritët</h3>
              <p>Vetëm vijat që ndikojnë garën për fitore</p>
            </div>
            <span className="f1-refresh-label">
              <Radio size={14} strokeWidth={2} aria-hidden />
              {marketOpen && !isFinished ? "të dhëna të verifikuara" : "arkiv"}
            </span>
          </div>
          <ExactMarketChart
            height={300}
            minimal
            tone="sport"
            series={chartSeries}
            ariaLabel="Historia e verifikuar e gjasave të pilotëve"
          />
        </div>

        {!isLive && (
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
            <h3 id="f1-favorites-title">
              {showAllDrivers
                ? drivers.length === 22
                  ? "Të 22 pilotët"
                  : "Të gjithë pilotët"
                : "10 favoritët për fitore"}
            </h3>
            <p>
              {isLive || isFinished
                ? "Renditja dhe diferenca ndaj liderit"
                : showAllDrivers
                  ? "Nga favoriti te piloti me gjasën më të ulët"
                  : "Renditur nga gjasa më e lartë"}
            </p>
          </div>
          <span className="f1-driver-market-state">
            <Trophy size={18} strokeWidth={1.9} aria-hidden />
            {isLive || isFinished ? "LIVE TIMING" : "GJASA PËR FITORE"}
          </span>
        </div>
        <ol id="f1-driver-market-list" className="f1-favorites">
          {visibleDrivers.map((driver, index) => {
            const color = teamColor(driver);
            const timingRow = timingByDriver.get(driver.key.toUpperCase());
            const position = isLive || isFinished ? timingRow?.position ?? index + 1 : index + 1;
            const gap =
              position === 1
                ? "Lider"
                : String(timingRow?.gap ?? "Pa të dhëna").replace(/^LEADER$/i, "Lider");
            return (
              <li
                key={driver.key}
                className="f1-favorite-card"
                data-revealed={index >= 10 || undefined}
                data-selected={selectedDriverKey === driver.key || undefined}
                style={
                  {
                    "--f1-team": color,
                    "--f1-reveal-delay": `${Math.max(0, index - 10) * 34}ms`,
                  } as CSSProperties
                }
              >
                <span className="f1-favorite-rank">{String(position).padStart(2, "0")}</span>
                <DriverFace driver={driver} className="f1-favorite-face" />
                <span className="f1-favorite-name">
                  <strong>{driver.label}</strong>
                  <small>{driver.team}</small>
                </span>
                <span className="f1-favorite-odds" data-live={isLive || isFinished || undefined}>
                  {isLive || isFinished
                    ? gap
                    : `${(cleanProbability(driver.probability) * 100).toFixed(1)}%`}
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
        {field.length > 10 && (
          <button
            type="button"
            className="f1-continue-button"
            data-expanded={showAllDrivers || undefined}
            aria-expanded={showAllDrivers}
            aria-controls="f1-driver-market-list"
            onClick={() => setShowAllDrivers((current) => !current)}
          >
            <span>
              <strong>{showAllDrivers ? "Mbyll" : "Vazhdo"}</strong>
              {showAllDrivers ? "Shfaq vetëm top 10" : `Shfaq edhe ${field.length - 10} pilotët e tjerë`}
            </span>
            <ChevronDown size={19} strokeWidth={2} aria-hidden />
          </button>
        )}
      </section>
    </section>
  );
}
