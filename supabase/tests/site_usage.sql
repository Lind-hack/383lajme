-- Run with psql -v ON_ERROR_STOP=1. Fixtures never survive this transaction.
begin;
do $$
declare batch jsonb; summary jsonb;
begin
  if has_table_privilege('anon', 'public.site_usage_events', 'SELECT') or
     has_function_privilege('anon', 'public.site_usage_summary()', 'EXECUTE') then
    raise exception 'Anonymous users can read usage data';
  end if;
  batch := jsonb_build_array(jsonb_build_object(
    'id','d4242e49-a8ce-4824-b23f-d11ccead9801',
    'visitor_hash',repeat('a',64),'session_hash',repeat('b',64),
    'path','/__usage_test__','feature','other','kind','click','action','button:buy','seconds',0));
  perform public.record_site_usage(batch);
  perform public.record_site_usage(batch);
  if (select count(*) from public.site_usage_events where path='/__usage_test__') <> 1 then
    raise exception 'Replayed batch counted twice';
  end if;
  summary := public.site_usage_summary();
  if not exists (select 1 from jsonb_array_elements(summary->'buttons') e
                 where e->>'action'='button:buy' and (e->>'clicks')::int >= 1) then
    raise exception 'Button measurement absent from summary';
  end if;
end $$;
rollback;
