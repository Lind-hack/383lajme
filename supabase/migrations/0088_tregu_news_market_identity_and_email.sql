begin;

alter table public.markets
  add column if not exists market_image_url text,
  add column if not exists market_image_alt text,
  add column if not exists market_image_source_url text,
  add column if not exists market_image_credit text;

create table if not exists public.market_open_notifications (
  market_id uuid primary key references public.markets(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  claimed_until timestamptz,
  claim_token uuid
);
alter table public.market_open_notifications enable row level security;
revoke all on public.market_open_notifications from public, anon, authenticated;
grant select, insert, update on public.market_open_notifications to service_role;

create or replace function public.queue_news_market_open_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_open boolean;
  queued uuid;
begin
  first_open := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then first_open := old.status is distinct from 'open'; end if;
  if new.status = 'open' and first_open
     and coalesce(new.market_classification, 'general_news') = 'general_news'
     and coalesce(new.market_type, 'binary') = 'binary'
     and lower(new.category) <> 'sport' then
    insert into public.market_open_notifications(market_id) values (new.id)
      on conflict (market_id) do nothing returning market_id into queued;
    if queued is not null then
      insert into public.market_snapshots(market_id, oracle_kind, market_prob, volume)
      values (new.id, 'opening', public.lmsr_price_yes(new.q_yes, new.q_no, new.b), 0);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists queue_news_market_open_email on public.markets;
create trigger queue_news_market_open_email
after insert or update of status on public.markets
for each row execute function public.queue_news_market_open_email();
revoke all on function public.queue_news_market_open_email() from public, anon, authenticated;

create or replace function public.claim_news_market_open_email(p_market_id uuid default null)
returns table(market_id uuid, claim_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  chosen uuid;
  token uuid := gen_random_uuid();
begin
  select n.market_id into chosen from public.market_open_notifications n
  where n.sent_at is null and (n.claimed_until is null or n.claimed_until < now())
    and (p_market_id is null or n.market_id = p_market_id)
  order by n.created_at for update skip locked limit 1;
  if chosen is null then return; end if;
  update public.market_open_notifications n
    set claim_token = token, claimed_until = now() + interval '3 minutes', attempts = n.attempts + 1
    where n.market_id = chosen;
  return query select chosen, token;
end;
$$;
revoke all on function public.claim_news_market_open_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_news_market_open_email(uuid) to service_role;

commit;
