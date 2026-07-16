-- 383 Lajme: direct Supabase publication for VPS news automation.
-- Run once in Supabase Dashboard -> SQL Editor -> New query.

create table if not exists public.news_batches (
  batch_key text primary key,
  scheduled_slot text,
  source_file text,
  article_count integer not null check (article_count between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news_articles (
  id text primary key,
  batch_key text not null references public.news_batches(batch_key) on delete cascade,
  slug text not null unique,
  url text,
  dispatch text,
  title text not null,
  excerpt text not null,
  body text not null,
  source text not null,
  source_flag text,
  source_bias text,
  tone text,
  category text not null,
  published_at timestamptz not null,
  reading_time integer not null check (reading_time > 0),
  featured boolean not null default false,
  engagement_score numeric,
  score_reason text,
  score_breakdown jsonb,
  score_formula text,
  image_url text not null,
  image_width integer,
  image_height integer,
  video_clip_url text,
  social_platform text,
  social_post_account text,
  social_post_url text,
  social_post_basis text,
  raw_article jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists news_articles_published_at_idx
  on public.news_articles (published_at desc);
create index if not exists news_articles_category_published_at_idx
  on public.news_articles (category, published_at desc);
create index if not exists news_articles_batch_key_idx
  on public.news_articles (batch_key);

alter table public.news_batches enable row level security;
alter table public.news_articles enable row level security;

drop policy if exists "news articles are publicly readable" on public.news_articles;
create policy "news articles are publicly readable"
  on public.news_articles for select
  using (true);

-- No insert/update/delete policy is granted to browser clients. The VPS uses
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS for trusted publication only.
