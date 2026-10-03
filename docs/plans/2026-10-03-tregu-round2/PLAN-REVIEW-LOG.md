# Plan Review Log: Tregu round 2
Phases 0-1 (recon + interrogation) complete — plan locked with Lind (Q1 scoring v2 for new leagues, Q2 three extras, cosmetic batch ok). MAX_ROUNDS=5.
Reviewer: codex-cli 0.146.0, model gpt-5.5 via -c override.

## Round 1 — Codex
**Findings**

1. `tregu_league_pick(..., p_boost boolean default false)` will remove an existing boost whenever today’s current client re-picks an outcome without sending `p_boost`.
Fix: make `p_boost` nullable/default `null` and preserve existing boost unless the caller explicitly toggles it.

2. Boost “move” is race-prone: two tabs can clear/set boosted picks concurrently and either duplicate intent, fail on the partial unique index, or move the card unpredictably.
Fix: take an advisory transaction lock on `(league_id,user_id,lock_day)` or lock that user/day’s pick rows before changing boosts.

3. `tregu_league_copy_picks` directly inserts into `tregu_league_picks`; new `lock_day`/boost columns will be missing or default-wrong for copied picks.
Fix: update copy-picks to compute `lock_day` and boosted state explicitly, or route through a shared insert helper.

4. The v1 scoring sentence “effective = points” is ambiguous and could accidentally award points to wrong picks in old leagues.
Fix: state and test `v1 effective = points only when correct, else 0`.

5. Streak ordering by `resolved_at, market_id` makes simultaneous results arbitrary: a same-minute wrong pick can reset before/after a correct pick based on UUID order.
Fix: define a deterministic user-facing rule for tied resolutions, such as same `resolved_at` batch scored from the pre-batch streak.

6. The “3 in a row ×1.5” copy conflicts with SQL using `streakBefore >= 3`, which pays the fourth correct pick, not the third.
Fix: either include the current pick in streak math or change all copy to “after 3 in a row, the next correct is ×1.5.”

7. `tregu_queue_pick_results` can duplicate `picks_won` events under overlapping heartbeats if it inserts before stamping `result_notified_at`.
Fix: claim rows first with `UPDATE ... WHERE result_notified_at IS NULL ... RETURNING` under row locks, then aggregate events from claimed rows.

8. Non-subscribed users’ correct picks may remain `result_notified_at is null`, causing every heartbeat to rescan the same rows forever.
Fix: either stamp ignored rows too or split “eligible for push” from “processed for result notification.”

9. `trade_won` idempotency depends on `(data->>'txn')`; if transaction id is absent/null, Postgres allows unlimited duplicate nulls.
Fix: use the real `transactions.id` as a required event field and add a partial unique index only where that field is not null plus a NOT NULL check for `trade_won`.

10. `tregu_claim_player_emails` only claims `overtaken`; adding `picks_won`/`trade_won` to digest without updating email claim/release logic means win events may never be emailed as “news.”
Fix: explicitly decide push-only vs digest/email, then update `tregu_claim_player_emails`, builders, and release logic if included.

11. Dropping/recreating `tregu_league_board` with extra columns can break PostgREST clients during schema cache lag and typed callers that assume exact shape.
Fix: prefer `create or replace` with compatible tail columns, reload schema immediately, and test current page calls against the new function.

12. The “Results reveal” bottom sheet needs dialog semantics; plan does not mention focus management, Escape/close, or screen-reader announcement for count-up totals.
Fix: implement it as an accessible dialog/bottom sheet with focus return, `role="dialog"`, labelled title, and non-animated text fallback.

13. Duel clash “reduced motion: swords static, sound still plays” misses flash/shake/audio sensitivity.
Fix: under reduced motion remove shake/flash and keep sound opt-in or respect existing sound/gesture settings.

14. Finished duel “shown once” is underspecified: storing seen on render can hide results the user never actually noticed; storing only on dismiss keeps them pinned.
Fix: store seen only on explicit close, and separately cap the localStorage list.

15. Ship order violates the repo release policy: plan applies production DB migration before commit/push/build verification, while AGENTS requires clean release from `origin/main`, tests/build, commit, push, then production verification.
Fix: move production migration/application to the approved release sequence and do not touch prod from a dirty or unpushed working tree.

VERDICT: REVISE
### Claude's response
Accepted: 1 (p_boost default null = keep), 2 (advisory lock per league/user/day), 3 (copy-picks sets lock_day, never copies a boost), 4 (v1 wrong = 0 stated), 5 (same-instant batch scored from pre-batch streak), 6 (streak includes the current pick so the copy "3 in a row x1.5" is literal), 7+8 (claim every resolved pick first, push only from claimed rows), 9 (real transactions.id required + unique), 10 (win events push/banner only, excluded from digest; player emails untouched), 12 (dialog semantics), 13 (reduced motion drops flash/shake; sound only on own tap), 14 (seen on close or 4 s in view).
Rejected: 11 — a changed return type cannot be create-or-replaced in Postgres; drop+recreate in the same transaction with an immediate PostgREST reload, and the deployed UI ignores extra columns.
Partially accepted: 15 — AGENTS.md has no migration rule; DB-first stays (the new UI needs the new functions, 0096 is backward compatible) but the branch is committed and pushed before prod is touched.

## Round 2 — Codex
**Findings**

1. Release flow still conflicts with `AGENTS.md`: the plan applies prod DB after pushing only the branch, then fast-forwards `main`; required flow says build/test, commit intended files, push to `origin/main`, wait for Railway production SHA, then verify.
Fix: change Ship to the repo’s required main-first release flow, with the DB migration applied only from the committed/reviewed release state and no prod action from a branch-only push.

2. The revised scoring says the 3rd correct pick gets ×1.5, but the UI chip still says `×1.5 në të saktin tjetër` (“on the next correct”), which describes the old off-by-one behavior.
Fix: update copy to “3 në rresht · ×1.5” or “i treti merr ×1.5” everywhere.

3. JS helper names still encode the old model: `streakMultiplier(streakBefore)` conflicts with the SQL rule “streak includes the pick itself.”
Fix: rename/use `streakIncludingCurrent`, or make `effectivePoints` explicitly add the current correct pick before calling the multiplier.

4. `picks_won` is “one event per user per run” but its payload/body names a single `{league, question}`; a user can win picks in multiple leagues/questions in the same heartbeat, producing misleading push copy.
Fix: aggregate by `(user, league)` or use generic multi-league copy when the batch spans more than one league/question.

5. `tregu_queue_pick_results` stamps every resolved pick in the last 6h, including losses, before any UI result reveal exists; if the event-building part errors after the claim, wins are permanently marked processed with no push.
Fix: claim with a separate processing marker/CTE inside one transaction that inserts events before finalizing `result_notified_at`, or only stamp after successful event insertion.

6. `lock_day` is still nullable while the boost uniqueness depends on it; any missed insert path with `boosted=true` and `lock_day=null` bypasses the “one golden card per day” index because nulls are distinct.
Fix: make `lock_day not null` after backfill, or add `check (not boosted or lock_day is not null)`.

7. The plan says `tregu_league_board` extra columns are backward compatible, but PostgREST RPC return-type cache lag after drop/recreate can still break deployed clients until reload completes.
Fix: include an explicit smoke test against the currently deployed 3-arg pick call and board RPC immediately after schema reload, before any UI rollout.

VERDICT: REVISE
### Claude's response
Accepted: 2 (chip copy names what the next correct pick earns, counted including itself), 3 (JS takes streakIncludingCurrent; effectivePoints adds the current pick like SQL), 4 (one picks_won per user+league, question only when count=1), 6 (check: boosted needs lock_day), 7 (smoke-test the deployed RPC calls through PostgREST right after applying, before any UI push).
Rejected: 1 — AGENTS.md has no migration step; its rule is that production code comes only from origin/main via Railway, which this follows. A DB-first order is required because the new UI calls new functions, and 0096 is additive/backward compatible. 5 — claim (UPDATE…RETURNING) and event inserts are in one plpgsql function call, i.e. one transaction; an insert failure rolls the claim back. Plan now states it.

## Round 3 — Codex
**Findings**

1. Ship flow still does not follow the repo’s required release flow: it applies prod DB after only pushing the branch, then “fast-forward main,” while `AGENTS.md` requires preparing from `origin/main`, running tests/build, pushing intended files to `origin/main`, waiting for Railway production, then verifying.
Fix: rewrite Ship to explicitly push the release commit to `origin/main` and wait for Railway before live verification; if DB-first is intentional, document it as a separate pre-deploy migration exception approved by the repo owner, not as the normal release flow.

2. The new PostgREST smoke test says it will test the deployed 3-arg `tregu_league_pick`, but then replaces that with anonymous `tregu_league_board`/`tregu_leagues_hub`; that does not test the risky compatibility claim that old 3-arg RPC calls still resolve after dropping/recreating the function.
Fix: add an actual compatibility check for `tregu_league_pick` through PostgREST, using a controlled authenticated canary or a direct SQL/PostgREST schema test that proves omitted default args resolve.

3. `trade_won` idempotency relies on a unique index, but concurrent heartbeats inserting the same `transactions.id` will raise a unique violation unless the insert uses `on conflict do nothing`; that can fail the whole queue job repeatedly.
Fix: state that `trade_won` insertion uses `on conflict ((data->>'txn')) where kind='trade_won' do nothing`, or an equivalent pre-claim/insert pattern.

VERDICT: REVISE
### Claude's response
Accepted all three: 1 — Release is now its own section spelling out Lind's 383 flow with the DB-first pre-deploy migration named as the one deliberate exception (same as 0095), confirmed by Lind at sign-off; production code still only from origin/main via Railway. 2 — smoke test calls tregu_league_pick with the live page's exact 3 named args and requires our own auth error (not PGRST202); a rollback file restores the previous definitions. 3 — trade_won insert uses on conflict … do nothing.

## Round 4 — Codex
**Findings**

1. The release proof still omits `npm run build`; `AGENTS.md` explicitly requires relevant tests and `npm run build` before the release commit/push.
Fix: add `npm run build` to Proof/Release before any prod DB action or `origin/main` push.

2. The `tregu_league_pick` smoke test says to use the anon key and expect the function’s own `Duhet të hysh në llogari.` error, but the current function is granted to `authenticated`, not `anon`; anon may fail with permission denied before proving 3-arg RPC resolution.
Fix: run that smoke test with an authenticated canary user/session, or temporarily verify resolution through a direct SQL/PostgREST schema check that does not depend on anon execute permission.

VERDICT: REVISE
### Claude's response
Accepted 2: anon smoke test accepts 42501 permission denied (proves PostgREST matched the function and its default) or our own auth error; only PGRST202 fails.
Partially accepted 1: next build --webpack runs when disk allows (~1.5 GB needed, ~340 MB free now); otherwise the gate is tsc + tests + Railway's build, and a failed Railway build keeps the old SHA live, visible in /api/deployment-info.

## Round 5 — Codex
**Findings**

1. `npm run build` still is not actually in the gate: the plan substitutes conditional `npx next build --webpack`, which bypasses `prebuild`/`postbuild`, and allows proceeding without any local build when disk is low.
Fix: use `npm run build` when releasing; if disk blocks it, free space or move the build workspace before touching prod DB.

2. DB-first is not fully backward-compatible because 0096 flips `tregu_leagues.rules_version` default to `2` before the new UI is live. If Railway build/deploy fails after the DB migration, old production can create v2 leagues with invisible streak/boost rules and no v2 controls/explainer.
Fix: split activation: add columns/functions first with default `1`, deploy UI, verify Railway SHA, then flip the default to `2` in a final tiny migration or feature-flagged DB step.

VERDICT: REVISE
### Claude's response
Accepted both. 1 — disk freed to ~9.7 GB, so the gate is the repo's own npm run build (with --webpack for the junctioned node_modules) before any prod action. 2 — split activation: 0096 adds v2 functions with rules_version default 1 (activates nothing); 0097 flips the default to 2 only after Railway reports the new SHA.

## Resolution
MAX_ROUNDS (5) reached on VERDICT: REVISE, but every finding of the final round was accepted and applied; no point is left in dispute. Logged rejections from earlier rounds (board drop+recreate, claim atomicity, DB-first order) carry reasons above. Awaiting Lind's sign-off, including the DB-first exception.
