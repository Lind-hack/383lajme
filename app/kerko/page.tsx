import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import { getSearchData } from "@/lib/search-sources";
import { search, nearest } from "@/lib/search-match.mjs";
import { resolveEntity, surfaceForms, mentions } from "@/lib/entities.mjs";

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

  const { entries, articles, people } = term ? await getSearchData() : { entries: [], articles: [], people: [] };
  const entity = term ? resolveEntity(term, people) : null;

  const entityArticles = entity
    ? articles.filter((a) => mentions(a, surfaceForms(entity)))
    : [];

  const groups = term ? search(entries, term, { perGroup: 40, total: 200 }) : [];
  // Articles already shown under the entity are not repeated below it.
  const entityHrefs = new Set(entityArticles.map((a) => `/article/${a.slug}`));
  const otherGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i: { href: string }) => !entityHrefs.has(i.href)) }))
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
