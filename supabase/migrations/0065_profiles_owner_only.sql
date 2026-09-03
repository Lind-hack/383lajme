-- Coin balances were readable by anyone.
--
-- public.profiles carried two SELECT policies. RLS ORs permissive policies
-- together, so the owner-only rule was never the effective one:
--
--   "profiles are viewable by owner"                       using (auth.uid() = id)
--   "profiles are viewable publicly (leaderboard-safe ...)" using (true)
--
-- The second one names a view it does not use -- it is `using (true)` on the
-- raw table, which grants `select *` to anon. Since NEXT_PUBLIC_SUPABASE_ANON_KEY
-- ships in every page's JavaScript by design, one unauthenticated request to
--
--   /rest/v1/profiles?select=id,display_name,coins,created_at
--
-- enumerated every user's coin balance and display name. Coins convert to real
-- withdrawals over PayPal or IBAN (app/api/tregu/withdraw/route.ts), so this was
-- a financial and privacy leak, not only an information one.
--
-- Nothing needs the public grant. Checked every direct read of the table:
-- app/profili/page.tsx and app/api/tregu/portfolio/route.ts both filter
-- .eq("id", user.id), which the owner policy already allows. The public
-- leaderboard goes through market_top_holders(), a SECURITY DEFINER function
-- added in 0004 that returns board-safe columns only and is unaffected by this.
drop policy if exists "profiles are viewable publicly (leaderboard-safe fields only via view)"
  on public.profiles;

-- Re-asserted rather than assumed: 0002 recreated both policies, so a database
-- that ran 0002 after 0001 still has the owner rule, but one that skipped it may
-- not, and dropping the public policy without this would lock users out of
-- their own profile page.
drop policy if exists "profiles are viewable by owner" on public.profiles;
create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);
