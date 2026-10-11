"use client";

// A shared paper (/gazeta/<code>), turned page by page like the sharer's own:
// the same kind of paper, the same front page and the same follow pages, with
// nothing of the sharer's reading on it — no reasons, no read marks. The
// friend's one next step, on the front and the back: make their own.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { coverWord } from "@/lib/per-ty-paper.mjs";
import { lookById } from "@/lib/paper-look.mjs";
import { genitive } from "@/lib/reader-name.mjs";
import { FRONT_STORIES, paperPages } from "@/lib/paper-pages.mjs";
import Newspaper, { type NewspaperPage } from "@/app/per-ty/paper/newspaper";
import { BackSheet, FrontSheet, MoreSheet, NO_SEEN, SectionSheet, type PaperMeta, type PaperStory } from "@/app/per-ty/paper/pages";
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
  leadKey,
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
  leadKey: string;
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
    motto: info?.motto ?? "",
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

  const invite = (
    <aside className="np-note">
      <h2>{sharer ? `${sharer} ta ndau gazetën e vet.` : "Dikush ta ndau gazetën e vet."}</h2>
      <p>
        Në 383 secili ka gazetën e vet: zgjedh temat, njerëzit dhe qytetin, dhe çdo mëngjes gazeta mbushet vetë me
        lajmet e tyre. Kthe faqet për ta parë këtë, pastaj bëj tënden.
      </p>
      <div className="np-note-actions">
        <Link href="/per-ty" className="np-btn">
          Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );

  const sheets: NewspaperPage[] = pages.map((page) => {
    if (page.kind === "front") {
      return {
        key: page.key,
        title: page.title,
        node: (
          <FrontSheet
            meta={meta}
            lead={page.lead ? story(page.lead) : null}
            leadWord={page.lead ? coverWord(page.lead.article, leadKey) : ""}
            stories={page.stories.map(story)}
            contents={page.contents}
            onJump={(n) => {
              window.location.hash = `faqja-${n}`;
            }}
            before={invite}
            stamp={
              <>
                <b>Kopje e ndarë</b>
                {sharer ? `nga ${sharer}` : "nga një lexues"}
              </>
            }
          />
        ),
      };
    }
    if (page.kind === "more") {
      return { key: page.key, title: page.title, node: <MoreSheet meta={meta} n={page.n} stories={page.stories.map(story)} from={2 + FRONT_STORIES} /> };
    }
    if (page.kind === "section") {
      const s = page.section;
      return {
        key: page.key,
        title: page.title,
        node: <SectionSheet meta={meta} n={page.n} title={s.title} sectionKey={s.key} href={s.href} intro="" stories={s.items.map(story)} />,
      };
    }
    return {
      key: page.key,
      title: page.title,
      node: (
        <BackSheet meta={meta} n={page.n}>
          <div className="np-back-end">
            <h2>Gazeta jote të pret.</h2>
            <p>
              Kjo ishte gazeta {sharer && genitive(sharer) ? `e ${genitive(sharer)}` : "e dikujt tjetër"}. E jotja do të kishte lajmet për njerëzit, qytetin
              dhe temat që ndjek ti — dhe do të dukej ndryshe, sipas asaj që lexon.
            </p>
            <div className="np-back-actions">
              <Link href="/per-ty" className="np-btn np-btn--spot">
                Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div>
            <section className="np-box">
              <h3 className="np-box-title">Si funksionon</h3>
              <ol className="np-howto-list">
                <li>Zgjedh çka të intereson: tema, njerëz, qytete. Pa llogari.</li>
                <li>Çdo mëngjes faqet mbushen vetë me lajmet e reja për to.</li>
                <li>Sa më shumë lexon, aq më mirë të njeh — edhe pamja e gazetës ndryshon sipas teje.</li>
              </ol>
            </section>
          </div>
        </BackSheet>
      ),
    };
  });

  return (
    <div className={`perty-paper-pages ${newspaperFonts}`}>
      <Newspaper pages={sheets} look={info?.id ?? "e-perditshme"} label={title} hint />
    </div>
  );
}
