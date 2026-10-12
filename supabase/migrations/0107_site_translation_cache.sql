-- Shared public-site translations survive application restarts. Original text
-- is identified by its versioned hash; only the server service role has access.
create table if not exists public.site_translation_cache (
  cache_key text primary key,
  language text not null check (language in ('sq', 'en', 'de')),
  translated_text text not null check (length(translated_text) between 1 and 48000),
  created_at timestamptz not null default now()
);
alter table public.site_translation_cache enable row level security;
revoke all on public.site_translation_cache from anon, authenticated;
grant select, insert, update, delete on public.site_translation_cache to service_role;
