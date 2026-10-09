"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { LoadMoreButton, focusFirstNew, useArticlePages } from "@/components/load-more-articles";
import { dateKeyInKosovo, KOSOVO_TZ_FALLBACK } from "@/lib/reagimi-data";

/** What a timeline row renders; the server sends nothing else. */
export type TimelineItem = {
  id: string;
  slug: string;
  title: string;
  imageUrl?: string | null;
  publishedAt: string;
  /** The row's city within this section, from lib/section-cities. */
  cityId?: string | null;
};

export type TimelineCity = { name: string; emblem: string };

// Belgrade shares Kosovo's offset and DST rules and is in every Intl build;
// Europe/Pristina throws on trimmed ones, and these run at module load.
const TIME = new Intl.DateTimeFormat("sq-AL", { timeZone: KOSOVO_TZ_FALLBACK, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
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

function toItem(article: Article): TimelineItem {
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
 * A category's stories as the day ran: grouped under Sot / Dje / the date,
 * each row its time, headline, the city it happened in and a photograph.
 *
 * It replaced the grid-then-list layout copied from the homepage. A section
 * page is where a reader comes to catch up on one subject, and the question
 * that page answers is "what happened, and when" — so the time is the spine.
 *
 * With `loadMore` it pages back through the archive as the reader nears the
 * end, and puts the loaded rows and the scroll back after Back from a story.
 */
export default function KategoriTimeline({
  items,
  cities,
  todayKey: serverToday,
  loadMore,
  endNote,
}: {
  items: TimelineItem[];
  /** City id → name and emblem, for the label under each headline. */
  cities: Record<string, TimelineCity>;
  /** The server's "today", so the first render matches; corrected on mount. */
  todayKey: string;
  loadMore?: { category: string; seenIds: string[] };
  /** Shown under the last row when there is nothing further to load. */
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
  const feedKey = `383-timeline:${category ?? "none"}`;
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Back from a story: the rows already loaded and the scroll position return.
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
  if (all.length === 0) return null;

  // Consecutive rows that share a Kosovo calendar day form one group.
  const groups: { key: string; label: string; rows: TimelineItem[] }[] = [];
  for (const item of all) {
    const when = new Date(item.publishedAt);
    const key = dateKeyInKosovo(when);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(item);
    else groups.push({ key, label: dayLabel(key, todayKey, yesterdayKey), rows: [item] });
  }

  return (
    <section className="kt" aria-label="Lajmet sipas kohës">
      <div
        ref={listRef}
        onClickCapture={
          loadMore
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
        {groups.map((group) => (
          <div className="kt-day" key={group.key}>
            <h2 className="kt-day-label">{group.label}</h2>
            <ol className="kt-rows">
              {group.rows.map((item) => (
                <TimelineRow key={item.id} item={item} city={item.cityId ? cities[item.cityId] : undefined} />
              ))}
            </ol>
          </div>
        ))}
      </div>

      {loadMore && status === "loading" && (
        <div className="kt-skeletons" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="kt-skeleton">
              <i />
              <i />
            </div>
          ))}
        </div>
      )}
      {loadMore && <div ref={sentinelRef} className="kt-sentinel" aria-hidden="true" />}
      {loadMore && (status === "error" || status === "done") && (
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
      {!loadMore && endNote && <p className="kt-end">{endNote}</p>}
    </section>
  );
}

function TimelineRow({ item, city }: { item: TimelineItem; city?: TimelineCity }) {
  const [failed, setFailed] = useState(false);
  const when = new Date(item.publishedAt);
  const src = failed ? null : item.imageUrl;

  return (
    <li className="kt-row">
      <Link href={`/article/${item.slug}`} className="kt-link">
        <time className="kt-time" dateTime={item.publishedAt}>
          {Number.isFinite(when.getTime()) ? TIME.format(when) : ""}
        </time>
        <span className="kt-dot" aria-hidden="true" />
        <span className="kt-body">
          <span className="kt-title">{item.title}</span>
          {city && (
            <span className="kt-city">
              <img src={city.emblem} alt="" width={18} height={18} loading="lazy" decoding="async" />
              {city.name}
            </span>
          )}
        </span>
        <span className="kt-thumb">
          {src && (
            <Image src={src} alt="" fill sizes="(max-width: 640px) 96px, 176px" quality={90} onError={() => setFailed(true)} />
          )}
        </span>
      </Link>
    </li>
  );
}
