-- Resolve coin requests and execute against the same locked book. Existing
-- sell routines retain ownership, market-status, ledger and balance checks.
create or replace function public.sell_market_coins(
  p_market_id uuid, p_side text, p_coins numeric default null,
  p_sell_all boolean default false, p_preview boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.markets%rowtype;
  holding public.positions%rowtype;
  quantities jsonb;
  pivot numeric;
  total numeric;
  price numeric;
  maximum numeric;
  amount numeric;
  quantity numeric;
  receipt record;
begin
  if auth.uid() is null then raise exception 'Duhet të jesh i kyçur'; end if;
  select * into m from public.markets where id=p_market_id for update;
  if not found or m.status <> 'open' or m.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;
  select * into holding from public.positions where user_id=auth.uid() and market_id=p_market_id and side=p_side for update;
  if not found or holding.shares <= 0 then raise exception 'Nuk ke pozicion për të shitur'; end if;
  quantities := case when jsonb_typeof(m.outcome_quantities)='object' then m.outcome_quantities else jsonb_build_object('PO',m.q_yes,'JO',m.q_no) end;
  if not quantities ? p_side or m.b <= 0 then raise exception 'Zgjedhje e pavlefshme'; end if;
  select max(value::numeric) into pivot from jsonb_each_text(quantities);
  select sum(exp((value::numeric-pivot)/m.b)) into total from jsonb_each_text(quantities);
  price := exp(((quantities->>p_side)::numeric-pivot)/m.b)/total;
  maximum := -m.b*ln(1-price+price*exp(-holding.shares/m.b));
  if p_preview then return jsonb_build_object('maximumCoins',maximum); end if;
  amount := case when p_sell_all then maximum else p_coins end;
  if amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<=0 or amount>maximum then
    raise exception 'Shuma tejkalon vlerën aktuale. Rifresko dhe provo përsëri.';
  end if;
  quantity := case when p_sell_all then holding.shares else least(holding.shares,-m.b*ln((exp(-amount/m.b)-(1-price))/price)) end;
  if m.market_type in ('f1_race_winner','f1_championship_winner') then
    select * into receipt from public.sell_f1_race_winner_shares(p_market_id,p_side,quantity);
  elsif jsonb_typeof(m.sport_outcomes)='array' then
    select * into receipt from public.sell_sport_market_shares(p_market_id,p_side,quantity);
  else
    select * into receipt from public.sell_shares(p_market_id,p_side,quantity);
  end if;
  return jsonb_build_object('coinsReceived',receipt.coins_received);
end $$;
revoke all on function public.sell_market_coins(uuid,text,numeric,boolean,boolean) from public,anon;
grant execute on function public.sell_market_coins(uuid,text,numeric,boolean,boolean) to authenticated;
