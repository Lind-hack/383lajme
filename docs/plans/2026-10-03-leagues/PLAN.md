# Plan: Ligat as Tregu's killer feature
_Locked via claudex-loop — by Claude + Lind, 2026-10-03. Base: origin/main b355f735, worktree `383-leagues`, branch `feat/leagues-killer`._

## Goal
Make Tregu's leagues (Ligat) the reason a reader opens 383 every day. Every league becomes a wide, horizontal card that shows the race at a glance: who is 1st/2nd/3rd, where the reader stands and how far from the podium, and whether today's picks are done. Readers can create **one public league at a time** (listed, searchable, one-tap join, emoji emblem only) alongside their private code leagues, browse the **top 5 public leagues** by today's activity, **search** the rest, and **leave** any league. A daily "Fitues i ditës" crown and a personal browser push 2h before the first unpicked match locks bring them back.

## Approach

### 1. Migration `supabase/migrations/0095_tregu_leagues_open.sql` (one transaction)
1. `tregu_leagues.listed boolean not null default false`. A user's public league is `kind = 'private'` + `listed = true`: it keeps the private economy end to end (entry pot + `tregu_private_bonus_pct` time bonus, 50/30/20, rewards auto-approved in `tregu_settle_due_leagues`), so settlement is untouched. It still gets a code (invite links keep working). `kind = 'public'` stays 383's official, admin-funded leagues ("Zyrtare").
2. Emoji-only for listed leagues, enforced in the DB as a whitelist matching `LEAGUE_EMOJIS`: `check (not listed or emblem is null or emblem = any (array['🏆','🦅','🔥','⚡','👑','🎯','🚀','💎','🐺','⚽','🏀','🏎️']))`. Covers `tregu_league_update` too, since it writes the same row; a test pins the SQL list to the TS constant.
2b. Visibility: every function that hard-codes `l.kind = 'public' or <member>` is redefined from its latest version with `l.kind = 'public' or l.listed or <member>` — `tregu_league_preview` (0090), `tregu_league_standings` (0087), `tregu_league_board` (0089), `tregu_league_pick_counts` (0089), `tregu_league_race` (0087), `tregu_league_feed` (0086). `code` is still returned only to members.
3. `tregu_league_create(p_name, p_days, p_entry_fee, p_emblem, p_color, p_listed boolean default false)` — replaces the 5-arg version (drop + recreate, re-grant). Takes `pg_advisory_xact_lock(hashtext('tregu_league_create:' || uid))` before the limit checks so two parallel taps can't both pass. Limits: listed → at most **1** with `creator_id = me and listed and ends_at > now()`; unlisted → the existing 3 (now counted on `not listed`). Error for the listed limit names the existing league and its end: `Ke tashmë një ligë publike: "<emri>". Krijo tjetrën kur të mbarojë.`
4. `tregu_league_join`: joining by id is allowed for `kind = 'public'` **or `listed`**; unlisted private stays code-only.
5. `tregu_league_leave(p_league_id) returns table (balance numeric, refunded numeric, deleted boolean)`, security definer, locks the league row `for update`:
   - must be a member; league not ended (`ends_at > now()`) and not settled → else `Kjo ligë ka përfunduar.`
   - refund `fee_paid` to `profiles.coins` + `transactions` row (`league_fee`, positive, note `Rimbursim: dole nga "<emri>" para nisjes`) **only if `now() < starts_at`, or the member joined less than 15 minutes ago and has made no pick in this league** (grace for a mistaken tap — Lind, sign-off 2026-10-03); otherwise the fee stays in the pot: it is added to a new `tregu_leagues.forfeited numeric not null default 0` column before the member row is deleted.
   - **One pot definition.** New `tregu_league_pot(p_league_id) = sum(fee_paid) + forfeited` (internal). Every pot reader switches to it: SQL — overview/hub, `tregu_league_preview`, `tregu_settle_due_leagues` (`v_pot`), the email snapshot in 0093, and any other `sum(fee_paid)` found by `grep -rn "fee_paid" supabase/migrations` at its latest definition; TS — `app/api/tregu/league-card/[id]/route.tsx:44` and `app/api/admin/tregu/leagues/route.ts:67` (select `forfeited` and add it). A test greps the codebase so a new `sum(fee_paid)` without `forfeited` fails.
   - deletes the member's `tregu_league_picks` and `tregu_league_ranks` rows for that league;
   - duels in that league involving them: `pending` → `expired`, refund the **challenger only** (only they have paid); `active` → `expired`, refund **both** stakes; `duel_refund` transactions, `duel_expired` event to the rival. Never refunds an unpaid side. Race-safe: `update tregu_duels set status = 'expired' … where league_id = … and (challenger = me or opponent = me) and status in ('pending','active') returning id, status_before, challenger, opponent, stake` (status_before via a CTE that selects the rows `for update` first); refunds and events are created **only from the returned rows**, so a concurrent `tregu_settle_duels`/`tregu_duel_respond` that already moved a duel makes leave skip it.
   - if they were the **last member**, the league is deleted and their own fee refunded (nobody else is left to win it), which also frees the creator's public slot. Any `forfeited` coins are burned (deliberate coin sink — the people who left already accepted losing them; refunding them would let leave-then-delete undo a forfeit). Made visible: the last member's confirm says `Je i fundit në ligë: liga mbyllet dhe poti prej N 383C nuk ndahet.`, and the function inserts a `tregu_league_audit` row (`league_id uuid` **without** an FK so it survives the delete, denormalized `name, action 'deleted_last_member', forfeited, at`; service-role only) so the burn is traceable. The same rule already applies at settlement when nobody scored: members' fees go back, `forfeited` is not paid to anyone — stated in the settle comment. Creator leaving a league with others keeps `creator_id` (slot stays used until it ends — no create/leave/create churn).
6. Activity + discovery:
   - `tregu_league_open_markets(p_league_id, p_until timestamptz)` (internal, not granted): markets in the league's scope, still pickable (`status = 'open'`, `tregu_market_lock_at(...) > now()`, lock inside the league window and `<= p_until`) — same filter `tregu_league_board` uses, extracted so the board, the hub and the nudge share one definition.
   - `tregu_leagues_hub()` → one row per league visible to the caller (member leagues + official public + listed candidates), columns: everything `tregu_leagues_overview` returns plus `listed`, `top3 jsonb` (`[{name, points}]`), `my_rank_change int` (from `tregu_league_ranks.day_rank`), `gap_to_podium int` (points to 3rd, 0 if on podium), `open_count int` / `picked_count int` / `next_lock_at timestamptz` (next 24h, members only), `day_king text` (top correct-pick points resolved since Kosovo midnight, null if none), `active_today int` (members with a pick created in the last 24h). Listed candidates: `listed and ends_at > now() + interval '24 hours'` and not full and not (`members = 1 and created_at < now() - 3 days`) and caller not a member; ordered `active_today desc, members desc, purse desc`, then newest to fill to 5; capped at 5 in SQL. One call per page load. **Bounded cost:** podium, my rank and `rank_change` come from the cached `tregu_league_ranks` table (already refreshed by the heartbeat); `tregu_league_scores` runs live only for a league with no ranks rows yet (new league). **All** active member leagues are returned (none hidden); only the live-score fallback for leagues without ranks rows is capped at 12 per call (the rest show "Renditja po llogaritet" until the next heartbeat). Official public capped at 3, listed at 5.
   - `tregu_league_search(p_query text)` → up to 20 listed + official leagues, not ended, `name ilike '%' || escaped(p_query) || '%'` (escape `%`, `_`, `\`), min 2 chars, ordered by prefix match then `active_today`. Returns `members`/`max_members`; full leagues are listed with a disabled **Plot** button, never a one-tap Hyr. Granted to anon + authenticated (public data only; never returns `code`).
7. `tregu_league_events.kind` check gains `'picks_due'`; `check (kind <> 'picks_due' or data ? 'day')` plus unique partial index `(user_id, (data->>'day')) where kind = 'picks_due'`, so one nudge per Kosovo day per user is enforced by the DB and a missing day can't slip past it.
8. Admin can unlist: column `unlisted_at timestamptz`; the existing admin API `app/api/admin/tregu/leagues/route.ts` (behind `isAdminAuthed`) gets a `PATCH { id, listed: false }` that sets `listed = false, unlisted_at = now()` with the service client and logs `[tregu-admin] unlisted <id> <name>`. An unlisted league keeps its members and becomes code-only; it drops out of top 5 and search on the next fetch.
8b. Public-slot invariant: there is no partial unique index for "active" (it depends on `now()`), so the check and the insert run in one transaction under the per-creator advisory lock; the PGlite rehearsal runs two creates on two connections to prove the second one fails.
9. `notify pgrst, 'reload schema';` at the end.

### 2. Server: the picks-due nudge (`lib/tregu-rivalry-server.ts`)
- New `queuePicksDue(admin)` called from the existing 2-minute heartbeat path that already runs `pushEvents` (`/api/automation/tregu/live-sports`). Between 09:00 and 21:00 Kosovo time: for users who have a `tregu_push_subscriptions` row, compute (via one SQL function `tregu_picks_due_candidates()`, service role) the earliest unpicked `next_lock_at` across their active leagues and their best league (lowest rank). If `next_lock_at - now()` is between 15 min and 2 h → insert a `picks_due` event (`data: {day, league, rank, open, lock_at}`); the unique index absorbs duplicates from overlapping heartbeats.
- `pushEvents` `worthy` += `picks_due`; `describeEvent` gets `picks_due`: title `Je #2 te <liga>` (or `Parashikimet e sotme` when unranked), body `3 ndeshje mbyllen në 20:45. Bëji tani.`
- The email digest skips `picks_due` (it's a reminder, not news): `sendDigests` adds `.neq("kind", "picks_due")` to its 24h events query.
- Service worker unchanged: it already fetches `/api/tregu/league-events/latest`; that route returns the newest unseen event, which will be the `picks_due` row.

### 3. Pure logic `lib/tregu-leagues-hub.mjs` (+ `.d.mts`, + `lib/tregu-leagues-hub.test.mjs`)
- `cardStatus(row, now)` → `{ tone: 'due'|'done'|'idle'|'upcoming'|'ended', label }` ("3 parashikime të hapura · mbyllen 20:45" / "Gati për sot" / "Asnjë ndeshje sot" / "Nis për …").
- `sortMine(rows, now)` → open-picks first, then soonest lock, then best rank.
- `podiumLine(row)` → gap/rank copy ("Ti #6 ▲2 · 32 pikë nga podiumi", "Je në podium").
- `leaveCopy(row, now)` → the confirm text ("Tarifa prej 50 383C mbetet në pot" / "Merr mbrapsht 50 383C").
- Tests for each, including Kosovo-time edges (lock at 23:59, midnight rollover, league with no scope markets).

### 4. UI
- `components/tregu/leagues-hub.tsx` (client) replaces `PublicLeaguesSection` + `LeaguesCard` on `app/tregu/page.tsx:986-987`, one `#ligat` section (keep `#ligat-383` as an alias anchor so old links land). Order: **Ligat e tua** rail → **Top 5 publike** rail (official leagues pinned first with a "Zyrtare" badge, then listed by activity) → **Kërko ligë** → Krijo / Kodi actions. Join/create/invite/pay/`?kodi=` flows move over from `leagues-card.tsx` unchanged in behaviour.
- `components/tregu/league-race-card.tsx`: the horizontal card (C1 mockup): emblem + name + "Publike/Private/Zyrtare · N lojtarë"; podium row (🥇🥈🥉 name + points, tabular nums), 👑 day king; "Ti #n ▲/▼ · pikë · gap"; status pill with the primary action (`Parashiko` → `/tregu/ligat/[id]`, or `Hyr · 50 383C` / `Hyr falas` for non-members); purse + time left. Whole card is a link; the action button stops propagation. ~200px tall.
- Rails: CSS scroll-snap (`scroll-snap-type: x mandatory`, card `flex: 0 0 min(88%, 420px)`), desktop ≥1024px → grid 2–3 columns, no JS carousel. Keyboard: rail is a `role="list"`, cards focusable, arrow keys not hijacked. Reduced motion: no entrance animations.
- `components/tregu/league-search.tsx`: debounced (250 ms) input, ≥2 chars, `aria-live` result count, result cards with one-tap Hyr; empty state "Asnjë ligë · Krijo një me këtë emër" prefills the create sheet.
- Create sheet (moved into the hub): segmented **Private (me kod) / Publike** at the top; Publike hides the photo button and resets an image emblem to 🏆; the create button shows the public-slot error inline if taken.
- `app/tregu/ligat/[id]/page.tsx`: a ⋯ menu in the header with **Dil nga liga** → confirm dialog using `leaveCopy` → `tregu_league_leave` → toast + redirect to `/tregu#ligat`. Not shown for ended leagues. Join button and the empty-board copy (lines 444, 554) gate on `kind === "public" || listed` so a listed league opened from search can be joined there; `prize-pool.tsx` / `league-emblem.tsx` keep keying the *economy* on `kind` (listed = private economy), which is correct.
- After a successful join: inline prompt **Më kujto para ndeshjeve** (only if push supported and not yet subscribed) → existing `enableLeaguePush()`.
- `lib/tregu-leagues.ts`: `LeagueSummary` gains the hub columns (all optional, optional-chained — persisted/RPC data may predate the migration during the deploy window); `leaguePurse` adds `forfeited`.
- Styling in `components/tregu/leagues.css` (paper look kept); no new deps; lucide icons only.

### 5. Admin
- `app/admin/tregu/PublicLeagues.tsx`: a "Ligat e lexuesve" list (listed leagues: name, creator, members, created) with **Hiq nga lista** → `PATCH /api/admin/tregu/leagues { id, listed: false }` (the guarded route from 1.8; no SQL function).

### 6. Proof gates
- `node --test lib/tregu-leagues-hub.test.mjs` + the existing league/sport tests; `npx tsc --noEmit`; `npm run lint` on touched files.
- Migration rehearsed on PGlite with stub tables (as 0091–0093 were), covering: listed limit + race (two creates), emoji check, join-by-id for listed vs unlisted, leave before/after start, last-member delete, duel refund on leave, leave racing `tregu_settle_duels` and `tregu_duel_respond` on two connections (exactly one transition creates refunds/events), forfeited fee reaching the settled purse, audit row surviving the delete, picks_due uniqueness.
- Local render via the junctioned worktree (`next dev --webpack`) against production's public API, screenshots at 390px and 1440px.
- Ship: show Lind the SQL → apply 0095 on the VPS in one transaction → push to main → Railway → `/api/deployment-info` → check `/tregu#ligat` live on phone width.

## Key decisions & tradeoffs
- **User public league = private economy + `listed` flag**, not a third `kind`. Settlement, bonus and auto-approval stay untouched; the cost is that `kind` no longer alone means "who can see it". (Q1)
- **Emoji-only emblems for listed leagues**, enforced by a check constraint, not just the UI. (Lind, Q1 follow-up)
- **Leave**: full refund before start; after start the fee stays in the pot via a `forfeited` column; picks removed; duels voided and refunded; last member out deletes the league. (Q2)
- **1 public league per creator while active**, joins unlimited, private limit unchanged at 3; advisory lock against double-create. (Q3)
- **Top 5 by today's active pickers**, then members, then purse; stale/full/ending/joined leagues excluded; newest fill the gaps. (Q4)
- **Retention scope** = card status + race on the card + day king + one picks-due push 2 h before the first unpicked lock (09:00–21:00, ≤1/day, on the existing per-user Tregu push channel, not Për ty's anonymous one) + leave/shelf/copy-picks. Seasons, badges, chat, new duel types are out. (Q5)
- One hub RPC instead of N per-card calls.

## Assumptions
1. Today "public" = 383's admin leagues with 383-paid prizes; user leagues are private/code-only — `0084` kind check, `0086:381` create.
2. Private limit is 3 active per creator — `0086:402`.
3. No leave function exists — grep of migrations/components.
4. Floor shows `PublicLeaguesSection` then `LeaguesCard` — `app/tregu/page.tsx:986-987`.
5. `rank_change`, streaks, overtake events, duels, copy-picks already exist — `0087`, `0091`, `0092`.
6. Per-user push already exists (`tregu_push_subscriptions`, `enableLeaguePush`, `pushEvents`, `public/tregu-sw.js`); Për ty's push is anonymous — `0087:700`, `0094`.
7. Production DB is the self-hosted Supabase on the VPS; next free migration number is 0095; migrations are applied by hand — memory `383-prod-db-access`.
8. Only `/api/automation/tregu/live-sports` heartbeat runs (2 min) — memory `383-tregu-heartbeat`.

## Risks / open questions
- Resolved at sign-off: user leagues start at creation, so a 15-minute no-picks grace refund was added (option b).
- Public league **names** are visible to everyone: only the admin unlist is in scope; no automatic word filter.
- `tregu_leagues_hub` cost grows with the number of visible leagues (each runs `tregu_league_scores`); capped by SQL limits, monitor after launch.
- Deploy window: new UI before the migration → hub RPC missing. Order is migration first, then push. `leagues-hub.tsx` feature-detects: if `tregu_leagues_hub` errors, it renders the old `PublicLeaguesSection` + `LeaguesCard` unchanged (both files stay in the repo for this release).

## Out of scope
Seasons/divisions, badges/achievements page, league chat, new duel types, profanity filter, changing 383's official league economy, the Për ty morning push.
