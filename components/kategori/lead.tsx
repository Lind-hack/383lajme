import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Article } from "@/lib/mock-data";
import TimeAgo from "@/components/time-ago";
import type { FeedCity } from "./feed";

/**
 * The section's top story: the photograph beside the headline on wide screens,
 * above it on phones, and nothing between the reader and the click — no
 * standfirst, so the card sends readers into the story instead of standing in
 * for it.
 */
export default function KategoriLead({ article, city }: { article: Article; city?: FeedCity }) {
  return (
    <Link href={`/article/${article.slug}`} className="kl">
      <span className="kl-photo">
        {article.imageUrl && (
          <Image
            src={article.imageUrl}
            alt=""
            fill
            // Above the fold and the page's LCP element on most loads.
            priority
            sizes="(max-width: 860px) 100vw, 720px"
            quality={90}
          />
        )}
      </span>
      <span className="kl-body">
        <h2 className="kl-title">{article.title}</h2>
        <span className="kl-meta">
          {city && (
            <span className="kl-city">
              <img src={city.emblem} alt="" width={22} height={22} decoding="async" />
              {city.name}
            </span>
          )}
          <span>
            <TimeAgo iso={article.publishedAt} /> më parë
          </span>
        </span>
        <span className="kl-cta" aria-hidden="true">
          Lexo lajmin
          <ArrowRight size={16} strokeWidth={2.2} />
        </span>
      </span>
    </Link>
  );
}
