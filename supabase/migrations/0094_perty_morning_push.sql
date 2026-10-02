-- Për ty: "Edicioni yt i mëngjesit", a push at 07:00 Kosovo time
-- (docs/ideas/gazeta-jote.md, step 3).
--
-- Guests can turn it on, so a subscription belongs to a browser, not a user.
-- The only thing stored is the browser's push address: no account, no name,
-- no interests. The edition itself is put together on the reader's device when
-- they open it. Written only by the server (service role); RLS on, no policies.

create table if not exists public.perty_push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  created_at timestamptz not null default now(),
  -- The Kosovo date of the last morning push, claimed before sending so that
  -- overlapping heartbeats never send the same morning twice.
  last_sent_on date,
  last_sent_at timestamptz
);

alter table public.perty_push_subscriptions enable row level security;

create index if not exists perty_push_subscriptions_last_sent_on_idx
  on public.perty_push_subscriptions (last_sent_on);
