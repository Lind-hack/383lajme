// The first screen: one dominant story with its headline ON the photograph,
// and three supporting stories beside it.
//
// The previous version stacked image, then headline, then summary, then meta —
// four separate bands that pushed the supporting column out of alignment and
// left the photo doing nothing but sitting there. Laying the text over the
// image is what makes a front page read as a front page: one object, not four,
// and the picture becomes part of the story rather than an illustration above
// it.
//
// The scrim is deliberately heavy at the bottom. White text over an arbitrary
// publisher photograph has to clear 4.5:1 against whatever happens to be in
// that corner of the frame, and article images here come from anywhere.

import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import SourceBadge from "@/components/source-badge";
import TimeAgo from "@/components/time-ago";
import ArticleImage from "./article-image";
import BookmarkButton from "./bookmark-button";
import SideCards from "./side-cards";
import type { CityWeather } from "@/lib/weather";
import type { ExchangeSnapshot, FuelSnapshot } from "@/lib/home-market-data";

function SupportingCard({ article }: { article: Article }) {
  const accent = getCategoryColor(article.category);
  return (
    <article className="home-support">
      <Link href={`/article/${article.slug}`} className="home-support-link">
        <span className="home-support-thumb">
          <ArticleImage
            src={article.imageUrl}
            sizes="(max-width: 860px) 124px, 132px"
            accent={accent}
          />
        </span>
        <span className="home-support-text">
          <strong>{article.title}</strong>
          <span className="home-support-meta-line">
            <b style={{ color: accent }}>{article.category}</b>
            <i aria-hidden="true">·</i>
            <TimeAgo iso={article.publishedAt} />
          </span>
        </span>
      </Link>
    </article>
  );
}

export default function LeadBlock({
  lead,
  supporting,
  weather,
  exchange,
  fuel,
  recommended,
}: {
  lead: Article;
  supporting: Article[];
  weather?: CityWeather[];
  exchange?: ExchangeSnapshot | null;
  fuel?: FuelSnapshot | null;
  recommended?: Article[];
}) {
  const accent = getCategoryColor(lead.category);

  return (
    <section className="home-lead" aria-labelledby="home-lead-title">
      <article className="home-hero">
        <Link href={`/article/${lead.slug}`} className="home-hero-link">
          <ArticleImage
            src={lead.imageUrl}
            sizes="(max-width: 860px) 100vw, 820px"
            accent={accent}
            // The page's LCP element. Exactly one image may carry this.
            priority
          />
          <span className="home-hero-scrim" aria-hidden="true" />

          <span className="home-hero-body">
            <span className="home-hero-badge">Kryesore</span>
            <h2 id="home-lead-title" className="home-hero-title">
              {lead.title}
            </h2>
            {lead.excerpt && <p className="home-hero-summary">{lead.excerpt}</p>}
            <span className="home-hero-meta">
              <b style={{ color: accent }}>{lead.category}</b>
              <i aria-hidden="true">·</i>
              <TimeAgo iso={lead.publishedAt} />
              {lead.readingTime ? (
                <>
                  <i aria-hidden="true">·</i>
                  <span>{lead.readingTime} min lexim</span>
                </>
              ) : null}
            </span>
          </span>
        </Link>

        {/* Outside the link: SourceBadge renders an <a> when it has a url, and
            an anchor inside an anchor is invalid HTML. */}
        <div className="home-hero-foot">
          <SourceBadge
            source={lead.source}
            flag={lead.sourceFlag}
            url={lead.url}
          />
          <BookmarkButton
            articleId={lead.id}
            slug={lead.slug}
            title={lead.title}
            size={40}
          />
        </div>
      </article>

      <div className="home-lead-side">
        {supporting.map((article) => (
          <SupportingCard key={article.id} article={article} />
        ))}
      </div>

      {/* A third column, not a footer under the second. Stacked under the
          headlines these read as an afterthought to the news; beside them they
          are their own standing reference, and the row fills the full width. */}
      <SideCards
        weather={weather}
        exchange={exchange}
        fuel={fuel}
        recommended={recommended}
      />
    </section>
  );
}
