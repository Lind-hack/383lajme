-- 0059 — A run that dies mid-flight must not wedge its subject.
--
-- The research job claims its work before doing any of it, so a double fire is
-- a no-op rather than a doubled spend. But the claim is written as
-- 'in_progress' and only the finish path ever moves it on. A run that times
-- out, is killed, or hits an unhandled error leaves that row behind forever.
--
-- Nothing reconciles it. The unique (subject_key, run_date) then refuses every
-- retry for the rest of the day, and because the row carries no cooldown it
-- never surfaces as a problem either — the subject simply stops being
-- researched, silently, which is the failure mode this whole feature keeps
-- producing and the one hardest to notice.
--
-- The route's own ceiling is 300 seconds. Anything still 'in_progress' well
-- past that is not running; it is a corpse.

alter table public.dosje_research_runs
  drop constraint if exists dosje_research_runs_outcome_check;

alter table public.dosje_research_runs
  add constraint dosje_research_runs_outcome_check
  check (outcome in ('in_progress', 'drafted', 'no_subject', 'no_sources',
                     'duplicate', 'llm_failed', 'verify_failed', 'abandoned'));

comment on column public.dosje_research_runs.outcome is
  'How the run ended. abandoned means it was claimed and never finished — a timeout or a crash — and was swept so the subject is not wedged.';

/**
 * Sweep claims that cannot still be running, and report how many.
 *
 * Called at the start of each run rather than on a schedule of its own: the
 * job that would notice a wedged claim is the same job that is blocked by it,
 * so the check belongs where the block is felt.
 */
create or replace function public.dosje_sweep_stale_claims(
  p_older_than interval default interval '20 minutes'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  swept int;
begin
  update public.dosje_research_runs
     set outcome = 'abandoned',
         detail = coalesce(detail, '{}'::jsonb)
                  || jsonb_build_object('abandoned_at', now(), 'reason', 'claim never finished'),
         -- A run that died already spent its fetches and possibly its model
         -- call. Retrying immediately risks a crash loop billing every few
         -- minutes, so the subject waits for tomorrow rather than being
         -- hammered — and it is a normal candidate again after that.
         cooldown_until = current_date + 1
   where outcome = 'in_progress'
     and created_at < now() - p_older_than;

  get diagnostics swept = row_count;
  return swept;
end;
$$;

comment on function public.dosje_sweep_stale_claims(interval) is
  'Marks claims that outlived the route timeout as abandoned so their subject can be researched again. Returns how many were swept.';

revoke all on function public.dosje_sweep_stale_claims(interval) from public, anon, authenticated;
grant execute on function public.dosje_sweep_stale_claims(interval) to service_role;

-- Prove it, at apply time.
do $$
declare
  swept int;
  still text;
begin
  insert into public.dosje_topics (slug, title, blurb, status, research_query)
       values ('__sweep_test__', 'Sweep', 'Sweep', 'draft', 'sweep test subject')
    on conflict (slug) do nothing;

  -- One claim from an hour ago that never finished, and one from just now.
  insert into public.dosje_research_runs (subject_key, run_date, outcome, created_at)
       values ('__sweep_old__', current_date, 'in_progress', now() - interval '1 hour'),
              ('__sweep_new__', current_date, 'in_progress', now())
    on conflict (subject_key, run_date) do update
       set outcome = excluded.outcome, created_at = excluded.created_at;

  swept := public.dosje_sweep_stale_claims();
  if swept < 1 then
    raise exception 'a claim an hour past a five minute ceiling was not swept';
  end if;

  select outcome into still
    from public.dosje_research_runs
   where subject_key = '__sweep_new__' and run_date = current_date;
  if still <> 'in_progress' then
    raise exception 'a claim made moments ago was swept as stale (got %)', still;
  end if;

  select outcome into still
    from public.dosje_research_runs
   where subject_key = '__sweep_old__' and run_date = current_date;
  if still <> 'abandoned' then
    raise exception 'the stale claim was not marked abandoned (got %)', still;
  end if;

  delete from public.dosje_research_runs
   where subject_key in ('__sweep_old__', '__sweep_new__');
  delete from public.dosje_topics where slug = '__sweep_test__';
  raise notice 'dosje_sweep_stale_claims verified: a dead claim is released, a live one is left alone';
end;
$$;
