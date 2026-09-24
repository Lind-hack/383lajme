-- 0082 - Reader interests for "Për ty".
--
-- The signed-in mirror of the browser-side "383:interests" key. Guests never
-- touch this table: choosing interests works with no account at all, and this
-- exists only so a reader who signs in keeps the same feed on another device.
--
-- Additive and safe against a live database: one new table, one function,
-- nothing existing is altered.
--
-- Adapted from the never-applied 0077 on the home-redesign branch, without its
-- news_articles.why_matters column (that belongs to the homepage redesign) and
-- with people and cities added.
--
-- Learned reading affinity is deliberately NOT stored here. It stays on the
-- reader's device; only what the reader explicitly chose is synced.
--
-- Values are text[] rather than foreign keys: the category, people and city
-- vocabularies live in lib/category-map.ts, lib/people.mjs and lib/cities.mjs,
-- and the client drops any value it no longer recognises. A hard FK would turn
-- retiring a name into deleting a reader's choice.

create table if not exists public.reader_interests (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  categories  text[] not null default '{}',
  topics      text[] not null default '{}',
  people      text[] not null default '{}',
  cities      text[] not null default '{}',
  email_optin boolean not null default false,
  updated_at  timestamptz not null default now()
);

comment on table public.reader_interests is
  'Per-reader interest profile for Për ty. email_optin is a separate consent: '
  'choosing interests personalises the site and never subscribes anyone to email.';

alter table public.reader_interests enable row level security;

-- Owner-only, matching the saved_articles policies in 0048.
drop policy if exists "users read own interests" on public.reader_interests;
create policy "users read own interests"
  on public.reader_interests for select
  using (auth.uid() = user_id);

drop policy if exists "users create own interests" on public.reader_interests;
create policy "users create own interests"
  on public.reader_interests for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own interests" on public.reader_interests;
create policy "users update own interests"
  on public.reader_interests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own interests" on public.reader_interests;
create policy "users delete own interests"
  on public.reader_interests for delete
  using (auth.uid() = user_id);


-- merge_reader_interests: called once when a reader who has been choosing as a
-- guest signs in. It unions both sides, so a reader who picked on their phone
-- and then signed in on a laptop ends up with both sets, never the smaller one.
-- email_optin is never touched here: consent is given on purpose, not acquired
-- as a side effect of signing in.

create or replace function public.merge_reader_interests(
  p_categories text[],
  p_topics text[],
  p_people text[],
  p_cities text[]
)
returns table (categories text[], topics text[], people text[], cities text[], email_optin boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.reader_interests as ri (user_id, categories, topics, people, cities, updated_at)
  values (
    v_user,
    coalesce(p_categories, '{}'),
    coalesce(p_topics, '{}'),
    coalesce(p_people, '{}'),
    coalesce(p_cities, '{}'),
    now()
  )
  on conflict (user_id) do update
    set categories = (
          select coalesce(array_agg(distinct x), '{}')
          from unnest(ri.categories || coalesce(p_categories, '{}')) as x
        ),
        topics = (
          select coalesce(array_agg(distinct x), '{}')
          from unnest(ri.topics || coalesce(p_topics, '{}')) as x
        ),
        people = (
          select coalesce(array_agg(distinct x), '{}')
          from unnest(ri.people || coalesce(p_people, '{}')) as x
        ),
        cities = (
          select coalesce(array_agg(distinct x), '{}')
          from unnest(ri.cities || coalesce(p_cities, '{}')) as x
        ),
        updated_at = now();

  return query
    select ri.categories, ri.topics, ri.people, ri.cities, ri.email_optin
    from public.reader_interests ri
    where ri.user_id = v_user;
end;
$$;

revoke all on function public.merge_reader_interests(text[], text[], text[], text[]) from public, anon;
grant execute on function public.merge_reader_interests(text[], text[], text[], text[]) to authenticated;
