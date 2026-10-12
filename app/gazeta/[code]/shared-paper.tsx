"use client";

// A shared paper (/gazeta/<code>), turned page by page like the sharer's own:
// the same kind of paper, the same front page and the same follow pages, with
// nothing of the sharer's reading on it — no reasons, no read marks. The bar
// says at once whose paper this is; the friend's one next step, in the bar and
// on the last page, is to make their own.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { lookById } from "@/lib/paper-look.mjs";
import { genitive } from "@/lib/reader-name.mjs";
import { paperPages } from "@/lib/paper-pages.mjs";
import Newspaper, { type NewspaperPage } from "@/app/per-ty/paper/newspaper";
import { EndSheet, FrontSheet, IndexSheet, MoreSheet, NO_SEEN, SectionSheet, type PaperMeta, type PaperStory } from "@/app/per-ty/paper/pages";
import { newspaperFonts } from "@/app/per-ty/paper/fonts";
import type { FeedArticle } from "@/app/per-ty/per-ty-feed";
import "@/app/per-ty/paper/newspaper.css";

type SharedSection = { key: string; kind: "person" | "city" | "category"; title: string; href: string; items: FeedArticle[] };

export default function SharedPaper({
  title,
  sharer,
  date,
  year,
  look,
  edition,
  sections,
}: {
  title: string;
  /** The sharer's first name, when they chose to show it. */
  sharer: string;
  /** "e shtunë, 3 tetor" */
  date: string;
  year: number;
  look: string;
  edition: FeedArticle[];
  sections: SharedSection[];
}) {
  const info = lookById(look) ?? lookById("e-perditshme");
  const paper = {
    edition: edition.map((article) => ({ article })),
    sections: sections.map((s) => ({ ...s, empty: s.items.length === 0, items: s.items.map((article) => ({ article })) })),
  };
  const pages = paperPages(paper);
  const meta: PaperMeta = {
    title,
    edition: sharer ? `E ndarë nga ${sharer}` : "Kopje e ndarë",
    issue: 0,
    date,
    year,
    follows: sections.map((s) => s.title).slice(0, 3),
    count: edition.length,
    minutes: Math.max(2, Math.ceil(edition.reduce((n, a) => n + `${a.title} ${a.excerpt}`.split(/\s+/).length, 0) / 200)),
    total: pages.length,
    readOnly: true,
    pace: "medium",
    seen: NO_SEEN,
  };
  const story = (i: { article: FeedArticle }): PaperStory => ({ article: i.article, why: null });
  const whose = sharer && genitive(sharer) ? `e ${genitive(sharer)}` : "e dikujt tjetër";

  const makeYours = (
    <section>
      <h3>Bëj tënden</h3>
      <ol className="np-list">
        <li>Zgjedh çka të intereson: tema, njerëz, qytete. Pa llogari, në një minutë.</li>
        <li>Çdo mëngjes faqet mbushen vetë me lajmet e reja për to.</li>
        <li>Sa më shumë lexon, aq më mirë të njeh — edhe pamja e gazetës ndryshon sipas teje.</li>
      </ol>
    </section>
  );

  const sheets: NewspaperPage[] = pages.map((page) => {
    if (page.kind === "front") {
      return { key: page.key, title: page.title, node: <FrontSheet meta={meta} lead={page.lead ? story(page.lead) : null} stories={page.stories.map(story)} /> };
    }
    if (page.kind === "index") {
      return {
        key: page.key,
        title: page.title,
        node: (
          <IndexSheet
            meta={meta}
            n={page.n}
            contents={page.contents}
            onJump={(n) => {
              window.location.hash = `faqja-${n}`;
            }}
          >
            {makeYours}
          </IndexSheet>
        ),
      };
    }
    if (page.kind === "more") {
      return { key: page.key, title: page.title, node: <MoreSheet meta={meta} n={page.n} title={page.title} stories={page.stories.map(story)} /> };
    }
    if (page.kind === "section") {
      const s = page.section;
      return {
        key: page.key,
        title: page.title,
        node: <SectionSheet meta={meta} n={page.n} title={s.title} sectionKey={s.key} href={s.href} intro="" hidden={0} stories={page.items.map(story)} />,
      };
    }
    if (page.kind === "about") {
      return {
        key: page.key,
        title: page.title,
        node: (
          <EndSheet meta={meta} n={page.n} title="Si funksionon">
            {makeYours}
            <div className="np-actions">
              <Link href="/per-ty" className="np-btn np-btn--accent">
                Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </div>
          </EndSheet>
        ),
      };
    }
    return {
      key: page.key,
      title: page.title,
      node: (
        <EndSheet meta={meta} n={page.n} title="Gazeta jote të pret.">
          <p className="np-end-big">Kjo ishte gazeta {whose}.</p>
          <p>E jotja do të kishte lajmet për njerëzit, qytetin dhe temat që ndjek ti — dhe do të dukej ndryshe, sipas asaj që lexon.</p>
          <div className="np-actions">
            <Link href="/per-ty" className="np-btn np-btn--accent">
              Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
          {page.about && makeYours}
        </EndSheet>
      ),
    };
  });

  return (
    <div className={`perty-paper-pages ${newspaperFonts}`}>
      <Newspaper
        pages={sheets}
        look={info?.id ?? "e-perditshme"}
        label={title}
        hint
        lead={
          <p className="np-shared-lead">
            <b>{sharer ? `${sharer} ta ndau gazetën e vet` : "Dikush ta ndau gazetën e vet"}</b> · {date}. Në 383 secili ka gazetën e vet — kthe faqet.
          </p>
        }
        tools={
          <Link href="/per-ty" className="np-tool np-tool--primary">
            <span className="np-tool-label">Bëj tënden</span>
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        }
      />
    </div>
  );
}
