# Plan: Tregu round 2 — strips, points that pull you back, duels with a clash, a banner that explains itself
_Locked via claudex-loop — by Claude + Lind, 2026-10-03. Base: origin/main 2c25b11b, worktree `383-leagues`, branch `feat/tregu-round2`._

## Goal
Make Tregu obvious and habit-forming. The banner explains in one glance what you do, what you play with and how it becomes money (10 000 383C = 10€), and on phones it stops being a wall of text. The homepage says the same and shows the road to 10€ under its Tregu cards, and a signed-out tap on Po/Jo leads straight through sign-up to that pick. Leagues become slim strips. Predictions get two new rules in new leagues — 🔥 Seria (3 in a row ×1.5, 5 in a row ×2) and ⭐ Kartë e artë (one pick a day per league counts double) — plus a clear points explainer, a "Rezultatet e tua" reveal and a push when picks or trades win. Duels get a sword-clash moment, and finished duels stop living at the top of the floor once seen.

## Approach

### 1. Migration `supabase/migrations/0096_tregu_points_v2.sql` (one transaction)
1. `tregu_leagues.rules_version int not null default 1` — 0096 adds the column and every v2 function but **activates nothing**: the default stays 1, so even if the UI deploy failed afterwards, the live site keeps creating today's leagues. Activation is a separate one-line migration `0097_tregu_points_v2_on.sql` (`alter table tregu_leagues alter column rules_version set default 2`), applied only after Railway reports the new SHA live. From then on every new league (readers' and admin's) is v2; existing ones stay v1.
2. `tregu_league_picks.boosted boolean not null default false`, `lock_day date` (Kosovo day of the market's lock, set by `tregu_league_pick`, backfilled from `tregu_market_lock_at` for existing rows, then `check (not boosted or lock_day is not null)` so the one-card-a-day index can't be dodged by a null), `result_notified_at timestamptz`. Unique partial index `(league_id, user_id, lock_day) where boosted` = one Kartë e artë per league per day, enforced by the DB.
3. `tregu_league_pick(p_league_id, p_market_id, p_outcome, p_boost boolean default null)` — drops the 3-arg version (named-arg callers keep working through the default). `null` = leave the boost as it is (a re-pick never silently drops it); `true` = put the day's card here; `false` = take it off. Boost only in v2 leagues; moving it takes `pg_advisory_xact_lock(hashtext(league||user||lock_day))` first, then moves the card off another of your picks *only while that pick is still open*, else `Karta e artë e sotme është përdorur.`
3b. `tregu_league_copy_picks` redefined so copied picks get their own `lock_day` and `boosted = false` (a card is never copied).
4. `tregu_league_pick_effective(p_league_id)` (internal): one row per resolved, non-stale pick. Wrong pick → 0 in every version. Correct pick in v1 → `points` (exactly today). Correct pick in v2 → `round(points × streak_mult × (boosted ? 2 : 1))`. The streak **includes the pick itself**: the 3rd correct in a row is ×1.5, the 5th and beyond ×2 — matching the copy "3 në rresht ×1.5". Ordered by `mk.resolved_at`; picks resolved at the **same instant** form one batch scored from the streak before the batch, and the batch's wrong picks reset it after (no UUID tie-break deciding money). Void/stale picks are skipped.
5. `tregu_league_scores` redefined (same signature and columns) to sum `effective` — overview, hub, standings, ranks, settlement and emails all follow, because they all read it.
6. `tregu_league_board` gains `my_boosted boolean`, `rules_version int` at the end of its columns (a changed return type needs drop + recreate in Postgres; re-grant and reload PostgREST in the same transaction — the deployed page ignores extra columns, so the old UI keeps working). New `tregu_league_my_streak(p_league_id) → (streak int, next_mult numeric, boost_used_today boolean)` for the league page.
7. Duels keep raw points (`tregu_pick_points_between` unchanged): a duel is 24h of picks, and multipliers earned before it started must not decide it. Stated in the explainer.
8. Results: `tregu_my_recent_results(p_since timestamptz)` → the caller's league picks resolved since `p_since` (league, question, picked label, won, effective points) plus floor `payout` transactions since `p_since` (amount, market question from `meta`), newest first, max 20.
9. Win pushes: event kinds `picks_won` and `trade_won` added to `tregu_league_events.kind`. `tregu_queue_pick_results()` (service role, heartbeat): (a) **claims first** — `update tregu_league_picks set result_notified_at = now() where result_notified_at is null and <market resolved in the last 6 h> returning …` for *every* resolved pick (correct or not, subscribed or not), so rows are processed once and never rescanned; then one `picks_won` event per (user, league) among the claimed correct picks whose owner has a push subscription (`{count, points, league, question}`; `question` only when count = 1, else the copy is "3 parashikime të sakta te <liga> · +180 pikë"). Claim and inserts run inside the one plpgsql function call = one transaction: if an insert fails the claim rolls back with it, so no win is marked processed without its event; (b) `payout` transactions in the last 6 h for subscribed users → `trade_won` carrying the real `transactions.id` in `data.txn`, with `check (kind <> 'trade_won' or data ? 'txn')` and a unique partial index on `(data->>'txn') where kind = 'trade_won'`; the insert is `on conflict ((data->>'txn')) where kind = 'trade_won' do nothing`, so overlapping heartbeats skip instead of erroring.
10. `notify pgrst, 'reload schema';`

### 2. Server (`lib/tregu-rivalry-server.ts`)
- Step `results` → `rpc("tregu_queue_pick_results")` before `push`; `worthy` += `picks_won`, `trade_won`; `describeEvent` cases: `+62 pikë te <liga>` / `3 parashikime të sakta · +180 pikë`; `Fitove +240 383C` / `<pyetja>`.
- Win events are **push + floor banner only**: the digest query excludes `picks_due`, `picks_won` and `trade_won`; `tregu_claim_player_emails` (overtaken only) is untouched.

### 3. Pure logic `lib/tregu-points.mjs` (+ `.d.mts`, tests)
- `streakMultiplier(streakIncludingCurrent)`, `effectivePoints({points, correct, streakBefore, boosted, rulesVersion})` — `effectivePoints` adds the current correct pick to `streakBefore` before calling the multiplier, exactly like the SQL — mirror the SQL and are pinned to it by a PGlite rehearsal using the same cases.
- `pointsExample(prob)` for the explainer's live numbers; `milestone(coins)` for the 10€ bar (1 000 / 2 500 / 5 000 / 7 500 / 10 000 with their lines).

### 4. UI
1. **League strips** — `league-race-card.tsx` becomes a ~76px strip (emblem · name/meta · compact podium · Ti #n ▲ · status · action); rails become a vertical list (2 columns ≥1024px). Strip with picks due gets an orange left edge. Join strips use the same component with Hyr.
2. **Points** — league page: header chip `🔥 2 në rresht · e treta e saktë merr ×1.5` / `🔥 4 në rresht · tani ×1.5, e pesta ×2` (v2; the copy always names what the *next* correct pick earns, counted including itself), ⭐ toggle on each open pick button row (v2; one per day, moves while open), "Si llogariten pikët" card (favourite/surprise with today's real numbers via `pointsExample`, Seria, Kartë e artë, duels use raw points) reachable from a `?` next to points on strips and standings; `league-tutorial.tsx` copy updated.
3. **Results reveal** — `components/tregu/results-reveal.tsx` on the floor (signed in): reads `tregu_my_recent_results(since)` with `since` = last seen (localStorage, try/catch, default 48 h ago); if anything won, a bottom sheet "Rezultatet e tua" with each win and the total. Accessible dialog: `role="dialog"`, `aria-modal`, labelled by its title, focus moved in and returned on close, Escape and backdrop close; the total is real text (count-up is decoration, `aria-hidden` on the animated copy). `since` is stored when it closes. Losses listed quietly under the wins.
4. **Duels** — `components/tregu/sword-clash.tsx`: two inline-SVG swords swing in from both sides and strike centre with a flash + 6px shake (~700 ms total, transform/opacity only), `playSwordClash()` added to `trade-success-sound.ts` (WebAudio: band-passed noise hit + three inharmonic sine partials 1.9k/3.1k/4.7k ringing out ~600 ms, gain ≤0.35, primed on the tap). Fires when a challenge is sent (`duel-challenge.tsx`) and when one is accepted (`duel-pin.tsx`). Reduced motion: no swing, no flash, no shake — the swords simply appear; the sound only ever plays on the reader's own tap (send/accept), never on load. Finished duels in `duel-pin.tsx`: counted as seen when the reader closes it (×) **or** it has been on screen for 4 s (IntersectionObserver ≥60% visible); ids in localStorage `tregu:duels-seen` (try/catch, last 50 kept); win gets a one-shot burst.
5. **Banner** (`video-hero.tsx`) — headline `Parashiko. Fito.\nMerr para.`; three step chips (① Zgjidh Po ose Jo · ② Fito 383C · ③ 10 000 = 10€) in white; one primary CTA (`Fillo me 100 Monedha falas` → sign-up, or `Merr bonusin e sotëm` → portofoli when signed in); `ose shiko tregjet ↓` text link. Phone: darker overlay, ~15% shorter, chips stacked one per line, no paragraph. Desktop: chips in a row, CTA beside them. Keeps the existing Reveal/AnimatedHeading pacing and `TREGU_HERO` geometry (updated numbers mirrored in `treguHeroBehindChrome`).
6. **Homepage** (`components/home/tregu-home.tsx`) — intro: `Luan me 383 Monedha falas. 10 000 Monedha i këmben për 10€ të vërteta.`; tour last step → "Monedhat bëhen para" with the same line; `WithdrawalProgress` under the two cards (balance read client-side when signed in, 0 when not). Signed-out tap on Po/Jo: small sheet "Parashikimi yt: Po · Regjistrohu dhe merr 100 Monedha falas" → `/hyr?tab=regjistrohu&next=/tregu/<slug>?ana=po`; the market page keeps `ana` through its own login prompt. Nothing is auto-placed: the reader confirms the stake.
7. **10€ bar milestones** (`withdrawal-progress.tsx`) — next milestone named under the bar ("Edhe 640 për gjysmën e rrugës"); crossing one shows a one-time burst + line (last celebrated stored in localStorage).
8. **Copy everywhere** uses the one money line from C4.

### 5. Proof
- `node --test` new + existing; `npx tsc --noEmit` (junctioned node_modules).
- PGlite rehearsal of 0096 on the 0095 stub: v1 league unchanged; v2 streak ×1.5/×2 and reset; void skipped; boost doubles, one per day, moves only while open; scores/settlement use effective; results RPC; queue idempotent; JS mirror equals SQL on the same cases.
- Screenshots phone 390 / desktop 1440 with fixtures: banner, strips, points card, results sheet, duel clash frame, homepage bar.
- Right after applying 0096 on prod, before any UI push, smoke-test the **deployed client's exact calls** through PostgREST with the anon key: `tregu_league_pick` with the 3 named args the live page sends (`p_league_id, p_market_id, p_outcome`) must resolve: the anon role has no execute grant, so the expected answer is `42501 permission denied for function tregu_league_pick` (PostgREST only reaches the permission check after it has matched the function and its defaults); our own `Duhet të hysh në llogari.` also passes. Only `PGRST202 could not find the function` fails the check and triggers the rollback below; `tregu_league_board` and `tregu_leagues_hub` must answer 200 with their columns.
- Rollback if the smoke test fails: re-apply the 0089/0095 definitions of `tregu_league_pick`, `tregu_league_board`, `tregu_league_scores`, `tregu_league_copy_picks` (kept in `docs/plans/2026-10-03-tregu-round2/rollback-0096.sql`, written during the build); the added columns and event kinds are inert without them.

### 6. Release (Lind's 383 flow, DB-first exception made explicit)
Same order as 0095 on 2026-10-03, which Lind approved: **(1)** Codex post-build inspection; **(2)** tests + `tsc` green and `npm run build -- --webpack` green (runs the repo's prebuild/postbuild verification; `--webpack` because Turbopack refuses the junctioned node_modules — the C: drive now has ~9.7 GB free); **(3)** commit, push the branch; **(4)** DB-first pre-deploy migration — the one deliberate exception to "code first", because the new UI calls functions that must exist and 0096 is additive/backward compatible: dry run 0096 on prod inside `BEGIN … ROLLBACK`, apply in one transaction, smoke test above; **(5)** push the release commit to `origin/main` (fast-forward) — production code only ever comes from `origin/main` via Railway, never `railway up`; **(6)** wait for `/api/deployment-info` to report that SHA with `commit_ref main`, `environment production`, `deployment_source github-main`; **(7)** apply `0097_tregu_points_v2_on.sql` (activation) and verify the default; **(8)** live check at 390 and 1440. Lind confirms the exception at sign-off.

## Key decisions & tradeoffs
- New scoring only for leagues created after release (`rules_version`), so no live pot reshuffles. (Q1)
- Streak per member per league, ordered by resolution time; void picks neutral. Boost one per league per Kosovo day of the match lock, movable only while open.
- Duels stay on raw points.
- Win pushes for subscribed users only, aggregated per run (no push per pick).
- Guest flow pre-selects, never auto-spends.
- "Seen" for finished duels and the results reveal is per browser (localStorage) — a second device shows it once more.

## Toolchain
- Claude build: follow `impeccable` + `web-design-guidelines` rules for the banner/strips, `improve-animations` principles for the clash and reveal (transform/opacity, interruptible, reduced motion).
- Codex review/inspection: `-c model="gpt-5.5"` (config's `gpt-6.1-sol` is rejected on ChatGPT auth).

## Assumptions
1. Scoring today = 100 − probability on a correct pick — `0089`.
2. Finished duels pinned 24 h regardless — `components/tregu/duel-pin.tsx`.
3. Sounds are WebAudio-synthesised — `components/tregu/trade-success-sound.ts`.
4. Withdrawal 10 000 383C = 10€, manually verified — `app/tregu/portofoli/page.tsx:151`; homepage currently says "jo para reale" — `components/home/tregu-home.tsx:201`.
5. `WithdrawalProgress` exists — `components/tregu/withdrawal-progress.tsx`.
6. Card sides deep-link `?ana=` and the market page preselects — `market-mini-card.tsx:143`, `app/tregu/[slug]/page.tsx:519`.
7. League pick buttons already show `+N` — `app/tregu/ligat/[id]/page.tsx:164`.
8. Production DB self-hosted; next migration 0096 — memory `383-prod-db-access`.

## Risks / open questions
- `payout` transaction `meta` may not carry the market question; if not, `trade_won` says the amount only.
- Disk ~340 MB free: no installs; screenshots kept small and deleted after.

## Out of scope
Friends/following, weekly prize show, shareable win cards, achievements page, changing v1 leagues' scoring, auto-placing guest picks.
