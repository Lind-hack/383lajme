"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Article } from "@/lib/mock-data";
import type { SectionMarket } from "@/lib/kategori-market";
import { LoadMoreButton, focusFirstNew, useArticlePages } from "@/components/load-more-articles";
import { CoinIcon } from "@/components/tab-icons";
import { dateKeyInKosovo } from "@/lib/reagimi-data";
import { PYET_OPEN_EVENT } from "@/lib/pyet-thread";

/** What a feed card renders; the server sends nothing else. */
export type FeedItem = {
  id: string;
  slug: string;
  title: string;
  imageUrl?: string | null;
  publishedAt: string;
  /** The story's city within this section, from lib/section-cities. */
  cityId?: string | null;
};

export type FeedCity = { name: string; emblem: string };

/** The blocks that break the run of cards, in the order they first appear. */
export type FeedHooks = {
  /** The section's three most-read stories. */
  top?: FeedItem[];
  /** A swipe row: one story per city, or the section's photo stories. */
  carousel?: { title: string; items: FeedItem[] };
  /** An open Tregu market on the section, else the Pyet Dardanin card. */
  market?: SectionMarket | null;
};

/** Cards between two blocks: two rows of three on desktop, ~6–8s on a phone. */
const RUN = 6;
/** Stories listed beside a large one. */
const FEATURE_SIDE = 3;

// Spelled out rather than taken from Intl's "sq" locale, which trimmed ICU
// builds (and some browsers) silently replace with English.
const WEEKDAYS = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/** "Sot", "Dje", or "E enjte, 8 tetor" for a Kosovo YYYY-MM-DD key. */
function dayLabel(key: string, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return "Sot";
  if (key === yesterdayKey) return "Dje";
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday] ?? ""}, ${d} ${MONTHS[m - 1] ?? ""}`;
}

/** "në Kosovë", "në sport": how Dardani's prompts name the section. */
const SECTION_IN: Record<string, string> = {
  Kosovë: "në Kosovë",
  Shqipëri: "në Shqipëri",
  Sport: "në sport",
  Teknologji: "në teknologji",
  Ekonomi: "në ekonomi",
  Botë: "në botë",
  Showbiz: "në showbiz",
};

function toItem(article: Article): FeedItem {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    imageUrl: article.imageUrl ?? null,
    publishedAt: article.publishedAt,
    cityId: (article as Article & { cityId?: string | null }).cityId ?? null,
  };
}

/**
 * A category's stories with the run broken on purpose.
 *
 * Every six cards the feed changes shape — a large photo story beside the
 * next few, the
 * section's most-read three, a swipe row, a Tregu market or Pyet Dardanin —
 * so a reader scrolling on is met by something new every few seconds instead
 * of the same card to the end of the archive. Once the one-off blocks are
 * spent, every seventh story is shown large.
 *
 * With `loadMore` it pages back through the archive as the reader nears the
 * end, and puts the loaded cards and the scroll back after Back from a story.
 */
export default function KategoriFeed({
  section,
  items,
  cities,
  hooks,
  todayKey: serverToday,
  loadMore,
  endNote,
}: {
  section: string;
  items: FeedItem[];
  /** City id → name and emblem, for the label on each card. */
  cities: Record<string, FeedCity>;
  hooks: FeedHooks;
  /** The server's "today", so the first render matches; corrected on mount. */
  todayKey: string;
  loadMore?: { category: string; seenIds: string[] };
  /** Shown under the last card when there is nothing further to load. */
  endNote?: string;
}) {
  const [todayKey, setTodayKey] = useState(serverToday);
  useEffect(() => setTodayKey(dateKeyInKosovo()), []);
  const yesterdayKey = dateKeyInKosovo(new Date(Date.parse(`${todayKey}T12:00:00Z`) - 86_400_000));

  const oldest = items.reduce<string | null>(
    (min, a) => (a.publishedAt && (!min || a.publishedAt < min) ? a.publishedAt : min),
    null
  );
  // `loadMore` is a new object every render; effects key off these instead.
  const paging = Boolean(loadMore);
  const category = loadMore?.category;
  const pages = useArticlePages({
    cursor: paging ? oldest : null,
    category,
    seenIds: loadMore?.seenIds ?? [],
  });
  const { status, loadMore: loadPage, restore, getCursor } = pages;
  const feedKey = `383-kategori-feed:${category ?? "none"}`;
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Back from a story: the cards already loaded and the scroll position return.
  useEffect(() => {
    if (!paging) return;
    try {
      const returning = sessionStorage.getItem(`${feedKey}:return`);
      sessionStorage.removeItem(`${feedKey}:return`);
      const raw = sessionStorage.getItem(feedKey);
      if (returning === null || !raw) return;
      const saved = JSON.parse(raw) as { items?: Article[]; next?: string | null; at?: number };
      if (!saved?.items?.length || Date.now() - (saved?.at ?? 0) > 30 * 60 * 1000) return;
      restore(saved.items, saved?.next ?? null);
      const y = Number(returning);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    } catch {
      // Storage unavailable: the feed starts fresh.
    }
  }, [paging, feedKey, restore]);

  useEffect(() => {
    if (!paging || pages.items.length === 0) return;
    try {
      sessionStorage.setItem(feedKey, JSON.stringify({ items: pages.items, next: getCursor(), at: Date.now() }));
    } catch {
      // Quota or private mode: nothing to restore later, nothing breaks now.
    }
  }, [paging, feedKey, pages.items, getCursor]);

  // The next page is asked for ~2 screens before the end, so scrolling never
  // meets a wall; a sentinel already flung past still counts as reached.
  useEffect(() => {
    if (!paging || status !== "idle") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadPage();
      },
      { rootMargin: "100000px 0px 1200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [paging, status, loadPage]);

  const all = [...items, ...pages.items.map(toItem)];

  // The order the blocks first appear in; after that, a large story each time.
  type Hook = "feature" | "top" | "carousel" | "act";
  const queue: Hook[] = ["feature"];
  if ((hooks.top?.length ?? 0) >= 3) queue.push("top");
  if ((hooks.carousel?.items.length ?? 0) >= 3) queue.push("carousel");
  queue.push("act");

  const out: ReactNode[] = [];
  let run: FeedItem[] = [];
  let sinceBreak = 0;
  let next = 0;
  let lastDay: string | null = null;
  const flush = () => {
    if (run.length) out.push(<CardGrid key={`g-${run[0].id}`} items={run} cities={cities} />);
    run = [];
  };

  for (let i = 0; i < all.length; i++) {
    const item = all[i];
    const day = dateKeyInKosovo(new Date(item.publishedAt));
    if (day !== lastDay) {
      flush();
      out.push(
        <h2 key={`d-${day}`} className="kf-day">
          {dayLabel(day, todayKey, yesterdayKey)}
        </h2>
      );
      lastDay = day;
    }
    if (sinceBreak === RUN) {
      sinceBreak = 0;
      flush();
      const hook = queue[next++] ?? "feature";
      if (hook === "feature") {
        // The large story shares its row with the next few from the same day,
        // so the block is a photo beside a short list, not a wall of photo.
        const side: FeedItem[] = [];
        while (side.length < FEATURE_SIDE && i + 1 < all.length && dateKeyInKosovo(new Date(all[i + 1].publishedAt)) === day) {
          side.push(all[++i]);
        }
        out.push(<FeatureBlock key={`f-${item.id}`} item={item} side={side} cities={cities} />);
        continue;
      }
      if (hook === "top") out.push(<TopThree key="top" section={section} items={hooks.top ?? []} />);
      if (hook === "carousel" && hooks.carousel) out.push(<Carousel key="carousel" {...hooks.carousel} cities={cities} />);
      if (hook === "act") {
        out.push(
          hooks.market ? (
            <MarketCard key="act" market={hooks.market} />
          ) : (
            <DardaniCard key="act" section={section} />
          )
        );
      }
    }
    run.push(item);
    sinceBreak++;
  }
  flush();

  if (all.length === 0) return null;

  return (
    <section className="kf" aria-label={`Lajmet e ${section}`}>
      <div
        ref={listRef}
        onClickCapture={
          paging
            ? (event) => {
                if ((event.target as HTMLElement).closest("a[href]")) {
                  try {
                    sessionStorage.setItem(`${feedKey}:return`, String(window.scrollY));
                  } catch {
                    // No storage: Back starts the feed fresh.
                  }
                }
              }
            : undefined
        }
      >
        {out}
      </div>

      {paging && status === "loading" && (
        <div className="kf-skeletons" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="kf-skeleton">
              <i />
              <i />
            </div>
          ))}
        </div>
      )}
      {paging && <div ref={sentinelRef} className="kf-sentinel" aria-hidden="true" />}
      {paging && (status === "error" || status === "done") && (
        <LoadMoreButton
          status={status}
          added={pages.items.length}
          onClick={async () => {
            const from = all.length;
            const fresh = await pages.loadMore();
            if (fresh.length) requestAnimationFrame(() => focusFirstNew(listRef.current, from));
          }}
        />
      )}
      {!paging && endNote && <p className="kf-end">{endNote}</p>}
    </section>
  );
}

/** A photograph that falls back to the section-tinted block if it fails. */
function Photo({ src, sizes, className }: { src?: string | null; sizes: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={className}>
      {src && !failed && <Image src={src} alt="" fill sizes={sizes} quality={90} onError={() => setFailed(true)} />}
    </span>
  );
}

function CityTag({ city }: { city?: FeedCity }) {
  if (!city) return null;
  return (
    <span className="kf-city">
      <img src={city.emblem} alt="" width={18} height={18} loading="lazy" decoding="async" />
      {city.name}
    </span>
  );
}

/** The standard card: photograph, headline, and the city when there is one. */
function Card({ item, city }: { item: FeedItem; city?: FeedCity }) {
  return (
    <li className="kf-cell">
      <Link href={`/article/${item.slug}`} className="kf-card">
        <Photo src={item.imageUrl} sizes="(max-width: 640px) 112px, 160px" className="kf-thumb" />
        <span className="kf-body">
          <span className="kf-title">{item.title}</span>
          {city && (
            <span className="kf-meta">
              <CityTag city={city} />
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function CardGrid({ items, cities }: { items: FeedItem[]; cities: Record<string, FeedCity> }) {
  return (
    <ul className="kf-grid">
      {items.map((item) => (
        <Card key={item.id} item={item} city={item.cityId ? cities[item.cityId] : undefined} />
      ))}
    </ul>
  );
}

/**
 * One story shown large, headline on the photograph, beside the next stories
 * of the same day. It used to take the full width at 21:9 — around 600px tall
 * on a laptop, a whole screen of one photograph — which read as an interruption
 * rather than a story. Half the row now, and the other half keeps reading.
 */
function FeatureBlock({ item, side, cities }: { item: FeedItem; side: FeedItem[]; cities: Record<string, FeedCity> }) {
  const city = item.cityId ? cities[item.cityId] : undefined;
  return (
    <div className="kf-feature-block kf-hook" data-side={side.length > 0 ? "true" : undefined}>
      <Link href={`/article/${item.slug}`} className="kf-feature">
        <Photo src={item.imageUrl} sizes="(max-width: 860px) 100vw, 720px" className="kf-feature-photo" />
        <span className="kf-feature-body">
          {city && (
            <span className="kf-feature-city">
              <img src={city.emblem} alt="" width={20} height={20} loading="lazy" decoding="async" />
              {city.name}
            </span>
          )}
          <span className="kf-feature-title">{item.title}</span>
          <span className="kf-feature-cta">
            Lexo lajmin <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </span>
        </span>
      </Link>
      {side.length > 0 && (
        <ul className="kf-feature-side">
          {side.map((s) => (
            <Card key={s.id} item={s} city={s.cityId ? cities[s.cityId] : undefined} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TopThree({ section, items }: { section: string; items: FeedItem[] }) {
  return (
    <section className="kf-top kf-hook" aria-labelledby="kf-top-title">
      <h2 id="kf-top-title" className="kf-hook-title">
        Më të lexuarat {SECTION_IN[section] ?? ""}
      </h2>
      <ol className="kf-top-list">
        {items.slice(0, 3).map((item, i) => (
          <li key={item.id}>
            <Link href={`/article/${item.slug}`} className="kf-top-item">
              <span className="kf-top-rank" aria-hidden="true">
                {i + 1}
              </span>
              <span className="kf-top-title">{item.title}</span>
              <Photo src={item.imageUrl} sizes="96px" className="kf-top-thumb" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Carousel({ title, items, cities }: { title: string; items: FeedItem[]; cities: Record<string, FeedCity> }) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const track = trackRef.current;
    if (!track) return;
    setEdge({
      start: track.scrollLeft <= 4,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
    });
  };
  useEffect(update, []);

  const step = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section className="kf-carousel kf-hook" aria-labelledby="kf-carousel-title">
      <div className="kf-carousel-head">
        <h2 id="kf-carousel-title" className="kf-hook-title">{title}</h2>
        <span className="kf-carousel-nav">
          <button type="button" onClick={() => step(-1)} disabled={edge.start} aria-label="Lajmet e mëparshme">
            <ChevronLeft size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => step(1)} disabled={edge.end} aria-label="Lajmet e tjera">
            <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      </div>
      <ul className="kf-carousel-track" ref={trackRef} onScroll={update}>
        {items.map((item) => {
          const city = item.cityId ? cities[item.cityId] : undefined;
          return (
            <li key={item.id}>
              <Link href={`/article/${item.slug}`} className="kf-slide">
                <Photo src={item.imageUrl} sizes="280px" className="kf-slide-photo" />
                {city && (
                  <span className="kf-slide-city">
                    <img src={city.emblem} alt="" width={20} height={20} loading="lazy" decoding="async" />
                    {city.name}
                  </span>
                )}
                <span className="kf-slide-title">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MarketCard({ market }: { market: SectionMarket }) {
  const yes = market.prob === null ? null : Math.round(market.prob * 100);
  return (
    <Link href={`/tregu/${market.slug}`} className="kf-act kf-market kf-hook">
      <span className="kf-act-label">
        <CoinIcon size={18} /> Tregu · parashiko
      </span>
      <span className="kf-act-title">{market.question}</span>
      {yes !== null ? (
        <span className="kf-market-split">
          <span className="kf-market-bar" aria-hidden="true">
            <i style={{ width: `${yes}%` }} />
          </span>
          <span className="kf-market-sides">
            <b className="kf-yes">PO {yes}%</b>
            <b className="kf-no">JO {100 - yes}%</b>
          </span>
        </span>
      ) : null}
      <span className="kf-act-cta">
        {yes !== null ? "Jep parashikimin tënd" : "Zgjidh rezultatin"} <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
      </span>
    </Link>
  );
}

function DardaniCard({ section }: { section: string }) {
  const where = SECTION_IN[section] ?? "";
  const questions = [
    `Çfarë ndodhi sot ${where}?`,
    `Cilat janë lajmet më të rëndësishme të javës ${where}?`,
    `Më shpjego shkurt lajmin kryesor ${where}`,
  ];
  const ask = (question: string) => window.dispatchEvent(new CustomEvent(PYET_OPEN_EVENT, { detail: { question } }));
  return (
    <aside className="kf-act kf-dardani kf-hook" aria-labelledby="kf-dardani-title">
      <img className="kf-dardani-avatar" src="/images/dardan/avatar.webp" alt="" width={56} height={56} loading="lazy" decoding="async" />
      <div className="kf-dardani-copy">
        <h2 id="kf-dardani-title" className="kf-act-title">Pyet Dardanin {where}</h2>
        <p className="kf-dardani-hint">Merr përgjigje të shkurtra nga lajmet e 383.</p>
      </div>
      <div className="kf-dardani-asks">
        {questions.map((q) => (
          <button key={q} type="button" onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
    </aside>
  );
}
