-- 0012 — Permit the dedicated live-sports processor in the immutable automation audit allowlist.
-- Review/apply separately; this migration has no runtime side effect by itself.
-- Keep the existing action values explicit so unknown audit actions remain rejected.

alter table public.market_automation_runs
  drop constraint if exists market_automation_runs_action_check;

alter table public.market_automation_runs
  add constraint market_automation_runs_action_check
  check (action in ('daily_drafts', 'reprice', 'live_sports'));
