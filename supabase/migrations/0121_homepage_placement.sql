-- One independently timed editorial lead; normal featured rankings are untouched.
create table if not exists public.homepage_placements (
  slot text primary key check (slot = 'lead'),
  article_id text not null references public.news_articles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
alter table public.homepage_placements enable row level security;
create policy "homepage placements are publicly readable"
  on public.homepage_placements for select using (true);
grant select on public.homepage_placements to anon, authenticated;
grant all on public.homepage_placements to service_role;
notify pgrst, 'reload schema';
