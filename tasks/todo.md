# Reagimi i Ditës v2 — daily-habit feature

Redesign-overhaul of the daily reaction module on the homepage.
Design read: daily editorial module, returning Albanian-language readers, existing
ink-and-orange language. Dials: VARIANCE 7 / MOTION 5 / DENSITY 5.

Motion is deliberately restrained: a returning reader sees this every day, which is the
"reduce motion" frequency band. Engagement comes from content and participation, not
from animation.

Editorial model chosen by Lind (2026-08-16): **hybrid with safe fallback**. Admin
curates when they want; uncurated days auto-pick from *today's* articles only and label
themselves honestly. The module can never show stale content again.

## Findings this replaces

- `app/page.tsx:56-60` picked "highest-scored non-hero article", with no date anchor at
  all. That is the `· 5d` in the shipped screenshot.
- `reagimi-dites.tsx:37` made the "reaction" a YouTube keyword search on the headline.
  No quote, no speaker, no editorial claim.
- `reagimi-dites.tsx:138,193` stamped `readingTime` ("2 min") on a video thumbnail.
- Consume-only: nothing to do, no result, no yesterday, no reason to return.
- Craft: nested interactives, ungated hover, non-GPU `boxShadow` animation, no
  `prefers-reduced-motion`, modal with no dialog semantics or focus management,
  letterboxed `hqdefault` thumbnail, no skeleton.

## Tasks

- [x] 1. `supabase/migrations/0041_reagimi_dites.sql` — `reagimi_daily` + `reagimi_reactions`, RLS, idempotent
- [x] 2. `lib/reagimi-data.ts` — types, reaction set, Albanian date format, streak logic, fallback selection (pure functions)
- [x] 3. `lib/reagimi-data.test.mjs` — 41 tests, registered in `npm test`
- [x] 4. `app/globals.css` — `.reagimi-*` interactive states (hover gated, `:active`, `:focus-visible`, reduced-motion)
- [x] 5. `components/reagimi-dites.tsx` — full rewrite
- [x] 6. `app/admin/reagimi/{page.tsx,actions.ts}` — curation surface mirroring `/admin/poll`
- [x] 7. `app/page.tsx` — date-anchored selection
- [x] 8. QA: `tsc` clean, 41/41 unit tests, `next build` clean
- [x] 9. QA: headless Chrome pass via playwright-core at 1440 / 390 / 320, all five states,
      reduced-motion, and the reacted state with mocked Supabase

## Defects found and fixed during QA

1. **Entrance stuck at `opacity: 0`.** Framer Motion cannot interpolate a
   `transform: "translateY(12px)"` string (it animates its own `x`/`y` components),
   so the card reserved height and rendered invisible. Replaced with a CSS keyframe
   entrance, which is also off the main thread. Framer Motion is now gone from this
   component entirely.
2. **Result bars never filled.** `.reagimi-fill` was a bare `<span>`, and transforms
   do not apply to non-replaced inline elements. `getComputedStyle` still reported
   `matrix(0.33, ...)`, so metrics looked correct while nothing rendered. Fixed with
   `display: block`.
3. **Desktop reaction buttons were 230px slabs** holding ~60px of stacked content.
   Switched to inline icon+label on desktop, stacked only on mobile.
4. **Bars unreadable at desktop width** (~1400px long, 33% vs 8% indistinguishable).
   Capped `.reagimi-results` at 620px and raised fill contrast.
5. **40px touch targets at 320px**, under the 44px minimum. Options now wrap to two
   centred rows below 360px (116px wide).
6. Added `max-width: 62ch` on the lead so the quote measure stays sane above 1600px.

## Deploy prerequisites

- Apply `supabase/migrations/0041_reagimi_dites.sql`.
- **`SUPABASE_SERVICE_ROLE_KEY` is not in `.env.local`.** RLS deliberately denies anon
  writes to `reagimi_daily`, so `/admin/reagimi` saves need it. Same requirement the
  Tregu admin already has. Until it is set, the admin page reports the missing key and
  the homepage silently uses the auto fallback.

## Follow-up: site-wide relative-timestamp hydration fix (approved 2026-08-16)

Found while QA-ing Reagimi, pre-existing and unrelated to it. React logged
"server rendered text didn't match the client" on roughly 1 load in 3. Captured diff
attributed it to `KryesoreFront` → `MostReadRail`: server `40m`, client `41m`.

The real severity is caching, not console noise. Every page rendering a relative
timestamp is ISR-cached (`revalidate` 3600 on home/category, 7200 on articles), so the
string baked into the server HTML can be **up to two hours stale**. React's mismatch
"error" was it correcting that. A naive `suppressHydrationWarning` would have frozen
the stale text permanently, which is worse than the bug.

Fix: `components/time-ago.tsx` — renders `<time dateTime>` with
`suppressHydrationWarning` plus a post-mount recompute. Suppression stops the warning
and the subtree discard; the recompute is what corrects the stale cached value. Both
halves are required.

Converted 15 render sites across 11 files. Notes:
- `robot-hero.tsx` was already correct (computes in `useEffect`); left untouched.
- Tregu screens have their own Albanian phrasing ("para 5 min"), so `TimeAgo` takes an
  optional `format` prop and they pass their local function. No copy changed anywhere.

Verified: 0/10 hydration errors (was ~1/3), 44 `<time>` elements rendering real labels,
0 empty, no horizontal overflow, no page errors.

## Second pass: watch-first (2026-08-17)

Lind pushed back before deploying: the module had to make people stop and watch the
clip, and it did not. Honest read of the first version, confirmed by measurement:

- The headline **answered** the question the clip existed to answer, so there was no
  reason to press play. Text closed the curiosity gap instead of opening it.
- The only call to action was "Lexo artikullin", pointing away from the video. The
  original "Shiko videon" had been dropped.
- Desktop text out-measured the video: lead 61,481px² vs clip 50,625px², with ~40% of
  the card sitting as dead black space.
- The reaction bar asked people to react before watching anything.

Changed:
- Video leads on desktop (`minmax(0,1.1fr) minmax(0,1fr)`). Clip is now 205,519px²,
  5.2x the lead area, and the dead zone is gone.
- `Shiko videon · 1:18` is a real primary button; "Lexo artikullin" demoted to a quiet
  secondary link. Duration reads as a promise, not a warning.
- Muted looping hover preview, mounted **only** on hover, and only when
  `(hover: hover) and (pointer: fine)` and reduced-motion is not set. Nothing loads on
  page view, so homepage LCP and mobile data are untouched. 220ms delay so a cursor
  crossing the card does not trigger it.
- Watching now feeds the reaction: after the dialog closes the prompt becomes
  "E pe. Si po reagon?" with one quiet background sweep (single run, not a loop).

Verified: video 5.2x text · preview absent on load, present on hover · 0/6 hydration
errors · reduced-motion suppresses the preview · watch button keyboard-focusable and
Enter opens the dialog · no horizontal overflow at 1440/390.

Still open (needs a schema change, deliberately not done pre-deploy): an admin-authored
`hook` column on `reagimi_daily` for a curiosity-gap line on curated days. On auto days
the lead is the article headline and cannot tease without editorial input.

## Third pass: theater mode (2026-08-17)

Requested: bigger video on click, darker ground so focus is wholly on the clip, only
the video and the reactions at first, then the rest pulling down once a vote is cast,
smoothly, and a mobile layout that is properly formatted.

Built:
- Backdrop `rgba(0,0,0,0.93)` + 6px blur; page behind is fully dimmed.
- Stage capped at `62vh` so the clip plus the reactions clear the fold on a laptop.
  When it clamps, the player letterboxes against the black stage so the seam is
  invisible.
- Panel shows only the prompt and the five reactions until a vote lands. The tally,
  count and yesterday's rail then unfold via `grid-template-rows: 0fr -> 1fr`, the one
  CSS-only way to transition to an unmeasured height. Verified 0px -> 220px.
- After voting the reveal is scrolled into view (waits out the 460ms unfold first).

### Two containing-block bugs found here

1. **The dialog was never fullscreen.** `.reagimi--enter` leaves a transform on the
   card, and any non-none transform makes that element the containing block for
   `position: fixed` descendants. The overlay was clipped to the card: page undimmed,
   reactions below the fold. **This predated the theater work** — earlier QA checked
   the dialog existed, not that it covered the viewport. Fixed by portalling the
   dialog to `document.body`, which is what a modal wants anyway.
2. **The mobile close button floated mid-screen.** Same root cause one level down:
   `.reagimi-dialog` runs a fill-mode animation, and the browser keeps resolving its
   transform as an identity matrix even with `to { transform: none }`, so it stays a
   containing block. Rather than fight that, mobile now top-aligns the dialog
   (`margin: 0 auto`), which puts the close button at the screen edge regardless.
   closeTop 230 -> 12 at 390, 320 and landscape.

Verified: build clean · 149/149 · 0/6 hydration · reduced-motion suppresses the preview
· focus enters the dialog, stays trapped across Tabs, and returns to the watch button
on close · body scroll locks and unlocks · reaction targets 68px at 390, 93px at 320.

Note: the 1px horizontal overflow at 320px is pre-existing page chrome (`float-blob`,
`side-panel`) and reproduces with the dialog closed. Not from this module.

## Known pre-existing, unrelated

`npm test` has 7 failures in the F1/Tregu suites. Verified identical at clean HEAD with
my changes stashed; nothing I touched is referenced by those tests.

## Not doing

- Not another poll. `DailyPoll` sits directly below and is already a binary Po/Jo vote.
  This differentiates by being an *expressive reaction to a specific thing*, not an
  answer to a question.
- No emoji. Project already depends on lucide-react; staying on one icon family.
