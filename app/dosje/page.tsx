import type { Metadata } from "next";
import Link from "next/link";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { getArticles } from "@/lib/db";
import { dosjeUniverse } from "@/lib/dosje-entries";
import { articlesForTopic } from "@/lib/topics.mjs";

const SITE = "https://www.383ks.com";

/**
 * Every dossier, in one place.
 *
 * This route did not exist. A reader reached a dossier only through the chip on
 * an article or the strip on the homepage, both of which surface a dossier only
 * when a recent article happens to match one — so a subject 383 has covered for
 * a year was unreachable in a week it published nothing about it, and the whole
 * feature had no address of its own. The chip rail at the foot of a dossier
 * pointed sideways forever without ever pointing up.
 *
 * Two things are shown per dossier and nothing else: whether its history has
 * been through sourcing, and how much of 383's recent coverage sits behind it.
 *
 * "Recent" is load-bearing and is why the count says so. news_articles is a
 * rolling window — 61 rows across three days when this was written — so the
 * number here measures that window, not the archive. A bare "0 artikuj" beside
 * the Kosovo–Serbia dialogue would read as "383 has never covered this", when
 * the five months on disk hold forty-eight articles that match it. The count is
 * true either way; only the label makes it mean the right thing.
 */

export const revalidate = 43200;

export const metadata: Metadata = {
  title: "Dosje — 383",
  description:
    "Temat që 383 i ndjek vazhdimisht: historiku i çdo dosjeje dhe gjithë mbulimi ynë për të.",
  alternates: { canonical: `${SITE}/dosje` },
  openGraph: {
    title: "Dosje — 383",
    description:
      "Temat që 383 i ndjek vazhdimisht: historiku i çdo dosjeje dhe gjithë mbulimi ynë për të.",
    url: `${SITE}/dosje`,
    type: "website",
    siteName: "383",
  },
};

export default async function DosjeIndexPage() {
  const [topics, articles] = await Promise.all([
    // The universe, not just the identities: the coverage count below is a
    // match against every subject at once, and a topic scored against a
    // smaller field is scored against the wrong one.
    dosjeUniverse(),
    // Cards only, same as the dossier page: no body text is needed to count
    // coverage, and it is the largest column in the table.
    getArticles(400, undefined, { withBody: false }),
  ]);

  const rows = topics.map((t) => ({
    ...t,
    coverage: articlesForTopic(t.slug, articles, topics).length as number,
  }));

  return (
    <>
      <TextureBg />
      <Navbar />

      <main className="dosje-index">
        <header className="dosje-index__head">
          <div className="dosje-index__eyebrow">Dosje</div>
          <h1 className="dosje-index__title">Temat që i ndjekim vazhdimisht</h1>
          <p className="dosje-index__lede">
            Një dosje mban historikun e një teme dhe çdo artikull që 383 ka botuar për të.
            Dosjet e verifikuara mbështeten në burime të kontrolluara; të tjerat janë
            kronologji pune derisa të kalojnë atë kontroll.
          </p>
        </header>

        <ul className="dosje-index__list">
          {rows.map((t) => (
            <li key={t.slug}>
              <Link href={`/dosje/${t.slug}`} className="dosje-index__card">
                <span className="dosje-index__card-title">{t.title}</span>
                <span className="dosje-index__card-blurb">{t.blurb}</span>
                <span className="dosje-index__meta">
                  <span
                    className={
                      t.approved
                        ? "dosje-index__badge dosje-index__badge--sourced"
                        : "dosje-index__badge"
                    }
                  >
                    {t.approved ? "Me burime të verifikuara" : "Kronologji pune"}
                  </span>
                  <span className="dosje-index__count">
                    {t.coverage === 0
                      ? "Pa mbulim të fundit"
                      : t.coverage === 1
                        ? "1 artikull së fundmi"
                        : `${t.coverage} artikuj së fundmi`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <Footer />
    </>
  );
}
