-- Topic Selection v2: persist deterministic local city tags for the KOSOVË/
-- SHQIPËRI sections. The full corroborating-source list remains in raw_article
-- so publication retains the audit trail without requiring a second schema column.
alter table public.news_articles
  add column if not exists city text;

create index if not exists news_articles_category_city_published_at_idx
  on public.news_articles (category, city, published_at desc);
