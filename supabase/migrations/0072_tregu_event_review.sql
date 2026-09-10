-- New event-pair contracts stop for review; silence is never a JO result.
begin;
create or replace function public.pause_due_news_event_markets()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.markets
  set status = 'stale', updated_at = now(),
    pre_match_analysis = pre_match_analysis || jsonb_build_object(
      'review_required', true, 'review_reason', 'Neither contracted outcome verified before review date',
      'review_requested_at', now())
  where status = 'open' and market_classification = 'general_news'
    and market_type = 'binary' and closes_at <= now()
    and pre_match_analysis->>'contract_version' = 'news-event-v3'
    and pre_match_analysis->'proposition'->>'resolution_mode' = 'event_pair';
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.pause_due_news_event_markets() from public, anon, authenticated;
grant execute on function public.pause_due_news_event_markets() to service_role;
commit;
