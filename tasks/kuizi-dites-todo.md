# Kuizi i ditës — tasks

Plan: `tasks/kuizi-dites-plan.md`. Work in a worktree off origin/main, not `home-redesign`.
Verification commands (worktree with junctioned node_modules): `npm test`,
`npx tsc --noEmit`, `npx next build --webpack`.

## Phase 0 — Setup

- [x] **0. Worktree off origin/main** (XS)
  - `git worktree add ../383-kuiz -b feat/kuizi-dites origin/main`; junction node_modules
    (see the 383-worktree-dev memory); copy both task files in.
  - Done when: `npx tsc --noEmit` is clean on untouched main in the worktree.

## Phase 1 — Prove the content (highest risk first)

- [x] **1. Quiz core, pure functions** (S) — `lib/kuizi-data.mjs`, `lib/kuizi-data.test.mjs`
  - Types, `validateQuestion`, `scoreAnswers`, `shareText`, `statsVisible(n ≥ 30)`,
    `pickDisplayQuiz(today, latest)` (today → ≤48 h labelled → null).
  - AC: rejects a question with an unknown slug, a number missing from the source, duplicate
    or hedge options, or a correct index out of range; the share text matches the spec.
  - Verify: `node --test lib/kuizi-data.test.mjs`.
  - Deps: 0.

- [x] **2. Generator + dry-run route** (M) — `lib/kuizi-draft.mjs` (+test),
  `app/api/automation/kuizi/draft/route.ts`
  - Select 24 h articles (reuse `selectDraftArticles`, at least 2 local), prompt for 7
    candidates, validate, choose 5 distinct slugs, exclude tragedy stories.
    `GET ?dry=1` returns the quiz without writing; POST writes (after Task 3).
    `llmJSON(prefer:"groq", temperature 0.3)` inside `AbortSignal.timeout(45s)`.
  - AC: fixture tests cover grounding, tragedy exclusion, the local quota, and "<5 survivors
    → null"; a dry run against live articles returns valid JSON.
  - Deps: 1.

### Checkpoint A — content quality (with Lind)

- [ ] Round 2 (debate prompt + judge): `tasks/kuizi-checkpoint-a.md`, 15/15 grounded,
  ~10/15 strong. **Waiting on Lind.**
- [x] Round 1 dry-run 3 separate days (done 2026-10-12: `tasks/kuizi-checkpoint-a.md`, 15/15 answers
  supported by their articles; **waiting on Lind's read**)
  Found on the way: the `gemini-flash-latest` alias sometimes hangs instead of returning 503.
  `lib/llm.ts` now gives each Gemini request a 25 s deadline so the next model gets a turn
  (this affects every llmJSON caller). Quiz runs take 12–46 s.
- [ ] (original criterion) Dry-run 3 separate days of real articles. Lind reads all 15 questions. Fact errors in
  0 of 15, and no tasteless picks, before any UI is built. If this fails, fix the prompt and
  validator or stop the project.

## Phase 2 — Playable on the homepage

- [x] **3. Migration 0106 + RPCs** (applied 2026-10-12, per-answer model) (S) — `supabase/migrations/0106_kuizi_dites.sql`
  - Re-check the number on origin/main. Tables, RLS, `kuizi_submit`, `kuizi_day`, grants to
    anon.
  - AC: anon cannot select or insert either table directly; submit is scored server-side and
    rejects a second play; `kuizi_day` returns per-question % and mean.
  - Verify: PGlite with stub tables, then a BEGIN…ROLLBACK dry run on prod **with Lind's OK**,
    then apply + `notify pgrst, 'reload schema'`.
  - Deps: 0.

- [x] **4. Server data** (S) — `lib/kuizi-server.ts`
  - `getKuiziData(todayKey)` → `{ quiz, dateKey, isToday }` | null, via `pickDisplayQuiz`.
  - Deps: 1, 3.

- [x] **5. Play flow, local only** (built 2026-10-12; browser QA pending) (M) — `components/kuizi-dites.tsx`, `app/globals.css`,
  `app/page.tsx`
  - Replace `<ReagimiDites>` with `<KuiziDites>` in the same SectionBoundary (relabelled).
    One question per step, locked answer, feedback with an icon plus text, explain line,
    "Lexo lajmin", end card, `localStorage` resume (`383:kuiz:<date>`), shared streak via
    `advanceStreak`. radiogroup semantics, aria-live feedback, 44 px targets,
    reduced-motion, fixed stage height.
  - AC: completable by keyboard only; reload mid-quiz resumes; the end card persists after
    reload; no hydration warnings; no CLS between questions.
  - Verify: Playwright at 1440/390/320 + reduced motion.
  - Deps: 4.

- [x] **6. Live split after each answer** (built; browser QA pending) (S) — `components/kuizi-dites.tsx`
  - Each tap calls `kuizi_answer` and renders that question's split (bars,
    `splitPercents`, `splitVerdict`, the count beside it, shown from 5 answers); "Dje: x/5" line for returning players; GA events `kuiz_start`,
    `kuiz_answer`, `kuiz_complete`, `kuiz_read_click`.
  - AC: a failed submit still shows the local score; a second device play is counted once
    per voter id.
  - Deps: 3, 5.

### Checkpoint B — homepage works end-to-end

- [ ] Tests, tsc, build clean. Today's quiz plays and submits against prod in local dev.
  Reagimi no longer renders. Lind reviews on mobile.

## Phase 3 — Habit and reach

- [x] **7. Daily schedule** (heartbeat job, in-memory guards: from 06:00, 4 tries/day, 30 min apart) (S) — `lib/tregu-automation-server.ts`
  - Add `runKuiziDaily` to the heartbeat `Promise.allSettled` list; `beginRun` key
    `kuizi:<dateKey>`, only after 06:00 Kosovo time; skip if today is already published.
  - AC: exactly one generation per day; a failure leaves a run row with the error.
  - Verify: the next morning `kuizi_daily` has today's row; `supabase-envoy` logs show it.
  - Deps: 2, 3.

- [ ] **8. `/kuiz` page + share** (page + text share built; OG image card not yet) (M) — `app/kuiz/page.tsx`, `app/api/og/kuiz/[date]/route.tsx`
  - Full-width quiz plus a short archive of the last 7 days. `navigator.share` text with a
    clipboard fallback. OG card (date, score marks) via `lib/og-assets.ts`. Metadata for
    shared links. GA `kuiz_share`.
  - AC: a shared link opens the playable quiz; the OG card renders (satori: no `double`
    borders, flexShrink 0).
  - Deps: 5.

- [x] **9. Admin `/admin/kuiz`** (built) (M) — `app/admin/kuiz/{page.tsx,actions.ts}`,
  `AdminNav.tsx`
  - View today's and tomorrow's quiz; edit question/options/correct/explain; unpublish;
    regenerate. Auth like `/admin/poll` (`isAdminAuthed` + TOTP, checked inside each action).
  - AC: unpublish hides the card within one ISR window; an edit re-runs the validator.
  - Deps: 2, 3.

### Checkpoint C — ship

- [x] **10. 07:00 push line** (built, tested) (S) — `lib/perty-morning*.{mjs,ts}`
  - The morning push body mentions "kuizi i sotëm" only when today's quiz is published; the
    tap target stays /per-ty.
  - AC: test covers with and without a quiz; the push stays impersonal.
  - Deps: 4, 7.

- [x] **11. Delete Reagimi code** (done; DB tables kept) (M)
  - Remove `components/reagimi-dites.tsx`, `app/admin/reagimi/*`, `app/api/reagimi-daily`,
    `app/api/automation/reagimi/daily`, `scripts/reagimi-daily.mjs`,
    `lib/reagimi-education*`, `docs/reagimi-automation.md`, `.reagimi-*` CSS, the AdminNav
    link, and Reagimi-only exports and tests in `lib/reagimi-data.ts`. Keep the date and
    streak helpers. Also drop `/api/yt-search` if nothing else uses it.
  - AC: `grep -ri reagimi` hits only the kept helpers file name and migrations; tsc and
    build clean.
  - Deps: 5. **Precondition:** Lind has disabled the Codex educational-video job.

- [ ] Full QA pass. Ship via the `ship` skill (push to main → Railway → verify
  `/api/deployment-info`, all four fields).
- [ ] Day 14: read completions and next-day return from `kuizi_answers` against the goal
  and kill criterion in the plan.
