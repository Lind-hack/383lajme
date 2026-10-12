-- Kuizi i Ditës — five questions on the last 24 hours of news, replacing
-- Reagimi i Ditës on the homepage.
--
-- kuizi_daily    one quiz per Kosovo calendar day. Written only by the
--                service role (automation, admin); readers see published rows.
-- kuizi_answers  one row per reader per question. Nobody reads or writes it
--                directly: answers go in through kuizi_answer() and come back
--                out only as aggregates through kuizi_day(), so no visitor ever
--                sees another visitor's id (the lesson of 0043).
--
-- Each answer is saved the moment it is tapped, because the card shows how the
-- other readers split on that question right after the reader answers it.
--
-- Idempotent: safe to re-run.

create table if not exists public.kuizi_daily (
  kuiz_date  text primary key check (kuiz_date ~ '^\d{4}-\d{2}-\d{2}$'),
  questions  jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) = 5),
  status     text not null default 'published' check (status in ('published', 'draft', 'rejected')),
  source     text not null default 'auto' check (source in ('auto', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kuizi_daily enable row level security;

drop policy if exists kuizi_daily_public_read on public.kuizi_daily;
create policy kuizi_daily_public_read
  on public.kuizi_daily for select
  to anon, authenticated
  using (status = 'published');

create table if not exists public.kuizi_answers (
  kuiz_date  text not null references public.kuizi_daily (kuiz_date) on delete cascade,
  voter_id   text not null check (char_length(voter_id) between 8 and 64),
  q_index    smallint not null check (q_index between 0 and 4),
  choice     smallint not null check (choice between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (kuiz_date, voter_id, q_index)
);

-- RLS on and no policies: the functions below are the only way in or out.
alter table public.kuizi_answers enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- kuizi_day(date, voter): the room's split on every question, plus the
-- caller's own answers. counts is 5 arrays of 4 (unused option slots stay 0).
-- Null when the day has no published quiz.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.kuizi_day(p_date text, p_voter text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with tally as (
    select q_index, choice, count(*)::int as n
      from public.kuizi_answers
     where kuiz_date = p_date
     group by q_index, choice
  ),
  mine as (
    select q_index, choice
      from public.kuizi_answers
     where kuiz_date = p_date and voter_id = p_voter
  )
  select jsonb_build_object(
    'players', (select count(distinct voter_id) from public.kuizi_answers where kuiz_date = p_date),
    'counts', (
      select jsonb_agg(
               (select jsonb_agg(coalesce((select t.n from tally t where t.q_index = q and t.choice = o), 0) order by o)
                  from generate_series(0, 3) as o)
               order by q)
        from generate_series(0, 4) as q
    ),
    'mine', (
      select jsonb_agg((select m.choice from mine m where m.q_index = q) order by q)
        from generate_series(0, 4) as q
    )
  )
  where exists (
    select 1 from public.kuizi_daily where kuiz_date = p_date and status = 'published'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- kuizi_answer(date, voter, question, choice): record one answer and return
-- the day's state. The first answer to a question stands; a repeat is ignored
-- and still returns the state, so a double tap or a second tab is harmless.
-- Only today's and yesterday's quizzes (Kosovo time) take answers, so old
-- splits cannot be stuffed after the fact.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.kuizi_answer(p_date text, p_voter text, p_q int, p_choice int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_question jsonb;
  v_today date := (now() at time zone 'Europe/Belgrade')::date;
begin
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' or p_date::date not between v_today - 1 and v_today then
    raise exception 'quiz % is not open', p_date using errcode = '22023';
  end if;
  if p_voter is null or char_length(p_voter) not between 8 and 64 then
    raise exception 'invalid voter' using errcode = '22023';
  end if;
  if p_q is null or p_q not between 0 and 4 then
    raise exception 'invalid question' using errcode = '22023';
  end if;

  select questions -> p_q into v_question
    from public.kuizi_daily
   where kuiz_date = p_date and status = 'published';
  if v_question is null then
    raise exception 'no published quiz for %', p_date using errcode = 'P0002';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(v_question -> 'options') then
    raise exception 'invalid choice' using errcode = '22023';
  end if;

  insert into public.kuizi_answers (kuiz_date, voter_id, q_index, choice)
  values (p_date, p_voter, p_q, p_choice)
  on conflict (kuiz_date, voter_id, q_index) do nothing;

  return public.kuizi_day(p_date, p_voter);
end;
$$;

revoke all on function public.kuizi_day(text, text) from public;
revoke all on function public.kuizi_answer(text, text, int, int) from public;
grant execute on function public.kuizi_day(text, text) to anon, authenticated, service_role;
grant execute on function public.kuizi_answer(text, text, int, int) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
