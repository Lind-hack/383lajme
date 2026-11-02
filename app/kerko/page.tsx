import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownWideNarrow, Clock, Inbox, Minus, Search, TrendingDown, TrendingUp } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import TextureBg from "@/components/aurora-bg";
import LatestStrip from "@/components/home/latest-strip";
import CategoryMark from "@/components/category-mark";
import KategoriLead from "@/components/kategori/lead";
import KategoriFeed, { type FeedItem } from "@/components/kategori/feed";
import { highlightTerms } from "@/components/search-highlight";
import { getSearchData } from "@/lib/search-sources";
import { searchResults, type SearchSort } from "@/lib/search-results";
import { getLatestArticles } from "@/lib/db";
import { toneLabel } from "@/lib/tone-scale";
import { CATEGORY_TO_SLUG, RESOLVABLE_SLUGS, type NavCategory } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";
import { dateKeyInKosovo } from "@/lib/reagimi-data";
import type { Article } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

/**
 * The full results page, where Enter in the search box lands.
 *
 * It reads like a category page because it is one — a section of the paper
 * about what the reader asked for: the same banner, the same chip bar (here
 * the sections the matches fall in, and the order), the same lead story and
 * the same feed that changes shape every six cards, with the matched words
 * lit in every headline. The ranking lives in lib/search-results, shared with
 * /api/search/results, so the feed pages on exactly where the page stops,
 * through the same filter and order.
 */

/** Cards the feed renders before it starts paging. */
const FIRST_PAGE = 40;
/** The brand orange, for a banner that is not any one section. */
const HERO: [string, string] = ["#FF4422", "#A8240E"];

type Params = { q?: string; entitet?: string; kat?: string; rendit?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  const { q, entitet } = await searchParams;
  const term = (entitet ?? q ?? "").trim();
  return { title: term ? `Kërko: ${term}` : "Kërko" };
}

function toFeed(a: Article): FeedItem {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    imageUrl: a.imageUrl ?? null,
    publishedAt: a.publishedAt,
    category: a.category || undefined,
  };
}

const usable = (a: Article | undefined): a is Article => Boolean(a?.id && a.slug && a.title && a.publishedAt);

export default async function KerkoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const term = (params?.entitet ?? params?.q ?? "").trim().slice(0, 120);
  if (!term) notFound();

  const category: NavCategory | null = params?.kat ? (RESOLVABLE_SLUGS[params.kat] ?? null) : null;
  const sort: SearchSort = params?.rendit === "te-rejat" ? "new" : "rel";

  const [results, data] = await Promise.all([searchResults(term, { category, sort }), getSearchData()]);
  const { articles, exact, entity, related, market, categories } = results;
  const facts = entity ? (data.countryFacts[entity.name] ?? null) : null;
  const dir = !facts || facts.delta === null || facts.delta === 0 ? "flat" : facts.delta > 0 ? "up" : "down";
  const TrendIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;

  const total = categories.reduce((n, c) => n + c.count, 0);
  const count = articles.length;
  const title = entity?.name ?? term;
  const terms = highlightTerms(term);

  const [lead, ...rest] = articles.filter(usable);
  const firstPage = rest.slice(0, FIRST_PAGE);
  const feed = firstPage.map(toFeed);
  // Nothing at all to show: the newest stories, so the page is never a dead end.
  const fallback = total === 0 ? (await getLatestArticles(13)).filter(usable) : [];

  // Every link on the page keeps the query in the parameter it came in under.
  const href = (next: { kat?: string | null; rendit?: string | null }) => {
    const out = new URLSearchParams();
    out.set(params?.entitet ? "entitet" : "q", term);
    const kat = next.kat === undefined ? params?.kat : next.kat;
    const rendit = next.rendit === undefined ? params?.rendit : next.rendit;
    if (kat) out.set("kat", kat);
    if (rendit) out.set("rendit", rendit);
    return `/kerko?${out}`;
  };
  const filters: Record<string, string> = {};
  if (category && params?.kat) filters.kat = params.kat;
  if (sort === "new") filters.rendit = "te-rejat";

  const summary =
    total === 0
      ? "Asnjë lajm për këtë kërkim"
      : !exact
        ? `Asnjë rezultat i saktë · ${total} ${total === 1 ? "lajm i afërt" : "lajmet më të afërta"}`
        : `${total} ${total === 1 ? "lajm" : "lajme"}`;

  const accent = category ? getCategoryColor(category) : HERO[0];

  return (
    <>
      <TextureBg />
      <Navbar />

      <div style={{ paddingTop: "var(--nav-h)", position: "relative", zIndex: 1 }}>
        <LatestStrip />
        <section
          className="cat-hero kerko-hero"
          style={{ ["--hero-from" as string]: HERO[0], ["--hero-to" as string]: HERO[1] }}
        >
          <div className="cat-hero-title kerko-hero-title">
            {/* A plain GET form: a new query is a new page, shareable and Back-able. */}
            <form action="/kerko" method="get" role="search" className="kerko-hero-form">
              <Search size={18} strokeWidth={2.5} aria-hidden="true" />
              <input
                type="search"
                name="q"
                defaultValue={term}
                aria-label="Kërko në 383"
                placeholder="Kërko lajme, tema, vende…"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                maxLength={120}
              />
              <button type="submit">Kërko</button>
            </form>
            <h1>
              {entity ? title : `“${title}”`}
              {total > 0 && (
                <span className="cat-hero-count">
                  <i aria-hidden="true" />
                  {total}
                </span>
              )}
            </h1>
            <p>
              {entity?.role ? `${entity.role} · ` : ""}
              {summary}
            </p>
            {related.length > 0 && (
              <nav className="kerko-hero-related" aria-label="Tema dhe vende të lidhura">
                {related.map((r) => (
                  <Link key={`${r.kind}-${r.href}`} href={r.href} data-kind={r.kind}>
                    {r.title}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </section>

        {total > 0 && (
          <div className="kat-bar kerko-bar" style={{ ["--kat" as string]: accent }}>
            <nav className="kerko-bar-row" aria-label="Filtro rezultatet">
              <ul className="kc-list kerko-bar-sections">
                <li>
                  <Link
                    href={href({ kat: null })}
                    scroll={false}
                    className="kc-chip"
                    aria-current={!category ? "page" : undefined}
                    style={{ ["--kat" as string]: HERO[0] }}
                  >
                    <span className="kc-mark" aria-hidden="true">
                      <Search size={14} strokeWidth={2.5} />
                    </span>
                    Të gjitha
                    <span className="kc-count">{total}</span>
                  </Link>
                </li>
                {categories
                  .filter((c) => CATEGORY_TO_SLUG[c.name as NavCategory])
                  .map((c) => {
                    const slug = CATEGORY_TO_SLUG[c.name as NavCategory];
                    return (
                      <li key={c.name}>
                        <Link
                          href={href({ kat: slug })}
                          scroll={false}
                          className="kc-chip"
                          aria-current={category === c.name ? "page" : undefined}
                          style={{ ["--kat" as string]: getCategoryColor(c.name) }}
                        >
                          <span className="kc-mark" aria-hidden="true">
                            <CategoryMark category={c.name} size={16} />
                          </span>
                          {c.name}
                          <span className="kc-count">
                            {c.count}
                            <span className="sr-only"> lajme</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
              <div className="kerko-sort" role="group" aria-label="Rendit">
                <Link
                  href={href({ rendit: null })}
                  scroll={false}
                  aria-current={sort === "rel" ? "true" : undefined}
                >
                  <ArrowDownWideNarrow size={15} strokeWidth={2.4} aria-hidden="true" />
                  Më relevante
                </Link>
                <Link
                  href={href({ rendit: "te-rejat" })}
                  scroll={false}
                  aria-current={sort === "new" ? "true" : undefined}
                >
                  <Clock size={15} strokeWidth={2.4} aria-hidden="true" />
                  Më të rejat
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>

      <main className="kat kerko-kat" style={{ ["--kat" as string]: accent }}>
        {total === 0 && (
          <div className="kat-empty kerko-none">
            <Inbox size={40} strokeWidth={1.5} aria-hidden="true" />
            <p>
              Nuk gjetëm lajme për <strong>“{term}”</strong>. Provo një fjalë tjetër, ose lexo më të rejat.
            </p>
          </div>
        )}
        {total > 0 && count === 0 && (
          <div className="kat-empty">
            <Inbox size={40} strokeWidth={1.5} aria-hidden="true" />
            <p>
              Asnjë lajm për <strong>“{term}”</strong> në <strong>{category}</strong>.{" "}
              <Link href={href({ kat: null })}>Shiko të gjitha</Link>
            </p>
          </div>
        )}

        {lead && <KategoriLead article={lead} highlight={terms} />}

        {/* A country's press tone about Kosovo, when the query names one. */}
        {facts && facts.index !== null && (
          <section className="kerko-results-tone">
            <div className="kerko-page-tone" data-dir={dir}>
              <span className="kerko-page-tone-value">{facts.index}</span>
              <div className="kerko-page-tone-body">
                <p className="kerko-page-tone-label">Toni i medias · {entity?.name}</p>
                <p className="kerko-page-tone-verdict">
                  {toneLabel(facts.index)} · {facts.articles} artikuj të analizuar
                </p>
              </div>
              <span className="kerko-page-tone-delta">
                <TrendIcon size={14} strokeWidth={2.75} aria-hidden="true" />
                {facts.delta === null
                  ? "pa krahasim"
                  : facts.delta === 0
                    ? "pa ndryshim"
                    : `${facts.delta > 0 ? "+" : ""}${facts.delta}`}
              </span>
            </div>
          </section>
        )}

        {feed.length > 0 && (
          <KategoriFeed
            // A new filter or order is a new list: paging state never carries over.
            key={`${params?.kat ?? "all"}:${sort}`}
            section="kërkimit"
            items={feed}
            cities={{}}
            hooks={{
              market,
              ask: {
                title: `Pyet Dardanin për ${title}`,
                questions: [
                  `Çfarë dihet për ${title}?`,
                  `Cilat janë lajmet e fundit për ${title}?`,
                  `Më shpjego shkurt: ${title}`,
                ],
              },
            }}
            todayKey={dateKeyInKosovo()}
            // Matches are sparse per day, so headings would strand single
            // cards; each card carries its own time instead.
            days={false}
            highlight={terms}
            categoryLabels={!category}
            loadMore={{
              search: term,
              // By position in the ranking: the lead, then this first page.
              offset: 1 + firstPage.length,
              filters,
              seenIds: [lead, ...firstPage].filter(usable).map((a) => a.id),
            }}
          />
        )}

        {fallback.length > 0 && (
          <>
            <KategoriLead article={fallback[0]} />
            <KategoriFeed
              section="kërkimit"
              items={fallback.slice(1).map(toFeed)}
              cities={{}}
              hooks={{}}
              todayKey={dateKeyInKosovo()}
              categoryLabels
            />
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
