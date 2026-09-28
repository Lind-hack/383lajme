import Image from "next/image";
import Link from "next/link";
import { type Article, calcReadingTime } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import CategoryMark from "@/components/category-mark";
import TimeAgo from "@/components/time-ago";

/**
 * "Top 5 sot" — one story per topic, ranked.
 *
 * It replaced "5 tema, 5 lajme", five portrait photo cards a fifth of the page
 * wide and ~400px tall. News photographs are landscape, so every card cropped
 * its picture to a sliver and stretched a feed-sized file across the whole
 * tile, and each headline sat in a column a few words wide. A ranked list reads
 * at a glance instead: the rank is the hook, the headline gets a full line, and
 * the photo keeps its own 16:10 shape beside it, loaded at the size it shows.
 *
 * The ranking is the order the page passes in (best-scored first). Rendered on
 * the server; hover and the entrance are CSS only.
 */
/** A thin day can fill fewer than five topics; the copy counts what is shown. */
const COUNT_WORDS: Record<number, string> = { 1: "një", 2: "dy", 3: "tre", 4: "katër", 5: "pesë" };

export default function TopFive({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;
  return (
    <section className="top5" aria-labelledby="top5-title">
      <header className="top5-head">
        <h2 id="top5-title">
          Top <span className="top5-head-num">{articles.length}</span> sot
        </h2>
        <p>
          Nëse lexon vetëm {COUNT_WORDS[articles.length] ?? articles.length} gjëra sot, lexo këto — një histori e
          vetme nga secila temë.
        </p>
      </header>

      <ol className="top5-list">
        {articles.map((article, i) => {
          const color = getCategoryColor(article.category);
          return (
            <li key={article.id} className="top5-item" style={{ ["--cat" as string]: color }}>
              <Link href={`/article/${article.slug}`} className="top5-row" data-rank={i + 1}>
                <span className="top5-rank" aria-hidden>
                  {i + 1}
                </span>

                <span className="top5-body">
                  <span className="top5-meta">
                    <span className="top5-cat">
                      <CategoryMark category={article.category} size={13} />
                      {article.category}
                    </span>
                    <span className="top5-dot" aria-hidden>·</span>
                    <TimeAgo iso={article.publishedAt} />
                    <span className="top5-dot top5-read" aria-hidden>·</span>
                    <span className="top5-read">{calcReadingTime(article.body ?? "")} min lexim</span>
                  </span>
                  <span className="top5-title">
                    <span className="sr-only">{`Nr. ${i + 1}: `}</span>
                    {article.title}
                  </span>
                  {article.excerpt && <span className="top5-excerpt">{article.excerpt}</span>}
                </span>

                <span className="top5-thumb" aria-hidden>
                  {article.imageUrl ? (
                    <Image
                      src={article.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 92px, (max-width: 1024px) 220px, 280px"
                      quality={90}
                    />
                  ) : (
                    <span className="top5-thumb-empty">
                      <CategoryMark category={article.category} size={28} />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
