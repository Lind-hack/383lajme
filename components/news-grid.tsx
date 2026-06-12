import { type Article } from "@/lib/mock-data";
import SectionLabel from "./section-label";
import ArticleCard from "./article-card";

interface NewsGridProps {
  articles: Article[];
  title: string;
  accentColor?: string;
}

export default function NewsGrid({ articles, title, accentColor = "#FF4422" }: NewsGridProps) {
  return (
    <section>
      <SectionLabel label={title} accent={accentColor} marginBottom={28} />

      {/* Grid */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article, i) => (
          <div key={article.id}>
            <ArticleCard article={article} variant="grid" index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}
