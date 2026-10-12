# Implementation Plan: "Kuizi i ditës" — replaces Reagimi i Ditës

Written 2026-10-12. Task checklist: `tasks/kuizi-dites-todo.md`.
Base: **origin/main** (cac7382a or later). The `home-redesign` checkout is 390 commits
behind main and carries unrelated uncommitted work. Build in a separate worktree.

## Goal

Swap a homepage module that people ignore for one they use every day. The test is behavior,
not looks:

- **Baseline (production, read 2026-10-12):** Reagimi has 13 reactions from 11 voters since
  launch. The last 21 days have 1 reaction. 7 curated days, 2026-10-01..10-12, from the
  educational-video job.
- **Target after 14 days live:** at least 50 completed quizzes per day and at least 20% of
  one day's players playing again the next day. Count both server-side from `kuizi_answers`,
  not from GA, which is consent-gated and undercounts.
- **Kill criterion:** under 10 completions per day after 14 days means remove the module and
  give the slot to Për ty. Don't run a fourth redesign.

## The product

A 60-second quiz on the last 24 hours of 383 news, published at 06:30 Kosovo time, ahead of
the 07:00 Për ty push.

1. Card header: **Kuizi i ditës** · 5 pyetje · date · "60 sekonda" · streak chip.
2. One question at a time with 3–4 options. A tap locks the answer. Feedback is instant
   (right or wrong, never color alone), followed by a **"Çfarë do të thotë"** line (one
   sentence of consequence or context from the story) and a quiet **"Lexo lajmin"** link.
   A wrong answer still teaches the news, so finishing means you're caught up.
3. End card: score x/5, a row of five marks, the shared streak, and real stats from other
   readers: "62% e lexuesve e qëlluan pyetjen 3", "Mesatarja sot: 3.2". Stats appear only
   once N ≥ 30 players.
4. **Ndaje**: `navigator.share` text such as `Kuizi i ditës · 12 tetor · 4/5 ■■■□■
   383ks.com/kuiz`, plus an OG card. The link opens `/kuiz`, the quiz itself, not the
   homepage.
5. Playing again on the same device shows the end card straight away (answers kept in
   `localStorage`). A reader who comes back the next day sees "Dje: 3/5" above the new quiz.

## Architecture decisions

- **Auto-publish when the validator passes** (Lind, 2026-10-12). Curation never kept up.
  The admin can edit or unpublish but isn't required to.
- **Video is gone** (Lind, 2026-10-12). No `/api/yt-search`, no theater dialog, no YouTube
  embed. Text plus the stories' existing `imageUrl`.
- **Strict validator.** The generator asks for 7 candidates. A question survives only if:
  - its `slug` is in the article set it was given
  - every digit or number in the question or options appears in that article's
    title/excerpt/body
  - the options are distinct, contain no hedges ("Nuk e di", "Të gjitha"), and have exactly
    one correct index
  - the story isn't in an excluded tone or keyword set: deaths, killings, accidents, abuse.
    Tragedy doesn't belong in a trivia game.

  It then picks 5 with distinct slugs and at least 2 Kosovo-local stories, reusing
  `selectDraftArticles`/`isLocalArticle` from `lib/sondazhi-draft.mjs`. Fewer than 5
  survivors means nothing is published, and the card says so plainly. It never shows filler.
- **Server-side scoring and aggregation.** Answers go through the SECURITY DEFINER RPC
  `kuizi_submit(date, voter, answers[])`, which computes the score from the stored key. Stats
  come from the RPC `kuizi_day(date, voter)`. The tables have no anon select or insert
  policies. This avoids Reagimi's 1,000-row count cap and its public `voter_id` exposure,
  following the `poll_votes` + `sondazhi_day` pattern from 0042/0043.
- **Scheduler: the heartbeat, not GitHub Actions or Codex.** The job is added to the
  `Promise.allSettled` list in `runLiveSportsAutomation`, guarded by `beginRun` with
  `run_key = kuizi:<dateKey>`, and only after 06:00 Kosovo time. This is the only trigger
  known to fire reliably (see the tregu-heartbeat note). There's also a manual
  `POST /api/automation/kuizi/draft` behind `automationDenied`, plus a `GET ?dry=1` that
  returns a quiz without writing it, for review.
- **LLM:** `llmJSON(..., { prefer: "groq" })`. The Gemini free quota is already used up by
  `tregu-daily-drafts`, and `llmJSON` falls back on its own.
- **Missing day:** if today has no quiz, show the latest quiz ≤ 48 h old, clearly labelled
  with its own date ("Kuizi i djeshëm"). Otherwise hide the section. Never present old
  content as today's (the lesson from Reagimi v2's `· 5d`).
- **Reagimi code is deleted** (Task 11). Its tables stay. See Decisions.
- **Answer key is public** (it's in the published JSON and the ISR HTML). Accepted: it's a
  casual quiz, and cheating only skews the stats.

## Data model — `supabase/migrations/0106_kuizi_dites.sql`

Re-check the number with `git ls-tree origin/main supabase/migrations/` before writing.
Parallel sessions take numbers.

```
kuizi_daily   kuiz_date text PK (YYYY-MM-DD check) · questions jsonb · status text
              ('published'|'draft'|'rejected') · source ('auto'|'admin') · model text
              · created_at · updated_at
              RLS on; public SELECT where status = 'published'; no write policies.
kuizi_answers kuiz_date · voter_id · q_index 0-4 · choice 0-3 · PK (date, voter, q)
              RLS on; no policies (RPC only).
kuizi_answer(p_date, p_voter, p_q, p_choice) SECURITY DEFINER: saves the first answer
              (repeats ignored), only today/yesterday Kosovo time → kuizi_day state.
kuizi_day(p_date, p_voter) SECURITY DEFINER → { players, counts[5][4], mine[5] }.
```

Question JSON: `{ q ≤140 ends "?", options[3..4] ≤60, correct, explain ≤200, slug, category }`.

## Files

New: `lib/kuizi-data.mjs` (+test), `lib/kuizi-draft.mjs` (+test), `lib/kuizi-server.ts`,
`app/api/automation/kuizi/draft/route.ts`, `components/kuizi-dites.tsx`,
`app/kuiz/page.tsx`, `app/api/og/kuiz/[date]/route.tsx`, `app/admin/kuiz/{page,actions}.ts(x)`.
Touched: `app/page.tsx` (swap the module), `app/globals.css` (`.kuiz-*`),
`lib/tregu-automation-server.ts` (one job), `app/admin/_components/AdminNav.tsx` (one link).

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LLM writes a wrong "correct" answer in Albanian | High: a news site teaching false facts | Number/slug grounding validator; dry-run review of 3 real days at Checkpoint A before any UI; admin unpublish; low temperature (0.3) |
| Newsroom supply is skewed (Botë 149 / Kosovo 91 / Ekonomi 1 per week) | Med: an all-world quiz | `localSlots` reservation, at least 2 local; publish nothing rather than pad |
| Tragedy turned into trivia | High (tone) | Tone/keyword exclusion in the validator plus a prompt rule; test fixtures cover it |
| Heartbeat run blocked by a slow LLM call (llm.ts has no timeout) | Med | Wrap the job in `AbortSignal.timeout(45s)`; `beginRun` keeps it once per day; a failure leaves yesterday's quiz labelled honestly |
| Placement: the slot is under "Më shumë nga 383", low on the page. Reagimi may have failed partly because nobody scrolls there | High for the goal | Open question below; `/kuiz` deep link + share + the 07:00 push line give it traffic that doesn't rely on scrolling |
| Card height jumps between questions (CLS) | Low | Fixed min-height on the question stage; explain line reserved |
| Codex educational-video job keeps writing `reagimi_daily` | Done | Lind switched it off 2026-10-12 |
| Gemini down and Groq can't take the prompt (413 "request too large" on the free tier for gpt-oss; other Groq models 404) | Med: no quiz that day | Seen locally 2026-10-12 when the Gemini quota ran out. Prod has its own keys and needs 2–3 calls/day. The card falls back to yesterday's quiz labelled with its date. Fix if it recurs: a smaller Groq prompt (fewer articles, shorter bodies) |
| Prod DB reads/dry-runs need Lind's go-ahead (the classifier blocked a prod read this session) | Process | Ask before the BEGIN…ROLLBACK dry run and before applying |

## Decisions (Lind, 2026-10-12)

1. **Placement:** keep the current slot (SectionBoundary under "Më shumë nga 383"). No teaser.
2. **Name:** "Kuizi i ditës".
3. **07:00 push:** add "kuizi i sotëm" to the Për ty morning push in v1 (Task 10).
4. **Reagimi:** delete the code (Task 11). The DB tables `reagimi_daily` /
   `reagimi_reactions` stay; dropping them needs a separate yes. The shared date and streak
   helpers in `lib/reagimi-data.ts` stay in that file (10+ importers; renaming it would be a
   relocation). Only the Reagimi-only exports are removed.
5. **No Dardani** in the quiz.
6. **Trickier, debate-first questions with a live split after every answer**
   (2026-10-12): each tap is saved immediately and the card shows how the room split on
   that question ("Shumica gaboi", "Vetëm 12% e qëlluan"). Questions stay right/wrong.
   The Sondazhi poll card stays as it is.
7. **Migration approved and applied** (2026-10-12): `0106_kuizi_dites.sql`
   (`kuizi_daily`, `kuizi_answers`, `kuizi_day()`, `kuizi_answer()`), after a
   BEGIN…ROLLBACK run on prod that exercised RLS, repeat answers and bad input.
8. Lind switched off the Codex Reagimi educational-video job (2026-10-12).

## Generation pipeline (as built)

Pool: last 24 h, tragedy/fire excluded, 24 articles with up to 18 local. The generator
(Gemini first, then Groq) writes 16 candidates, each with a `trap`, `difficulty` and
`explain`. The validator checks grounding, numbers, negation (NUK only) and hedges. A
judge call in a fresh context scores each survivor 1–5 against the debate test and drops
≤2. Then the top 5 are picked, at least 2 local, ordered easiest first, with options
shuffled. Fewer than 5 survivors means no quiz that day.
