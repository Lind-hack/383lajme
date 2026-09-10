begin;
do $$
declare m uuid; prices jsonb; before_prices jsonb; key text;
begin
  insert into public.markets(slug,question,category,status,market_type,market_classification,b,outcomes,sport_outcomes,outcome_quantities,reference_probabilities,live_event,closes_at)
  values('test-vector-cap','Home, draw or away?','sport','open','three_outcome','live_football',6500,array['home','draw','away'],
  '[{"key":"home","label":"Home","team":"Home"},{"key":"draw","label":"Draw"},{"key":"away","label":"Away","team":"Away"}]',
  jsonb_build_object('home',6500*ln(0.8),'draw',6500*ln(0.1),'away',6500*ln(0.1)),
  '{"home":0.6,"draw":0.2,"away":0.2}',
  '{"provider":"espn","event_id":"cap-test","league":"uefa.europa","yes_team":"Home"}',now()+interval '1 day') returning id into m;
  before_prices := '{"home":0.8,"draw":0.1,"away":0.1}';
  perform public.apply_sport_market_oracle(m,'espn','cap-test','{"key":"cap-state","status":"STATUS_SCHEDULED","source_url":"https://site.api.espn.com/"}',
  '{"home":0.1,"draw":0.45,"away":0.45}','[]','Cap regression',0.1,false,null,null);
  select reference_probabilities into prices from public.markets where id=m;
  for key in select jsonb_object_keys(prices) loop
    if abs((prices->>key)::numeric-(before_prices->>key)::numeric)>0.100000001 then raise exception 'Displayed odds exceeded cap: %',prices; end if;
  end loop;
  if abs((select sum(value::numeric) from jsonb_each_text(prices))-1)>0.000001 then raise exception 'Vector lost normalization'; end if;
  if abs((prices->>'home')::numeric-0.7)>0.000001 then raise exception 'Cap used stale reference instead of actual book'; end if;
  raise notice 'PASS: three-way caps preserve normalization and respect displayed prices after trades';
end $$;
rollback;

