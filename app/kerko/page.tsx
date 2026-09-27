import Link from "next/link";
import { notFound } from "next/navigation";
import { Minus, Search, TrendingDown, TrendingUp } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import HeroDispatch from "@/components/hero-dispatch";
import NewsGrid from "@/components/news-grid";
import DispatchList from "@/components/dispatch-list";
import AdSlot from "@/components/home/ad-slot";
import LatestStrip from "@/components/home/latest-strip";
import { getSearchData } from "@/lib/search-sources";
import { searchResults } from "@/lib/search-results";
import { getLatestArticles } from "@/lib/db";
import { toneLabel } from "@/lib/tone-scale";

export const dynamic = "force-dynamic";

/**
 * The full results page, where Enter in the search box lands.
 *
 * It used to be a text list of headlines. It now reads like a section of the
 * paper about what the reader asked for: the best match as the lead, the next
 * six as photo cards, then every other match in an endless list with the ad
 * column beside it — sponsored cards between rows, labelled as such. The
 * ranking lives in lib/search-results, shared with /api/search/results, so
 * the endless list continues exactly where the page stops.
 */

/** Lead + six cards above the list; the list shows this many before it pages. */
const GRID = 6;
const LIST = 20;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entitet?: string }>;
}) {
  const { q, entitet } = await searchParams;
  const term = (entitet ?? q ?? "").trim();
  return { title: term ? `Kërko: ${term}` : "Kërko" };
}

export default async function KerkoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entitet?: string }>;
}) {
  const { q, entitet } = await searchParams;
  const term = (entitet ?? q ?? "").trim().slice(0, 120);
  if (!term) notFound();

  const [results, data] = await Promise.all([searchResults(term), getSearchData()]);
  const { articles, exact, entity, related, market } = results;
  const facts = entity ? (data.countryFacts[entity.name] ?? null) : null;
  const dir = !facts || facts.delta === null || facts.delta === 0 ? "flat" : facts.delta > 0 ? "up" : "down";
  const TrendIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;

  const [lead, ...rest] = articles;
  const grid = rest.slice(0, GRID);
  const list = rest.slice(GRID, GRID + LIST);
  const shownIds = [lead, ...grid, ...list].filter(Boolean).map((a) => a!.id);
  // Nothing at all to show: the newest stories, so the page is never empty.
  const fallback = articles.length === 0 ? await getLatestArticles(7) : [];

  const count = articles.length;
  const title = entity?.name ?? term;

  return (
    <>
      <TextureBg />
      <Navbar />
      <div style={{ paddingTop: "var(--nav-h)", position: "relative", zIndex: 1 }}>
        <LatestStrip />
      </div>

      <main className="kerko-results">
        <header className="kerko-results-head">
          <p className="kerko-page-kicker">
            <Search size={13} strokeWidth={2.5} aria-hidden="true" />
            Rezultatet e kërkimit
          </p>
          <h1 className="kerko-page-title">{entity ? title : `“${title}”`}</h1>
          <p className="kerko-page-count">
            {entity?.role && <span className="kerko-page-role">{entity.role}</span>}
            {count === 0
              ? "Asnjë lajm për këtë kërkim"
              : exact
                ? `${count} ${count === 1 ? "lajm" : "lajme"}`
                : `Asnjë rezultat i saktë — ${count} ${count === 1 ? "lajm më i afërt" : "lajmet më të afërta"}`}
          </p>
          {related.length > 0 && (
            <nav className="kerko-chips" aria-label="Tema dhe vende të lidhura">
              {related.map((r) => (
                <Link key={`${r.kind}-${r.href}`} href={r.href} className="kerko-chip" data-kind={r.kind}>
                  {r.title}
                </Link>
              ))}
            </nav>
          )}
        </header>

        {lead && (
          <div className="kerko-results-lead">
            <HeroDispatch article={lead} />
          </div>
        )}

        {grid.length > 0 && (
          <div className="kerko-results-grid">
            <NewsGrid articles={grid} title="MË SHUMË PËR KËRKIMIN" />
          </div>
        )}

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

        {list.length > 0 && (
          <div className="home-latest">
            <DispatchList
              articles={list}
              max={LIST}
              size="lg"
              label="TË GJITHA REZULTATET"
              loadMore={{ search: term, startOffset: 1 + GRID + list.length, seenIds: shownIds, infinite: true }}
              sponsored={{ every: 12, market }}
            />
            <AdSlot />
          </div>
        )}

        {count === 0 && (
          <section className="kerko-results-empty">
            <p>
              Nuk gjetëm lajme për <strong>“{term}”</strong>. Provo një fjalë tjetër, ose lexo më të rejat:
            </p>
            {fallback.length > 0 && (
              <>
                <div className="kerko-results-lead">
                  <HeroDispatch article={fallback[0]} />
                </div>
                <NewsGrid articles={fallback.slice(1)} title="LAJMET E FUNDIT" />
              </>
            )}
          </section>
        )}

        {count > 0 && list.length === 0 && <SectionLabel label="KAQ PËR KËTË KËRKIM" marginBottom={0} />}
      </main>

      <Footer />
    </>
  );
}
