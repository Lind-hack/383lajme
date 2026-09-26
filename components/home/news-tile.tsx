import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import TimeAgo from "@/components/time-ago";

/**
 * A story as a tile whose size the grid decides.
 *
 * Cards used to take their height from their content, so a two-line headline
 * next to a three-line one left two cards of different heights side by side.
 * A tile fills whatever cell it is given and clips its text to fit, so every
 * tile in a row shares both edges.
 *
 *   overlay   the photograph fills the tile, headline over a dark gradient
 *   headline  no photograph: the headline set large on the category's tint
 */
export default function NewsTile({
  article,
  variant = "overlay",
  size = "sm",
  sizes = "(max-width: 700px) 50vw, 320px",
}: {
  article: Article;
  variant?: "overlay" | "headline";
  size?: "sm" | "lg";
  sizes?: string;
}) {
  const photo = variant === "overlay" && article.imageUrl;
  return (
    <Link
      href={`/article/${article.slug}`}
      className="news-tile"
      data-variant={photo ? "overlay" : "headline"}
      data-size={size}
    >
      {photo && (
        <span className="news-tile-media" aria-hidden>
          <Image src={article.imageUrl!} alt="" fill sizes={sizes} />
        </span>
      )}
      <span className="news-tile-body">
        <span className="news-tile-tag">
          <i aria-hidden />
          {article.category}
        </span>
        <span className="news-tile-title">{article.title}</span>
        {size === "lg" && article.excerpt && <span className="news-tile-excerpt">{article.excerpt}</span>}
        <span className="news-tile-meta">
          {article.source}
          {article.source ? " · " : ""}
          <TimeAgo iso={article.publishedAt} />
        </span>
      </span>
    </Link>
  );
}
