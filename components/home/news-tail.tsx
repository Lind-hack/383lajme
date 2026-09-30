// The closing editorial band: "Të fundit" beside "Historia e ditës".
//
// This is where the page stops selling features and goes back to being a news
// site. Të fundit is strictly chronological and may repeat a story above, so a
// reader who wants "what just happened" always sees the newest headlines.

import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import SectionLabel from "@/components/section-label";
import SourceBadge from "@/components/source-badge";
import TimeAgo from "@/components/time-ago";
import ArticleImage from "./article-image";

export default function LatestStrip({
  latest,
  story,
}: {
  latest: Article[];
  story?: Article;
}) {
  if (latest.length === 0 && !story) return null;

  return (
    <section className="home-latest" aria-label="Të fundit dhe historia e ditës">
      <div className="home-latest-col">
        <SectionLabel
          label="Të fundit"
          right={
            <Link href="/kerko" className="home-section-more">
              Shiko të gjitha →
            </Link>
          }
        />

        <div className="home-latest-list">
          {latest.map((article) => (
            <article key={article.id} className="home-latest-item">
              <Link href={`/article/${article.slug}`}>
                <span className="home-latest-thumb">
                  <ArticleImage
                    src={article.imageUrl}
                    sizes="110px"
                    accent={getCategoryColor(article.category)}
                  />
                </span>
                <span className="home-latest-text">
                  <strong>{article.title}</strong>
                  {article.excerpt && <span>{article.excerpt}</span>}
                </span>
              </Link>
              <div className="home-latest-meta">
                <SourceBadge
                  source={article.source}
                  flag={article.sourceFlag}
                  size="sm"
                  url={article.url}
                />
                <TimeAgo
                  iso={article.publishedAt}
                  style={{ fontSize: "13px", color: "#5A5A5A" }}
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      {story && (
        <div className="home-latest-col">
          <SectionLabel label="Historia e ditës" />

          <article className="home-story">
            <Link href={`/article/${story.slug}`}>
              <span className="home-story-media">
                <ArticleImage
                  src={story.imageUrl}
                  sizes="(max-width: 860px) 100vw, 560px"
                  accent={getCategoryColor(story.category)}
                />
              </span>
              <strong>{story.title}</strong>
              {story.excerpt && <p>{story.excerpt}</p>}
            </Link>
            <div className="home-story-meta">
              <SourceBadge
                source={story.source}
                flag={story.sourceFlag}
                url={story.url}
              />
              <TimeAgo
                iso={story.publishedAt}
                style={{ fontSize: "14px", color: "#5A5A5A" }}
              />
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
