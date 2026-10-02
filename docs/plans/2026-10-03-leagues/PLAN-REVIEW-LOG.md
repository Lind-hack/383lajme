# Plan Review Log: Ligat as Tregu's killer feature
Phases 0-1 (recon + interrogation) complete — plan locked with Lind. MAX_ROUNDS=5.
Reviewer model: gpt-6.1-sol (from ~/.codex/config.toml) — codex-cli 0.146.0

## Round 1 — Codex
**Findings**

- `tregu_league_leave` would mint coins for pending duels if it refunds “both stakes”; in `pending`, only the challenger has paid. Fix: refund challenger only for `pending`, refund both sides only for `active`.

- Listed leagues will still be invisible/broken on league detail pages because `tregu_league_preview`, `tregu_league_standings`, `tregu_league_board`, `tregu_league_pick_counts`, `tregu_league_race`, and `tregu_league_feed` hard-code `l.kind = 'public' OR member`. Fix: replace every public visibility predicate with `l.kind = 'public' OR l.listed OR member`, returning `code` only to members.

- The detail page only shows the join button for `league.kind === "public"`, so listed private leagues opened from search/top cards cannot be joined there. Fix: gate join UI on `league.kind === "public" || league.listed`.

- The “emoji-only” DB check is not emoji-only; it permits arbitrary text as long as it does not start with `http:`/`https:`/`/`. Fix: constrain listed emblems to a small allowed emoji set or a strict short text whitelist matching the UI constants.

- Last-member leave after another member has already forfeited destroys the forfeited pot when the league is deleted. Fix: do not delete/refund the final member after start if `forfeited > 0`; either keep/settle the league or refund all forfeited fees explicitly.

- `forfeited` must be added to every purse/pot reader, not just overview/settlement/preview; the share image route, email snapshot, prize pool helpers, admin list, and any `sum(fee_paid)` SQL will understate prizes. Fix: grep all `sum(fee_paid)`/`leaguePurse` consumers and add `l.forfeited`.

- `sendDigests` currently fetches all league events from the last 24h; `picks_due` will appear in email unless explicitly excluded. Fix: add `.neq("kind", "picks_due")` or filter before `buildDigestEmail`.

- The unique `picks_due` index on `(user_id, data->>'day')` allows unlimited duplicates when `day` is missing/null. Fix: add a check constraint requiring `data ? 'day'` for `kind='picks_due'`, or use `coalesce(data->>'day','')` in the unique index.

- Hub cost can be user-amplified: joins are unlimited, and the plan runs `tregu_league_scores` once per returned league. Fix: cap “mine” rows or compute podium/rank from cached `tregu_league_ranks` with a bounded fallback.

- Public-slot enforcement uses an advisory lock, but the actual invariant is not schema-backed. Fix: add a partial unique index for active listed creator leagues if feasible, or at least a transactional `for update` creator-league check with a regression test for concurrent create.

- Admin “unlist” is underspecified: there is a DB function and component, but no concrete API route/auth path, audit trail, or behavior for currently open search results. Fix: implement it through the existing admin API guard and log `listed=false` changes.

- The migration changes function return shapes and adds RPCs, but the plan’s fallback to `tregu_leagues_overview` cannot preserve the new hub card fields/actions during a failed/missing migration. Fix: make the UI explicitly feature-detect `tregu_leagues_hub` and render the old components unchanged on failure.

VERDICT: REVISE
### Claude's response
Accepted (plan revised): pending-duel refund to challenger only; `or l.listed` in preview/standings/board/pick_counts/race/feed; detail-page join gate on `public || listed`; emblem whitelist matching LEAGUE_EMOJIS; single `tregu_league_pot()` used by every SQL/TS pot reader (league-card image route, admin route included) with a grep test; digest excludes picks_due; `data ? 'day'` check on picks_due; hub reads cached `tregu_league_ranks` and caps rows; admin unlist via the existing isAdminAuthed route with `unlisted_at` + log; UI feature-detects the hub RPC and falls back to the old components.
Partially accepted: last-member leave with `forfeited > 0` — league is deleted and the forfeited coins are burned on purpose (a coin sink), rather than kept alive with zero members or refunded (refund would let leave-then-delete undo a forfeit).
Rejected: schema-backed public-slot invariant — "active" depends on now(), so no partial unique index can express it; kept the advisory lock with check+insert in one transaction and added a two-connection race test to the rehearsal.

## Round 2 — Codex
Most of the prior findings are addressed: visibility is broadened beyond `kind='public'`, emoji validation is now a whitelist, `forfeited` has a single pot helper, pending duel refunds no longer mint coins, `picks_due` has a non-null day guard, digest filtering is explicit, and the hub fallback is specified.

Remaining material issues:

- `tregu_league_leave` still needs explicit duel row locking/idempotency. Concurrent leave vs `tregu_settle_duels` or duel response can double-refund or settle/refund the same active duel unless leave locks duel rows and refunds only rows it successfully transitions from `pending|active` to `expired`. Fix: select affected duels `FOR UPDATE`, update with `WHERE status IN (...) RETURNING`, and create refunds/events only from returned rows.

- The hub caps member leagues to the 12 active ones ending soonest, which can hide leagues the user joined and prevent obvious navigation/leave for the rest. Fix: cap expensive enrichment to 12, but return all active member leagues as basic rows or add pagination/“show all”.

- Admin unlist is inconsistent: section 1.8 says use the existing admin API `PATCH { listed:false }`, but section 5 says `PublicLeagues.tsx` calls `tregu_admin_league_unlist`, which the revised migration no longer defines. Fix: pick one path, preferably the guarded admin API, and remove the stale RPC/function reference.

- Last-member deletion with `forfeited > 0` is now an intentional coin burn, but it creates a surprising “someone else’s forfeited pot disappears because the last player left” rule. Fix: either state this in leave confirmation/admin observability, or keep the empty league until expiry so forfeited pot behavior remains auditable.

VERDICT: REVISE
### Claude's response
Accepted all four: duel expiry in leave is an UPDATE … WHERE status IN ('pending','active') RETURNING over rows locked FOR UPDATE, refunds/events only from returned rows; hub returns every active member league (only the live-score fallback is capped); admin unlist is the guarded PATCH route only (stale RPC reference removed); last-member burn kept but surfaced in the confirm copy and a service-role `tregu_league_audit` row, and the existing no-winner settlement rule is documented the same way.

## Round 3 — Codex
Prior findings are addressed: duel refunds are now row-transition based, all member leagues stay visible, admin unlist uses one API path, and the forfeited burn is at least visible/audited.

New things I’d tighten during implementation, but I don’t see them as plan-blockers:

- `tregu_league_audit` must survive league deletion. Fix: do not FK `audit.league_id` to `tregu_leagues`, or use `on delete set null` plus denormalized `name`.
- Search should not present full leagues as one-tap joinable. Fix: either exclude full leagues from `tregu_league_search` or return `members/max_members` and render a disabled “Plot” state.
- Add a proof case for leave racing `tregu_settle_duels` / `tregu_duel_respond`, since the SQL is now explicitly designed around that. Fix: include a migration rehearsal that proves only one transition creates refunds/events.

VERDICT: APPROVED
### Claude's response
APPROVED. Folded in all three non-blocking notes: audit table has no FK to tregu_leagues (denormalized name); search returns members/max_members and renders full leagues as a disabled "Plot"; rehearsal adds leave-vs-settle_duels and leave-vs-duel_respond races.

## Resolution
Converged in 3 rounds. Awaiting Lind's sign-off.

## Post-build inspection
Fresh read-only Codex session (gpt-5.5), diff b355f735..6b68004e, 1 round.

- `supabase/migrations/0095_tregu_leagues_open.sql:963` - `gap_to_podium` adds `+ 1`, so the hub reports points needed to pass 3rd place, not “points to 3rd” as specified. A user 32 points behind the podium will see 33.

- `supabase/migrations/0095_tregu_leagues_open.sql:849` and `supabase/migrations/0095_tregu_leagues_open.sql:1006` - `active_today` uses `p.updated_at`, but the plan defines it as members with a pick `created` in the last 24h. Editing old picks can make a stale league rank as active in Top 5/search.

### Claude's dispositions
- gap_to_podium +1: rejected — ties are broken by who reached the points first, so matching 3rd does not take the place; "N pikë nga podiumi" is the points needed to get onto it. Plan wording updated to say so.
- active_today on updated_at: rejected — changing a pick today is playing today, which is what the shelf ranks by. Plan wording updated to "made or changed".
No code changes; second inspection round not needed.
