-- 0027 — Deadline settlement authority for time-bounded General/News markets.
-- Apply in Supabase SQL Editor before deploying the matching worker.

create or replace function public.apply_news_deadline_settlement(p_market_id uuid)
returns table (outcome text, settled_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_market record;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status not in ('open', 'closed') then
    raise exception 'Market is missing or already resolved';
  end if;
  if coalesce(v_market.market_type, 'binary') <> 'binary'
     or lower(coalesce(v_market.category, '')) in ('sport', 'f1', 'football') then
    raise exception 'Deadline settlement only supports eligible General/News binary markets';
  end if;
  if v_market.closes_at is null or v_market.closes_at > now() then
    raise exception 'Market deadline has not passed';
  end if;
  perform public.resolve_market(p_market_id, 'JO');
  return query select 'JO'::text, now();
end;
$$;
revoke all on function public.apply_news_deadline_settlement(uuid) from public, anon, authenticated;
grant execute on function public.apply_news_deadline_settlement(uuid) to service_role;
