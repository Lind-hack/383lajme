-- 0016 — Durable two-minute Tregu repricing observability.
-- Per-run completion, duration, provider/fallback (non-secret), scan/update counts,
-- outcome, and error class are retained in market_automation_runs.details.
create index if not exists market_automation_runs_reprice_started_at_idx
  on public.market_automation_runs (action, started_at desc);
