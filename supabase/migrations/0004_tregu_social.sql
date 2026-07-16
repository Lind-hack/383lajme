-- 0004 — Tregu social layer: comments + public holder aggregation.
--
-- Run once in the Supabase SQL editor (Project → SQL Editor → paste → Run).
-- Idempotent — safe to run more than once.
--
-- Why: the Polymarket-style detail page needs Comments, Top Holders and
-- Positions tabs. positions RLS is owner-only (correct for privacy of
-- coins_staked-level detail writes), so public holder data is exposed via a
-- SECURITY DEFINER function that returns only what the tabs show:
-- display name, side, shares, coins staked. No user ids leak.

-- ============================================================================
-- 1. market_comments — public discussion per market.
-- ============================================================================

create table if not exists public.market_comments (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists market_comments_market_time_idx
  on public.market_comments (market_id, created_at desc);

alter table public.market_comments enable row level security;

drop policy if exists "comments are public" on public.market_comments;
create policy "comments are public"
  on public.market_comments for select
  using (true);

drop policy if exists "users write own comments" on public.market_comments;
create policy "users write own comments"
  on public.market_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "users delete own comments" on public.market_comments;
create policy "users delete own comments"
  on public.market_comments for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 2. market_top_holders — public holder board. SECURITY DEFINER bypasses the
--    owner-only positions RLS but returns only board-safe columns.
-- ============================================================================

create or replace function public.market_top_holders(p_market_id uuid, p_limit int default 30)
returns table (display_name text, side text, shares numeric, coins_staked numeric)
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(pr.display_name, 'Anonim') as display_name,
         p.side,
         p.shares,
         p.coins_staked
  from public.positions p
  left join public.profiles pr on pr.id = p.user_id
  where p.market_id = p_market_id
    and p.shares > 0.01
  order by p.shares desc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.market_top_holders(uuid, int) to anon, authenticated;
