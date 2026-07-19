-- One mutually-exclusive Argentina/Spain sport market.
-- This expands the generic sport engine from 3 outcomes to 2 or 3 outcomes,
-- without changing binary PO/JO validation.

alter table public.markets drop constraint if exists markets_outcomes_match_type_check;
alter table public.markets add constraint markets_outcomes_match_type_check check (
  (market_type = 'binary' and outcomes = array['PO', 'JO']::text[])
  or (market_type = 'two_outcome' and outcomes = array['ARGENTINA', 'SPAIN']::text[])
  or (market_type = 'three_outcome' and cardinality(outcomes) = 3)
);

alter table public.markets drop constraint if exists markets_sport_outcomes_check;
alter table public.markets add constraint markets_sport_outcomes_check check (
  sport_outcomes is null
  or (jsonb_typeof(sport_outcomes) = 'array' and jsonb_array_length(sport_outcomes) between 2 and 3)
);
