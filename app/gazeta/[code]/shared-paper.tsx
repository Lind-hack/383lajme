"use client";

// A shared paper (/gazeta/<code>) as the same reel the sharer reads: the same
// kind of paper, the same stories in the same order, with nothing of the
// sharer's reading on it — no reasons, no read marks, no "more / less". The
// cover says at once whose paper it is; the friend's one next step, on the
// cover, in the bar and on the last screen, is to make their own.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { lookById } from "@/lib/paper-look.mjs";
import { genitive } from "@/lib/reader-name.mjs";
import { hashForSlide, reelSlides } from "@/lib/paper-reel.mjs";
import Reel, { type ReelScreen } from "@/app/per-ty/paper/reel";
import { CoverSlide, NO_SEEN, PanelSlide, SectionSlide, StorySlide, type ReelMeta } from "@/app/per-ty/paper/slides";
import { newspaperFonts } from "@/app/per-ty/paper/fonts";
import type { FeedArticle } from "@/app/per-ty/per-ty-feed";
import "@/app/per-ty/paper/reel.css";

type SharedSection = { key: string; kind: "person" | "city" | "category"; title: string; href: string; items: FeedArticle[] };

export default function SharedPaper({
  title,
  sharer,
  date,
  look,
  edition,
  sections,
}: {
  title: string;
  /** The sharer's first name, when they chose to show it. */
  sharer: string;
  /** "e shtunë, 3 tetor" */
  date: string;
  year?: number;
  look: string;
  edition: FeedArticle[];
  sections: SharedSection[];
}) {
  const info = lookById(look) ?? lookById("e-perditshme");
  const slides = reelSlides({
    edition: edition.map((article) => ({ article })),
    sections: sections.map((s) => ({ ...s, empty: s.items.length === 0, items: s.items.map((article) => ({ article })) })),
  });
  const meta: ReelMeta = { readOnly: true, seen: NO_SEEN };
  const who = sharer ? `${sharer} ta ndau gazetën e vet` : "Dikush ta ndau gazetën e vet";
  const whose = sharer && genitive(sharer) ? `e ${genitive(sharer)}` : "e dikujt tjetër";
  const minutes = Math.max(2, Math.ceil(edition.reduce((n, a) => n + `${a.title} ${a.excerpt}`.split(/\s+/).length, 0) / 200));
  const firstStory = slides.findIndex((s) => s.kind === "story");
  const make = (
    <Link href="/per-ty" className="fy-btn fy-btn--ghost">
      Bëj tënden <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
    </Link>
  );

  const screens: ReelScreen[] = slides.map((slide) => {
    if (slide.kind === "cover") {
      const lead = edition[0];
      return {
        key: slide.key,
        kind: "cover",
        title,
        node: (
          <CoverSlide
            title={title}
            kicker={`${who} · ${date}`}
            line={`${edition.length === 1 ? "1 lajm" : `${edition.length} lajme`} · ${minutes} min${sections.length ? ` · ${sections.map((s) => s.title).slice(0, 3).join(", ")}` : ""}`}
            photo={lead ? lead.coverArt || lead.imageUrl || null : null}
            heads={slides
              .filter((s) => s.kind === "story")
              .slice(0, 3)
              .map((s) => ({ title: s.title, href: hashForSlide(s.n) }))}
            start={{ label: "Shfletoje", href: hashForSlide(firstStory > 0 ? firstStory : 1) }}
          >
            {make}
          </CoverSlide>
        ),
      };
    }
    if (slide.kind === "section") {
      const s = slide.section;
      const first = s.items[0]?.article;
      return {
        key: slide.key,
        kind: "section",
        title: s.title,
        node: (
          <SectionSlide
            title={s.title}
            kicker={s.kind === "person" ? "Njeri që ndjek" : s.kind === "city" ? "Qytet që ndjek" : "Temë që ndjek"}
            intro=""
            count={slide.count}
            hidden={slide.hidden}
            href={s.href}
            photo={first ? first.coverArt || first.imageUrl || null : null}
            sectionKey={s.key}
            meta={meta}
          />
        ),
      };
    }
    if (slide.kind === "story") {
      return {
        key: slide.key,
        kind: "story",
        title: slide.title,
        group: slide.group,
        groupTitle: slide.groupTitle,
        pos: slide.pos,
        of: slide.of,
        thumb: slide.item.article.coverArt || slide.item.article.imageUrl || null,
        node: <StorySlide story={{ article: slide.item.article, why: null }} meta={meta} eager={slide.n <= 3} />,
      };
    }
    return {
      key: slide.key,
      kind: slide.kind === "brief" ? "brief" : "end",
      title: slide.title,
      node: (
        <PanelSlide kicker="Fundi" title="Gazeta jote të pret.">
          <p className="fy-end-big">Kjo ishte gazeta {whose}.</p>
          <p>E jotja do të kishte lajmet për njerëzit, qytetin dhe temat që ndjek ti — dhe do të dukej ndryshe, sipas asaj që lexon.</p>
          <div className="fy-actions-row">
            <Link href="/per-ty" className="fy-btn fy-btn--accent">
              Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>
          <section>
            <h3>Si funksionon</h3>
            <ol className="fy-list-plain">
              <li>Zgjedh çka të intereson: tema, njerëz, qytete. Pa llogari, në një minutë.</li>
              <li>Çdo mëngjes gazeta mbushet vetë me lajmet e reja për to.</li>
              <li>Sa më shumë lexon, aq më mirë të njeh — edhe pamja e gazetës ndryshon sipas teje.</li>
            </ol>
          </section>
        </PanelSlide>
      ),
    };
  });

  return (
    <div className={`perty-paper-pages ${newspaperFonts}`}>
      <Reel
        screens={screens}
        look={info?.id ?? "e-perditshme"}
        label={title}
        name={title}
        sub={`${who} · ${date}`}
        hint
        tools={
          <Link href="/per-ty" className="fy-tool fy-tool--primary">
            <span className="fy-tool-label">Bëj tënden</span>
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        }
      />
    </div>
  );
}
