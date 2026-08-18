-- Sondazhi i Ditës — daily poll: schema, integrity and read path.
--
-- Both tables already exist in the hosted project; they were created ad hoc and
-- never had a migration, so this file is the first committed record of them. It
-- is written defensively for exactly that reason: every statement tolerates the
-- object already existing, and nothing assumes a shape it has not verified.
--
--   daily_polls  one poll per calendar day, keyed by local Kosovo date. Absent
--                row = the client falls back to the static bank in lib/polls-data.ts
--   poll_votes   one vote per anonymous voter per day
--
-- Anonymous voter identity is the localStorage id shared with Reagimi i Ditës
-- (`383_voter_id`). No accounts, no PII.
--
-- Three real defects are fixed here, not just schema recorded:
--   1. poll_votes had no unique index, so the one-vote-per-day rule the client
--      has always assumed was never actually enforced.
--   2. RLS has been rejecting anonymous SELECT on poll_votes on some days (401
--      in the browser console), which the component swallowed and rendered as
--      "0 vota". The policies below are recreated unconditionally.
--   3. Every voter's uuid for the day was shipped to every browser. The
--      sondazhi_day() function replaces that with an aggregate.
--
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Poll of the day
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.daily_polls (
  poll_date date primary key,
  question  text not null,
  options   jsonb not null
);

-- Columns added by this migration. Split out with `if not exists` because the
-- live table predates the file and already holds rows.
alter table public.daily_polls add column if not exists context_line        text;
alter table public.daily_polls add column if not exists source_article_slug text;
alter table public.daily_polls add column if not exists status              text not null default 'approved';
alter table public.daily_polls add column if not exists created_at          timestamptz not null default now();
alter table public.daily_polls add column if not exists updated_at          timestamptz not null default now();

comment on table  public.daily_polls is
  'One poll per day, keyed by local Kosovo date. Absent row = static fallback in lib/polls-data.ts.';
comment on column public.daily_polls.context_line is
  'One sentence of real context from the day''s news. This is what gives the question a reason to exist today rather than any other day.';
comment on column public.daily_polls.status is
  'draft = generated, awaiting review in /admin/poll. approved = live. Only approved rows are read by the homepage.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_polls_status_check'
  ) then
    alter table public.daily_polls
      add constraint daily_polls_status_check
      check (status in ('draft', 'approved'));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reader votes
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.poll_votes (
  id           bigint generated always as identity primary key,
  poll_date    date        not null,
  option_index int         not null,
  voter_id     text        not null,
  created_at   timestamptz not null default now()
);

-- The live table may predate the id/created_at columns.
alter table public.poll_votes add column if not exists created_at timestamptz not null default now();

-- One vote per person per day. The client relies on this: a duplicate insert
-- returns 23505, and the optimistic update keeps the vote but undoes the count.
--
-- Existing duplicates have to go first or the index cannot be built. The
-- earliest vote wins, which is the one the voter actually intended; later rows
-- are reload artefacts from the window where nothing enforced this.
delete from public.poll_votes a
  using public.poll_votes b
 where a.poll_date = b.poll_date
   and a.voter_id  = b.voter_id
   and a.ctid      > b.ctid;

create unique index if not exists poll_votes_day_voter_idx
  on public.poll_votes (poll_date, voter_id);

-- Tally query is always "all votes for one day".
create index if not exists poll_votes_day_idx
  on public.poll_votes (poll_date);

-- Defensive bounds. A poll never has more than a handful of options, and a
-- voter_id is a client-generated uuid — cap both so a hostile client cannot
-- write junk or unbounded rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'poll_votes_option_range_check'
  ) then
    alter table public.poll_votes
      add constraint poll_votes_option_range_check
      check (option_index between 0 and 9);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'poll_votes_voter_len_check'
  ) then
    alter table public.poll_votes
      add constraint poll_votes_voter_len_check
      check (char_length(voter_id) between 8 and 64);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
--
-- daily_polls  public read; writes only via the service-role key (admin + the
--              draft automation).
-- poll_votes   public insert only. Reads go through sondazhi_day() below rather
--              than a direct select, so no client ever receives another
--              visitor's voter_id. No update, no delete: a vote is final,
--              which is also what the UI promises.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.daily_polls enable row level security;
alter table public.poll_votes  enable row level security;

drop policy if exists daily_polls_public_read on public.daily_polls;
create policy daily_polls_public_read
  on public.daily_polls for select
  using (true);

drop policy if exists poll_votes_public_insert on public.poll_votes;
create policy poll_votes_public_insert
  on public.poll_votes for insert
  with check (true);

-- Named for what it replaced. Any previously-granted public read on poll_votes
-- is withdrawn: the aggregate below is the only read path.
drop policy if exists poll_votes_public_read on public.poll_votes;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read path
--
-- One round trip returns both things the card needs: the tally, and whether
-- this particular voter has already voted. SECURITY DEFINER so it can read
-- poll_votes without granting the caller a blanket select over it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sondazhi_day(p_date date, p_voter text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'counts', coalesce(
      (
        select jsonb_object_agg(option_index::text, votes)
          from (
            select option_index, count(*)::int as votes
              from public.poll_votes
             where poll_date = p_date
             group by option_index
          ) tallies
      ),
      '{}'::jsonb
    ),
    'my_vote', (
      select option_index
        from public.poll_votes
       where poll_date = p_date
         and p_voter is not null
         and voter_id = p_voter
       limit 1
    )
  );
$$;

comment on function public.sondazhi_day(date, text) is
  'Tally for one poll day plus this voter''s own choice. Replaces a direct select on poll_votes, which used to ship every visitor''s uuid to every browser.';

revoke all on function public.sondazhi_day(date, text) from public;
grant execute on function public.sondazhi_day(date, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sondazhi_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists daily_polls_touch_updated_at on public.daily_polls;
create trigger daily_polls_touch_updated_at
  before update on public.daily_polls
  for each row execute function public.sondazhi_touch_updated_at();
