-- 0018 — Five-minute tregu-live heartbeat action.
-- Keep the action constraint explicit: unknown automation actions must fail closed.
alter table public.market_automation_runs
  drop constraint if exists market_automation_runs_action_check;

alter table public.market_automation_runs
  add constraint market_automation_runs_action_check
  check (action in ('daily_drafts', 'reprice', 'live_sports', 'pre_match_refresh', 'tregu_live'));

create index if not exists market_automation_runs_tregu_live_started_at_idx
  on public.market_automation_runs (action, started_at desc)
  where action = 'tregu_live';
