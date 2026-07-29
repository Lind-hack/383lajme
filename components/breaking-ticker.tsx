"use client";

import Link from "next/link";
import type { Article } from "@/lib/mock-data";

type TickerArticle = Pick<Article, "id" | "slug" | "title" | "category">;

interface BreakingTickerProps {
  articles: TickerArticle[];
}

function TickerGroup({
  articles,
  hidden = false,
}: BreakingTickerProps & { hidden?: boolean }) {
  return (
    <div className="breaking-ticker-group" aria-hidden={hidden || undefined}>
      {articles.map((article) => (
        <Link
          key={article.id}
          href={`/article/${article.slug}`}
          className="breaking-ticker-link"
          tabIndex={hidden ? -1 : undefined}
          aria-label={`${article.category}: ${article.title}`}
        >
          <span className="breaking-ticker-category">{article.category}</span>
          <span className="breaking-ticker-title">{article.title}</span>
          <span className="breaking-ticker-arrow" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function BreakingTicker({ articles }: BreakingTickerProps) {
  if (articles.length === 0) return null;

  return (
    <aside className="breaking-ticker" aria-label="Lajmet e fundit">
      <div className="breaking-ticker-label">
        <span className="breaking-ticker-live-dot" aria-hidden />
        <span>LAJMET E FUNDIT</span>
      </div>

      <div className="breaking-ticker-viewport">
        <div className="ticker-track">
          <TickerGroup articles={articles} />
          <TickerGroup articles={articles} hidden />
        </div>
      </div>
    </aside>
  );
}
