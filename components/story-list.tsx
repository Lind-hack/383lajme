import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import TimeAgo from "@/components/time-ago";

/**
 * The site's compact story row: thumbnail, headline, source and time.
 *
 * Shared by the homepage category blocks and the lists under an article, so a
 * headline looks the same wherever a reader meets it next.
 */
export default function StoryList({
  articles,
  showCategory = false,
}: {
  articles: Article[];
  /** For mixed lists, where the section is not already named above. */
  showCategory?: boolean;
}) {
  if (!articles.length) return null;
  return (
    <ol className="story-list">
      {articles.map((article) => (
        <li key={article.id}>
          <Link href={`/article/${article.slug}`} className="story-row">
            <span className="story-thumb" aria-hidden>
              {article.imageUrl && <Image src={article.imageUrl} alt="" fill sizes="96px" />}
            </span>
            <span className="story-body">
              <span className="story-title">{article.title}</span>
              <span className="story-meta">
                {showCategory && article.category ? `${article.category} · ` : ""}
                {article.source}
                {article.source ? " · " : ""}
                <TimeAgo iso={article.publishedAt} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
