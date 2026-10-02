-- Append verified batches atomically, preserving existing articles and capping
-- each Kosovo calendar day at 100. Shared lock also serializes legacy callers.
create or replace function public.publish_bota_coverage_v2(p_day date,p_articles jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare total integer; ids jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('bota_coverage_daily'));
 if p_day <> (now() at time zone 'Europe/Belgrade')::date then raise exception 'Current Kosovo date required'; end if;
 if jsonb_typeof(p_articles)<>'array' or jsonb_array_length(p_articles) not between 1 and 100 then raise exception 'Publish 1-100 translated articles'; end if;
 select count(*) into total from bota_coverage_articles where first_seen=p_day;
 with candidates as (
   select distinct on (a->>'id') a from jsonb_array_elements(p_articles) a
   where not exists(select 1 from bota_coverage_articles b where b.id=a->>'id')
   order by a->>'id' limit greatest(0,100-total)
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
                          'total',total,'article_ids',ids,'at_capacity',total>=100);
end;$$;
revoke all on function public.publish_bota_coverage_v2(date,jsonb) from public,anon,authenticated;
grant execute on function public.publish_bota_coverage_v2(date,jsonb) to service_role;
