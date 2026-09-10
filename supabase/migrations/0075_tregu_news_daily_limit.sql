begin;

-- Serialize automatic v3 publication across workers, including retries and
-- different run keys. Closed/resolved markets still consume their day's quota.
create or replace function public.enforce_news_daily_publication_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'Europe/Belgrade')::date;
  v_count integer;
begin
  if new.market_classification <> 'general_news'
     or new.pre_match_analysis->>'contract_version' is distinct from 'news-event-v3'
     or new.status <> 'open' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tregu-news-publication:' || v_day::text, 0));
  select count(*) into v_count from public.markets
  where market_classification = 'general_news'
    and pre_match_analysis->>'contract_version' = 'news-event-v3'
    and (created_at at time zone 'Europe/Belgrade')::date = v_day;
  if v_count >= 6 then
    raise exception 'Daily automatic news publication limit reached';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists news_daily_publication_limit on public.markets;
create trigger news_daily_publication_limit before insert on public.markets
for each row execute function public.enforce_news_daily_publication_limit();
revoke all on function public.enforce_news_daily_publication_limit() from public, anon, authenticated;
commit;
