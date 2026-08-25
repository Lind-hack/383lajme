-- 0048 - Profile hub: persistent reading list, public anonymity and self-delete.

alter table public.profiles
  add column if not exists is_anonymous boolean not null default false;

create table if not exists public.saved_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  slug text not null,
  title text not null,
  excerpt text not null default '',
  category text not null default '',
  source text not null default '',
  image_url text,
  published_at timestamptz,
  saved_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists saved_articles_user_time_idx
  on public.saved_articles (user_id, saved_at desc);

alter table public.saved_articles enable row level security;

drop policy if exists "users read own saved articles" on public.saved_articles;
create policy "users read own saved articles"
  on public.saved_articles for select
  using (auth.uid() = user_id);

drop policy if exists "users save own articles" on public.saved_articles;
create policy "users save own articles"
  on public.saved_articles for insert
  with check (auth.uid() = user_id);

drop policy if exists "users remove own saved articles" on public.saved_articles;
create policy "users remove own saved articles"
  on public.saved_articles for delete
  using (auth.uid() = user_id);

drop policy if exists "users update own saved articles" on public.saved_articles;
create policy "users update own saved articles"
  on public.saved_articles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.update_profile_settings(
  p_display_name text,
  p_is_anonymous boolean
)
returns table (display_name text, is_anonymous boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := left(regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), 48);
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if char_length(v_name) < 2 then raise exception 'Emri publik duhet të ketë së paku 2 karaktere'; end if;

  return query
    update public.profiles
       set display_name = v_name,
           is_anonymous = coalesce(p_is_anonymous, false),
           updated_at = now()
     where id = v_user
     returning profiles.display_name, profiles.is_anonymous;
end;
$$;

revoke all on function public.update_profile_settings(text, boolean) from public, anon;
grant execute on function public.update_profile_settings(text, boolean) to authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

create or replace function public.market_top_holders(p_market_id uuid, p_limit int default 30)
returns table (display_name text, side text, shares numeric, coins_staked numeric)
language sql
security definer
set search_path = public
stable
as $$
  select case when coalesce(pr.is_anonymous, false) then 'Anonim'
              else coalesce(pr.display_name, 'Anonim') end,
         p.side,
         p.shares,
         p.coins_staked
  from public.positions p
  left join public.profiles pr on pr.id = p.user_id
  where p.market_id = p_market_id and p.shares > 0.01
  order by p.shares desc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.market_top_holders(uuid, int) to anon, authenticated;
