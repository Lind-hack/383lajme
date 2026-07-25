alter table public.markets drop constraint if exists markets_market_classification_check;
alter table public.markets add constraint markets_market_classification_check check (market_classification in ('general_news', 'live_football', 'live_basketball', 'live_f1'));
