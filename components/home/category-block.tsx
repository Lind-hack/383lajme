import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import { CATEGORY_TO_SLUG, type NavCategory } from "@/lib/category-map";
import ArticleCard from "@/components/article-card";
import SectionLabel from "@/components/section-label";
import StoryList from "@/components/story-list";

/**
 * A category's section on the homepage: its best story as a card, the next
 * four as compact rows, and the way into the full section.
 *
 * Kosovë and Shqipëri keep their full-colour spotlights. The other five were
 * absent from the homepage altogether; giving each a colour band too would put
 * seven saturated slabs on one page, so here the colour is only an accent —
 * the label's bar and the row markers — on the page's own paper.
 */
export default function CategoryBlock({
  category,
  articles,
}: {
  category: NavCategory;
  articles: Article[];
}) {
  const [lead, ...rest] = articles;
  if (!lead) return null;
  const color = getCategoryColor(category);
  const slug = CATEGORY_TO_SLUG[category];

  return (
    <section
      className="home-cat"
      id={`seksioni-${slug}`}
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
      <div className="home-cat-grid">
        <div className="home-cat-lead">
          <ArticleCard article={lead} variant="grid" />
        </div>
        <StoryList articles={rest.slice(0, 4)} />
      </div>
    </section>
  );
}
