"use client";

// One page of the reader's paper: "Sport", "Prishtinë", "Albin Kurti" — a
// newspaper rule with the name on it, then up to four stories. The first one
// carries its picture when it has one; the rest are headlines.
//
// An empty section says so in Dardani's voice and points to where that topic
// lives, rather than being padded with something else or silently dropped.

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import DardaniFace from "@/components/dardani/dardani-face";
import { Mark, Meta, NO_HISTORY, type Seen } from "./front-page";
import type { FeedArticle } from "../per-ty-feed";

export type SectionView = {
  key: string;
  kind: "person" | "city" | "category";
  title: string;
  href: string;
  items: { article: FeedArticle; fromShelf: boolean }[];
  empty: boolean;
};

function emptyLine(section: SectionView) {
  if (section.kind === "person") return `Këtë javë s'ka pasur lajme për ${section.title}. Të them sapo të ketë.`;
  if (section.kind === "city") return `Këtë javë s'kemi shkruar për ${section.title}. Shiko çka ka tjetër andej.`;
  return `Redaksia s'ka shkruar për ${section.title} këtë muaj. Po i them ta shtojnë!`;
}

export default function PaperSection({
  section,
  seen = NO_HISTORY,
  readOnly = false,
  print = 0,
}: {
  section: SectionView;
  seen?: Seen;
  readOnly?: boolean;
  print?: number;
}) {
  const [first, ...rest] = section.items;
  const titleId = `perty-sec-${section.key.replace(/[^a-z0-9]+/gi, "-")}`;
  return (
    <section
      className="perty-sec"
      aria-labelledby={titleId}
      data-kind={section.kind}
      data-empty={section.empty || undefined}
      data-print
      style={{ "--i": print } as React.CSSProperties}
    >
      <header className="perty-sec-head">
        <h2 id={titleId}>{section.title}</h2>
        <Link href={section.href} className="perty-sec-more">
          Të gjitha
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
          <span className="sr-only"> për {section.title}</span>
        </Link>
      </header>

      {section.empty ? (
        <p className="perty-sec-empty">
          <DardaniFace state="happy" size={28} decorative />
          <span>{emptyLine(section)}</span>
        </p>
      ) : (
        <ul className="perty-sec-list">
          {first && (
            <li>
              <Link
                href={`/article/${first.article.slug}`}
                className="perty-sec-top"
                data-read={(!readOnly && seen.read.has(first.article.slug)) || undefined}
              >
                {first.article.imageUrl && (
                  <span className="perty-sec-img">
                    <Image
                      src={first.article.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 45vw, 380px"
                      style={{ objectFit: "cover" }}
                    />
                  </span>
                )}
                <strong>{first.article.title}</strong>
                <span className="perty-sec-meta">
                  <Meta article={first.article} date={first.fromShelf} />
                  {!readOnly && <Mark article={first.article} seen={seen} />}
                </span>
              </Link>
            </li>
          )}
          {rest.map(({ article, fromShelf }) => (
            <li key={article.slug}>
              <Link
                href={`/article/${article.slug}`}
                className="perty-sec-row"
                data-read={(!readOnly && seen.read.has(article.slug)) || undefined}
              >
                <strong>{article.title}</strong>
                <span className="perty-sec-meta">
                  <Meta article={article} date={fromShelf} />
                  {!readOnly && <Mark article={article} seen={seen} />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
