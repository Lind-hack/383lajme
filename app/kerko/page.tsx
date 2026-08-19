import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Minus, Search, TrendingDown, TrendingUp } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import { getSearchData } from "@/lib/search-sources";
import { search, nearest } from "@/lib/search-match.mjs";
import { resolveEntity, surfaceForms, mentions } from "@/lib/entities.mjs";
import { toneLabel } from "@/lib/tone-scale";

export const dynamic = "force-dynamic";

/**
 * The full results page.
 *
 * The overlay is for finding one thing quickly. This is for the other case:
 * "show me everything about the prime minister", which is a reading list
 * rather than a jump. Rendered on the server so it is linkable, shareable and
 * indexable — a search result that only exists inside a dialog cannot be any
 * of those.
 */

const MAX_ARTICLES = 60;

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

  const data = term
    ? await getSearchData()
    : { entries: [], articles: [], people: [], subjects: [], countryFacts: {} };
  const { entries, articles, people, subjects, countryFacts } = data;
  const entity = term ? resolveEntity(term, [...subjects, ...people]) : null;
  const facts = entity?.kind === "vend" ? (countryFacts[entity.name] ?? null) : null;
  const dir = !facts || facts.delta === null || facts.delta === 0
    ? "flat"
    : facts.delta > 0
      ? "up"
      : "down";
  const TrendIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;

  const entityArticles = entity
    ? articles.filter((a) => mentions(a, surfaceForms(entity)))
    : [];

  const groups = term ? search(entries, term, { perGroup: 40, total: 200 }) : [];
  // Articles already shown under the entity are not repeated below it.
  const entityHrefs = new Set(entityArticles.map((a) => `/article/${a.slug}`));
  const otherGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i: { href: string; title: string }) =>
          // Neither the articles already listed above, nor the subject itself:
          // a "VENDE → Gjermani" row under a page headed Gjermani is the same
          // answer a second time.
          !entityHrefs.has(i.href) && !(entity && i.title === entity.name),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const total = entityArticles.length + otherGroups.reduce((n, g) => n + g.items.length, 0);
  const suggestions = term && total === 0 ? nearest(entries, term, 6) : [];

  if (!term) notFound();

  return (
    <>
      <TextureBg />
      <Navbar />

      <main className="kerko-page">
        <p className="kerko-page-kicker">
          <Search size={13} strokeWidth={2.5} aria-hidden="true" />
          Rezultatet e kërkimit
        </p>
        <h1 className="kerko-page-title">{entity?.name ?? term}</h1>
        <p className="kerko-page-count">
          {entity?.role && <span className="kerko-page-role">{entity.role}</span>}
          {total === 1 ? "1 rezultat" : `${total} rezultate`}
        </p>

        {/* Everything about the subject, when the query named one. This is the
            claim the reader actually made — "about this person" — and it is
            kept apart from the string matches below it. */}
        {entity && entityArticles.length > 0 && (
          <section className="kerko-page-section">
            <SectionLabel
              label={`ARTIKUJ PËR ${entity.name.toUpperCase()}`}
              marginBottom={14}
              right={
                <span className="kerko-page-meta">
                  {entityArticles.length} {entityArticles.length === 1 ? "artikull" : "artikuj"}
                </span>
              }
            />
            <ul className="kerko-page-list">
              {entityArticles.slice(0, MAX_ARTICLES).map((a) => (
                <li key={a.slug}>
                  <Link href={`/article/${a.slug}`}>
                    <span className="kerko-page-item-title">{a.title}</span>
                    {a.meta && <span className="kerko-page-item-meta">{a.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The tone index, then the evidence for it. Placed after this site's
            own reporting because that is what the reader came for; the index
            is context on top of it, not a replacement. */}
        {facts && facts.index !== null && (
          <section className="kerko-page-section">
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

            {facts.foreign.length > 0 && (
              <>
                <SectionLabel
                  label={`ÇFARË SHKRUAN ${(entity?.name ?? "").toUpperCase()} PËR KOSOVËN`}
                  marginBottom={10}
                />
                <ul className="kerko-page-list kerko-page-foreign">
                  {facts.foreign.map((a: { title: string; url: string; outlet: string; sentiment: string }) => (
                    <li key={a.url}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
                        <span className="kerko-page-item-title">{a.title}</span>
                        <span className="kerko-page-item-meta">
                          <em data-sentiment={a.sentiment} />
                          {a.outlet}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {otherGroups.map((group) => (
          <section key={group.kind} className="kerko-page-section">
            <SectionLabel label={group.label} marginBottom={14} />
            <ul className="kerko-page-list">
              {group.items.map((item: { title: string; href: string; meta?: string }) => (
                <li key={`${item.href}-${item.title}`}>
                  <Link href={item.href}>
                    <span className="kerko-page-item-title">{item.title}</span>
                    {item.meta && <span className="kerko-page-item-meta">{item.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {total === 0 && (
          <div className="kerko-page-empty">
            <p>
              Asnjë rezultat për <strong>“{term}”</strong>.
            </p>
            {suggestions.length > 0 && (
              <>
                <p className="kerko-page-empty-sub">Ndoshta kërkoje një nga këto:</p>
                <ul className="kerko-page-suggestions">
                  {suggestions.map((s: { title: string; href: string }) => (
                    <li key={s.href}>
                      <Link href={s.href}>
                        {s.title}
                        <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
