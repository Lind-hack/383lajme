-- 400 verified articles/day, with cumulative country and outlet limits.
-- Both the new worker and legacy callers use the same transaction lock.
create or replace view public.bota_coverage_cards with (security_invoker=true) as
select id,first_seen,created_at,data - 'paragraphs' - 'sourceHash' as data
from public.bota_coverage_articles;
revoke all on public.bota_coverage_cards from public,anon,authenticated;
grant select on public.bota_coverage_cards to service_role;

create or replace function public.publish_bota_coverage_v3(p_day date,p_articles jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare total integer; ids jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('bota_coverage_daily'));
 if p_day <> (now() at time zone 'Europe/Belgrade')::date then raise exception 'Current Kosovo date required'; end if;
 if jsonb_typeof(p_articles)<>'array' or jsonb_array_length(p_articles) not between 1 and 400 then raise exception 'Publish 1-400 verified articles'; end if;
 select count(*) into total from bota_coverage_articles where first_seen=p_day;
 with unique_candidates as (
   select distinct on (a->>'id') a,position
   from jsonb_array_elements(p_articles) with ordinality as x(a,position)
   where not exists(select 1 from bota_coverage_articles b where b.id=a->>'id')
   order by a->>'id',position
 ), country_counts as (
   select data->>'country' country,count(*) n from bota_coverage_articles
   where first_seen=p_day group by data->>'country'
 ), outlet_counts as (
   select data->>'country' country,data->>'outlet' outlet,count(*) n from bota_coverage_articles
   where first_seen=p_day group by data->>'country',data->>'outlet'
 ), outlet_ranked as (
   select a,position,
   row_number() over(partition by a->>'country',a->>'outlet' order by position) outr,
   coalesce(c.n,0) cn,coalesce(o.n,0) onum
   from unique_candidates u left join country_counts c on c.country=a->>'country'
   left join outlet_counts o on o.country=a->>'country' and o.outlet=a->>'outlet'
 ), ranked as (
   select a,position,cn,row_number() over(partition by a->>'country' order by position) cr
   from outlet_ranked where outr<=greatest(0,12-onum)
 ), candidates as (
   select a from ranked where cr<=greatest(0,40-cn)
   order by position limit greatest(0,400-total)
 ), inserted as (
   insert into bota_coverage_articles(id,first_seen,data)
   select a->>'id',p_day,a from candidates on conflict(id) do nothing returning id
 ) select coalesce(jsonb_agg(id),'[]'::jsonb) into ids from inserted;
 total:=total+jsonb_array_length(ids);
 if total>0 then
   insert into bota_coverage_runs(day,model,reasoning_effort,article_count)
   values(p_day,'gpt-6-luna','xhigh',total)
   on conflict(day) do update set article_count=excluded.article_count;
 end if;
 return jsonb_build_object('published',jsonb_array_length(ids)>0,'inserted',jsonb_array_length(ids),
                          'total',total,'article_ids',ids,'at_capacity',total>=400);
end;$$;
revoke all on function public.publish_bota_coverage_v3(date,jsonb) from public,anon,authenticated;
grant execute on function public.publish_bota_coverage_v3(date,jsonb) to service_role;
create or replace function public.publish_bota_coverage_v2(p_day date,p_articles jsonb)
returns jsonb language sql security definer set search_path=public as $$
 select public.publish_bota_coverage_v3(p_day,p_articles);
$$;
create or replace function public.publish_bota_coverage(p_day date,p_articles jsonb)
returns boolean language sql security definer set search_path=public as $$
 select (public.publish_bota_coverage_v3(p_day,p_articles)->>'published')::boolean;
$$;
notify pgrst,'reload schema';
