"use client";

// The small boxes of the reader's paper, each one switchable in "Rregullo
// gazetën": Dardani's thirty seconds, the home town, the numbers of the day and
// one Tregu question. Every box that has nothing true to say renders nothing.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, MapPin } from "lucide-react";
import DardaniFace from "@/components/dardani/dardani-face";
import DardaniImage from "@/components/dardani/dardani-image";
import { cityById } from "@/lib/cities.mjs";
import { kosovoDateKey, pickDailyMarkets } from "@/lib/home-tregu.mjs";
import type { CityWeather } from "@/lib/weather";

type BriefLine = { slug: string; text: string };
const BRIEF_KEY = "383:perty-brief";

/**
 * "Në 30 sekonda": Dardani's three lines, written only from the stories of
 * this edition (app/api/per-ty/brief). Kept on the device for the day, for the
 * same stories, so a return visit costs nothing. When the model is down or says
 * nothing usable, the block is simply absent.
 */
export function DardaniBrief({ slugs, print = 0 }: { slugs: string[]; print?: number }) {
  const key = [...slugs].sort().join("|");
  const [lines, setLines] = useState<BriefLine[] | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      const cached = JSON.parse(localStorage.getItem(BRIEF_KEY) ?? "null");
      if (cached?.key === key && Array.isArray(cached?.lines) && Date.now() - Number(cached?.at) < 6 * 3600_000) {
        setLines(cached.lines);
        return;
      }
    } catch {
      // Unreadable cache: ask again.
    }
    setLines(null);
    fetch("/api/per-ty/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
    })
      .then((r) => (r.ok ? r.json() : { lines: [] }))
      .then((json) => {
        if (!alive) return;
        const got: BriefLine[] = Array.isArray(json?.lines) ? json.lines : [];
        setLines(got);
        if (got.length) {
          try {
            localStorage.setItem(BRIEF_KEY, JSON.stringify({ key, at: Date.now(), lines: got }));
          } catch {
            // No storage: the brief is fetched again next visit.
          }
        }
      })
      .catch(() => alive && setLines([]));
    return () => {
      alive = false;
    };
    // `key` carries the slugs; the array itself is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (lines && lines.length === 0) return null;
  return (
    <section
      className="perty-brief"
      aria-labelledby="perty-brief-title"
      aria-busy={!lines}
      data-print
      style={{ "--i": print } as React.CSSProperties}
    >
      <header>
        <DardaniFace state="happy" size={34} decorative />
        <h2 id="perty-brief-title">Në 30 sekonda</h2>
      </header>
      {lines ? (
        <ol>
          {lines.map((line) => (
            <li key={line.slug}>
              <Link href={`/article/${line.slug}`}>{line.text}</Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="perty-brief-loading" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
    </section>
  );
}

type CityPanelData = {
  name: string;
  weather: CityWeather | null;
  border: {
    entry: { lo: number; hi: number } | null;
    exit: { lo: number; hi: number } | null;
    updatedAt: string | null;
  } | null;
  fuel: { diesel: number | null; petrol: number | null } | null;
};

/** "15–40 min", or "10 min" when every crossing reads the same. */
function waitRange(range: { lo: number; hi: number } | null | undefined) {
  if (!range) return "—";
  return range.lo === range.hi ? `${range.hi} min` : `${range.lo}–${range.hi} min`;
}

/** "1,74 €", the way prices are written here. */
function euro(n: number) {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/**
 * "Qyteti yt sot", at the top of the paper: the reader's town in one strip —
 * the weather (for the diaspora, the waits at the border), the newest story
 * from there, and the day's small print: cheapest fuel and the border. Without
 * a home town it asks for one instead.
 */
export function TownToday({
  homeId,
  story,
  onPickCity,
}: {
  homeId: string | null;
  /** The newest story from the town, if the paper has one. */
  story: { slug: string; title: string } | null;
  onPickCity: () => void;
}) {
  const city = cityById(homeId);
  const [data, setData] = useState<CityPanelData | null>(null);

  useEffect(() => {
    if (!city) return;
    let alive = true;
    setData(null);
    fetch(`/api/per-ty/city?id=${encodeURIComponent(city.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (alive && json) setData(json as CityPanelData);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [city]);

  if (!city) {
    return (
      <button type="button" className="perty-box perty-box--ask perty-town--ask" onClick={onPickCity}>
        <MapPin size={18} strokeWidth={2.4} aria-hidden="true" />
        <span>
          <strong>Nga je?</strong> Zgjidh qytetin tënd: moti, lajmet prej andej dhe çmimet e ditës dalin këtu.
        </span>
      </button>
    );
  }

  const diaspora = city.id === "diaspora";
  const weather = data?.weather ?? null;
  const border = data?.border ?? null;
  const fuel = data?.fuel ?? null;
  const facts: string[] = [];
  if (fuel?.diesel != null) facts.push(`Nafta ${euro(fuel.diesel)}`);
  if (fuel?.petrol != null) facts.push(`Benzina ${euro(fuel.petrol)}`);
  if (!diaspora && border?.entry) facts.push(`Kufiri ${waitRange(border.entry)}`);

  return (
    <section className="perty-box perty-town" aria-labelledby="perty-town-title">
      <header className="perty-town-head">
        <h2 id="perty-town-title" className="perty-box-label">
          <MapPin size={13} strokeWidth={2.6} aria-hidden="true" />
          {diaspora ? "Për diasporën sot" : `${city.name} sot`}
        </h2>
        <button type="button" className="perty-text-btn perty-town-change" onClick={onPickCity}>
          Ndrysho
        </button>
      </header>

      <div className="perty-town-main">
        {!data ? (
          <span className="perty-box-skeleton perty-town-now" aria-hidden="true" />
        ) : diaspora ? (
          <Link href="/visit" className="perty-town-now">
            <span className="perty-box-big">{waitRange(border?.entry)}</span>
            <span className="perty-box-note">
              hyrje në Kosovë{border?.exit ? ` · dalje ${waitRange(border.exit)}` : ""}
            </span>
          </Link>
        ) : weather ? (
          <div className="perty-town-now">
            <span className="perty-box-big">{weather.tempC}°</span>
            <span className="perty-box-note">
              {weather.label}
              {weather.highC !== null && weather.lowC !== null ? ` · ${weather.lowC}°/${weather.highC}°` : ""}
              {weather.rainChance !== null && weather.rainChance >= 30 ? ` · shi ${weather.rainChance}%` : ""}
            </span>
          </div>
        ) : null}

        {story ? (
          <Link href={`/article/${story.slug}`} className="perty-town-story">
            <span className="perty-town-story-kicker">{city.from}</span>
            <strong>{story.title}</strong>
          </Link>
        ) : (
          <p className="perty-town-story perty-town-story--none">
            Sot s&apos;ka ende lajm {diaspora ? "për diasporën" : `nga ${city.name}`}. Kur të ketë, del këtu i pari.
          </p>
        )}
      </div>

      {facts.length > 0 && <p className="perty-town-facts">{facts.join(" · ")}</p>}
    </section>
  );
}

/**
 * "Numrat e tu": only numbers this device can know for certain — what the
 * newsroom published in the last 24 hours, and this reader's own days, reads
 * and streak. Never a
 * rank against other readers: a guest's device has nothing to compare with.
 */
export function NumbersBox({ today, days, streak, reads }: { today: number; days: number; streak: number; reads: number }) {
  return (
    <div className="perty-box perty-box--numbers">
      <span className="perty-box-label">Numrat e tu</span>
      <dl>
        <div>
          <dt>lajme në 24 orë</dt>
          <dd>{today}</dd>
        </div>
        <div>
          <dt>ditë me ne</dt>
          <dd>{days}</dd>
        </div>
        <div>
          <dt>lexuar këtë muaj</dt>
          <dd>{reads}</dd>
        </div>
      </dl>
      {streak >= 2 && (
        <span className="perty-box-streak">
          <Flame size={14} strokeWidth={2.6} aria-hidden="true" />
          {streak} ditë rresht
        </span>
      )}
    </div>
  );
}

type MarketRow = { slug: string; question: string; category: string; status: string; market_prob: number; closes_at: string; market_type?: string };
const TREGU_CACHE = "383:paper-tregu";
const TREGU_TTL_MS = 10 * 60_000;

/**
 * One yes/no question from Tregu, picked the way the homepage picks its band.
 * Only binary markets: a match ("Peja — Vëllaznimi: kush fiton?") has teams,
 * not PO and JO, and needs its own card. The
 * markets list is heavy, so it is fetched only once the box is about to be
 * seen, aborted if the reader leaves first, and kept for the session.
 */
export function TreguBox() {
  const box = useRef<HTMLDivElement>(null);
  const [market, setMarket] = useState<MarketRow | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(TREGU_CACHE) ?? "null");
      if (cached?.slug && Date.now() - Number(cached?.at) < TREGU_TTL_MS) {
        setMarket(cached.market);
        return;
      }
    } catch {
      // No session storage: fetch below.
    }
    const el = box.current;
    if (!el) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        fetch("/api/tregu/markets", { signal: controller.signal })
          .then((r) => {
            if (!r.ok) throw new Error(`markets ${r.status}`);
            return r.json();
          })
          .then((data: { markets?: MarketRow[] }) => {
            const binary = (data?.markets ?? []).filter((m) => m?.market_type === "binary");
            const [pick] = pickDailyMarkets(binary, { dateKey: kosovoDateKey(), count: 1 });
            if (!pick) {
              setFailed(true);
              return;
            }
            const slim = {
              slug: pick.slug,
              question: pick.question,
              category: pick.category,
              status: pick.status,
              market_prob: pick.market_prob,
              closes_at: pick.closes_at,
            };
            setMarket(slim);
            try {
              sessionStorage.setItem(TREGU_CACHE, JSON.stringify({ slug: slim.slug, at: Date.now(), market: slim }));
            } catch {
              // Fine: fetched again next time.
            }
          })
          .catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setFailed(true);
          });
      },
      { rootMargin: "100% 0px" }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, []);

  if (failed) return null;
  const pct = market ? Math.round(Math.max(0, Math.min(1, Number(market.market_prob) || 0)) * 100) : null;
  return (
    <div ref={box} className="perty-box perty-box--tregu" aria-busy={!market}>
      <span className="perty-box-label">Tregu · Parashiko</span>
      {market && pct !== null ? (
        <Link href={`/tregu/${market.slug}`} className="perty-tregu">
          <strong>{market.question}</strong>
          <span className="perty-tregu-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="perty-tregu-odds">
            <b>PO {pct}%</b>
            <span>JO {100 - pct}%</span>
            <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </Link>
      ) : (
        <span className="perty-box-skeleton" aria-hidden="true" />
      )}
    </div>
  );
}

/** Dardani, once every story of the edition has been opened. */
export function AllReadCheer() {
  return <DardaniImage name="celebrating" decorative className="perty-end-img perty-end-img--cheer" />;
}
