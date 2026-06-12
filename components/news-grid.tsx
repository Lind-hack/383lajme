"use client";

import { type Article } from "@/lib/mock-data";
import { formatDateShortSq } from "@/lib/date-sq";
import SectionLabel from "./section-label";
import LeadStory from "./lead-story";
import CompactStory from "./compact-story";

interface NewsGridProps {
  articles: Article[];
  title: string;
  accentColor?: string;
}

export default function NewsGrid({ articles, title, accentColor = "#FF4422" }: NewsGridProps) {
  const lead = articles[0];
  const stack = articles.slice(1, 4);
  const bottom = articles.slice(4, 6);
  const hasBottom = articles.length >= 5;

  if (!lead) return null;

  return (
    <section>
      <SectionLabel
        label={title}
        accent={accentColor}
        marginBottom={28}
        rule="double"
        kicker={`EDICIONI · ${formatDateShortSq()}`}
      />

      {/* Lead + stack */}
      <div className="kryesore-grid">
        {/* Lead — big left story */}
        <LeadStory article={lead} />

        {/* Stack — 3 compact stories right */}
        <div className="kryesore-stack">
          {stack.map((article, i) => (
            <CompactStory key={article.id} article={article} index={i} />
          ))}
        </div>
      </div>

      {/* Bottom row — 2 wide stories */}
      {hasBottom && (
        <div className="kryesore-bottom">
          {bottom.map((article, i) => (
            <CompactStory key={article.id} article={article} index={i + stack.length} variant="wide" />
          ))}
        </div>
      )}
    </section>
  );
}
