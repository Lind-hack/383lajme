import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { CATEGORY_TO_SLUG, type NavCategory } from "@/lib/category-map";
import SectionLabel from "@/components/section-label";
import StoryList from "@/components/story-list";
import NewsTile from "./news-tile";

/**
 * How a category section arranges its stories. Each is symmetrical — every
 * tile in a row shares its top and bottom edge, and the outer edges of the
 * block line up — and each still has its own shape, so the run of sections
 * does not read as one block repeated.
 *
 *   bento    one large tile spanning two rows, the rest in a two-row grid
 *   mosaic   a wide lead and two tiles in one row, the rest as rows in two
 *            equal columns
 *   overlay  photo tiles in equal rows: three large over four smaller
 */
export type CategoryLayout = "bento" | "mosaic" | "overlay";

/** Rows of an overlay block, larger first: 5 → 2+3, 6 → 3+3, 7 → 3+4. */
function overlayRows(count: number): number[] {
  if (count <= 4) return [count];
  if (count === 5) return [2, 3];
  return [3, count - 3];
}

export default function CategoryBlock({
  category,
  articles,
  layout = "bento",
}: {
  category: NavCategory;
  articles: Article[];
  layout?: CategoryLayout;
}) {
  if (!articles.length) return null;
  const color = getCategoryColor(category);
  const slug = CATEGORY_TO_SLUG[category];

  return (
    <section
      className="home-cat"
      id={`seksioni-${slug}`}
      data-layout={layout}
      aria-labelledby={`seksioni-${slug}-titulli`}
      style={{ ["--cat-color" as string]: color }}
    >
      <SectionLabel
        label={<span id={`seksioni-${slug}-titulli`}>{category}</span>}
        accent={color}
        marginBottom={14}
        right={
          <Link href={`/kategori/${slug}`} className="section-more">
            Shiko të gjitha<span aria-hidden> →</span>
          </Link>
        }
      />
      {layout === "bento" && <Bento articles={articles} />}
      {layout === "mosaic" && <Mosaic articles={articles} />}
      {layout === "overlay" && <Overlay articles={articles} />}
    </section>
  );
}

function Bento({ articles }: { articles: Article[] }) {
  const [lead, ...rest] = articles;
  const small = rest.slice(0, 6);
  const columns = Math.max(1, Math.ceil(small.length / 2));
  return (
    <div
      className="cat-bento"
      style={{ ["--bento-cols" as string]: columns }}
      data-odd={small.length % 2 === 1 || undefined}
    >
      <div className="cat-bento-lead">
        <NewsTile article={lead} size="lg" sizes="(max-width: 700px) 100vw, 560px" />
      </div>
      {small.map((article, i) => (
        // One tile in the grid is set as a headline rather than a photograph,
        // so the block is not six of the same object.
        <NewsTile key={article.id} article={article} variant={i === 1 ? "headline" : "overlay"} />
      ))}
    </div>
  );
}

function Mosaic({ articles }: { articles: Article[] }) {
  const top = articles.slice(0, 3);
  // Rows run in two equal columns, so they come in pairs.
  const rows = articles.slice(3);
  const even = rows.slice(0, rows.length - (rows.length % 2));
  return (
    <div className="cat-mosaic">
      <div className="cat-mosaic-top" data-count={top.length}>
        {top.map((article, i) => (
          <NewsTile
            key={article.id}
            article={article}
            size={i === 0 ? "lg" : "sm"}
            sizes={i === 0 ? "(max-width: 700px) 100vw, 640px" : "(max-width: 700px) 50vw, 320px"}
          />
        ))}
      </div>
      {even.length > 0 && (
        <div className="cat-mosaic-rows">
          <StoryList articles={even} />
        </div>
      )}
    </div>
  );
}

function Overlay({ articles }: { articles: Article[] }) {
  const rows = overlayRows(Math.min(articles.length, 7));
  let start = 0;
  return (
    <div className="cat-overlay">
      {rows.map((count, r) => {
        const slice = articles.slice(start, start + count);
        start += count;
        return (
          <div key={r} className="cat-overlay-row" data-row={r === 0 ? "first" : "next"} style={{ ["--row-cols" as string]: count }}>
            {slice.map((article, i) => (
              <NewsTile
                key={article.id}
                article={article}
                size={r === 0 ? "lg" : "sm"}
                // The second row carries one headline tile for the same reason
                // the bento does.
                variant={r > 0 && i === slice.length - 1 ? "headline" : "overlay"}
                sizes={r === 0 ? "(max-width: 700px) 100vw, 440px" : "(max-width: 700px) 50vw, 320px"}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
