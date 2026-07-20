-- Clear admin-facing market lanes. Existing markets keep their historical
-- category; this classification identifies the intended source and live oracle.
alter table public.markets
  add column if not exists market_classification text not null default 'general_news';

alter table public.markets drop constraint if exists markets_market_classification_check;
alter table public.markets add constraint markets_market_classification_check check (
  market_classification in ('general_news', 'live_football', 'live_f1')
);

-- Preserve the known live feeds when upgrading an existing Tregu database.
update public.markets
set market_classification = 'live_f1'
where slug like 'f1-%';

update public.markets
set market_classification = 'live_football'
where market_classification = 'general_news'
  and live_event->>'provider' = 'espn';
