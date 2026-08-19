-- Kosovo fuel prices, pushed in rather than fetched out.
--
-- The card is fed by api.naftasot.com, which sits behind Cloudflare. Measured
-- on 2026-08-19:
--
--   residential IP        200
--   GitHub Actions runner 403  "Just a moment..."  (JS challenge)
--   Vercel render path    403  "Just a moment..."  (JS challenge)
--   any Origin header     500                      (no CORS, so no browser fetch)
--
-- So no part of the deployed system can read it: not the page, not CI, not the
-- reader's browser. That is why the card served hardcoded 29 July prices under
-- a "Rifreskim ditor" label for three weeks — the fetch had been failing since
-- the day it shipped and the catch swallowed the reason.
--
-- The fetch therefore happens somewhere with an allowed IP and the result is
-- posted here. This table is that mailbox. Append-only, so a bad push can be
-- diagnosed against the ones before it rather than having overwritten them.
--
-- Idempotent: safe to re-run.

create table if not exists public.fuel_prices (
  id         bigint generated always as identity primary key,
  /** The FuelSnapshot the card renders, exactly as lib/home-market-data.ts
      builds it: brands, per-fuel prices, and the timestamps NaftaSot gave. */
  snapshot   jsonb       not null,
  /** When the pushing machine read NaftaSot — not when this row was written. */
  fetched_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.fuel_prices is
  'Fuel snapshots pushed from a machine Cloudflare allows. The site cannot fetch naftasot.com itself — Vercel and CI both get a 403 challenge.';

-- Always read newest-first, and only ever the newest.
create index if not exists fuel_prices_fetched_idx
  on public.fuel_prices (fetched_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
--
-- Public read: these are forecourt prices, already published, and the homepage
-- reads them with the anon key on every render.
-- Writes are service-role only, through the secret-gated automation route.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.fuel_prices enable row level security;

drop policy if exists fuel_prices_public_read on public.fuel_prices;
create policy fuel_prices_public_read
  on public.fuel_prices for select
  using (true);

-- No insert, update or delete policy: the service role bypasses RLS, and
-- nothing else has any business writing prices.

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
--
-- Expect exactly one row: fuel_prices_public_read / SELECT.
-- ─────────────────────────────────────────────────────────────────────────────
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'fuel_prices';
